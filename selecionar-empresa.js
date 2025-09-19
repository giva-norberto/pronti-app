/**
 * @file selecionar-empresa.js
 * @description Script autônomo para a página de seleção de empresa.
 *              Gerencia a exibição de empresas e o redirecionamento.
 *              Não chama o 'verificarAcesso' para evitar loops.
 */

// Importações diretas, tornando o script independente.
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Elementos do DOM ---
const grid = document.getElementById('empresas-grid' );
const loader = document.getElementById('loader');
const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
const btnLogout = document.getElementById('btn-logout');

// --- Eventos ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        localStorage.removeItem('empresaAtivaId');
        await signOut(auth).catch(error => console.error("Erro ao sair:", error));
        window.location.href = 'login.html';
    });
}

// Ponto de entrada principal do script
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ✅ GARANTIA: Limpa qualquer empresa ativa salva anteriormente para forçar uma nova escolha.
        localStorage.removeItem('empresaAtivaId');
        
        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
        if (tituloBoasVindas) {
            tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
        }
        carregarEmpresas(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

// --- Funções Principais ---
async function carregarEmpresas(userId) {
    try {
        const mapaUsuarioRef = doc(db, "mapaUsuarios", userId);
        const mapaUsuarioSnap = await getDoc(mapaUsuarioRef);

        if (!mapaUsuarioSnap.exists() || !mapaUsuarioSnap.data().empresas || mapaUsuarioSnap.data().empresas.length === 0) {
            renderizarOpcoes([]);
            return;
        }
        
        const idsDasEmpresas = mapaUsuarioSnap.data().empresas;

        // ✅ SUA LÓGICA ORIGINAL PRESERVADA: Se houver apenas uma empresa, redireciona direto.
        // Isso é essencial para o fluxo de novos usuários.
        if (idsDasEmpresas.length === 1) {
            const empresaId = idsDasEmpresas[0];
            localStorage.setItem('empresaAtivaId', empresaId);
            window.location.href = 'index.html';
            return; 
        }

        // ✅ MELHORIA: A busca usa 'in' para respeitar suas regras de segurança e evitar erros.
        const empresasRef = collection(db, "empresarios");
        const q = query(empresasRef, where(documentId(), "in", idsDasEmpresas));
        const snapshotsDasEmpresas = await getDocs(q);
        
        const empresas = snapshotsDasEmpresas.docs
            .filter(snapshot => snapshot.exists())
            .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));

        renderizarOpcoes(empresas);

    } catch (error) {
        console.error("Erro ao carregar empresas: ", error);
        if (grid) {
            grid.innerHTML = `<p style="color: red;">Erro ao carregar empresas. Detalhes: ${error.message}</p>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function renderizarOpcoes(empresas) {
    if (!grid) return;
    grid.innerHTML = ''; 
    if (empresas.length > 0) {
        empresas.forEach(empresa => {
            grid.appendChild(criarEmpresaCard(empresa));
        });
    } else {
         grid.innerHTML = '<p>Você ainda não possui empresas cadastradas.</p>';
    }
    grid.appendChild(criarNovoCard());
}

function criarEmpresaCard(empresa) {
    const card = document.createElement('a');
    card.className = 'empresa-card';
    card.href = '#';
    card.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.setItem('empresaAtivaId', empresa.id);
        window.location.href = 'index.html';
    });

    const nomeFantasia = empresa.nomeFantasia || "Empresa Sem Nome";
    const inicial = nomeFantasia.charAt(0).toUpperCase();
    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial )}`;

    card.innerHTML = `
        <img src="${logoSrc}" alt="Logo de ${nomeFantasia}" class="empresa-logo">
        <span class="empresa-nome">${nomeFantasia}</span>
    `;
    return card;
}

function criarNovoCard() {
    const card = document.createElement('a');
    card.className = 'criar-empresa-card';
    card.href = 'perfil.html'; 

    card.innerHTML = `
        <div class="plus-icon"><i class="fas fa-plus"></i></div>
        <span class="empresa-nome">Criar Nova Empresa</span>
    `;
    return card;
}
