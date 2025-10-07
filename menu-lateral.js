// ======================================================================
// menu-lateral.js (VERSÃO FINAL - FORÇA LOGOUT EM TODAS INSTÂNCIAS + DEBUG)
// ======================================================================

import { auth, db } from "./firebase-config.js";
import { signOut as signOutSingle } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ======================================================================
// aplicarPermissoesMenuLateral
// ======================================================================
export async function aplicarPermissoesMenuLateral(papelUsuario) {
  try {
    const permissoesRef = doc(db, "configuracoesGlobais", "permissoes");
    const permissoesSnap = await getDoc(permissoesRef);
    const regras = permissoesSnap.exists() ? permissoesSnap.data() : {};
    const menus = regras.menus || {};

    document.querySelectorAll(".sidebar-links [data-menu-id]").forEach(link => {
      const id = link.dataset.menuId;
      const regra = menus[id];
      const podeVer = !regra || regra[papelUsuario] === true;
      link.style.display = podeVer ? "" : "none";
    });
  } catch (error) {
    console.error("Erro ao aplicar permissões no menu lateral:", error);
  }
}

// ======================================================================
// ativarMenuLateral
// ======================================================================
export function ativarMenuLateral(papelUsuario) {
  try {
    // ------------------------------
    // 1. Destacar menu atual
    // ------------------------------
    const nomePaginaAtual = window.location.pathname.split("/").pop().split("?")[0].split("#")[0];
    document.querySelectorAll(".sidebar-links a").forEach(link => {
      link.classList.remove("active");
      const linkPagina = link.getAttribute("href").split("/").pop().split("?")[0].split("#")[0];
      if (linkPagina === nomePaginaAtual || (nomePaginaAtual === "" && linkPagina === "index.html")) {
        link.classList.add("active");
      }
    });

    // ------------------------------
    // 2. Logout: Delegation e signOut em todas as instâncias de Firebase
    // ------------------------------
    if (!window.__logoutHandlerPronti) {
      window.__logoutHandlerPronti = true;

      document.addEventListener(
        "click",
        async (e) => {
          const btn = e.target && e.target.closest ? e.target.closest("#btn-logout") : null;
          if (!btn) return; // não é clique no logout

          e.preventDefault();
          e.stopPropagation();
          console.log("[menu-lateral] Clique em sair detectado. Iniciando fluxo de logout...");

          try {
            // dynamic import para inspecionar todas as apps/auths ativas nesta página
            const appMod = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
            const authMod = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");

            const apps = appMod.getApps();
            console.log("[menu-lateral] Apps detectados:", apps.map(a => a.name));

            // Adiciona observers que logam quando houver mudança de estado (útil para detectar re-login automático)
            apps.forEach((a) => {
              try {
                const aAuth = authMod.getAuth(a);
                authMod.onAuthStateChanged(aAuth, (user) => {
                  console.log(`[menu-lateral][onAuthStateChanged] app=${a.name}`, user);
                  if (user) {
                    // Quando um re-login automático ocorrer, imprime stack trace para ajudar a localizar
                    console.trace(`[menu-lateral] Re-auth detected for app=${a.name}`);
                  }
                });
              } catch (errObs) {
                console.warn("[menu-lateral] Não foi possível anexar observer em app", a.name, errObs);
              }
            });

            // Tenta signOut em cada instância encontrada
            for (const a of apps) {
              try {
                const aAuth = authMod.getAuth(a);
                console.log("[menu-lateral] Fazendo signOut() em app:", a.name, aAuth.currentUser);
                await authMod.signOut(aAuth).catch(err => {
                  console.warn("[menu-lateral] signOut falhou para app:", a.name, err);
                });
                console.log("[menu-lateral] signOut completado para app:", a.name);
              } catch (errSign) {
                console.warn("[menu-lateral] Erro ao realizar signOut em app:", a.name, errSign);
              }
            }

            // Tenta também o signOut na instância importada diretamente (fallback)
            try {
              await signOutSingle(auth).catch(() => {});
            } catch (_) {
              // noop
            }

            // Pequena espera para permitir que onAuthStateChanged propague e revele re-logins automáticos
            await new Promise(resolve => setTimeout(resolve, 700));

            // Re-checa se qualquer instância ainda tem usuário
            const stillSignedIn = apps.some((a) => {
              try {
                const aAuth = authMod.getAuth(a);
                return !!aAuth.currentUser;
              } catch (_) {
                return false;
              }
            });

            if (stillSignedIn) {
              console.warn("[menu-lateral] Após tentativas de signOut, ainda existe usuário autenticado. Pode haver um script que re-autentica automaticamente (ex.: signInAnonymously).");
              // Força limpeza local e redirecionamento mesmo assim
              try { localStorage.clear(); } catch(_) {}
              try { sessionStorage.clear(); } catch(_) {}
              window.location.replace("login.html");
              return;
            }

            // Se chegou aqui, logout aparenta ter ocorrido com sucesso
            try { localStorage.clear(); } catch(_) {}
            try { sessionStorage.clear(); } catch(_) {}
            console.log("[menu-lateral] Logout concluído com sucesso. Redirecionando para login.html");
            window.location.replace("login.html");

          } catch (erro) {
            console.error("[menu-lateral] Falha no processo de logout:", erro);
            alert("Erro ao sair da conta: " + (erro && erro.message ? erro.message : erro));
          }
        },
        true // capture
      );
    }

    // ------------------------------
    // 3. Aplicar permissões do menu
    // ------------------------------
    if (papelUsuario) {
      aplicarPermissoesMenuLateral(papelUsuario);
    }
  } catch (erro) {
    console.error("Erro ao ativar menu lateral:", erro);
  }
}
