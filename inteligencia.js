// Módulo de Inteligência para Resumo Diário
// Funcionalidades de análise inteligente dos agendamentos
// Adaptado para multiempresa: o contexto multiempresa deve ser garantido no momento de buscar os agendamentos (cada empresa possui sua própria lista do dia).

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

    // Ordenar agendamentos por horário
    const agendamentosOrdenados = agendamentos.slice().sort((a, b) => {
        const horaA = new Date(a.inicio).getTime();
        const horaB = new Date(b.inicio).getTime();
        return horaA - horaB;
    });

    const primeiro = agendamentosOrdenados[0];
    const ultimo = agendamentosOrdenados[agendamentosOrdenados.length - 1];

    // Calcular faturamento estimado (assumindo preço padrão se não informado)
    const faturamentoEstimado = agendamentos.reduce((total, ag) => {
        const preco = ag.servicoPreco || ag.preco || 50; // valor padrão
        return total + Number(preco);
    }, 0);

    // Encontrar maior intervalo entre agendamentos
    let maiorIntervalo = null;
    if (agendamentosOrdenados.length > 1) {
        let maiorDuracao = 0;
        let intervaloInfo = null;

        for (let i = 0; i < agendamentosOrdenados.length - 1; i++) {
            const fimAtual = new Date(agendamentosOrdenados[i].fim);
            const inicioProximo = new Date(agendamentosOrdenados[i + 1].inicio);
            const duracaoMinutos = (inicioProximo - fimAtual) / (1000 * 60);

            if (duracaoMinutos > maiorDuracao) {
                maiorDuracao = duracaoMinutos;
                intervaloInfo = {
                    inicio: fimAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    fim: inicioProximo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    duracaoMinutos: Math.round(duracaoMinutos)
                };
            }
        }

        if (maiorDuracao > 30) {
            maiorIntervalo = intervaloInfo;
        }
    }

    // Encontrar horário de pico (hora com mais atendimentos iniciados)
    const distribuicaoHoraria = {};
    agendamentos.forEach(ag => {
        const hora = new Date(ag.inicio).getHours();
        distribuicaoHoraria[hora] = (distribuicaoHoraria[hora] || 0) + 1;
    });
    const pico = Object.entries(distribuicaoHoraria).sort((a, b) => b[1] - a[1])[0];

    // Ranking de serviços (por valor total, não só quantidade)
    const servicosRanking = {};
    agendamentos.forEach(ag => {
        const preco = ag.servicoPreco || ag.preco || 50;
        servicosRanking[ag.servico] = (servicosRanking[ag.servico] || 0) + preco;
    });
    const servicoTop = Object.entries(servicosRanking).sort((a, b) => b[1] - a[1])[0];

    // Mensagens motivacionais aleatórias
    const mensagensMotivacionais = [
        "Dia cheio! Continue com essa energia incrível 💪",
        "Agenda movimentada, sinal de sucesso 🚀",
        "Aproveite os intervalos para recarregar as energias ✨",
        "Mais um dia para brilhar com seus atendimentos ⭐"
    ];
    const mensagemExtra = mensagensMotivacionais[Math.floor(Math.random() * mensagensMotivacionais.length)];

    // Mensagem detalhada
    let mensagem = `Hoje você tem <b>${agendamentos.length} agendamento${agendamentos.length > 1 ? 's' : ''}</b>, `;
    mensagem += `começando às <b>${primeiro ? new Date(primeiro.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</b> `;
    mensagem += `(${primeiro?.cliente}${primeiro?.servico ? ' - ' + primeiro.servico : ''}) `;
    mensagem += `e terminando às <b>${ultimo ? new Date(ultimo.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</b> `;
    mensagem += `(${ultimo?.cliente}${ultimo?.servico ? ' - ' + ultimo.servico : ''}).<br>`;
    mensagem += `Faturamento estimado: <b>${faturamentoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>.`;

    if (maiorIntervalo) {
        mensagem += `<br>Maior intervalo livre: <b>${maiorIntervalo.duracaoMinutos} minutos</b> entre ${maiorIntervalo.inicio} e ${maiorIntervalo.fim}.`;
    }
    if (pico) {
        mensagem += `<br>Horário de pico: <b>${pico[0]}h</b> (${pico[1]} atendimentos iniciados).`;
    }
    if (servicoTop) {
        mensagem += `<br>Serviço mais lucrativo do dia: <b>${servicoTop[0]}</b> (${servicoTop[1].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`;
    }
    mensagem += `<br><i>${mensagemExtra}</i>`;

    return {
        totalAtendimentos: agendamentos.length,
        primeiro: {
            horario: new Date(primeiro.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            cliente: primeiro.cliente,
            servico: primeiro.servico
        },
        ultimo: {
            horario: new Date(ultimo.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            cliente: ultimo.cliente,
            servico: ultimo.servico
        },
        faturamentoEstimado,
        maiorIntervalo,
        pico: pico ? { hora: pico[0], atendimentos: pico[1] } : null,
        servicoTop: servicoTop ? { nome: servicoTop[0], valor: servicoTop[1] } : null,
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
        sugestoes.push("Dia livre! Aproveite para organizar o espaço ou planejar promoções.");
        return sugestoes;
    }

    // Análise de ocupação
    const totalSlots = configuracoes.totalSlots || 20;
    const ocupacao = (agendamentos.length / totalSlots) * 100;

    if (ocupacao < 30) {
        sugestoes.push("Baixa ocupação hoje. Considere enviar ofertas para clientes.");
    } else if (ocupacao > 80) {
        sugestoes.push("Dia muito movimentado! Prepare-se bem e considere ter um lanche.");
    }

    // Análise de intervalos
    const resumo = gerarResumoDiarioInteligente(agendamentos);
    if (resumo.maiorIntervalo && resumo.maiorIntervalo.duracaoMinutos > 60) {
        sugestoes.push(`Você tem ${resumo.maiorIntervalo.duracaoMinutos} minutos livres entre ${resumo.maiorIntervalo.inicio} e ${resumo.maiorIntervalo.fim}. Ótimo para uma pausa!`);
    }

    // Análise de serviços
    if (resumo.servicoTop) {
        sugestoes.push(`${resumo.servicoTop.nome} representa o maior faturamento do dia (${resumo.servicoTop.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`);
    }

    return sugestoes.length > 0 ? sugestoes : ["Tenha um ótimo dia de trabalho!"];
}
