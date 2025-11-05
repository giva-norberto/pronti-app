// =====================================================================
// PERFIL.JS (VERSÃO FINAL - SLUG AUTOMÁTICO + MANIFEST DINÂMICO PWA)
// =====================================================================

import {
    getFirestore, doc, getDoc, setDoc, addDoc, collection, serverTimestamp, Timestamp, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";

// Funções auxiliares para o slug (sem alterações)
function criarSlug(texto) {
    if (!texto) return '';
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;';
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------';
    const p = new RegExp(a.split('').join('|'), 'g');
    return texto.toString().toLowerCase()
        .replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c)))
        .replace(/&/g, '-e-').replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// Função slug única (sem alterações)
async function garantirSlugUnico(slugBase, idEmpresaAtual = null) {
    let slugFinal = slugBase;
    let contador = 1;
    let slugExiste = true;
    while (slugExiste) {
        const q = query(collection(db, "empresarios"), where("slug", "==", slugFinal));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            slugExiste = false;
        } else {
            const docUnico = snapshot.docs.length === 1 ? snapshot.docs[0] : null;
            if (docUnico && docUnico.id === idEmpresaAtual) {
                slugExiste = false;
            } else {
                contador++;
                slugFinal = `${slugBase}-${contador}`;
            }
        }
    }
    return slugFinal;
}

