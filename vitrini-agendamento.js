// ======================================================================
// vitrini-agendamento.js (FINAL — REVISADO E PRONTO)
// ======================================================================

import { db } from './vitrini-firebase.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { limparUIAgendamento } from './vitrini-ui.js';

// =========================================================
// 🔹 Funções auxiliares de tempo
// =========================================================
function timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// =========================================================
// 🔹 Busca de agendamentos
// =========================================================
export async function buscarAgendamentosDoDia(empresaId, data) {
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        const q = query(
            agendamentosRef,
            where("data", "==", data),
            where("status", "==", "ativo")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        throw new Error("Não foi possível buscar os agendamentos do dia.");
    }
}

// =========================================================
// 🔹 Cálculo de horários disponíveis
// =========================================================
export function calcularSlotsDisponiveis(data, agendamentosDoDia, horariosTrabalho, duracaoServico) {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dataObj = new Date(`${data}T12:00:00Z`);
    const nomeDia = dias[dataObj.getUTCDay()];
    const diaDeTrabalho = horariosTrabalho?.[nomeDia];

    if (!diaDeTrabalho?.ativo || !diaDeTrabalho?.blocos?.length) return [];

    const intervalo = horariosTrabalho.intervalo || 0;
    const slots = [];
    const ocupados = agendamentosDoDia.map(ag => ({
        inicio: timeStringToMinutes(ag.horario),
        fim: timeStringToMinutes(ag.horario) + ag.servicoDuracao
    }));

    const hoje = new Date();
    const ehHoje = hoje.toISOString().split('T')[0] === data;
    const agora = timeStringToMinutes(`${hoje.getHours().toString().padStart(2, '0')}:${hoje.getMinutes().toString().padStart(2, '0')}`);

    for (const bloco of diaDeTrabalho.blocos) {
        let atual = timeStringToMinutes(bloco.inicio);
        const fim = timeStringToMinutes(bloco.fim);

        while (atual + duracaoServico <= fim) {
            const fimProposto = atual + duracaoServico;
            const conflito = ocupados.some(o => atual < o.fim && fimProposto > o.inicio);

            if (!conflito && (!ehHoje || atual > agora)) {
                slots.push(minutesToTimeString(atual));
            }
            atual += intervalo || duracaoServico;
        }
    }

    return slots;
}

// =========================================================
// 🔹 Encontrar próxima data com horários
// =========================================================
export async function encontrarPrimeiraDataComSlots(empresaId, profissional, duracaoServico) {
    const hoje = new Date();
    for (let i = 0; i < 90; i++) {
        const dataAtual = new Date(hoje);
        dataAtual.setDate(hoje.getDate() + i);
        const dataString = dataAtual.toISOString().split('T')[0];

        const agendamentos = await buscarAgendamentosDoDia(empresaId, dataString);
        const doProfissional = agendamentos.filter(a => a.profissionalId === profissional.id);

        const slots = calcularSlotsDisponiveis(dataString, doProfissional, profissional.horarios, duracaoServico);
        if (slots.length > 0) return dataString;
    }
    return null;
}

// =========================================================
// 🔹 Salvar agendamento e enviar notificação
// =========================================================
export async function salvarAgendamento(empresaId, currentUser, agendamento) {
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');

        await addDoc(agendamentosRef, {
            empresaId,
            clienteId: currentUser.uid,
            clienteNome: currentUser.displayName,
            clienteFoto: currentUser.photoURL,
            profissionalId: agendamento.profissional.id,
            profissionalNome: agendamento.profissional.nome,
            servicoId: agendamento.servico.id,
            servicoNome: agendamento.servico.nome,
            servicoDuracao: agendamento.servico.duracao,
            servicoPreco: agendamento.servico.preco,
            data: agendamento.data,
            horario: agendamento.horario,
            status: 'ativo',
            criadoEm: serverTimestamp()
        });

        // =====================================================
        // 🔔 Notificação interna + envio de e-mail
        // =====================================================
        if (agendamento.empresa?.donoId && agendamento.empresa?.emailDono) {
            try {
                const filaRef = collection(db, "filaDeNotificacoes");
                await addDoc(filaRef, {
                    donoId: agendamento.empresa.donoId,
                    titulo: "🎉 Novo Agendamento!",
                    mensagem: `${currentUser.displayName} agendou ${agendamento.servico.nome} com ${agendamento.profissional.nome} às ${agendamento.horario}.`,
                    criadoEm: new Date(),
                    status: "pendente"
                });

                // --- Envio de e-mail via Google Apps Script ---
                const scriptURL = "https://script.google.com/macros/s/AKfycbyyxJ1oVBcoRCw7fZfvoTG6ak1X4XA84ogDj0gwvX31FvldOYzectROpookJl5Wo646/exec";

                fetch(scriptURL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        destinatario: agendamento.empresa.emailDono,
                        nomeCliente: currentUser.displayName,
                        servico: agendamento.servico.nome,
                        horario: agendamento.horario
                    })
                })
                .then(res => res.text())
                .then(console.log)
                .catch(console.error);

                console.log("✅ Notificação e e-mail enviados.");
            } catch (error) {
                console.error("❌ Erro ao adicionar notificação:", error);
            }
        } else {
            console.warn("⚠️ Nenhum e-mail de dono encontrado; notificação não enviada.");
        }

        if (typeof limparUIAgendamento === "function") limparUIAgendamento();

    } catch (error) {
        console.error("Erro principal ao salvar agendamento:", error);
        throw new Error('Ocorreu um erro ao confirmar seu agendamento.');
    }
}

// =========================================================
// 🔹 Buscar agendamentos do cliente
// =========================================================
export async function buscarAgendamentosDoCliente(empresaId, currentUser, modo) {
    if (!currentUser) return [];
    try {
        const agendamentosRef = collection(db, 'empresarios', empresaId, 'agendamentos');
        const hoje = new Date().toISOString().split('T')[0];

        let q = modo === 'ativos'
            ? query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("status", "==", "ativo"),
                where("data", ">=", hoje)
            )
            : query(
                agendamentosRef,
                where("clienteId", "==", currentUser.uid),
                where("data", "<", hoje)
            );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        if (error.code === 'failed-precondition' && error.message.includes("index"))
            throw new Error("A configuração do banco (índice composto) está incompleta.");
        throw error;
    }
}

// =========================================================
// 🔹 Cancelar agendamento
// =========================================================
export async function cancelarAgendamento(empresaId, agendamentoId) {
    try {
        const agendamentoRef = doc(db, 'empresarios', empresaId, 'agendamentos', agendamentoId);
        await updateDoc(agendamentoRef, {
            status: 'cancelado_pelo_cliente',
            canceladoEm: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        throw new Error("Ocorreu um erro ao cancelar o agendamento.");
    }
}
