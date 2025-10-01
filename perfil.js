// =====================================================================
// PERFIL.JS (VERSÃO FINAL - SLUG AUTOMÁTICO E VERIFICAÇÃO CORRETA)
// ====================================================================

import {
    getFirestore, doc, getDoc, setDoc, addDoc, collection, serverTimestamp, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";

// Funções auxiliares para o slug (sem alterações )
function criarSlug(texto) {
    if (!texto) return '';
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')
    return texto.toString().toLowerCase()
        .replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c)))
        .replace(/&/g, '-e-').replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// ✅ CORREÇÃO: A função agora aceita o ID da empresa atual para ignorá-la na busca
async function garantirSlugUnico(slugBase, idEmpresaAtual = null) {
    let slugFinal = slugBase;
    let contador = 1;
    let slugExiste = true;

    while (slugExiste) {
        const q = query(collection(db, "empresarios"), where("slug", "==", slugFinal));
        const snapshot = await getDocs(q);
        
        // Se não encontrou nenhum documento, o slug está livre.
        if (snapshot.empty) {
            slugExiste = false;
        } else {
            // Se encontrou, verifica se o único documento encontrado é o da própria empresa que estamos editando.
            const docUnico = snapshot.docs.length === 1 ? snapshot.docs[0] : null;
            if (docUnico && docUnico.id === idEmpresaAtual) {
                slugExiste = false; // É o slug da própria empresa, então está OK.
            } else {
                // O slug pertence a outra empresa, então precisamos de um novo.
                contador++;
                slugFinal = `${slugBase}-${contador}`;
            }
        }
    }
    return slugFinal;
}


