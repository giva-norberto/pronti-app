// Módulo de Inteligência para Resumo Diário
// Funcionalidades de análise inteligente dos agendamentos

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
        // Tentar extrair preço do serviço ou usar valor padrão
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

        if (maiorDuracao > 30) { // Só considera intervalos maiores que 30 minutos
            maiorIntervalo = intervaloInfo;
        }
    }

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
        maiorIntervalo
    };
}

// Função para gerar sugestões baseadas nos dados
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
    const servicosContados = agendamentos.reduce((acc, ag) => {
        acc[ag.servico] = (acc[ag.servico] || 0) + 1;
        return acc;
    }, {});

    const servicoMaisPopular = Object.entries(servicosContados)
        .sort((a, b) => b[1] - a[1])[0];

    if (servicoMaisPopular && servicoMaisPopular[1] > 1) {
        sugestoes.push(`${servicoMaisPopular[0]} está em alta hoje com ${servicoMaisPopular[1]} agendamentos!`);
    }

    return sugestoes.length > 0 ? sugestoes : ["Tenha um ótimo dia de trabalho!"];
}
