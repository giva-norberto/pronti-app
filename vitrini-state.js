// Centraliza e gerencia o estado da aplicação para evitar variáveis globais.

// O 'estado' é a memória de curto prazo da nossa aplicação.
export const state = {
    empresaId: null,
    dadosEmpresa: null,
    listaProfissionais: [], // Cache para não buscar toda hora
    todosOsServicos: [],    // Cache de todos os serviços da empresa

    // Estado do agendamento atual
    agendamento: {
        profissional: null,
        servico: null,
        data: null,
        horario: null
    },

    // Estado do usuário autenticado
    currentUser: null
};

// Funções para modificar o estado de forma controlada
export function setEmpresa(id, dados) {
    state.empresaId = id;
    state.dadosEmpresa = dados;
}

export function setProfissionais(profissionais) {
    state.listaProfissionais = profissionais;
}

export function setTodosOsServicos(servicos) {
    state.todosOsServicos = servicos;
}

export function setAgendamento(propriedade, valor) {
    state.agendamento[propriedade] = valor;
}

export function resetarAgendamento() {
    state.agendamento = {
        profissional: null,
        servico: null,
        data: null,
        horario: null
    };
}

export function setCurrentUser(user) {
    state.currentUser = user;
}
