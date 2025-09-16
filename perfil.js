// ======================================================================
// PERFIL.JS (PASSO 1: ADICIONANDO O 'SLUG' DE FORMA SEGURA)
// ======================================================================

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

// Garante que os serviços do Firebase foram inicializados
if (!app || !db || !auth || !storage  ) {
    console.error("Firebase não foi inicializado corretamente. Verifique firebase-config.js");
    throw new Error("Firebase não inicializado.");
}

// ============================================================
//           ✅ INÍCIO DA NOVA LÓGICA (FUNÇÕES AUXILIARES)
// ============================================================

/**
 * Converte um texto em um formato amigável para URL (slug).
 * Ex: "Barbearia do João" -> "barbearia-do-joao"
 */
function criarSlug(texto) {
    if (!texto) return '';
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return texto.toString().toLowerCase()
        .replace(/\s+/g, '-') // Substitui espaços por -
        .replace(p, c => b.charAt(a.indexOf(c))) // Substitui caracteres especiais
        .replace(/&/g, '-e-') // Substitui & por 'e'
        .replace(/[^\w\-]+/g, '') // Remove todos os caracteres não-alfanuméricos exceto -
        .replace(/\-\-+/g, '-') // Substitui múltiplos - por um único -
        .replace(/^-+/, '') // Remove - do início do texto
        .replace(/-+$/, '') // Remove - do final do texto
}

/**
 * Verifica se um slug já existe no banco de dados e, se existir,
 * adiciona um número no final para torná-lo único.
 * A verificação ignora o documento da própria empresa que está sendo editada.
 */
async function garantirSlugUnico(slugBase, idEmpresaAtual = null) {
    let slugFinal = slugBase;
    let contador = 1;
    let slugExiste = true;

    while (slugExiste) {
        const q = query(collection(db, "empresarios"), where("slug", "==", slugFinal));
        const snapshot = await getDocs(q);
        
        // Verifica se o slug encontrado pertence à empresa que já estamos editando
        if (snapshot.empty || (snapshot.docs.length === 1 && snapshot.docs[0].id === idEmpresaAtual)) {
            slugExiste = false; // Encontrou um slug único ou é o slug da própria empresa
        } else {
            // O slug já existe e pertence a outra empresa, tenta o próximo número
            contador++;
            slugFinal = `${slugBase}-${contador}`;
        }
    }
    return slugFinal;
}

// ============================================================
//           ✅ FIM DA NOVA LÓGICA
// ============================================================


window.addEventListener('DOMContentLoaded', () => {
    // Mapeamento dos elementos do DOM
    const elements = {
        h1Titulo: document.getElementById('main-title'),
        form: document.getElementById('form-perfil'),
        nomeNegocioInput: document.getElementById('nomeNegocio'),
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
                freeEmDias: 15
            };

            // ============================================================
            //           ✅ INÍCIO DA ALTERAÇÃO: LÓGICA DO SLUG
            // ============================================================

            const slugBase = criarSlug(nomeNegocio);
            if (slugBase) { // Apenas executa se o nome do negócio não for vazio
                if (!empresaId) { // Criando nova empresa
                    dadosEmpresa.slug = await garantirSlugUnico(slugBase);
                } else { // Editando empresa existente
                    const empresaAtual = empresasDoDono.find(e => e.id === empresaId);
                    // Só gera um novo slug se o nome fantasia realmente mudou
                    if (empresaAtual && criarSlug(empresaAtual.dados.nomeFantasia) !== slugBase) {
                        dadosEmpresa.slug = await garantirSlugUnico(slugBase, empresaId);
                    }
                }
            }

            // ============================================================
            //           ✅ FIM DA ALTERAÇÃO
            // ============================================================

            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const storagePath = `logos/${uid}/${Date.now()}-${logoFile.name}`;
                const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
                dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
            }

            if (!empresaId) {
                // CRIANDO NOVA EMPRESA
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

                if (mapaSnap.exists()) {
                    const mapaData = mapaSnap.data();
                    if (mapaData.empresas && Array.isArray(mapaData.empresas)) {
                        empresasAtuais = mapaData.empresas;
                    } else if (mapaData.empresaId) {
                        empresasAtuais = [mapaData.empresaId];
                    }
                }
                
                if (!empresasAtuais.includes(novoEmpresaId)) {
                    empresasAtuais.push(novoEmpresaId);
                }

                await setDoc(mapaRef, { empresas: empresasAtuais }, { merge: true });
                
                await setDoc(doc(db, "empresarios", novoEmpresaId, "profissionais", uid), {
                    uid: uid,
                    nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "",
                    ehDono: true,
                    criadoEm: serverTimestamp(),
                    status: "ativo"
                });

                if (elements.msgCadastroSucesso) {
                    elements.msgCadastroSucesso.innerHTML = `
                        <div style="padding:12px 2px;">
                            <span style="font-size:1.14em;">
                                ✅ Seu negócio foi cadastrado com sucesso!  
                                <span style="color:#065f46;">Você ganhou <strong>15 dias grátis</strong>!</span>  
                                <span style="color:#22223b;">Por segurança, será necessário sair e fazer login novamente.  
                                Após logar, selecione sua empresa no menu.</span>
                            </span>
                        </div>
                    `;
                    elements.msgCadastroSucesso.style.display = "block";
                }
                setTimeout(async () => {
                    await signOut(auth);
                    window.location.href = 'login.html';
                }, 4000);
                return;

            } else {
                // EDITANDO EMPRESA EXISTENTE
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
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el  ) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = "none";
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Novo Negócio";
        if (elements.empresaSelectorGroup) elements.empresaSelectorGroup.style.display = 'none';
    }
    
    function adicionarListenersDeEvento() {
        if (elements.form) elements.form.addEventListener('submit', handleFormSubmit);
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
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el  ) el.style.display = 'none'; });
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
        if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
        if (elements.localizacaoInput) elements.localizacaoInput.value = dadosEmpresa.localizacao || '';
        if (elements.horarioFuncionamentoInput) elements.horarioFuncionamentoInput.value = dadosEmpresa.horarioFuncionamento || '';
        if (elements.chavePixInput) elements.chavePixInput.value = dadosEmpresa.chavePix || '';
        if (elements.logoPreview) {
            elements.logoPreview.src = dadosEmpresa.logoUrl || "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        }
        if (!empresaId  ) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
    }

    function copiarLink() {
        if (!empresaId) return;
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }
});
