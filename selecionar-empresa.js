<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Selecionar Empresa - Pronti</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        :root { --cor-primaria: #4f46e5; --cor-perigo: #ef4444; --cor-fundo: #f8fafc; --cor-texto-titulo: #1e293b; --cor-texto-corpo: #64748b; --cor-borda: #e2e8f0; --sombra-card: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); --sombra-card-hover: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
        body { font-family: 'Poppins', sans-serif; background-color: var(--cor-fundo); color: var(--cor-texto-corpo); margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
        .selecao-container { width: 100%; max-width: 550px; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: var(--sombra-card); text-align: center; }
        .header-selecao h1 { color: var(--cor-texto-titulo); font-size: 2rem; font-weight: 700; margin: 0 0 10px 0; }
        #empresas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; justify-items: center; }
        .empresa-card, .criar-empresa-card { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--cor-borda); border-radius: 12px; padding: 20px; cursor: pointer; background: #fff; text-decoration: none; transition: transform 0.2s ease, box-shadow 0.2s ease; height: 180px; width: 100%; box-sizing: border-box; position: relative; }
        .empresa-card:hover, .criar-empresa-card:hover { transform: translateY(-5px); box-shadow: var(--sombra-card-hover); border-color: var(--cor-primaria); }
        .empresa-logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; background-color: #eef2ff; color: var(--cor-primaria); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 600; }
        .empresa-nome { font-weight: 600; color: var(--cor-texto-titulo); font-size: 1rem; text-align: center; }
        .criar-empresa-card { border: 2px dashed var(--cor-borda); }
        .criar-empresa-card .plus-icon { font-size: 2.5rem; color: var(--cor-primaria); margin-bottom: 15px; }
        .logout-container { margin-top: 40px; text-align: center; }
        .btn-logout { background-color: #fee2e2; color: var(--cor-perigo); border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-weight: 600; font-size: 1rem; }
        .loader { border: 4px solid #e2e8f0; border-top: 4px solid var(--cor-primaria); border-radius: 50%; width: 40px; height: 40px; margin: 40px auto; animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .status-expirado { position: absolute; bottom: 10px; font-size: 0.7rem; font-weight: 600; color: #d93025; background-color: #fce8e6; padding: 2px 8px; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="selecao-container">
        <div class="header-selecao">
            <h1 id="titulo-boas-vindas">Bem-vindo(a)!</h1>
            <p>Selecione uma empresa para continuar.</p>
        </div>
        <div id="empresas-grid">
            <div class="loader" id="loader"></div>
        </div>
        <div class="logout-container">
            <button id="btn-logout" class="btn-logout">Sair da conta</button>
        </div>
    </div>

    <script type="module">
        import { auth, db } from "./firebase-config.js";
        import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
        import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

        const grid = document.getElementById('empresas-grid');
        const loader = document.getElementById('loader');
        const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
        const btnLogout = document.getElementById('btn-logout');

        // --- FUNÇÕES DE LÓGICA (ANTES DENTRO DO userService.js) ---
        async function checkUserStatus(userId, empresaData) {
            try {
                if (!userId) return { isTrialActive: false };
                const userRef = doc(db, "usuarios", userId);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) return { isTrialActive: false };
                const userData = userSnap.data();
                if (userData.isPremium === true) return { isTrialActive: false };
                const trialDurationDays = empresaData?.freeEmDias ?? 0;
                if (trialDurationDays <= 0) return { isTrialActive: false };
                if (userData.trialStart?.seconds) {
                    const startDate = new Date(userData.trialStart.seconds * 1000);
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + trialDurationDays);
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    return { isTrialActive: endDate >= hoje };
                }
                return { isTrialActive: true };
            } catch (error) { return { isTrialActive: false }; }
        }

        async function getEmpresasDoUsuario(user) {
            if (!user) return [];
            const empresasUnicas = new Map();
            try {
                const qDono = query(collection(db, "empresarios"), where("donoId", "==", user.uid), where("status", "==", "ativo"));
                const snapshotDono = await getDocs(qDono);
                snapshotDono.forEach(doc => empresasUnicas.set(doc.id, { id: doc.id, ...doc.data() }));
            } catch (e) {}
            try {
                const mapaRef = doc(db, "mapaUsuarios", user.uid);
                const mapaSnap = await getDoc(mapaRef);
                if (mapaSnap.exists() && Array.isArray(mapaSnap.data().empresas)) {
                    const idsDeEmpresas = mapaSnap.data().empresas.filter(id => !empresasUnicas.has(id));
                    for (let i = 0; i < idsDeEmpresas.length; i += 10) {
                        const chunk = idsDeEmpresas.slice(i, i + 10);
                        if (chunk.length > 0) {
                            const q = query(collection(db, "empresarios"), where(documentId(), "in", chunk), where("status", "==", "ativo"));
                            const snap = await getDocs(q);
                            snap.forEach(doc => empresasUnicas.set(doc.id, { id: doc.id, ...doc.data() }));
                        }
                    }
                }
            } catch (e) {}
            return Array.from(empresasUnicas.values());
        }

        // --- LÓGICA PRINCIPAL DA PÁGINA ---
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                localStorage.removeItem('empresaAtivaId');
                const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Usuário';
                tituloBoasVindas.textContent = `Olá, ${primeiroNome}!`;
                
                try {
                    const empresas = await getEmpresasDoUsuario(user);
                    if (empresas.length === 0) {
                        grid.innerHTML = '<p>Você não tem empresas. Crie uma nova.</p>';
                        grid.appendChild(criarNovoCard());
                        loader.style.display = 'none';
                        return;
                    }

                    const empresasComStatus = await Promise.all(
                        empresas.map(async (empresa) => ({...empresa, status: await checkUserStatus(empresa.donoId, empresa) }))
                    );

                    if (empresasComStatus.length === 1) {
                        const empresa = empresasComStatus[0];
                        localStorage.setItem('empresaAtivaId', empresa.id);
                        if (empresa.status.isTrialActive) {
                            window.location.href = 'index.html';
                        } else {
                            window.location.href = 'assinatura.html';
                        }
                        return;
                    }
                    
                    renderizarOpcoes(empresasComStatus);

                } catch (error) {
                    grid.innerHTML = `<p style="color: red;">Erro ao carregar empresas.</p>`;
                } finally {
                    loader.style.display = 'none';
                }

            } else {
                window.location.href = 'login.html';
            }
        });

        function renderizarOpcoes(empresas) {
            grid.innerHTML = ''; 
            empresas.forEach(empresa => grid.appendChild(criarEmpresaCard(empresa)));
            grid.appendChild(criarNovoCard());
        }

        function criarEmpresaCard(empresa) {
            const card = document.createElement('a');
            card.className = 'empresa-card';
            card.href = '#';
            const isTrialActive = empresa.status.isTrialActive;
            card.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.setItem('empresaAtivaId', empresa.id);
                if (isTrialActive) {
                    window.location.href = 'index.html';
                } else {
                    window.location.href = 'assinatura.html';
                }
            });
            const nomeFantasia = empresa.nomeFantasia || "Sem Nome";
            const logoSrc = `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(nomeFantasia.charAt(0).toUpperCase())}`;
            const statusHtml = !isTrialActive ? '<span class="status-expirado">Expirado</span>' : '';
            card.innerHTML = `<img src="${empresa.logoUrl || logoSrc}" alt="Logo" class="empresa-logo"><span class="empresa-nome">${nomeFantasia}</span>${statusHtml}`;
            return card;
        }

        function criarNovoCard() {
            const card = document.createElement('a');
            card.className = 'criar-empresa-card';
            card.href = 'perfil.html';
            card.innerHTML = `<div class="plus-icon"><i class="fas fa-plus"></i></div><span class="empresa-nome">Criar Nova Empresa</span>`;
            return card;
        }
        
        btnLogout.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    </script>
</body>
</html>
