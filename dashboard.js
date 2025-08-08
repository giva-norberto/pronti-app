/**
 * dashboard.js (Firebase v10 - VERSÃO FINAL, CORRIGIDA PARA USO ONLINE)
 * Dashboard do Pronti - 3 gráficos + mensagem IA
 */

// IMPORTS VIA CDN DO FIREBASE v10!
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicialize o Firebase app
const app = initializeApp(firebaseConfig);

window.addEventListener('DOMContentLoaded', () => {
    const db = getFirestore(app);
    const auth = getAuth(app);

    // Elementos do DOM
    const graficoServicos = document.getElementById('graficoServicos');
    const graficoFaturamento = document.getElementById('graficoFaturamento');
    const graficoMensal = document.getElementById('graficoMensal');
    const insightsIa = document.getElementById('ia-mensagem');
    const btnLogout = document.getElementById('btn-logout');
    const filtroMesInicio = document.getElementById('filtro-mes-inicio');
    const filtroAnoInicio = document.getElementById('filtro-ano-inicio');
    const filtroMesFim = document.getElementById('filtro-mes-fim');
    const filtroAnoFim = document.getElementById('filtro-ano-fim');

    let empresaId = null;
    let uid = null;

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try { await signOut(auth); window.location.href = 'login.html'; }
            catch (error) { alert("Erro ao sair."); }
        });
    }

    // Autenticação e carga de dados
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        uid = user.uid;

        // Busca empresaId
        const empresasQ = query(collection(db, "empresarios"), where("donoId", "==", uid));
        const empresasSnap = await getDocs(empresasQ);
        if (empresasSnap.empty) {
            insightsIa.textContent = "Cadastre seu negócio para ver os gráficos e insights!";
            return;
        }
        empresaId = empresasSnap.docs[0].id;

        // Carrega dados dos gráficos e IA
        await carregarGraficos(empresaId);
        await avaliarInteligencia(empresaId);

        // Preenche filtros de ano
        preencherFiltrosAno();
        // Evento para filtros mensais
        [filtroMesInicio, filtroAnoInicio, filtroMesFim, filtroAnoFim].forEach(f =>
            f && f.addEventListener('change', () => carregarGraficoMensal(empresaId))
        );
    });

    // Função: Preencher anos dos filtros
    function preencherFiltrosAno() {
        const anoAtual = new Date().getFullYear();
        for (let i = anoAtual - 4; i <= anoAtual + 1; i++) {
            const optIni = document.createElement('option');
            optIni.value = i;
            optIni.textContent = i;
            filtroAnoInicio.appendChild(optIni);

            const optFim = document.createElement('option');
            optFim.value = i;
            optFim.textContent = i;
            filtroAnoFim.appendChild(optFim);
        }
        filtroAnoInicio.value = anoAtual;
        filtroAnoFim.value = anoAtual;
    }

    // Função: Carregar todos gráficos
    async function carregarGraficos(empresaId) {
        await carregarGraficoServicos(empresaId);
        await carregarGraficoFaturamento(empresaId);
        await carregarGraficoMensal(empresaId);
    }

    // Função: Carrega gráfico de serviços mais agendados
    async function carregarGraficoServicos(empresaId) {
        const q = query(collection(db, "empresarios", empresaId, "agendamentos"), where("status", "==", "agendado"));
        const snap = await getDocs(q);
        const servicosContagem = {};
        snap.forEach(doc => {
            const servico = doc.data().servicoNome || "Serviço";
            servicosContagem[servico] = (servicosContagem[servico] || 0) + 1;
        });

        renderizarGraficoBarra(graficoServicos, {
            labels: Object.keys(servicosContagem),
            datasets: [{
                label: 'Agendamentos',
                data: Object.values(servicosContagem),
                backgroundColor: '#6366f1'
            }]
        }, "Serviços mais agendados");
    }

    // Função: Carrega gráfico de faturamento por serviço
    async function carregarGraficoFaturamento(empresaId) {
        const q = query(collection(db, "empresarios", empresaId, "agendamentos"), where("status", "==", "agendado"));
        const snap = await getDocs(q);
        const faturamentoPorServico = {};
        snap.forEach(doc => {
            const servico = doc.data().servicoNome || "Serviço";
            const valor = parseFloat(doc.data().valor || "0");
            faturamentoPorServico[servico] = (faturamentoPorServico[servico] || 0) + valor;
        });

        renderizarGraficoBarra(graficoFaturamento, {
            labels: Object.keys(faturamentoPorServico),
            datasets: [{
                label: 'R$ Faturamento',
                data: Object.values(faturamentoPorServico),
                backgroundColor: '#4f46e5'
            }]
        }, "Faturamento por serviço");
    }

    // Função: Carrega gráfico de agendamentos por mês
    async function carregarGraficoMensal(empresaId) {
        const mesIni = parseInt(filtroMesInicio.value, 10);
        const anoIni = parseInt(filtroAnoInicio.value, 10);
        const mesFim = parseInt(filtroMesFim.value, 10);
        const anoFim = parseInt(filtroAnoFim.value, 10);

        // Ajusta range
        const mesesLabels = [];
        const mesesData = [];
        let currAno = anoIni, currMes = mesIni;
        while (currAno < anoFim || (currAno === anoFim && currMes <= mesFim)) {
            mesesLabels.push(`${(currMes+1).toString().padStart(2, "0")}/${currAno}`);
            mesesData.push(0);
            if (++currMes > 11) { currMes = 0; currAno++; }
        }

        const q = query(collection(db, "empresarios", empresaId, "agendamentos"), where("status", "==", "agendado"));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            const horario = doc.data().horario;
            if (horario && horario.toDate) {
                const d = horario.toDate();
                const idx = mesesLabels.findIndex(label => {
                    const [mes, ano] = label.split('/');
                    return d.getFullYear() === parseInt(ano) && d.getMonth() === parseInt(mes)-1;
                });
                if (idx > -1) mesesData[idx]++;
            }
        });

        renderizarGraficoBarra(graficoMensal, {
            labels: mesesLabels,
            datasets: [{
                label: 'Agendamentos',
                data: mesesData,
                backgroundColor: '#818cf8'
            }]
        }, "Agendamentos por mês");
    }

    // Função: Renderizar gráfico
    function renderizarGraficoBarra(canvasEl, data, title) {
        if (!canvasEl) return;
        if (canvasEl.chartInstance) {
            canvasEl.chartInstance.destroy();
        }
        canvasEl.chartInstance = new window.Chart(canvasEl.getContext('2d'), {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: !!title, text: title }
                }
            }
        });
    }

    // Função: Avaliação Inteligente IA (exemplo)
    async function avaliarInteligencia(empresaId) {
        // Exemplo genérico: pega agendamentos, faz análise simples
        const q = query(collection(db, "empresarios", empresaId, "agendamentos"), where("status", "==", "agendado"));
        const snap = await getDocs(q);
        const total = snap.size;
        let cancelados = 0;
        let maiorValor = 0;
        let servicoTop = "";
        const servicos = {};

        snap.forEach(doc => {
            const data = doc.data();
            if (data.status === "cancelado") cancelados++;
            const valor = parseFloat(data.valor || "0");
            if (valor > maiorValor) {
                maiorValor = valor;
                servicoTop = data.servicoNome || "";
            }
            const servico = data.servicoNome || "Serviço";
            servicos[servico] = (servicos[servico] || 0) + 1;
        });

        let mensagem = "";
        if (total === 0) {
            mensagem = "Nenhum agendamento registrado neste período.";
        } else {
            mensagem = `Foram realizados ${total} agendamentos.`;
            if (cancelados > 0) mensagem += ` Houve ${cancelados} cancelamentos.`;
            if (servicoTop) mensagem += ` O serviço com maior valor foi "${servicoTop}" (R$ ${maiorValor.toFixed(2)}).`;
            const maisAgendado = Object.entries(servicos).sort((a,b)=>b[1]-a[1])[0];
            if (maisAgendado) mensagem += ` O serviço mais agendado foi "${maisAgendado[0]}".`;
            mensagem += " Continue acompanhando seus resultados!";
        }
        insightsIa.textContent = mensagem;
    }
});
