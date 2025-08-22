// ======================================================================
//        VITRINI-STATE.JS - GESTÃO CENTRAL DO ESTADO
// ======================================================================

// 'state' é a memória de curto prazo da aplicação, evitando variáveis globais.
export const state = {
    empresaId: null,
    dadosEmpresa: null,
    listaProfissionais: [],   // Cache de profissionais da empresa
    todosOsServicos: [],      // Cache de todos os serviços da empresa

    // Estado do agendamento atual
    agendamento: {
        profissional: null,
        servico: null,
        data: null,
        horario: null
    },

    // Usuário autenticado atualmente
    currentUser: null
};

// ======================================================================
// FUNÇÕES PARA MODIFICAR O ESTADO DE FORMA CONTROLADA
// ======================================================================

/**
 * Define a empresa atual e seus dados.
 * @param {string} id - ID da empresa.
 * @param {object} dados - Dados da empresa.
 */
export function setEmpresa(id, dados) {
    state.empresaId = id;
    state.dadosEmpresa = dados;
}

/**
 * Atualiza a lista de profissionais.
 * @param {Array} profissionais
 */
export function setProfissionais(profissionais) {
    state.listaProfissionais = profissionais;
}

/**
 * Atualiza a lista de todos os serviços da empresa.
 * @param {Array} servicos
 */
export function setTodosOsServicos(servicos) {
    state.todosOsServicos = servicos;
}

/**
 * Atualiza um campo específico do agendamento atual.
 * @param {'profissional'|'servico'|'data'|'horario'} propriedade
 * @param {*} valor
 */
export function setAgendamento(propriedade, valor) {
    if (state.agendamento.hasOwnProperty(propriedade)) {
        state.agendamento[propriedade] = valor;
    } else {
        console.warn(`Propriedade de agendamento inválida: ${propriedade}`);
    }
}

/**
 * Reseta o agendamento atual para os valores iniciais.
 */
export function resetarAgendamento() {
    state.agendamento = {
        profissional: null,
        servico: null,
        data: null,
        horario: null
    };
}

/**
 * Define o usuário autenticado atual.
 * @param {object|null} user
 */
export function setCurrentUser(user) {
    state.currentUser = user;
}

/**
 * Reseta o usuário autenticado (útil para logout).
 */
export function resetCurrentUser() {
    state.currentUser = null;
}
