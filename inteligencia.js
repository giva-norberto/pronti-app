/**
 * inteligencia.js
 * * Contém a função "cérebro" do Pronti IA para análises locais.
 * A função agora é exportada para poder ser usada em outros scripts (módulos).
 */

/**
 * Analisa uma lista de agendamentos do dia e gera um resumo inteligente.
 * @param {Array<Object>} agendamentosDoDia - Um array de objetos de agendamento.
 * @returns {Object} Um objeto com os dados do resumo.
 */
export function gerarResumoDiarioInteligente(agendamentosDoDia) {
  // Passo 1: Verifica se existem agendamentos.
  if (!agendamentosDoDia || agendamentosDoDia.length === 0) {
    return {
      totalAtendimentos: 0,
      mensagem: "Você não tem atendimentos hoje. Aproveite para planejar sua semana!"
    };
  }

  // Passo 2: Ordena os agendamentos por hora de início.
  const agendamentosOrdenados = [...agendamentosDoDia].sort((a, b) => {
    // Garante que a.inicio e b.inicio são objetos Date
    const dateA = a.inicio instanceof Date ? a.inicio : new Date(a.inicio);
    const dateB = b.inicio instanceof Date ? b.inicio : new Date(b.inicio);
    return dateA - dateB;
  });

  // Passo 3: Identifica primeiro e último atendimento.
  const primeiroAtendimento = agendamentosOrdenados[0];
  const ultimoAtendimento = agendamentosOrdenados[agendamentosOrdenados.length - 1];

  // Passo 4: Calcula a estimativa de faturamento.
  const faturamentoEstimado = agendamentosOrdenados.reduce((total, agendamento) => {
    const preco = parseFloat(agendamento.servico.preco) || 0;
    return total + preco;
  }, 0);

  // Passo 5: Encontra o maior intervalo livre.
  let maiorIntervalo = { duracao: 0, inicio: null, fim: null };
  for (let i = 0; i < agendamentosOrdenados.length - 1; i++) {
    const fimAtual = new Date(agendamentosOrdenados[i].fim);
    const inicioProximo = new Date(agendamentosOrdenados[i + 1].inicio);
    const duracaoIntervalo = inicioProximo - fimAtual;

    if (duracaoIntervalo > maiorIntervalo.duracao) {
      maiorIntervalo = {
        duracao: duracaoIntervalo,
        inicio: fimAtual,
        fim: inicioProximo
      };
    }
  }

  // Passo 6: Monta o objeto final de resumo.
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


  return resumo;
}

// --- Fim do código para inteligencia.js ---
