// =========================
// Módulo de Inteligência para Resumo Diário
// =========================
// Funcionalidades de análise inteligente dos agendamentos
// Adaptado para multiempresa: o contexto multiempresa deve ser garantido
// no momento de buscar os agendamentos (cada empresa possui sua própria lista do dia).

// ---------- Função auxiliar para formatar hora ----------
function formatarHora(data) {
    if (!data) return "--:--";
    return new Date(data).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

/**
 * Gera o resumo inteligente do dia para os agendamentos de UMA empresa.
 * @param {Array} agendamentos Lista de agendamentos da empresa ativa (já filtrados).
 * @returns {Object} Resumo inteligente do dia.
 */
export function gerarResumoDiarioInteligente(agendamentos) {
    if (!agendamentos || agendamentos.length === 0) {
        return {
            totalAtendimentos: 0,
            mensagem: "Nenhum agendamento para hoje. Dia livre para outras atividades!"
        };
    }

    // Ordenar agendamentos por horário de início
    const agendamentosOrdenados = agendamentos.slice().sort((a, b) => {
        return new Date(a.inicio).getTime() - new Date(b.inicio).getTime();
    });

    const primeiro = agendamentosOrdenados[0];
    const ultimo = agendamentosOrdenados[agendamentosOrdenados.length - 1];

    // Calcular faturamento estimado
    const faturamentoEstimado = agendamentos.reduce((total, ag) => {
        const preco =
            ag.servicoPreco ||
            ag.preco ||
            ag.valor ||
            (ag.servico?.preco) ||
            50; // fallback padrão
        return total + Number(preco);
    }, 0);

    // Encontrar maior intervalo entre agendamentos
    let maiorIntervalo = null;
    if (agendamentosOrdenados.length > 1) {
        let maiorDuracao = 0;
        for (let i = 0; i < agendamentosOrdenados.length - 1; i++) {
            const fimAtual = new Date(agendamentosOrdenados[i].fim);
            const inicioProximo = new Date(agendamentosOrdenados[i + 1].inicio);
            const duracaoMinutos = (inicioProximo - fimAtual) / (1000 * 60);

            if (duracaoMinutos > maiorDuracao) {
                maiorDuracao = duracaoMinutos;
                maiorIntervalo = {
                    inicio: formatarHora(fimAtual),
                    fim: formatarHora(inicioProximo),
                    duracaoMinutos: Math.round(duracaoMinutos)
                };
            }
        }
        if (maiorDuracao < 30) maiorIntervalo = null; // ignora intervalos curtos
    }

    // Geração da mensagem
    const msgPrimeiro = `${primeiro?.cliente || "Cliente"}${
        primeiro?.servico ? " - " + primeiro.servico : ""
    }`;
    const msgUltimo = `${ultimo?.cliente || "Cliente"}${
        ultimo?.servico ? " - " + ultimo.servico : ""
    }`;

    let mensagem = `Hoje você tem <b>${agendamentos.length}</b> atendimento${
        agendamentos.length > 1 ? "s" : ""
    }. `;
    mensagem += `Início às <b>${primeiro ? formatarHora(primeiro.inicio) : "--:--"}</b> (${msgPrimeiro}). `;
    mensagem += `Último às <b>${ultimo ? formatarHora(ultimo.inicio) : "--:--"}</b> (${msgUltimo}). `;
    mensagem += `Faturamento estimado: <b>${faturamentoEstimado.toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" }
    )}</b>.`;
    if (maiorIntervalo) {
        mensagem += ` Maior intervalo: <b>${maiorIntervalo.duracaoMinutos} minutos</b> (${maiorIntervalo.inicio} - ${maiorIntervalo.fim}).`;
    }

    return {
        totalAtendimentos: agendamentos.length,
        primeiro: {
            horario: primeiro ? formatarHora(primeiro.inicio) : "--:--",
            cliente: primeiro?.cliente || null,
            servico: primeiro?.servico || null
        },
        ultimo: {
            horario: ultimo ? formatarHora(ultimo.inicio) : "--:--",
            cliente: ultimo?.cliente || null,
            servico: ultimo?.servico || null
        },
        faturamentoEstimado,
        maiorIntervalo,
        mensagem
    };
}

/**
 * Gera sugestões inteligentes para o dia, considerando os agendamentos da empresa.
 * @param {Array} agendamentos Lista de agendamentos da empresa ativa.
 * @param {Object} configuracoes Configurações opcionais da empresa (ex: totalSlots).
 * @returns {Array} Lista de sugestões inteligentes.
 */
export function gerarSugestoesInteligentes(agendamentos, configuracoes = {}) {
    const sugestoes = [];

    if (!agendamentos || agendamentos.length === 0) {
        sugestoes.push(
            "Dia livre! Aproveite para organizar o espaço ou planejar promoções."
        );
        return sugestoes;
    }

    // Análise de ocupação
    const totalSlots = configuracoes.totalSlots || 20;
    const ocupacao = (agendamentos.length / totalSlots) * 100;

    if (ocupacao < 30) {
        sugestoes.push(
            "Baixa ocupação hoje. Considere enviar ofertas ou mensagens de fidelização."
        );
    } else if (ocupacao > 80) {
        sugestoes.push(
            "Dia muito movimentado! Prepare-se bem e separe um tempo para pausas rápidas."
        );
    }

    // Análise de intervalos
    const resumo = gerarResumoDiarioInteligente(agendamentos);
    if (resumo.maiorIntervalo && resumo.maiorIntervalo.duracaoMinutos > 60) {
        sugestoes.push(
            `Você tem ${resumo.maiorIntervalo.duracaoMinutos} minutos livres entre ${resumo.maiorIntervalo.inicio} e ${resumo.maiorIntervalo.fim}. Boa oportunidade para descanso ou organização.`
        );
    }

    // Análise de serviços mais populares
    const servicosContados = agendamentos.reduce((acc, ag) => {
        const nomeServico = ag.servico || ag.servicoNome || "Serviço";
        acc[nomeServico] = (acc[nomeServico] || 0) + 1;
        return acc;
    }, {});

    const servicoMaisPopular = Object.entries(servicosContados).sort(
        (a, b) => b[1] - a[1]
    )[0];

    if (servicoMaisPopular && servicoMaisPopular[1] > 1) {
        sugestoes.push(
            `${servicoMaisPopular[0]} está em alta hoje com ${servicoMaisPopular[1]} agendamentos!`
        );
    }

    return sugestoes.length > 0
        ? sugestoes
        : ["Tenha um ótimo dia de trabalho!"];
}
