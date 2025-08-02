/**
 * ficha-cliente.js (VERSÃO CORRIGIDA E ALINHADA COM A ESTRUTURA 'empresarios')
 *
 * Lógica Principal:
 * 1. Confirma qual utilizador (dono) está logado.
 * 2. Descobre o ID da empresa ('empresaId') daquele dono.
 * 3. Busca os agendamentos do cliente especificado na URL, mas APENAS dentro da subcoleção daquela empresa.
 * 4. Busca os serviços do profissional (dono) para exibir os nomes corretos.
 */

// IMPORTAÇÕES
import { getFirestore, collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { app } from "./firebase-config.js";

// INICIALIZAÇÃO
const db = getFirestore(app);
const auth = getAuth(app);

// ELEMENTOS DA PÁGINA
const nomeClienteTitulo = document.getElementById('nome-cliente-titulo');
const historicoDiv = document.getElementById('historico-agendamentos');

/**
 * Função auxiliar para encontrar o ID da empresa com base no ID do dono.
 */
async function getEmpresaIdDoDono(uid) {
    const q = query(collection(db, "empresarios"), where("donoId", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
}

/**
 * Função principal que é chamada após a autenticação do utilizador.
 */
async function carregarFichaDoCliente(uid, empresaId) {
    // 1. Pega o nome do cliente que foi passado na URL
    const urlParams = new URLSearchParams(window.location.search);
    const nomeCliente = urlParams.get('cliente'); // O nome vem da URL

    if (!nomeCliente) {
        nomeClienteTitulo.textContent = 'Cliente não encontrado';
        historicoDiv.innerHTML = '<p>Não foi possível identificar o cliente. Por favor, volte para a lista.</p>';
        return;
    }

    const nomeClienteDecodificado = decodeURIComponent(nomeCliente);
    nomeClienteTitulo.textContent = `Ficha de: ${nomeClienteDecodificado}`;
    historicoDiv.innerHTML = '<p>Buscando histórico de agendamentos...</p>';

    try {
        // 2. Busca o "mapa" de serviços do profissional (dono)
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
        const profissionalSnap = await getDoc(profissionalRef);
        const servicosMap = new Map();
        if (profissionalSnap.exists() && profissionalSnap.data().servicos) {
            profissionalSnap.data().servicos.forEach(servico => {
                servicosMap.set(String(servico.id), servico);
            });
        }

        // 3. Consulta os agendamentos DENTRO DA SUBCOLEÇÃO DA EMPRESA
        const agendamentosCollection = collection(db, "empresarios", empresaId, "agendamentos");
        const agendamentosQuery = query(
            agendamentosCollection, 
            where("clienteNome", "==", nomeClienteDecodificado), // Campo correto é 'clienteNome'
            orderBy("horario", "desc")
        );
        const agendamentosSnapshot = await getDocs(agendamentosQuery);

        if (agendamentosSnapshot.empty) {
            historicoDiv.innerHTML = '<p>Nenhum agendamento encontrado para este cliente.</p>';
            return;
        }

        historicoDiv.innerHTML = ''; // Limpa a lista

        agendamentosSnapshot.forEach(doc => {
            const agendamento = doc.data();
            const servicoInfo = servicosMap.get(String(agendamento.servicoId));
            const nomeServico = servicoInfo ? servicoInfo.nome : 'Serviço Inválido';

            const dataHora = agendamento.horario.toDate(); // Converte Timestamp para Date
            const dataFormatada = dataHora.toLocaleDateString('pt-BR');
            const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const agendamentoElemento = document.createElement('div');
            agendamentoElemento.classList.add('agendamento-item');
            agendamentoElemento.innerHTML = `
              <div class="agendamento-info">
                <h3>${nomeServico}</h3>
                <p><strong>Data:</strong> ${dataFormatada} às ${horaFormatada}</p>
              </div>
            `;
            historicoDiv.appendChild(agendamentoElemento);
        });

    } catch (error) {
        console.error("Erro ao buscar histórico do cliente:", error);
        historicoDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar o histórico. Verifique o console e as regras de segurança.</p>';
    }
}

// Ponto de partida: verifica o login antes de executar qualquer coisa.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const empresaId = await getEmpresaIdDoDono(user.uid);
        if (empresaId) {
            carregarFichaDoCliente(user.uid, empresaId);
        } else {
            historicoDiv.innerHTML = "<p>Empresa não encontrada para este utilizador.</p>";
        }
    } else {
        window.location.href = 'login.html';
    }
});
