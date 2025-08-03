/**
 * perfil.js (VERSÃO FINAL E CORRIGIDA COM DOMContentLoaded)
 */

import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

// A MÁGICA ACONTECE AQUI: GARANTE QUE O SCRIPT SÓ RODE APÓS O HTML ESTAR PRONTO
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
        { id: 'seg', nome: 'Segunda-feira' }, { id: 'ter', nome: 'Terça-feira' },
        { id: 'qua', nome: 'Quarta-feira' }, { id: 'qui', nome: 'Quinta-feira' },
        { id: 'sex', nome: 'Sexta-feira' }, { id: 'sab', nome: 'Sábado' },
        { id: 'dom', nome: 'Domingo' }
    ];

    let currentUser;
    let empresaId = null;

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
            const dadosProfissional = profissionalSnap.exists() ? profissionalSnap.data() : {};

            preencherFormulario(dadosEmpresa, dadosProfissional);
            if (secaoEquipe) secaoEquipe.style.display = 'block';
            renderizarListaProfissionais(empresaId);
        }
    }

    async function renderizarListaProfissionais(idDaEmpresa) {
        if (!elements.listaProfissionaisPainel) return;
        elements.listaProfissionaisPainel.innerHTML = `<p>Carregando equipe...</p>`;
        const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");
        const snapshot = await getDocs(profissionaisRef);

        if (snapshot.empty) {
            elements.listaProfissionaisPainel.innerHTML = `<p>Nenhum profissional na equipe ainda.</p>`;
            return;
        }
        elements.listaProfissionaisPainel.innerHTML = snapshot.docs.map(doc => {
            const profissional = doc.data();
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
        diasDaSemana.forEach(dia => {
            const diaData = horarios[dia.id];
            const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
            if (toggleAtivo) {
                toggleAtivo.checked = diaData ? diaData.ativo : false;
                const containerBlocos = document.getElementById(`blocos-${dia.id}`);
                if (containerBlocos) {
                    containerBlocos.innerHTML = '';
                    if (diaData?.ativo && diaData.blocos?.length > 0) {
                        diaData.blocos.forEach(bloco => adicionarBlocoDeHorario(dia.id, bloco.inicio, bloco.fim));
                    } else if (diaData?.ativo) {
                        adicionarBlocoDeHorario(dia.id);
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
            if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

            const dadosEmpresa = { nomeFantasia: nomeNegocio, descricao: elements.descricaoInput.value.trim(), donoId: uid };
            const dadosProfissional = { nome: currentUser.displayName || nomeNegocio, fotoUrl: currentUser.photoURL || '', horarios: coletarDadosDeHorarios() };

            const logoFile = elements.logoInput.files[0];
            if (logoFile) {
                const storageRef = ref(storage, `logos/${uid}/logo`);
                const uploadResult = await uploadBytes(storageRef, logoFile);
                dadosEmpresa.logoUrl = await getDownloadURL(uploadResult.ref);
            } else if (empresaId) {
                const empresaAtualSnap = await getDoc(doc(db, "empresarios", empresaId));
                if (empresaAtualSnap.exists()) dadosEmpresa.logoUrl = empresaAtualSnap.data().logoUrl || '';
            }

            if (empresaId) {
                await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
                const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
                const docOriginal = await getDoc(profissionalRef);
                dadosProfissional.servicos = docOriginal.exists() ? docOriginal.data().servicos || [] : [];
                await setDoc(profissionalRef, dadosProfissional, { merge: true });
                alert("Perfil atualizado com sucesso!");
            } else {
                dadosProfissional.servicos = [];
                const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
                empresaId = novaEmpresaRef.id;
                await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional);
                alert("Seu negócio foi cadastrado com sucesso!");
                window.location.reload();
            }
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Ocorreu um erro ao salvar: " + error.message);
        } finally {
            elements.btnSalvar.disabled = false;
            elements.btnSalvar.textContent = 'Salvar Todas as Configurações';
        }
    }

    async function handleAdicionarProfissional(event) {
        event.preventDefault();
        const btnSubmit = event.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Salvando...';
        try {
            const nome = document.getElementById('nome-profissional').value.trim();
            const fotoFile = document.getElementById('foto-profissional').files[0];
            if (!nome) throw new Error("O nome do profissional é obrigatório.");

            let fotoUrl = '';
            if (fotoFile) {
                const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`);
                const uploadResult = await uploadBytes(storageRef, fotoFile);
                fotoUrl = await getDownloadURL(uploadResult.ref);
            }
            
            const novoProfissional = { nome, fotoUrl, servicos: [], horarios: {} };
            await addDoc(collection(db, "empresarios", empresaId, "profissionais"), novoProfissional);

            alert("Profissional adicionado com sucesso!");
            if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
            renderizarListaProfissionais(empresaId);
        } catch (error) {
            console.error("Erro ao adicionar profissional:", error);
            alert("Erro ao adicionar profissional: " + error.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Salvar Profissional';
        }
    }

    function coletarDadosDeHorarios() {
        const horariosData = { intervalo: parseInt(elements.intervaloSelect.value, 10) };
        diasDaSemana.forEach(dia => {
            const estaAtivo = document.getElementById(`${dia.id}-ativo`).checked;
            const blocos = [];
            if (estaAtivo) {
                document.querySelectorAll(`#blocos-${dia.id} .bloco-horario`).forEach(blocoEl => {
                    const inputs = blocoEl.querySelectorAll('input[type="time"]');
                    if (inputs[0].value && inputs[1].value) blocos.push({ inicio: inputs[0].value, fim: inputs[1].value });
                });
            }
            horariosData[dia.id] = { ativo: estaAtivo, blocos: blocos };
        });
        return horariosData;
    }

    function adicionarListenersDeEvento() {
        elements.form.addEventListener('submit', handleFormSubmit);
        if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
        if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput.click());
        if (elements.logoInput) elements.logoInput.addEventListener('change', () => {
            if (elements.logoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => { elements.logoPreview.src = e.target.result; };
                reader.readAsDataURL(elements.logoInput.files[0]);
            }
        });
        if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
            try { await signOut(auth); window.location.href = 'login.html'; }
            catch (error) { console.error("Erro no logout:", error); alert("Ocorreu um erro ao sair."); }
        });

        if (elements.btnAddProfissional) {
            elements.btnAddProfissional.addEventListener('click', () => {
                if (!empresaId) {
                    alert("Você precisa salvar as configurações do seu negócio antes de adicionar um funcionário.");
                    return;
                }
                if (elements.formAddProfissional) elements.formAddProfissional.reset();
                if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'flex';
            });
        }

        if (elements.btnCancelarProfissional) {
            elements.btnCancelarProfissional.addEventListener('click', () => {
                if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
            });
        }

        if (elements.formAddProfissional) {
            elements.formAddProfissional.addEventListener('submit', handleAdicionarProfissional);
        }
    }

    function copiarLink() {
        if (!empresaId) {
            alert("Salve seu perfil para gerar o link.");
            return;
        }
        const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
        navigator.clipboard.writeText(urlCompleta).then(() => {
            alert("Link da vitrine copiado!");
        }, () => {
            alert("Falha ao copiar o link.");
        });
    }

    function gerarEstruturaDosDias() {
        if (!elements.diasContainer) return;
        elements.diasContainer.innerHTML = '';
        diasDaSemana.forEach(dia => {
            const divDia = document.createElement('div');
            divDia.className = 'dia-semana';
            divDia.innerHTML = `
                <div class="dia-info">
                    <span class="dia-nome">${dia.nome}</span>
                    <div class="toggle-container">
                        <label class="switch">
                            <input type="checkbox" id="${dia.id}-ativo">
                            <span class="slider"></span>
                        </label>
                        <span class="toggle-label">Fechado</span>
                    </div>
                </div>
                <div class="horarios-container" style="display: none;" id="container-${dia.id}">
                    <div class="horarios-blocos" id="blocos-${dia.id}"></div>
                    <button type="button" class="btn-add-slot" data-dia="${dia.id}">+ Adicionar Horário</button>
                </div>`;
            elements.diasContainer.appendChild(divDia);
            
            const toggleAtivo = document.getElementById(`${dia.id}-ativo`);
            toggleAtivo.addEventListener('change', (e) => {
                const container = document.getElementById(`container-${dia.id}`);
                const label = e.target.closest('.toggle-container').querySelector('.toggle-label');
                container.style.display = e.target.checked ? 'flex' : 'none';
                label.textContent = e.target.checked ? 'Aberto' : 'Fechado';
                if (e.target.checked && container.querySelector('.horarios-blocos').childElementCount === 0) {
                    adicionarBlocoDeHorario(dia.id);
                }
            });
        });
        elements.diasContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-add-slot')) {
                adicionarBlocoDeHorario(e.target.dataset.dia);
            }
        });
    }

    function adicionarBlocoDeHorario(diaId, inicio = '09:00', fim = '18:00') {
        const container = document.getElementById(`blocos-${diaId}`);
        const divBloco = document.createElement('div');
        divBloco.className = 'slot-horario';
        divBloco.innerHTML = `
            <input type="time" value="${inicio}">
            <span class="ate">até</span>
            <input type="time" value="${fim}">
            <button type="button" class="btn-remove-slot">Remover</button>`;
        container.appendChild(divBloco);
        divBloco.querySelector('.btn-remove-slot').addEventListener('click', (e) => {
            if (container.childElementCount > 1) {
                e.target.closest('.slot-horario').remove();
            } else {
                alert("Para não atender neste dia, desative o botão na parte superior.");
            }
        });
    }

}); // Fim do DOMContentLoaded
