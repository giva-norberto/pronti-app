/**
 * dashboard.js
 * * Script principal da página de dashboard.
 * Agora inclui a lógica para buscar dados do Firebase, chamar a IA
 * e exibir o resumo diário, além de controlar os gráficos.
 */

// Importações essenciais
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from './inteligencia.js';

// --- FUNÇÃO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', async () => {
    // Inicia a exibição do resumo diário assim que a página carregar
    await exibirResumoDiario();

    // Aqui você pode chamar as funções para carregar seus gráficos
    // carregarGraficoServicos();
    // carregarGraficoFaturamento();
});


// --- LÓGICA DO RESUMO DIÁRIO INTELIGENTE ---

/**
 * Orquestra a busca de dados e a exibição do resumo na tela.
 */
async function exibirResumoDiario() {
    const container = document.getElementById('resumo-diario-container');
    if (!container) return; // Sai se o container não existir

    container.innerHTML = '<p>🧠 Analisando seu dia...</p>'; // Mensagem de carregamento

    try {
        const agendamentosDoDia = await buscarAgendamentosDeHoje();
        const resumo = gerarResumoDiarioInteligente(agendamentosDoDia);
        
        // Constrói o HTML do resumo e insere no container
        const resumoHTML = criarHTMLDoResumo(resumo);
        container.innerHTML = resumoHTML;

    } catch (error) {
        console.error("Erro ao gerar resumo diário:", error);
        container.innerHTML = '<p class="erro">❌ Erro ao carregar o resumo do dia.</p>';
    }
}

/**
 * Busca no Firestore todos os agendamentos para a data atual.
 * @returns {Promise<Array<Object>>} Uma promessa que resolve para um array de agendamentos.
 */
async function buscarAgendamentosDeHoje() {
    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));

    // Converte as datas do JS para Timestamps do Firestore para a consulta
    const inicioDoDiaTimestamp = Timestamp.fromDate(inicioDoDia);
    const fimDoDiaTimestamp = Timestamp.fromDate(fimDoDia);

    const agendamentosRef = collection(db, "agendamentos");
    const q = query(agendamentosRef, 
        where("inicio", ">=", inicioDoDiaTimestamp), 
        where("inicio", "<=", fimDoDiaTimestamp)
    );

    const querySnapshot = await getDocs(q);
    const agendamentos = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Converte os Timestamps do Firebase para objetos Date do JS
        // e garante que a estrutura de dados está correta
        agendamentos.push({
            id: doc.id,
            cliente: { nome: data.cliente_nome || 'Cliente' },
            servico: { nome: data.servico_nome || 'Serviço', preco: data.servico_preco || 0 },
            inicio: data.inicio.toDate(),
            fim: data.fim.toDate()
        });
    });
    return agendamentos;
}

/**
 * Cria o HTML final do card de resumo com base nos dados processados.
 * @param {Object} resumo - O objeto retornado pela função da IA.
 * @returns {string} O HTML do card.
 */
function criarHTMLDoResumo(resumo) {
    if (resumo.totalAtendimentos === 0) {
        return `<div class="resumo-card">
                    <h3>🧠 Resumo do Dia</h3>
                    <p>${resumo.mensagem}</p>
                </div>`;
    }

    let html = `
        <div class="resumo-card">
            <h3>🧠 Resumo Diário Inteligente</h3>
            <p>Hoje você tem <strong>${resumo.totalAtendimentos}</strong> atendimentos agendados:</p>
            <ul>
                <li><strong>Primeiro:</strong> ${resumo.primeiro.horario} — ${resumo.primeiro.servico} com ${resumo.primeiro.cliente}</li>
                <li><strong>Último:</strong> ${resumo.ultimo.horario} — ${resumo.ultimo.servico} com ${resumo.ultimo.cliente}</li>
            </ul>
            <div class="resumo-metricas">
                <div class="metrica">
                    <span>💰 Faturamento Estimado</span>
                    <strong>R$ ${resumo.faturamentoEstimado.toFixed(2).replace('.', ',')}</strong>
                </div>`;

    if (resumo.maiorIntervalo) {
        html += `
                <div class="metrica">
                    <span>🕓 Maior Intervalo</span>
                    <strong>${resumo.maiorIntervalo.inicio} - ${resumo.maiorIntervalo.fim} (${resumo.maiorIntervalo.duracaoMinutos} min)</strong>
                </div>`;
    }
    
    html += `
            </div>
            <p class="resumo-footer">Boa sorte com seu dia! 💪</p>
        </div>`;
        
    return html;
}
