import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

async function carregarResumoDiario() {
  const container = document.getElementById('resumo-diario-container');
  try {
    const snap = await getDocs(collection(db, 'agendamentos'));
    const totalAgendamentos = snap.size;
    container.innerHTML = `<div class="resumo-metricas">
      <div class="metrica"><b>${totalAgendamentos}</b><br>Agendamentos</div>
    </div>`;
  } catch (e) {
    container.innerHTML = `<div class="error-message">Erro ao carregar dados: ${e.message}</div>`;
  }
}

window.addEventListener('DOMContentLoaded', carregarResumoDiario);