window.addEventListener('DOMContentLoaded', () => {
    const elements = {
        h1Titulo: document.getElementById('main-title'),
        form: document.getElementById('form-perfil'),
        nomeNegocioInput: document.getElementById('nomeNegocio'),
        slugInput: document.getElementById('slug'),
        descricaoInput: document.getElementById('descricao'),
        localizacaoInput: document.getElementById('localizacao'),
        horarioFuncionamentoInput: document.getElementById('horarioFuncionamento'),
        chavePixInput: document.getElementById('chavePix'),
        logoInput: document.getElementById('logoNegocio'),
        logoPreview: document.getElementById('logo-preview'),
        btnUploadLogo: document.getElementById('btn-upload-logo'),
        btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
        btnCopiarLink: document.getElementById('btn-copiar-link'),
        containerLinkVitrine: document.getElementById('container-link-vitrine'),
        urlVitrineEl: document.getElementById('url-vitrine-display'),
        btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
        btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
        btnLogout: document.getElementById('btn-logout'),
        msgCadastroSucesso: document.getElementById('mensagem-cadastro-sucesso'),
        btnCriarNovaEmpresa: document.getElementById('btn-criar-nova-empresa'),
        empresaSelectorGroup: document.getElementById('empresa-selector-group'),
        selectEmpresa: document.getElementById('selectEmpresa')
    };

    let empresaId = null;
    let currentUser;
    let empresasDoDono = [];

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await carregarEmpresasDoUsuario(user.uid);
            adicionarListenersDeEvento();
        } else {
            window.location.href = 'login.html';
        }
    });

    async function carregarEmpresasDoUsuario(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        empresasDoDono = snapshot.docs.map(doc => ({
            id: doc.id,
            nome: doc.data().nomeFantasia || doc.id,
            dados: doc.data()
        }));

        if (elements.empresaSelectorGroup && elements.selectEmpresa) {
            if (empresasDoDono.length >= 1) {
                elements.empresaSelectorGroup.style.display = 'block';
                elements.selectEmpresa.innerHTML = '';
                empresasDoDono.forEach(empresa => {
                    const opt = document.createElement('option');
                    opt.value = empresa.id;
                    opt.textContent = empresa.nome;
                    elements.selectEmpresa.appendChild(opt);
                });
                
                const primeiraEmpresa = empresasDoDono[0];
                empresaId = primeiraEmpresa.id;
                elements.selectEmpresa.value = empresaId;
                preencherFormulario(primeiraEmpresa.dados);
                mostrarCamposExtras();

                elements.selectEmpresa.onchange = function() {
                    empresaId = this.value;
                    const empresaSel = empresasDoDono.find(e => e.id === empresaId);
                    preencherFormulario(empresaSel.dados);
                    mostrarCamposExtras();
                };
            } else {
                empresaId = null;
                atualizarTelaParaNovoPerfil();
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        elements.btnSalvar.disabled = true;
        elements.btnSalvar.textContent = 'A salvar...';
        try {
            const uid = currentUser?.uid;
            if (!uid) throw new Error("Utilizador não autenticado.");
            const nomeNegocio = elements.nomeNegocioInput.value.trim();
            if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");
            
            // =================== CORREÇÃO: CAMPOS NOVOS NO FIREBASE ===================
            // Aqui garantimos que os campos trialDisponivel e trialMotivoBloqueio existam no documento Firebase.
            // Eles NÃO aparecem na tela, mas são sempre criados/atualizados no Firestore.
            // Se o documento já tem, mantem. Se não tem, cria com valor padrão.
            let trialDisponivel = true;
            let trialMotivoBloqueio = "";

            if (empresaId) {
                const empresaDocRef = doc(db, "empresarios", empresaId);
                const empresaSnap = await getDoc(empresaDocRef);
                const empresaData = empresaSnap.exists() ? empresaSnap.data() : {};
                if (typeof empresaData.trialDisponivel !== "undefined") {
                    trialDisponivel = empresaData.trialDisponivel;
                }
                if (typeof empresaData.trialMotivoBloqueio !== "undefined") {
                    trialMotivoBloqueio = empresaData.trialMotivoBloqueio;
                }
            }

            const dadosEmpresa = {
                nomeFantasia: nomeNegocio,
                descricao: elements.descricaoInput.value.trim(),
                localizacao: elements.localizacaoInput.value.trim(),
                horarioFuncionamento: elements.horarioFuncionamentoInput.value.trim(),
                chavePix: elements.chavePixInput.value.trim(),
                donoId: uid,
                plano: "free",
                status: "ativo",
                updatedAt: serverTimestamp(),
                // Não aparece na tela, mas sempre salva/atualiza:
                trialDisponivel: trialDisponivel,
                trialMotivoBloqueio: trialMotivoBloqueio
            };

            const valorSlugInput = elements.slugInput.value.trim();
            const textoParaSlug = valorSlugInput || nomeNegocio;
            const slugBase = criarSlug(textoParaSlug);

            if (slugBase) {
                // A lógica de garantir unicidade agora recebe o ID da empresa atual
                const slugFinal = await garantirSlugUnico(slugBase, empresaId);
                dadosEmpresa.slug = slugFinal;
            }

            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const storagePath = `logos/${uid}/${Date.now()}-${logoFile.name}`;
                const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
                dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
            }

            if (!empresaId) {
                // Lógica de criar nova empresa (sem alterações)
                const userRef = doc(db, "usuarios", uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        nome: currentUser.displayName || currentUser.email,
                        email: currentUser.email,
                        trialStart: serverTimestamp(),
                        isPremium: false
                    });
                }
                dadosEmpresa.createdAt = serverTimestamp();
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                const novoEmpresaId = novaEmpresaRef.id;
                const mapaRef = doc(db, "mapaUsuarios", uid);
                const mapaSnap = await getDoc(mapaRef);
                let empresasAtuais = [];
                if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
                    empresasAtuais = mapaSnap.data().empresas;
                }
                if (!empresasAtuais.includes(novoEmpresaId)) {
                    empresasAtuais.push(novoEmpresaId);
                }
                await setDoc(mapaRef, { empresas: empresasAtuais }, { merge: true });
                await setDoc(doc(db, "empresarios", novoEmpresaId, "profissionais", uid), {
                    uid: uid, nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "", ehDono: true,
                    criadoEm: serverTimestamp(), status: "ativo"
                });
                if (elements.msgCadastroSucesso) {
                    elements.msgCadastroSucesso.innerHTML = `...`;
                    elements.msgCadastroSucesso.style.display = "block";
                }
                setTimeout(async () => {
                    await signOut(auth);
                    window.location.href = 'login.html';
                }, 4000);
                return;

            } else {
                // Lógica de editar empresa existente (sem alterações)
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                alert("Perfil atualizado com sucesso!");
                await carregarEmpresasDoUsuario(uid);
            }
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Ocorreu um erro ao salvar: " + error.message);
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = 'Salvar Todas as Configurações';
        }
    }

    function handleCriarNovaEmpresa() {
        empresaId = null;
        if (elements.form) elements.form.reset();
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Novo Negócio";
        if (elements.empresaSelectorGroup) elements.empresaSelectorGroup.style.display = 'none';
    }
    
    function adicionarListenersDeEvento() {
        if (elements.form) elements.form.addEventListener('submit', handleFormSubmit);
        
        // ✅ CORREÇÃO: Listener para atualizar o slug em tempo real
        if (elements.nomeNegocioInput && elements.slugInput) {
            elements.nomeNegocioInput.addEventListener('input', () => {
                // Só atualiza o campo de slug se ele estiver vazio (o usuário não digitou nada manualmente)
                if (elements.slugInput.value.trim() === '') {
                    elements.slugInput.value = criarSlug(elements.nomeNegocioInput.value);
                }
            });
        }

        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
        if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput.click());
        if (elements.logoInput) elements.logoInput.addEventListener('change', () => {
            const file = elements.logoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { if (elements.logoPreview) elements.logoPreview.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        });
        if (elements.btnCriarNovaEmpresa) {
            elements.btnCriarNovaEmpresa.addEventListener('click', handleCriarNovaEmpresa);
        }
        if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
            try {
                localStorage.removeItem('empresaAtivaId');
                await signOut(auth);
                window.location.href = 'login.html';
            }
            catch (error) { console.error("Erro no logout:", error); }
        });
    }

    function atualizarTelaParaNovoPerfil() {
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Negócio";
        if (elements.form) elements.form.reset();
        empresaId = null;
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
        if (elements.btnCriarNovaEmpresa) elements.btnCriarNovaEmpresa.style.display = 'inline-flex';
        if (elements.empresaSelectorGroup) elements.empresaSelectorGroup.style.display = 'none';
    }

    function mostrarCamposExtras() {
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el) el.style.display = ''; });
        if (elements.btnCriarNovaEmpresa) elements.btnCriarNovaEmpresa.style.display = 'inline-flex';
    }

    function preencherFormulario(dadosEmpresa) {
        if (!dadosEmpresa) return;
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Edite o Perfil do seu Negócio";
        if (elements.nomeNegocioInput) elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
        if (elements.slugInput) elements.slugInput.value = dadosEmpresa.slug || '';
        if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
        if (elements.localizacaoInput) elements.localizacaoInput.value = dadosEmpresa.localizacao || '';
        if (elements.horarioFuncionamentoInput) elements.horarioFuncionamentoInput.value = dadosEmpresa.horarioFuncionamento || '';
        if (elements.chavePixInput) elements.chavePixInput.value = dadosEmpresa.chavePix || '';
        if (elements.logoPreview) {
            elements.logoPreview.src = dadosEmpresa.logoUrl || "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        }
        if (!empresaId) return;
        
        // ✅ CÓDIGO RESTAURADO PARA O ORIGINAL
        // Gera o link da vitrine sem parâmetros extras.
        const slug = dadosEmpresa.slug;
        const urlCompleta = slug 
            ? `${window.location.origin}/r.html?c=${slug}`
            : `${window.location.origin}/vitrine.html?empresa=${empresaId}`;

        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
    }

    function copiarLink() {
        // ✅ CÓDIGO RESTAURADO PARA O ORIGINAL
        // Copia o link que está sendo exibido na tela.
        const urlCompleta = document.getElementById('url-vitrine-display').textContent;
        if (!urlCompleta) return;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }
});