window.addEventListener('DOMContentLoaded', () => {
    // ✅ Detecta se veio de "Criar Nova Empresa" e força modo criação
    // Inserido para garantir que perfil abra em tela limpa quando acessado via ?new=1
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('new')) {
            try {
                localStorage.removeItem('empresaAtivaId');
                localStorage.setItem('empresaModo', 'criar');
                sessionStorage.removeItem('empresaEdicao');
                sessionStorage.removeItem('empresaFormData');
                console.log("🔄 Entrando em modo criação de nova empresa (parâmetro ?new=1 detectado).");
            } catch (err) {
                console.warn("Falha ao preparar modo criação:", err);
            }
        }
    } catch (err) {
        console.warn("Não foi possível interpretar query params no perfil:", err);
    }

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
                chavePix: elements.chavePixInput.value.trim() || "",
                emailDeNotificacao: currentUser.email,
                donoId: uid,
                plano: "free",
                status: "ativo",
                updatedAt: serverTimestamp(),
                trialDisponivel: trialDisponivel,
                trialMotivoBloqueio: trialMotivoBloqueio
            };

            const valorSlugInput = elements.slugInput.value.trim();
            const textoParaSlug = valorSlugInput || nomeNegocio;
            const slugBase = criarSlug(textoParaSlug);

            if (slugBase) {
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
                // garante doc de usuário (sem sobrescrever demais campos)
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

                // ==================================================
                // ✅ ALTERAÇÃO: Cria TODOS os campos relevantes da empresa de uma vez
                // - Padroniza nomes/tipos: trialStart/trialEndDate como Timestamp,
                //   assinaturaAtiva (false), assinaturaValidaAte (null), proximoPagamento (null)
                // - freeEmDias configurado, createdAt como serverTimestamp()
                // ==================================================
                const agora = new Date();
                const trialStartTs = Timestamp.fromDate(agora);
                // Para totalizar 15 dias incluindo o dia inicial, somamos 14 dias e colocamos fim do dia
                const fimTrial = new Date(agora);
                fimTrial.setDate(fimTrial.getDate() + 14);
                fimTrial.setHours(23, 59, 59, 999);
                const trialEndTs = Timestamp.fromDate(fimTrial);

                // Campos padrão/completos para nova empresa
                const camposPadrao = {
                    // trial
                    trialStart: trialStartTs,
                    trialEndDate: trialEndTs,
                    freeEmDias: 15,
                    trialDisponivel: true,
                    trialMotivoBloqueio: trialMotivoBloqueio || "",
                    // assinatura (vazia inicialmente)
                    assinaturaAtiva: false,
                    assinaturaValidaAte: null,
                    proximoPagamento: null,
                    // plano e estado
                    plano: "free",
                    status: "ativo",
                    // pagamentos pendentes / flags
                    pagamentoPendente: null,
                    // metadados
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    // defaults
                    chavePix: dadosEmpresa.chavePix || "",
                    logoUrl: dadosEmpresa.logoUrl || "",
                    emailDeNotificacao: dadosEmpresa.emailDeNotificacao || currentUser.email || ""
                };

                Object.assign(dadosEmpresa, camposPadrao);
                // ==================================================

                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                const novoEmpresaId = novaEmpresaRef.id;

                // atualiza mapaUsuarios (merge)
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

                // cria documento de profissional dono
                await setDoc(doc(db, "empresarios", novoEmpresaId, "profissionais", uid), {
                    uid: uid,
                    nome: currentUser.displayName || nomeNegocio,
                    fotoUrl: currentUser.photoURL || "",
                    ehDono: true,
                    criadoEm: serverTimestamp(),
                    status: "ativo"
                });

                if (elements.msgCadastroSucesso) {
                    elements.msgCadastroSucesso.innerHTML = `Perfil criado com sucesso!`;
                    elements.msgCadastroSucesso.style.display = "block";
                }

                // Recarrega lista de empresas do usuário (sem forçar logout)
                await carregarEmpresasDoUsuario(uid);

                setTimeout(() => {
                    if (elements.msgCadastroSucesso) {
                        elements.msgCadastroSucesso.style.display = "none";
                    }
                }, 4000);
            } else {
                // edição: merge para não sobrescrever campos que não foram informados no formulário
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                if (elements.msgCadastroSucesso) {
                    elements.msgCadastroSucesso.innerHTML = `Perfil atualizado com sucesso!`;
                    elements.msgCadastroSucesso.style.display = "block";
                }
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
        if (elements.nomeNegocioInput && elements.slugInput) {
            elements.nomeNegocioInput.addEventListener('input', () => {
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
        if (elements.btnCriarNovaEmpresa) elements.btnCriarNovaEmpresa.addEventListener('click', handleCriarNovaEmpresa);
        if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
            try {
                localStorage.removeItem('empresaAtivaId');
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) { console.error("Erro no logout:", error); }
        });
    }

    function atualizarTelaParaNovoPerfil() {
        if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie o Perfil do seu Negócio";
        if (elements.form) elements.form.reset();
        empresaId = null;
        if (elements.logoPreview) elements.logoPreview.src = "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        [elements.containerLinkVitrine, elements.btnAbrirVitrine, elements.btnAbrirVitrineInline].forEach(el => { if (el) el.style.display = 'none'; });
        if (elements.msgCadastroSucesso) elements.msgCadastroSucesso.style.display = 'none';
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
        if (elements.logoPreview) elements.logoPreview.src = dadosEmpresa.logoUrl || "https://placehold.co/80x80/eef2ff/4f46e5?text=Logo";
        if (!empresaId) return;

        const slug = dadosEmpresa.slug;
        const urlCompleta = slug
            ? `${window.location.origin}/r.html?c=${slug}`
            : `${window.location.origin}/vitrine.html?empresa=${empresaId}`;

        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.href = urlCompleta;
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;

        // ==========================================================
        // ✅ ADIÇÃO DO MANIFEST PWA DINÂMICO (CORRIGIDO PARA URLS VÁLIDAS)
        // ==========================================================
        const manifest = {
            name: dadosEmpresa.nomeFantasia || "Pronti Negócio",
            short_name: dadosEmpresa.nomeFantasia?.substring(0, 12) || "Negócio",
            start_url: "/",    // URL relativa válida
            scope: "/",        // URL relativa válida
            display: "standalone",
            background_color: "#4f46e5",
            theme_color: "#4f46e5",
            description: "Painel personalizado do negócio no Pronti",
            icons: []
        };
        if (dadosEmpresa.logoUrl) {
            manifest.icons.push(
                { src: dadosEmpresa.logoUrl, sizes: "192x192", type: "image/png" },
                { src: dadosEmpresa.logoUrl, sizes: "512x512", type: "image/png" }
            );
        }
        const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
        const manifestURL = URL.createObjectURL(manifestBlob);
        let linkManifest = document.querySelector('link[rel="manifest"]');
        if (!linkManifest) {
            linkManifest = document.createElement('link');
            linkManifest.rel = 'manifest';
            document.head.appendChild(linkManifest);
        }
        linkManifest.href = manifestURL;
    }

    function copiarLink() {
        const urlCompleta = document.getElementById('url-vitrine-display').textContent;
        if (!urlCompleta) return;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }
});
