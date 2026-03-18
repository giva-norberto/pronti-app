// filaInteligentePainel.js
import {
  ofertarVagaParaFila,
  processarOfertasExpiradas,
  confirmarOfertaFila,
  recusarOfertaFila,
  ouvirOfertasFila,
  ouvirFilaEspera
} from "./filaInteligenteEngine.js";

let empresaIdAtual = null;
let unsubscribeOfertas = null;
let unsubscribeFila = null;

export function iniciarPainelFilaInteligente(empresaId) {
  empresaIdAtual = empresaId;

  if (unsubscribeOfertas) unsubscribeOfertas();
  if (unsubscribeFila) unsubscribeFila();

  unsubscribeOfertas = ouvirOfertasFila(empresaId, renderizarOfertas);
  unsubscribeFila = ouvirFilaEspera(empresaId, renderizarFila);

  iniciarLoopDeExpiracao();
  bindAcoesPainel();
}

function bindAcoesPainel() {
  document.addEventListener("click", async (e) => {
    const btnOferta = e.target.closest("[data-ofertar-vaga]");
    const btnConfirmar = e.target.closest("[data-confirmar-oferta]");
    const btnRecusar = e.target.closest("[data-recusar-oferta]");
    const btnProcessar = e.target.closest("[data-processar-expiradas]");

    if (btnOferta) {
      const vaga = {
        data: btnOferta.dataset.data,
        horario: btnOferta.dataset.horario,
        profissionalId: btnOferta.dataset.profissionalId || null,
        profissionalNome: btnOferta.dataset.profissionalNome || "",
        servicoId: btnOferta.dataset.servicoId,
        servicoNome: btnOferta.dataset.servicoNome || ""
      };

      btnOferta.disabled = true;
      const res = await ofertarVagaParaFila(empresaIdAtual, vaga);
      btnOferta.disabled = false;

      if (!res.ok) {
        alert(`Não foi possível ofertar: ${res.motivo}`);
      }
    }

    if (btnConfirmar) {
      const ofertaId = btnConfirmar.dataset.confirmarOferta;
      btnConfirmar.disabled = true;
      const res = await confirmarOfertaFila(empresaIdAtual, ofertaId);
      btnConfirmar.disabled = false;

      if (!res.ok) {
        alert(`Falha ao confirmar: ${res.motivo}`);
      } else {
        alert(`Agendamento confirmado para ${res.clienteNome} às ${res.horario}`);
      }
    }

    if (btnRecusar) {
      const ofertaId = btnRecusar.dataset.recusarOferta;
      btnRecusar.disabled = true;
      const res = await recusarOfertaFila(empresaIdAtual, ofertaId);
      btnRecusar.disabled = false;

      if (!res.ok) {
        alert(`Falha ao recusar: ${res.motivo}`);
      }
    }

    if (btnProcessar) {
      btnProcessar.disabled = true;
      const res = await processarOfertasExpiradas(empresaIdAtual);
      btnProcessar.disabled = false;

      if (!res.ok) {
        alert("Erro ao processar ofertas expiradas.");
      }
    }
  });
}

function iniciarLoopDeExpiracao() {
  setInterval(async () => {
    if (!empresaIdAtual) return;
    await processarOfertasExpiradas(empresaIdAtual);
  }, 30000);
}

function formatarStatus(status) {
  const mapa = {
    aguardando: "Aguardando",
    ofertado: "Ofertado",
    atendido: "Atendido",
    cancelado: "Cancelado",
    expirado: "Expirado",
    pendente: "Pendente",
    aceita: "Aceita",
    recusada: "Recusada"
  };
  return mapa[status] || status;
}

function renderizarOfertas(lista) {
  const el = document.getElementById("listaOfertasFila");
  if (!el) return;

  if (!lista.length) {
    el.innerHTML = `<div class="estado-vazio">Nenhuma oferta ainda.</div>`;
    return;
  }

  el.innerHTML = lista.map((item) => `
    <div class="card-fila">
      <div class="card-fila-topo">
        <strong>${item.clienteNome || "Cliente"}</strong>
        <span class="badge-status badge-${item.status}">${formatarStatus(item.status)}</span>
      </div>

      <div class="card-fila-info">
        <div><b>Serviço:</b> ${item.servicoNome || "-"}</div>
        <div><b>Profissional:</b> ${item.profissionalNome || "-"}</div>
        <div><b>Data:</b> ${item.data || "-"}</div>
        <div><b>Horário:</b> ${item.horario || "-"}</div>
      </div>

      ${item.status === "pendente" ? `
        <div class="card-fila-acoes">
          <button data-confirmar-oferta="${item.id}" class="btn-primario">Confirmar</button>
          <button data-recusar-oferta="${item.id}" class="btn-secundario">Recusar</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function renderizarFila(lista) {
  const el = document.getElementById("listaFilaEspera");
  if (!el) return;

  if (!lista.length) {
    el.innerHTML = `<div class="estado-vazio">Ninguém na fila no momento.</div>`;
    return;
  }

  el.innerHTML = lista.map((item) => `
    <div class="card-fila">
      <div class="card-fila-topo">
        <strong>${item.clienteNome || "Cliente"}</strong>
        <span class="badge-status badge-${item.status}">${formatarStatus(item.status)}</span>
      </div>

      <div class="card-fila-info">
        <div><b>Serviço:</b> ${item.servicoNome || "-"}</div>
        <div><b>Profissional:</b> ${item.profissionalNome || "Qualquer um"}</div>
        <div><b>Data desejada:</b> ${item.dataDesejada || "-"}</div>
        <div><b>Horários:</b> ${(item.horariosAceitos || []).join(", ") || "-"}</div>
      </div>
    </div>
  `).join("");
}
