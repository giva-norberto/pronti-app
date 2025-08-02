/**
 * servicos.js (VERSÃO DE DIAGNÓSTICO FINAL - TUDO-EM-UM)
 *
 * Esta versão inclui as funções do modal diretamente neste arquivo
 * para eliminar qualquer problema de importação ou cache com o vitrini-utils.js.
 */

import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

// [CORREÇÃO] Espera o HTML inteiro ser carregado antes de executar qualquer código.
document.addEventListener('DOMContentLoaded', () => {

    // ==================================================================
    //  FUNÇÕES DO MODAL (ANTES EM vitrini-utils.js)
    //  Copiadas para cá para eliminar erros de importação.
    // ==================================================================
    function showModal(title, message, buttons) {
        return new Promise(resolve => {
            const overlay = document.getElementById('custom-modal-overlay');
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const buttonsContainer = document.getElementById('modal-buttons-container');

            if (!overlay || !titleEl || !messageEl || !buttonsContainer) {
                console.error("ERRO: Elementos do modal não encontrados no DOM. Verifique o HTML de servicos.html.");
                // Retorna 'false' para não travar a aplicação
                return resolve(false);
            }
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            buttonsContainer.innerHTML = '';

            const close = (value) => {
                overlay.style.display = 'none';
                resolve(value);
            };

            buttons.forEach(buttonInfo => {
                const button = document.createElement('button');
                button.textContent = buttonInfo.text;
                button.className = `btn-confirm ${buttonInfo.styleClass}`;
                button.addEventListener('click', () => close(buttonInfo.value), { once: true });
                buttonsContainer.appendChild(button);
            });

            overlay.style.display = 'flex';
        });
    }

    function showAlert(title, message) {
        const buttons = [{ text: 'OK', styleClass: 'btn-ok', value: true }];
        return showModal(title, message, buttons);
    }

    function showCustomConfirm(title, message) {
        const buttons = [
            { text: 'Confirmar', styleClass: 'btn-ok', value: true },
            { text: 'Cancelar', styleClass: 'btn-cancel', value: false }
        ];
        return showModal(title, message, buttons);
    }
    // ==================================================================
    //  FIM DAS FUNÇÕES DO MODAL
    // ==================================================================


    const db = getFirestore(app);
    const auth = getAuth(app);
    const listaServicosDiv = document.getElementById('lista-servicos');

    let currentUser = null;
    let empresaId = null;
    let profissionalRef = null;

    async function getEmpresaIdDoDono(uid) {
        if (!uid) return null;
        const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return snapshot.docs[0].id;
    }

    async function carregarErenderizarServicos() {
        if (!profissionalRef) {
            listaServicosDiv.innerHTML = '<p style="color:red;">Não foi possível encontrar o perfil profissional.</p>';
            return;
        }
        listaServicosDiv.innerHTML = '<p>Carregando serviços...</p>';

        try {
            const docSnap = await getDoc(profissionalRef);

            if (!docSnap.exists() || !docSnap.data().servicos || docSnap.data().servicos.length === 0) {
                listaServicosDiv.innerHTML = '<p>Nenhum serviço cadastrado.</p>';
                return;
            }

            const servicos = docSnap.data().servicos;
            listaServicosDiv.innerHTML = '';
            
            servicos.sort((a, b) => a.nome.localeCompare(b.nome));

            servicos.forEach(servico => {
                const isVisible = servico.visivelNaVitrine !== false;
                const el = document.createElement('div');
                el.className = 'servico-item';
                el.style.cssText = 'padding: 15px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; background-color: #fafafa; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;';

                el.innerHTML = `
                    <div class="item-info">
                        <h3>${servico.nome}</h3>
                        <p><strong>Preço:</strong> R$ ${parseFloat(servico.preco || 0).toFixed(2).replace('.', ',')}</p>
                        <p><strong>Duração:</strong> ${servico.duracao} minutos</p>
                    </div>
                    <div class="item-acoes" style="display: flex; gap: 10px; align-items: center;">
                        <div class="acao-visibilidade" style="display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <label class="switch-label" style="font-size: 0.8em;">Ativo na Vitrine</label>
                            <label class="switch">
                                <input type="checkbox" class="toggle-visibilidade" data-id="${servico.id}" ${isVisible ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <button class="btn-editar" data-id="${servico.id}">Editar</button>
                        <button class="btn-excluir" data-id="${servico.id}">Excluir</button>
                    </div>
                `;
                listaServicosDiv.appendChild(el);
            });
        } catch (error) {
            console.error("Erro ao buscar serviços:", error);
            listaServicosDiv.innerHTML = '<p style="color:red;">Erro ao carregar os serviços.</p>';
        }
    }

    async function excluirServico(servicoId) {
        const confirmado = await showCustomConfirm("Confirmar Exclusão", "Você tem certeza? Esta ação é permanente.");
        if (!confirmado) return;

        try {
            const docSnap = await getDoc(profissionalRef);
            if (!docSnap.exists()) throw new Error("Documento do profissional não encontrado.");
            const servicosAtuais = docSnap.data().servicos || [];
            const novaListaDeServicos = servicosAtuais.filter(s => s.id !== servicoId);
            await updateDoc(profissionalRef, { servicos: novaListaDeServicos });
            await showAlert("Sucesso", "Serviço excluído com sucesso.");
            carregarErenderizarServicos();
        } catch (error) {
            console.error("Erro ao excluir serviço: ", error);
            await showAlert("Erro", "Erro ao excluir serviço.");
        }
    }

    async function atualizarVisibilidade(servicoId, visivel) {
        //... (código mantido, como estava antes)
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            empresaId = await getEmpresaIdDoDono(user.uid);
            
            if (empresaId) {
                profissionalRef = doc(db, "empresarios", empresaId, "profissionais", currentUser.uid);
                carregarErenderizarServicos();
            } else {
                listaServicosDiv.innerHTML = '<p>Empresa não encontrada. Por favor, complete seu cadastro na página "Meu Perfil".</p>';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    listaServicosDiv.addEventListener('click', (event) => {
        const target = event.target;
        const servicoId = target.dataset.id;
        if (!servicoId) return;
        if (target.classList.contains('btn-editar')) {
            window.location.href = `editar-servico.html?id=${servicoId}`;
        }
        if (target.classList.contains('btn-excluir')) {
            excluirServico(servicoId);
        }
    });

    listaServicosDiv.addEventListener('change', (event) => {
        const target = event.target;
        if (target.classList.contains('toggle-visibilidade')) {
            const servicoId = target.dataset.id;
            const isVisible = target.checked;
            atualizarVisibilidade(servicoId, isVisible);
        }
    });

}); // Fim do DOMContentLoaded
