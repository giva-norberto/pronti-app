// --- Início do código para inteligencia.js ---

/**
 * Analisa uma lista de agendamentos do dia e gera um resumo inteligente.
 * Esta função é o "cérebro" da IA do Pronti, rodando localmente.
 *
 * @param {Array<Object>} agendamentosDoDia - Um array de objetos de agendamento.
 * @returns {Object|null} Um objeto com o resumo ou null se não houver agendamentos.
 */
function gerarResumoDiarioInteligente(agendamentosDoDia) {
  // Passo 1: Verificar se existem agendamentos para o dia.
  if (!agendamentosDoDia || agendamentosDoDia.length === 0) {
    return {
      totalAtendimentos: 0,
      mensagem: "Você não tem atendimentos hoje. Aproveite para planejar sua semana!"
    };
  }

  // Passo 2: Ordenar os agendamentos por hora de início para facilitar os cálculos.
  const agendamentosOrdenados = [...agendamentosDoDia].sort((a, b) => {
    return new Date(a.inicio) - new Date(b.inicio);
  });

  // Passo 3: Identificar primeiro e último atendimento.
  const primeiroAtendimento = agendamentosOrdenados[0];
  const ultimoAtendimento = agendamentosOrdenados[agendamentosOrdenados.length - 1];

  // Passo 4: Calcular a estimativa de faturamento usando reduce.
  const faturamentoEstimado = agendamentosOrdenados.reduce((total, agendamento) => {
    const preco = parseFloat(agendamento.servico.preco) || 0;
    return total + preco;
  }, 0);

  // Passo 5: Encontrar o maior intervalo livre entre os atendimentos.
  let maiorIntervalo = {
    duracao: 0, // em milissegundos
    inicio: null,
    fim: null
  };

  for (let i = 0; i < agendamentosOrdenados.length - 1; i++) {
    const agendamentoAtual = agendamentosOrdenados[i];
    const proximoAgendamento = agendamentosOrdenados[i + 1];

    const fimAtual = new Date(agendamentoAtual.fim);
    const inicioProximo = new Date(proximoAgendamento.inicio);
    const duracaoIntervalo = inicioProximo - fimAtual;

    if (duracaoIntervalo > maiorIntervalo.duracao) {
      maiorIntervalo = {
        duracao: duracaoIntervalo,
        inicio: fimAtual,
        fim: inicioProximo
      };
    }
  }

  // Passo 6: Montar o objeto final de resumo.
  const resumo = {
    totalAtendimentos: agendamentosOrdenados.length,
    primeiro: {
      horario: new Date(primeiroAtendimento.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cliente: primeiroAtendimento.cliente.nome,
      servico: primeiroAtendimento.servico.nome
    },
    ultimo: {
      horario: new Date(ultimoAtendimento.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cliente: ultimoAtendimento.cliente.nome,
      servico: ultimoAtendimento.servico.nome
    },
    faturamentoEstimado: faturamentoEstimado,
    maiorIntervalo: maiorIntervalo.duracao > 0 ? {
        inicio: maiorIntervalo.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fim: maiorIntervalo.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        duracaoMinutos: Math.round(maiorIntervalo.duracao / (1000 * 60))
      } : null
  };

  return resumo;
}

// --- Fim do código para inteligencia.js ---
