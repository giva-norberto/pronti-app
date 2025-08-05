/**
 * perfil.js (VERSÃO FINAL, COMPLETA E CORRIGIDA)
 */

import { 
    getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, addDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { app } from "./firebase-config.js";

window.addEventListener('DOMContentLoaded', () => {
    const db = getFirestore(app);
    const auth = getAuth(app);
    const storage = getStorage(app);

    const elements = {
        h1Titulo: document.getElementById('main-title'),
        form: document.getElementById('form-perfil'),
        nomeNegocioInput: document.getElementById('nomeNegocio'),
        descricaoInput: document.getElementById('descricao'),
        logoInput: document.getElementById('logoNegocio'),
        logoPreview: document.getElementById('logo-preview'),
        btnUploadLogo: document.getElementById('btn-upload-logo'),
        btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
        btnCopiarLink: document.getElementById('btn-copiar-link'),
        containerLinkVitrine: document.getElementById('container-link-vitrine'),
        urlVitrineEl: document.getElementById('url-vitrine-display'),
        intervaloSelect: document.getElementById('intervalo-atendimento'),
        diasContainer: document.getElementById('dias-container'),
        btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
        btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
        linkVitrineMenu: document.querySelector('.sidebar-links a[href="vitrine.html"]'),
        btnLogout: document.getElementById('btn-logout'),
        listaProfissionaisPainel: document.getElementById('lista-profissionais-painel'),
        btnAddProfissional: document.getElementById('btn-add-profissional'),
        modalAddProfissional: document.getElementById('modal-add-profissional'),
        formAddProfissional: document.getElementById('form-add-profissional'),
        btnCancelarProfissional: document.getElementById('btn-cancelar-profissional')
    };

    const diasDaSemana = [
        { id: 'seg', nome: 'Segunda-feira' },
        { id: 'ter', nome: 'Terça-feira' },
        { id: 'qua', nome: 'Quarta-feira' },
        { id: 'qui', nome: 'Quinta-feira' },
        { id: 'sex', nome: 'Sexta-feira' },
        { id: 'sab', nome: 'Sábado' },
        { id: 'dom', nome: 'Domingo' }
    ];

    let currentUser;
    let empresaId = null;
    let unsubProfissionais = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            verificarEcarregarDados(user.uid);
            adicionarListenersDeEvento();
            gerarEstruturaDosDias();
        } else {
            window.location.href = 'login.html';
        }
    });

    async function verificarEcarregarDados(uid) {
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        const secaoEquipe = elements.btnAddProfissional?.closest('.form-section');

        if (snapshot.empty) {
            if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
            if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'none';
            if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'none';
            if (secaoEquipe) secaoEquipe.style.display = 'none';
            if (elements.linkVitrineMenu) {
                elements.linkVitrineMenu.classList.add('disabled');
                elements.linkVitrineMenu.style.pointerEvents = 'none';
                elements.linkVitrineMenu.style.opacity = '0.5';
                elements.linkVitrineMenu.href = '#';
            }
        } else {
            const empresaDoc = snapshot.docs[0];
            empresaId = empresaDoc.id;
            const dadosEmpresa = empresaDoc.data();

            const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
            const profissionalSnap = await getDoc(profissionalRef);

            let dadosProfissional = {};
            let ehDono = false;
            if (profissionalSnap.exists()) {
                dadosProfissional = profissionalSnap.data();
                ehDono = dadosProfissional.ehDono === true;
            }

            preencherFormulario(dadosEmpresa, dadosProfissional);

            if (ehDono) {
                if (secaoEquipe) secaoEquipe.style.display = 'block';
                iniciarListenerDeProfissionais(empresaId);
            } else {
                if (secaoEquipe) secaoEquipe.style.display = 'none';
            }
        }
    }

    function iniciarListenerDeProfissionais(idDaEmpresa) {
        if (!elements.listaProfissionaisPainel) return;
        if (unsubProfissionais) {
            unsubProfissionais();
        }

        const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");

        unsubProfissionais = onSnapshot(profissionaisRef, (snapshot) => {
            const profissionais = snapshot.docs.map(doc => doc.data());
            renderizarListaProfissionais(profissionais);
        });
    }

    function renderizarListaProfissionais(profissionais) {
        if (!elements.listaProfissionaisPainel) return;

        if (profissionais.length === 0) {
            elements.listaProfissionaisPainel.innerHTML = `<p>Nenhum profissional na equipe ainda.</p>`;
            return;
        }

        elements.listaProfissionaisPainel.innerHTML = profissionais.map(profissional => {
            return `<div class="profissional-card" style="border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px; background-color: white; margin-bottom: 8px;">
                        <img src="${profissional.fotoUrl || 'https://placehold.co/40x40/eef2ff/4f46e5?text=P'}" alt="Foto de ${profissional.nome}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        <span class="profissional-nome" style="font-weight: 500;">${profissional.nome}</span>
                    </div>`;
        }).join('');
    }

    function preencherFormulario(dadosEmpresa, dadosProfissional) {
        elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
        elements.descricaoInput.value = dadosEmpresa.descricao || '';
        if (dadosEmpresa.logoUrl) elements.logoPreview.src = dadosEmpresa.logoUrl;

        const horarios = dadosProfissional.horarios || {};
        elements.intervaloSelect.value = horarios.intervalo || '30';
        diasDaSemana.forEach(diaInfo => {
            const diaData = horarios[diaInfo.id];
            const toggleAtivo = document.getElementById(`${diaInfo.id}-ativo`);
            if (toggleAtivo) {
                toggleAtivo.checked = diaData ? diaData.ativo : false;
                const containerBlocos = document.getElementById(`blocos-${diaInfo.id}`);
                if (containerBlocos) {
                    containerBlocos.innerHTML = '';
                    if (diaData?.ativo && diaData.blocos?.length > 0) {
                        diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(diaInfo.id, bloco.inicio, bloco.fim));
                    } else if (diaData?.ativo) {
                        adicionarBlocoDeHorario(diaInfo.id);
                    }
                }
                toggleAtivo.dispatchEvent(new Event('change'));
            }
        });

        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
        if (elements.btnAbrirVitrine) {
            elements.btnAbrirVitrine.href = urlCompleta;
            elements.btnAbrirVitrine.style.display = 'inline-flex';
        }
        if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
        if (elements.linkVitrineMenu) {
            elements.linkVitrineMenu.href = urlCompleta;
            elements.linkVitrineMenu.classList.remove('disabled');
            elements.linkVitrineMenu.style.pointerEvents = 'auto';
            elements.linkVitrineMenu.style.opacity = '1';
        }
        if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'block';
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        elements.btnSalvar.disabled = true;
        elements.btnSalvar.textContent = 'Salvando...';
        try {
            const uid = currentUser.uid;
            const nomeNegocio = elements.nomeNegocioInput.value.trim();
            const descricao = elements.descricaoInput.value.trim();

            let logoUrl = elements.logoPreview.src || '';

            // Upload da logo se alterada
            if (elements.logoInput.files && elements.logoInput.files[0]) {
                logoUrl = await uploadLogo(uid, elements.logoInput.files[0]);
            }

            if (!empresaId) {
                // Cria nova empresa
                const novoDoc = await addDoc(collection(db, "empresarios"), {
                    donoId: uid,
                    nomeFantasia: nomeNegocio,
                    descricao,
                    logoUrl,
                    criadoEm: new Date()
                });
                empresaId = novoDoc.id;
            } else {
                // Atualiza empresa existente
                const empresaRef = doc(db, "empresarios", empresaId);
                await setDoc(empresaRef, {
                    donoId: uid,
                    nomeFantasia: nomeNegocio,
                    descricao,
                    logoUrl,
                    atualizadoEm: new Date()
                }, { merge: true });
            }

            // Atualiza o URL da vitrine e demais elementos
            const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
            if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
            if (elements.btnAbrirVitrine) {
                elements.btnAbrirVitrine.href = urlCompleta;
                elements.btnAbrirVitrine.style.display = 'inline-flex';
            }
            if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
            if (elements.linkVitrineMenu) {
                elements.linkVitrineMenu.href = urlCompleta;
                elements.linkVitrineMenu.classList.remove('disabled');
                elements.linkVitrineMenu.style.pointerEvents = 'auto';
                elements.linkVitrineMenu.style.opacity = '1';
            }
            if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'block';

            alert('Perfil salvo com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert('Erro ao salvar perfil. Tente novamente.');
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = 'Salvar';
        }
    }

    async function uploadLogo(uid, file) {
        const logoRef = ref(storage, `logos/${uid}/${file.name}`);
        await uploadBytes(logoRef, file);
        const url = await getDownloadURL(logoRef);
        if (elements.logoPreview) elements.logoPreview.src = url;
        return url;
    }

    function gerarEstruturaDosDias() {
        if (!elements.diasContainer) return;

        elements.diasContainer.innerHTML = diasDaSemana.map(dia => {
            return `
            <div class="dia-semana" data-dia="${dia.id}" style="margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 15px;">
                <label>
                    <input type="checkbox" id="${dia.id}-ativo" class="toggle-dia" />
                    <strong>${dia.nome}</strong>
                </label>
                <div id="blocos-${dia.id}" class="blocos-horarios" style="margin-top: 10px;"></div>
                <button type="button" class="btn-add-bloco" data-dia="${dia.id}" style="margin-top: 8px;">Adicionar Bloco</button>
            </div>
            `;
        }).join('');

        // Adiciona listeners para toggle e adicionar blocos
        diasDaSemana.forEach(dia => {
            const toggle = document.getElementById(`${dia.id}-ativo`);
            const btnAdd = elements.diasContainer.querySelector(`button.btn-add-bloco[data-dia="${dia.id}"]`);
            const blocosContainer = document.getElementById(`blocos-${dia.id}`);

            toggle.addEventListener('change', () => {
                if (toggle.checked) {
                    blocosContainer.style.display = 'block';
                    if (blocosContainer.children.length === 0) {
                        adicionarBlocoDeHorario(dia.id);
                    }
                } else {
                    blocosContainer.style.display = 'none';
                    blocosContainer.innerHTML = '';
                }
            });

            btnAdd.addEventListener('click', () => {
                adicionarBlocoDeHorario(dia.id);
            });
        });
    }

    function adicionarBlocoDeHorario(diaId, inicio = '', fim = '') {
        const blocosContainer = document.getElementById(`blocos-${diaId}`);
        if (!blocosContainer) return;

        const blocoEl = document.createElement('div');
        blocoEl.className = 'bloco-horario';
        blocoEl.style.display = 'flex';
        blocoEl.style.alignItems = 'center';
        blocoEl.style.gap = '8px';
        blocoEl.style.marginBottom = '6px';

        blocoEl.innerHTML = `
            <label>
                Início: <input type="time" class="input-inicio" value="${inicio}" required />
            </label>
            <label>
                Fim: <input type="time" class="input-fim" value="${fim}" required />
            </label>
            <button type="button" class="btn-remove-bloco" title="Remover bloco" style="background:#e53e3e;color:#fff;border:none;padding:0 8px;border-radius:4px;cursor:pointer;">×</button>
        `;

        blocoEl.querySelector('.btn-remove-bloco').addEventListener('click', () => {
            blocoEl.remove();
        });

        blocosContainer.appendChild(blocoEl);
    }

    elements.form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!empresaId) {
            alert('Ainda não foi possível identificar sua empresa. Tente recarregar a página.');
            return;
        }

        // Atualizar dados do perfil de negócio
        await handleFormSubmit(e);
    });

    elements.btnCopiarLink?.addEventListener('click', () => {
        const url = elements.urlVitrineEl?.textContent;
        if (url) {
            navigator.clipboard.writeText(url).then(() => {
                alert('Link copiado para a área de transferência!');
            }).catch(() => {
                alert('Erro ao copiar link.');
            });
        }
    });

    elements.btnLogout?.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        });
    });

    // --- Funções extras para validar e salvar horários do profissional ---

    async function salvarHorariosDoProfissional() {
        if (!empresaId) return;

        const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
        const profissionalDocRef = doc(profissionaisRef, currentUser.uid);

        // Monta o objeto horarios
        const horarios = {};
        horarios.intervalo = elements.intervaloSelect.value;

        diasDaSemana.forEach(dia => {
            const ativo = document.getElementById(`${dia.id}-ativo`)?.checked ?? false;
            const blocosContainer = document.getElementById(`blocos-${dia.id}`);
            let blocos = [];

            if (ativo && blocosContainer) {
                blocos = Array.from(blocosContainer.querySelectorAll('.bloco-horario')).map(blocoEl => {
                    const inicio = blocoEl.querySelector('input.input-inicio')?.value || '';
                    const fim = blocoEl.querySelector('input.input-fim')?.value || '';
                    return { inicio, fim };
                });
            }

            horarios[dia.id] = {
                ativo,
                blocos
            };
        });

        await setDoc(profissionalDocRef, { horarios }, { merge: true });
    }

    // Salva horários sempre que o formulário for submetido
    elements.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.btnSalvar.disabled = true;
        elements.btnSalvar.textContent = 'Salvando...';

        try {
            await handleFormSubmit(e);
            await salvarHorariosDoProfissional();
            alert('Perfil e horários salvos com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar dados. Tente novamente.');
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = 'Salvar';
        }
    });

    function adicionarListenersDeEvento() {
        // Pode adicionar outros listeners aqui no futuro
    }

});
