import { db } from "./firebase-config.js"; // Seu Firebase já inicializado
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const abas = document.querySelectorAll(".aba");
const conteudosAbas = document.querySelectorAll(".aba-conteudo");
const filtroInicio = document.getElementById("filtro-data-inicio");
const filtroFim = document.getElementById("filtro-data-fim");
const filtroProfissional = document.getElementById("filtro-profissional");
const btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");

// Pega empresa ativa do localStorage
let empresaId = localStorage.getItem("empresaAtivaId");
if (!empresaId) {
    alert("Nenhuma empresa ativa encontrada. Selecione uma empresa.");
    window.location.href = "selecionar-empresa.html";
}

// Troca de abas
abas.forEach(botao => {
    botao.addEventListener("click", () => {
        // Remove active de todos
        abas.forEach(b => b.classList.remove("active"));
        botao.classList.add("active");

        // Mostra apenas a aba correspondente
        const abaSelecionada = botao.dataset.aba;
        conteudosAbas.forEach(c => {
            if (c.id === abaSelecionada) {
                c.classList.add("active");
            } else {
                c.classList.remove("active");
            }
        });

        // Atualiza conteúdo da aba (placeholder por enquanto)
        carregarAbaPlaceholder(abaSelecionada);
    });
});

// Placeholder inicial
function carregarAbaPlaceholder(abaId) {
    const container = document.getElementById(abaId);
    if (!container) return;

    switch (abaId) {
        case "resumo":
            container.innerHTML = `<p>Resumo diário será exibido aqui.</p>`;
            break;
        case "servicos":
            container.innerHTML = `<p>Lista de serviços e métricas será exibida aqui.</p>`;
            break;
        case "profissionais":
            container.innerHTML = `<p>Lista de profissionais e métricas será exibida aqui.</p>`;
            break;
        case "faturamento":
            container.innerHTML = `<p>Resumo financeiro será exibido aqui.</p>`;
            break;
        case "clientes":
            container.innerHTML = `<p>Lista de clientes e métricas será exibida aqui.</p>`;
            break;
        default:
            container.innerHTML = `<p>Conteúdo não disponível.</p>`;
    }
}

// Preencher dropdown de profissionais
async function popularFiltroProfissionais() {
    if (!filtroProfissional) return;
    filtroProfissional.innerHTML = '<option value="todos">Todos</option>';
    try {
        const snapshot = await getDocs(collection(db, "empresarios", empresaId, "profissionais"));
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = data.nome;
            filtroProfissional.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao buscar profissionais:", error);
    }
}

// Setar filtro de datas para mês atual
function setDatasPadrao() {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = hoje;
    const pad = n => n.toString().padStart(2, '0');
    const f = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    filtroInicio.value = f(inicio);
    filtroFim.value = f(fim);
}

// Listener do botão aplicar filtro
btnAplicarFiltro.addEventListener("click", () => {
    const abaAtivaBtn = document.querySelector(".aba.active");
    if (!abaAtivaBtn) return;
    const abaAtiva = abaAtivaBtn.dataset.aba;

    // Aqui vamos chamar a função que irá buscar dados filtrados
    console.log("Filtro aplicado:", {
        aba: abaAtiva,
        inicio: filtroInicio.value,
        fim: filtroFim.value,
        profissional: filtroProfissional.value
    });

    // Placeholder enquanto dados não são carregados
    carregarAbaPlaceholder(abaAtiva);
});

// Inicializações
window.addEventListener("DOMContentLoaded", () => {
    setDatasPadrao();
    popularFiltroProfissionais();
    // Carrega aba inicial (Resumo Diário)
    carregarAbaPlaceholder("resumo");
});
