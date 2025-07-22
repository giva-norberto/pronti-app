/**
 * inteligencia.js
 * Contém a função "cérebro" que analisa os dados do dia e gera o resumo.
 * A função é exportada para ser usada pelo dashboard.js.
 */
export function gerarResumoDiarioInteligente(agendamentosDoDia) {
  if (!agendamentosDoDia || agendamentosDoDia.length === 0) {
    return {
      totalAtendimentos: 0,
      mensagem: "Você não tem atendimentos hoje. Aproveite para planejar sua semana!"
    };
  }

  const agendamentosOrdenados = [...agendamentosDoDia].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const primeiroAtendimento = agendamentosOrdenados[0];
  const ultimoAtendimento = agendamentosOrdenados[agendamentosOrdenados.length - 1];

  const faturamentoEstimado = agendamentosOrdenados.reduce((total, agendamento) => {
    return total + (parseFloat(agendamento.servico.preco) || 0);
  }, 0);

  let maiorIntervalo = { duracao: 0, inicio: null, fim: null };
  for (let i = 0; i < agendamentosOrdenados.length - 1; i++) {
    const fimAtual = new Date(agendamentosOrdenados[i].fim);
    const inicioProximo = new Date(agendamentosOrdenados[i + 1].inicio);
    const duracaoIntervalo = inicioProximo - fimAtual;
    if (duracaoIntervalo > maiorIntervalo.duracao) {
      maiorIntervalo = { duracao: duracaoIntervalo, inicio: fimAtual, fim: inicioProximo };
    }
  }

  return {
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
}
