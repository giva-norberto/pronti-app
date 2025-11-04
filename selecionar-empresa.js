1	/**
2	 * @file selecionar-empresa.js
3	 * @description Script autônomo para a página de seleção de empresa.
4	 * LÓGICA SIMPLES: Valida (Pago) ou (trialEndDate). Redireciona para planos se expirado.
5	 */
6	
7	// Importações diretas
8	import { auth, db } from "./firebase-config.js";
9	import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
10	import { doc, getDoc, collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
11	
12	// --- Elementos do DOM ---
13	const grid = document.getElementById('empresas-grid' );
14	const loader = document.getElementById('loader');
15	const tituloBoasVindas = document.getElementById('titulo-boas-vindas');
16	const btnLogout = document.getElementById('btn-logout');
17	
18	// --- Eventos ---
19	if (btnLogout) {
20	    btnLogout.addEventListener('click', async () => {
21	        localStorage.removeItem('empresaAtivaId');
22	        localStorage.removeItem('usuarioNome');
23	        await signOut(auth).catch(error => console.error("Erro ao sair:", error));
24	        window.location.href = 'login.html';
25	    });
26	}
27	
28	// Ponto de entrada principal do script
29	onAuthStateChanged(auth, (user) => {
30	    if (user) {
31	        localStorage.removeItem('empresaAtivaId');
32	        const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Empreendedor(a)';
33	        localStorage.setItem('usuarioNome', primeiroNome);
34	
35	        if (tituloBoasVindas) {
36	            tituloBoasVindas.textContent = `Bem-vindo(a), ${primeiroNome}!`;
37	        }
38	        carregarEmpresas(user.uid); 
39	    } else {
40	        window.location.href = 'login.html';
41	    }
42	});
43	
44	// --- Utilitários de Data ---
45	function tsToDate(ts) {
46	    if (!ts) return null;
47	    if (typeof ts.toDate === 'function') return ts.toDate();
48	    const d = new Date(ts);
49	    return isNaN(d) ? null : d;
50	}
51	
52	function hojeSemHoras() {
53	    const d = new Date();
54	    d.setHours(0, 0, 0, 0);
55	    return d;
56	}
57	
58	// ==========================================================
59	// ✅ FUNÇÃO DE VALIDAÇÃO SIMPLIFICADA (COM CORREÇÃO DE DATA)
60	// ==========================================================
61	function checkEmpresaStatus(empresaData) {
62	    try {
63	        if (!empresaData) {
64	            return { isPaid: false, isTrialActive: false };
65	        }
66	
67	        if (empresaData.status && String(empresaData.status).toLowerCase() !== 'ativo') {
68	            return { isPaid: false, isTrialActive: false };
69	        }
70	
71	        const now = new Date();
72	        const hoje = hojeSemHoras();
73	
74	        // --- 1. Checagem de PAGAMENTO (Valida empresas antigas) ---
75	        const assinaturaValidaAte = tsToDate(empresaData.assinaturaValidaAte || empresaData.paidUntil);
76	        const planoPago = (empresaData.plano === 'pago' || empresaData.plano === 'premium' || empresaData.planStatus === 'active');
77	        const assinaturaAtivaFlag = empresaData.assinaturaAtiva === true;
78	        const isApprovedManual = empresaData.aprovado === true || empresaData.approved === true;
79	
80	        if (planoPago || assinaturaAtivaFlag || isApprovedManual) {
81	            if (assinaturaValidaAte) {
82	                if (assinaturaValidaAte > now) {
83	                    return { isPaid: true, isTrialActive: false }; // Pago e válido
84	                } else {
85	                    return { isPaid: false, isTrialActive: false }; // Assinatura paga expirou
86	                }
87	            }
88	            return { isPaid: true, isTrialActive: false }; // Pago (sem data)
89	        }
90	
91	        // --- 2. Checagem de TRIAL (Somente data final) ---
92	        if (empresaData.trialEndDate) {
93	            
94	            // ✅ CORREÇÃO: Comparação de data robusta
95	            const dataAtualMs = now.getTime();
96	            let trialEndDateMs;
97	
98	            // Tenta converter o Timestamp do Firestore para milissegundos
99	            if (typeof empresaData.trialEndDate.toDate === 'function') {
100	                trialEndDateMs = empresaData.trialEndDate.toDate().getTime();
101	            } else {
102	                // Se já for um objeto Date ou string de data, converte para milissegundos
103	                trialEndDateMs = new Date(empresaData.trialEndDate).getTime();
104	            }
105	
106	            if (trialEndDateMs >= dataAtualMs) {
107	                // Trial está ativo
108	                return { isPaid: false, isTrialActive: true };
109	            }
110	        }
111	
112	        // --- 3. Expirado ---
113	        return { isPaid: false, isTrialActive: false };
114	
115	    } catch (error) {
116	        console.error("Erro em checkEmpresaStatus:", error);
117	        return { isPaid: false, isTrialActive: false };
118	    }
119	}
120	
121	
122	// --- Funções Principais (com a lógica de redirecionamento) ---
123	async function carregarEmpresas(userId) {
124	    try {
125	        const mapaUsuarioRef = doc(db, "mapaUsuarios", userId);
126	        const mapaUsuarioSnap = await getDoc(mapaUsuarioRef);
127	
128	        if (!mapaUsuarioSnap.exists() || !Array.isArray(mapaUsuarioSnap.data().empresas) || mapaUsuarioSnap.data().empresas.length === 0) {
129	            renderizarOpcoes([]); 
130	            return;
131	        }
132	
133	        const idsDasEmpresas = mapaUsuarioSnap.data().empresas;
134	
135	        // --- Validação para 1 Empresa ---
136	        if (idsDasEmpresas.length === 1) {
137	            const empresaId = idsDasEmpresas[0];
138	            localStorage.setItem('empresaAtivaId', empresaId); 
139	            
140	            const empresaRef = doc(db, "empresarios", empresaId);
141	            const empresaSnap = await getDoc(empresaRef);
142	            const empresaData = empresaSnap.exists() ? empresaSnap.data() : null;
143	
144	            const status = checkEmpresaStatus(empresaData);
145	
146	            if (status.isPaid || status.isTrialActive) {
147	                window.location.href = 'index.html'; // OK
148	            } else {
149	                window.location.href = 'planos.html'; // Expirado
150	            }
151	            return;
152	        }
153	
154	        // --- Validação para Múltiplas Empresas ---
155	        
156	        const empresas = [];
157	        const CHUNK_SIZE = 10; 
158	        for (let i = 0; i < idsDasEmpresas.length; i += CHUNK_SIZE) {
159	            const chunk = idsDasEmpresas.slice(i, i + CHUNK_SIZE);
160	            const empresasRef = collection(db, "empresarios");
161	            const q = query(empresasRef, where(documentId(), "in", chunk));
162	            const snapshots = await getDocs(q);
163	            snapshots.forEach(snap => {
164	                if (snap.exists()) empresas.push({ id: snap.id, ...snap.data() });
165	            });
166	        }
167	        
168	        const empresasComStatus = empresas.map(empresa => {
169	            const status = checkEmpresaStatus(empresa);
170	            return { ...empresa, statusAssinatura: status };
171	        });
172	
173	        renderizarOpcoes(empresasComStatus); 
174	
175	    } catch (error) {
176	        console.error("Erro ao carregar empresas: ", error);
177	        if (grid) {
178	            grid.innerHTML = `<p style="color: red;">Erro ao carregar empresas. Detalhes: ${error.message}</p>`;
179	        }
180	    } finally {
181	        if (loader) loader.style.display = 'none';
182	    }
183	}
184	
185	function renderizarOpcoes(empresas) {
186	    if (!grid) return;
187	    grid.innerHTML = '';
188	    if (empresas.length > 0) {
189	        empresas.forEach(empresa => {
190	            grid.appendChild(criarEmpresaCard(empresa));
191	        });
192	    } else {
193	        grid.innerHTML = '<p>Você ainda não possui empresas cadastradas.</p>';
194	    }
195	    grid.appendChild(criarNovoCard());
196	}
197	
198	// --- Card com lógica de clique ---
199	function criarEmpresaCard(empresa) {
200	    const card = document.createElement('a');
201	    card.className = 'empresa-card';
202	    card.href = '#';
203	
204	    const status = empresa.statusAssinatura || { isPaid: false, isTrialActive: false };
205	    const isPaid = status.isPaid;
206	    const isTrialActive = status.isTrialActive;
207	
208	    card.addEventListener('click', (e) => {
209	        e.preventDefault();
210	        localStorage.setItem('empresaAtivaId', empresa.id); 
211	        
212	        if (isPaid || isTrialActive) {
213	            window.location.href = 'index.html'; // OK
214	        } else {
215	            window.location.href = 'planos.html'; // Expirado
216	        }
217	    });
218	
219	    const nomeFantasia = empresa.nomeFantasia || "Empresa Sem Nome";
220	    const inicial = nomeFantasia.charAt(0).toUpperCase();
221	    const logoSrc = empresa.logoUrl || `https://placehold.co/100x100/eef2ff/4f46e5?text=${encodeURIComponent(inicial )}`;
222	
223	    let infoHtml = '';
224	    if (isPaid) {
225	        infoHtml = `<span class="status-ativo">Assinatura Ativa</span>`;
226	    } else if (isTrialActive) {
227	        infoHtml = `<span class="status-trial">Em Teste</span>`;
228	    } else {
229	        infoHtml = `<span class="status-expirado">Expirado</span>`;
230	    }
231	
232	    card.innerHTML = `
233	        <img src="${logoSrc}" alt="Logo de ${nomeFantasia}" class="empresa-logo">
234	        <span class="empresa-nome">${nomeFantasia}</span>
235	        ${infoHtml} 
236	    `;
237	    return card;
238	}
239	
240	function criarNovoCard() {
241	    const card = document.createElement('a');
242	    card.className = 'criar-empresa-card';
243	    card.href = 'perfil.html';
244	
245	    card.innerHTML = `
246	        <div class="plus-icon"><i class="fas fa-plus"></i></div>
247	        <span class="empresa-nome">Criar Nova Empresa</span>
248	    `;
249	    return card;
250	}
