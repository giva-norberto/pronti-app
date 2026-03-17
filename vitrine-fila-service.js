import { db } from './vitrini-firebase.js';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const FilaService = {
  isProcessing: false,

  /**
   * Gera a data local no formato YYYY-MM-DD.
   * Usa fuso do Brasil para evitar erro perto da meia-noite.
   */
  getDataLocalBR() {
    const agora = new Date();

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    return formatter.format(agora); // ex: 2026-03-17
  },

  /**
   * Normaliza a lista de serviços para garantir estrutura consistente.
   */
  normalizarServicos(servicos = []) {
    return servicos.map((s) => ({
      id: s?.id || null,
      nome: s?.nome || "Serviço sem nome",
      duracao: Number(s?.duracao) || 0
    }));
  },

  /**
   * Soma a duração total dos serviços.
   */
  calcularDuracaoTotal(servicos = []) {
    return servicos.reduce((total, servico) => total + (Number(servico.duracao) || 0), 0);
  },

  /**
   * Expira filas antigas abertas do mesmo cliente/profissional/empresa.
   * Só bloqueia se houver uma fila aberta do dia atual.
   */
  async validarDuplicidadeOuExpirarAntigas({ filaRef, usuarioId, empresaId, profissionalId, hoje }) {
    const filaQuery = query(
      filaRef,
      where("clienteId", "==", usuarioId),
      where("empresaId", "==", empresaId),
      where("profissionalId", "==", profissionalId),
      where("status", "in", ["fila", "aguardando"]),
      limit(10)
    );

    const filaSnapshot = await getDocs(filaQuery);

    if (filaSnapshot.empty) {
      return { duplicado: false };
    }

    for (const item of filaSnapshot.docs) {
      const dados = item.data();
      const dataFila = dados?.dataFila || null;

      // Se já existir uma fila aberta HOJE, bloqueia
      if (dataFila === hoje) {
        return {
          duplicado: true,
          id: item.id,
          mensagem: "Você já está na fila para esse profissional hoje."
        };
      }

      // Se existir fila aberta de outro dia, expira automaticamente
      if (dataFila && dataFila !== hoje) {
        await updateDoc(doc(db, "fila_agendamentos", item.id), {
          status: "expirado",
          expiradoEm: serverTimestamp()
        });
      }

      // Segurança extra:
      // se existir registro antigo sem dataFila, também expira
      if (!dataFila) {
        await updateDoc(doc(db, "fila_agendamentos", item.id), {
          status: "expirado",
          expiradoEm: serverTimestamp()
        });
      }
    }

    return { duplicado: false };
  },

  /**
   * Entra na fila de agendamento.
   */
  async entrarNaLista(state, usuario, preferencias = {}) {
    if (this.isProcessing) {
      return {
        sucesso: false,
        motivo: "processando",
        mensagem: "Já estamos processando sua solicitação."
      };
    }

    this.isProcessing = true;

    try {
      const profissional = state?.agendamento?.profissional;
      const servicosOriginais = state?.agendamento?.servicos || [];
      const empresaId = state?.empresaId || localStorage.getItem("empresaAtivaId");
      const hoje = this.getDataLocalBR();

      // Validações principais
      if (!usuario?.uid) {
        throw new Error("Usuário não autenticado.");
      }

      if (!empresaId) {
        throw new Error("empresaId não encontrado.");
      }

      if (!profissional?.id) {
        throw new Error("Dados do profissional incompletos no estado.");
      }

      if (!Array.isArray(servicosOriginais) || servicosOriginais.length === 0) {
        throw new Error("Nenhum serviço foi selecionado.");
      }

      const servicos = this.normalizarServicos(servicosOriginais);
      const duracaoTotal = this.calcularDuracaoTotal(servicos);

      if (duracaoTotal <= 0) {
        throw new Error("A duração total dos serviços é inválida.");
      }

      const filaRef = collection(db, "fila_agendamentos");

      // Verifica duplicidade real / expira antigas
      const validacao = await this.validarDuplicidadeOuExpirarAntigas({
        filaRef,
        usuarioId: usuario.uid,
        empresaId,
        profissionalId: profissional.id,
        hoje
      });

      if (validacao.duplicado) {
        return {
          sucesso: false,
          motivo: "duplicado",
          mensagem: validacao.mensagem,
          id: validacao.id
        };
      }

      // Monta o novo registro
      const novoRegistro = {
        clienteId: usuario.uid,
        clienteNome: usuario.displayName || "Cliente",
        clienteEmail: usuario.email || null,
        fcmToken: localStorage.getItem("fcm_token") || null,

        empresaId,

        profissionalId: profissional.id,
        profissionalNome: profissional.nome || "Profissional",

        servicos,
        duracaoTotal,

        preferencias: {
          turno: preferencias?.turno || "Qualquer horário"
        },

        status: "fila",
        origem: "vitrine",
        dataFila: hoje,

        criadoEm: serverTimestamp()
      };

      const docRef = await addDoc(filaRef, novoRegistro);

      console.log("✅ Sucesso! ID na fila:", docRef.id);

      return {
        sucesso: true,
        id: docRef.id,
        mensagem: "Você entrou na fila com sucesso."
      };
    } catch (error) {
      console.error("❌ Erro no FilaService:", error.message);

      return {
        sucesso: false,
        motivo: "erro",
        mensagem: error.message || "Erro ao entrar na fila."
      };
    } finally {
      this.isProcessing = false;
    }
  }
};
