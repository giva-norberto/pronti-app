/**
 * dashboard.js (Versão Final e Corrigida)
 * * Este script é o coração do dashboard. Ele foi ajustado para:
 * 1. Ser 100% compatível com a forma que você salva agendamentos.
 * 2. Buscar os dados dos agendamentos e dos serviços relacionados.
 * 3. Chamar a função da IA para processar os dados.
 * 4. Exibir o card de resumo diário na tela.
 */

// Importações essenciais do Firebase e dos seus módulos locais
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { gerarResumoDiarioInteligente } from './inteligencia.js';

// --- Gatilho Principal ---
// Executa todo o processo quando o conteúdo da página é carregado.
document.addEventListener('DOMContentLoaded', async () => {
    await exibirResumoDiario();
    // Você pode adicionar as chamadas para carregar seus gráficos aqui.
});

/**
 * Orquestra todo o processo: exibe o estado de carregamento,
 * busca os dados, processa com a IA e exibe o resultado final.
 */
async function exibirResumoDiario() {
    const container = document.getElementById('resumo-diario-container');
    if (!container) return;

    container.innerHTML = '<p>🧠 Analisando seu dia...</p>';

    try {
        // Passo 1: Buscar e enriquecer os dados dos agendamentos de hoje.
        const agendamentosEnriquecidos = await buscarEEnriquecerAgendamentosDeHoje();
        
        // Passo 2: Chamar a função da IA com os dados já prontos.
        const resumo = gerarResumoDiarioInteligente(agendamentosEnriquecidos);
        
        // Passo 3: Criar o HTML do resumo e injetar na página.
        const resumoHTML = criarHTMLDoResumo(resumo);
        container.innerHTML = resumoHTML;

    } catch (error) {
        console.error("Erro crítico ao gerar resumo diário:", error);
        container.innerHTML = '<p class="erro">❌ Ops! Não foi possível carregar o resumo do dia.</p>';
    }
}

/**
 * Esta é a função mais importante. Ela busca os agendamentos de hoje
 * e, para cada um, busca os detalhes do serviço correspondente para
 * criar um objeto de dados completo.
 * @returns {Promise<Array<Object>>} Uma promessa que resolve para um array de agendamentos completos.
 */
async function buscarEEnriquecerAgendamentosDeHoje() {
    // Define o intervalo de hoje (do início ao fim do dia)
    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999)).toISOString();

    // Consulta os agendamentos dentro do intervalo de hoje
    const agendamentosRef = collection(db, "agendamentos");
    const q = query(agendamentosRef, 
        where("horario", ">=", inicioDoDia), 
        where("horario", "<=", fimDoDia)
    );

    const querySnapshot = await getDocs(q);
    const promessasAgendamentos = querySnapshot.docs.map(async (agendamentoDoc) => {
        const agendamentoData = agendamentoDoc.data();
        
        // Para cada agendamento, precisamos buscar os detalhes do serviço
        const servicoRef = doc(db, "servicos", agendamentoData.servicoId);
        const servicoSnap = await getDoc(servicoRef);
        
        if (!servicoSnap.exists()) {
            console.warn(`Serviço com ID ${agendamentoData.servicoId} não encontrado.`);
            return null; // Ignora agendamentos com serviço inválido
        }
        
        const servicoData = servicoSnap.data();
        
        // Calcula a hora de início e fim
        const inicio = new Date(agendamentoData.horario);
        const fim = new Date(inicio.getTime() + (servicoData.duracao || 30) * 60000); // Adiciona a duração em minutos

        // Retorna o objeto "enriquecido" no formato que a IA espera
        return {
            id: agendamentoDoc.id,
            cliente: { nome: agendamentoData.cliente || 'Cliente' },
            servico: { 
                nome: servicoData.nome || 'Serviço', 
                preco: servicoData.preco || 0 
            },
            inicio: inicio,
            fim: fim
        };
    });

    // Espera todas as buscas de serviço terminarem
    const resultados = await Promise.all(promessasAgendamentos);
    // Filtra qualquer resultado nulo (caso um serviço não tenha sido encontrado)
    return resultados.filter(res => res !== null);
}

/**
 * Cria o HTML final do card de resumo com base nos dados processados pela IA.
 * @param {Object} resumo - O objeto retornado pela função da IA.
 * @returns {string} O HTML do card.
 */
function criarHTMLDoResumo(resumo) {
    if (resumo.totalAtendimentos === 0) {
        return `<div class="resumo-card">
                    <h3>Resumo do Dia</h3>
                    <p>${resumo.mensagem}</p>
                </div>`;
    }

    let html = `
        <div class="resumo-card">
            <h3>Resumo Diário Inteligente</h3>
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
