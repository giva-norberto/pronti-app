export const servicos = [
  { id: 1, nome: "Corte de Cabelo", preco: 30.00, duracao: 45 },
  { id: 2, nome: "Manicure", preco: 25.00, duracao: 60 },
  { id: 3, nome: "Barba Terapia", preco: 40.00, duracao: 45 },
  { id: 4, nome: "Design de Sobrancelha", preco: 25.00, duracao: 30 }
];

export const agendamentos = [
  // O FORMATO PRECISA SER EXATAMENTE ESTE: AAAA-MM-DDTHH:MM:SS
  { id: 1, cliente: "Maria Silva", servicoId: 2, horario: "2025-07-25T14:00:00" },
  { id: 2, cliente: "João Costa", servicoId: 1, horario: "2025-07-25T15:00:00" },
  { id: 3, cliente: "Ana Souza", servicoId: 4, horario: "2025-07-26T10:00:00" }
];