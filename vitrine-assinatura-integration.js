// vitrine-assinatura-integration.js
// Integração mínima para detectar assinaturas do cliente e marcar serviços na vitrine.
// Coloque este arquivo na mesma pasta do vitrine.html (ou ajuste o import no HTML).

import { db, auth } from './vitrini-firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/**
 * construirMapaServicosPorAssinatura(clienteUid, empresaId)
 */
export async function construirMapaServicosPorAssinatura(clienteUid, empresaId) {
  const mapa = {};
  if (!clienteUid || !empresaId) {
    console.debug('construirMapa: parâmetros ausentes');
    return mapa;
  }
  try {
    const assinCol = collection(db, `empresarios/${empresaId}/clientes/${clienteUid}/assinaturas`);
    const q = query(assinCol, where('status', '==', 'ativo'));
    const snap = await getDocs(q);
    if (snap.empty) return mapa;
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const itens = Array.isArray(data.servicosInclusos) ? data.servicosInclusos : [];
      itens.forEach(item => {
        const sid = String(item.servicoId);
        const qtdRaw = (item.quantidadeRestante != null) ? Number(item.quantidadeRestante) : (item.quantidade != null ? Number(item.quantidade) : 0);
        const qtd = (qtdRaw === 0) ? Infinity : qtdRaw;
        if (!mapa[sid]) mapa[sid] = { totalDisponivel: 0, assinaturas: [] };
        mapa[sid].assinaturas.push({
          assinaturaId: docSnap.id,
          quantidadeRestante: qtdRaw,
          planoNome: data.planoNome || null
        });
        mapa[sid].totalDisponivel = (mapa[sid].totalDisponivel === Infinity || qtd === Infinity) ? Infinity : (mapa[sid].totalDisponivel + qtd);
      });
    });
    console.debug('construirMapaServicosPorAssinatura: mapa construído', mapa);
    return mapa;
  } catch (err) {
    console.error('Erro construirMapaServicosPorAssinatura:', err);
    return mapa;
  }
}

/**
 * aplicarAssinaturasNaListaServicos(listaServicos, mapaServicosInclusos)
 */
export function aplicarAssinaturasNaListaServicos(listaServicos = [], mapaServicosInclusos = {}) {
  if (!Array.isArray(listaServicos)) return;
  listaServicos.forEach(servico => {
    const sid = servico.id || servico.servicoId || servico.dataId;
    if (!sid) return;
    const info = mapaServicosInclusos[String(sid)];
    const temCredito = info && (info.totalDisponivel === Infinity || info.totalDisponivel > 0);
    if (temCredito) {
      servico.inclusoAssinatura = true;
      servico.precoOriginal = (servico.precoOriginal != null) ? servico.precoOriginal : (servico.preco != null ? Number(servico.preco) : null);
      servico.precoCobrado = 0;
      servico.assinaturasCandidatas = info.assinaturas.map(a => ({
        assinaturaId: a.assinaturaId,
        quantidadeRestante: a.quantidadeRestante,
        planoNome: a.planoNome
      }));
    } else {
      servico.inclusoAssinatura = false;
    }
  });
}

/**
 * marcarServicosInclusosParaUsuario(listaServicos, empresaId)
 */
export async function marcarServicosInclusosParaUsuario(listaServicos = [], empresaId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.debug('marcarServicosInclusosParaUsuario: usuário não autenticado');
      return {};
    }
    const mapa = await construirMapaServicosPorAssinatura(user.uid, empresaId);
    aplicarAssinaturasNaListaServicos(listaServicos, mapa);
    return mapa;
  } catch (err) {
    console.error('Erro marcarServicosInclusosParaUsuario:', err);
    return {};
  }
}

export default {
  construirMapaServicosPorAssinatura,
  aplicarAssinaturasNaListaServicos,
  marcarServicosInclusosParaUsuario
};
