// relatorios.js
import { db } from "./firebase-config.js"; // Seu Firebase já inicializado
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const abasMenu = document.querySelectorAll(".aba-menu");
const conteudosAbas = document.querySelectorAll(".aba-conteudo");
const filtroInicio = document.getElementById("filtro-data-inicio");
const filtroFim = document.getElementById("filtro-data-fim");
const filtroProfissional = document.getElementById("filtro-profissional");
const btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");

let empresaId = localStorage.getItem("empresaAtivaId");
if (!empresaId) {
    alert("Nenhuma empresa ativa encontrada. Selecione uma empresa.");
    window.location.href = "selecionar-empresa.html";
}

// Troca de abas
abasMenu.forEach(botao => {
    botao.addEventListener("click", () => {
        // Remove active de todos
        abasMenu.forEach(b => b.classList.remove("active"));
        botao.classList.add("active");

        // Mostra apenas a aba correspondente
        const abaSelecionada = botao.dataset.aba;
        conteudosAbas.forEach(c => {
            c.style.display = c.id === abaSelecionada ? "block" : "none";
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

// Listener do botão aplicar filtro
btnAplicarFiltro.addEventListener("click", () => {
    const abaAtiva = document.querySelector(".aba-menu.active").dataset.aba;
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
    popularFiltroProfissionais();
    // Carrega aba inicial (Resumo Diário)
    carregarAbaPlaceholder("resumo");
});
