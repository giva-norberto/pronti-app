// IMPORTAÇÕES do Firebase
import { getFirestore, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { app } from "./firebase-config.js";

// INICIALIZAÇÃO
const db = getFirestore(app);
const agendamentosCollection = collection(db, "agendamentos");
const servicosCollection = collection(db, "servicos");

// ELEMENTOS DA PÁGINA
const nomeClienteTitulo = document.getElementById('nome-cliente-titulo');
const historicoDiv = document.getElementById('historico-agendamentos');

// FUNÇÃO PRINCIPAL
async function carregarFichaDoCliente() {
    // 1. Pega o nome do cliente que foi passado na URL
    const urlParams = new URLSearchParams(window.location.search);
    const nomeCliente = urlParams.get('cliente');

    // Se não encontrar um nome na URL, exibe um erro
    if (!nomeCliente) {
        nomeClienteTitulo.textContent = 'Cliente não encontrado';
        historicoDiv.innerHTML = '<p>Não foi possível identificar o cliente. Por favor, volte para a lista.</p>';
        return;
    }

    // Decodifica o nome para lidar com espaços (ex: "Maria%20Silva" vira "Maria Silva")
    const nomeClienteDecodificado = decodeURIComponent(nomeCliente);
    nomeClienteTitulo.textContent = `Ficha de: ${nomeClienteDecodificado}`;
    historicoDiv.innerHTML = '<p>Buscando histórico de agendamentos...</p>';

    try {
        // 2. Busca o "mapa" de serviços para sabermos os nomes
        const servicosSnapshot = await getDocs(servicosCollection);
        const servicosMap = new Map();
        servicosSnapshot.forEach(doc => {
            servicosMap.set(doc.id, doc.data());
        });

        // 3. Consulta o Firebase, pedindo apenas os agendamentos ONDE o campo "cliente" é IGUAL ao nome que pegamos da URL
        const agendamentosQuery = query(
            agendamentosCollection, 
            where("cliente", "==", nomeClienteDecodificado),
            orderBy("horario", "desc") // Ordena pelos mais recentes
        );
        const agendamentosSnapshot = await getDocs(agendamentosQuery);

        if (agendamentosSnapshot.empty) {
            historicoDiv.innerHTML = '<p>Nenhum agendamento encontrado para este cliente.</p>';
            return;
        }

        historicoDiv.innerHTML = ''; // Limpa a lista

        agendamentosSnapshot.forEach(doc => {
            const agendamento = doc.data();
            const servicoInfo = servicosMap.get(agendamento.servicoId);
            const nomeServico = servicoInfo ? servicoInfo.nome : 'Serviço Inválido';

            const dataHora = new Date(agendamento.horario);
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
        historicoDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar o histórico. Verifique o console.</p>';
    }
}

// Executa a função para carregar tudo
carregarFichaDoCliente();