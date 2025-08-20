import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";
import { verificarAcesso } from "./userService.js";

if (!app || !db || !auth || !storage) {
  console.error("Firebase não foi inicializado corretamente. Verifique firebase-config.js");
  throw new Error("Firebase não inicializado. Verifique firebase-config.js");
}

window.addEventListener('DOMContentLoaded', () => {
  const elements = {
    h1Titulo: document.getElementById('main-title'),
    form: document.getElementById('form-perfil'),
    nomeNegocioInput: document.getElementById('nomeNegocio'),
    descricaoInput: document.getElementById('descricao'),
    logoInput: document.getElementById('logoNegocio'),
    logoPreview: document.getElementById('logo-preview'),
    btnUploadLogo: document.getElementById('btn-upload-logo'),
    btnSalvar: document.querySelector('#form-perfil button[type="submit"]'),
    btnCopiarLink: document.getElementById('btn-copiar-link'),
    containerLinkVitrine: document.getElementById('container-link-vitrine'),
    urlVitrineEl: document.getElementById('url-vitrine-display'),
    btnAbrirVitrine: document.getElementById('btn-abrir-vitrine'),
    btnAbrirVitrineInline: document.getElementById('btn-abrir-vitrine-inline'),
    linkVitrineMenu: document.querySelector('.sidebar-links a[href="vitrine.html"]'),
    btnLogout: document.getElementById('btn-logout'),
    msgFree: document.getElementById('mensagem-free') // Adicione um div com esse id no HTML!
  };

  let currentUser;
  let empresaId = null;
  let isNovoCadastro = false; // Para controle do fluxo

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      try {
        const acesso = await verificarAcesso();
        if (acesso.role && acesso.role !== "dono") {
          window.location.href = "perfil-funcionario.html";
          return;
        }
      } catch (e) {
        if (e.message !== 'primeiro_acesso') {
          window.location.href = 'login.html';
          return;
        }
      }
      await verificarOuCriarEmpresa(user.uid);
      adicionarListenersDeEvento();
    } else {
      window.location.href = 'login.html';
    }
  });

  async function verificarOuCriarEmpresa(uid) {
    try {
      const empresariosRef = collection(db, "empresarios");
      const q = query(empresariosRef, where("donoId", "==", uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        empresaId = null;
        isNovoCadastro = true;
        atualizarTelaParaNovoPerfil();
      } else {
        const empresaDoc = snapshot.docs[0];
        empresaId = empresaDoc.id;
        isNovoCadastro = false;
        const dadosEmpresa = empresaDoc.data();
        preencherFormulario(dadosEmpresa);
        mostrarCamposExtras(); // Mostra logo, links, etc
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar dados do perfil: " + error.message);
    }
  }

  function atualizarTelaParaNovoPerfil() {
    if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
    if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'none';
    if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'none';
    if (elements.linkVitrineMenu) {
      elements.linkVitrineMenu.classList.add('disabled');
      elements.linkVitrineMenu.style.pointerEvents = 'none';
      elements.linkVitrineMenu.style.opacity = '0.5';
      elements.linkVitrineMenu.href = '#';
    }
    // Esconde campos de logo no cadastro inicial
    if (elements.logoInput) elements.logoInput.parentElement.style.display = "none";
    if (elements.logoPreview) elements.logoPreview.style.display = "none";
    if (elements.btnUploadLogo) elements.btnUploadLogo.style.display = "none";
  }

  // Mostra campos de logo e links
  function mostrarCamposExtras() {
    if (elements.logoInput) elements.logoInput.parentElement.style.display = "";
    if (elements.logoPreview) elements.logoPreview.style.display = "";
    if (elements.btnUploadLogo) elements.btnUploadLogo.style.display = "";
    if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'block';
    if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'inline-flex';
    if (elements.linkVitrineMenu) {
      elements.linkVitrineMenu.classList.remove('disabled');
      elements.linkVitrineMenu.style.pointerEvents = 'auto';
      elements.linkVitrineMenu.style.opacity = '1';
    }
  }

  function preencherFormulario(dadosEmpresa) {
    if (elements.nomeNegocioInput) elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
    if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
    if (elements.logoPreview && dadosEmpresa.logoUrl) {
      elements.logoPreview.src = dadosEmpresa.logoUrl;
    }

    if (!empresaId) return;
    const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
    if (elements.urlVitrineEl) elements.urlVitrineEl.textContent = urlCompleta;
    if (elements.btnAbrirVitrine) {
      elements.btnAbrirVitrine.href = urlCompleta;
      elements.btnAbrirVitrine.style.display = 'inline-flex';
    }
    if (elements.btnAbrirVitrineInline) elements.btnAbrirVitrineInline.href = urlCompleta;
    if (elements.linkVitrineMenu) {
      elements.linkVitrineMenu.href = urlCompleta;
      elements.linkVitrineMenu.classList.remove('disabled');
      elements.linkVitrineMenu.style.pointerEvents = 'auto';
      elements.linkVitrineMenu.style.opacity = '1';
    }
    if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'block';
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    if (elements.btnSalvar) {
      elements.btnSalvar.disabled = true;
      elements.btnSalvar.textContent = 'Salvando...';
    }
    try {
      const uid = currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado.");

      const nomeNegocio = elements.nomeNegocioInput ? elements.nomeNegocioInput.value.trim() : '';
      if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

      const dadosEmpresa = {
        nomeFantasia: nomeNegocio,
        descricao: elements.descricaoInput ? elements.descricaoInput.value.trim() : '',
        donoId: uid
      };

      const dadosProfissional = {
        uid: uid,
        nome: currentUser.displayName || nomeNegocio,
        fotoUrl: currentUser.photoURL || "",
        ehDono: true
      };

      // Cadastro inicial: não envia logo
      if (!empresaId) {
        const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
        empresaId = novaEmpresaRef.id;
        await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional, { merge: true });

        // Mensagem de sucesso com período grátis
        if (elements.msgFree) {
          elements.msgFree.textContent = "Seu negócio foi cadastrado com sucesso! Você ganhou 15 dias grátis!";
          elements.msgFree.style.display = "block";
        } else {
          alert("Seu negócio foi cadastrado com sucesso! Você ganhou 15 dias grátis!");
        }

        // Após salvar, recarrega os dados para mostrar logo, links, etc.
        isNovoCadastro = false;
        await verificarOuCriarEmpresa(uid);
        mostrarCamposExtras();
        // Opcional: não redirecionar, apenas recarregar dados e liberar edição, ou use location.reload() se preferir recarregar a página inteira.
        return;
      }

      // Edição (empresa já criada): pode atualizar logo
      const logoFile = elements.logoInput && elements.logoInput.files[0];
      if (logoFile) {
        const storagePath = `logos/${uid}/logo`;
        const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
        dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
      } else if (empresaId) {
        const empresaAtualSnap = await getDoc(doc(db, "empresarios", empresaId));
        if (empresaAtualSnap.exists()) dadosEmpresa.logoUrl = empresaAtualSnap.data().logoUrl || '';
      }

      await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
      await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional, { merge: true });
      alert("Perfil atualizado com sucesso!");
      await verificarOuCriarEmpresa(uid); // Atualiza dados na tela após edição
      mostrarCamposExtras();
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Ocorreu um erro ao salvar: " + error.message);
    } finally {
      if (elements.btnSalvar) {
        elements.btnSalvar.disabled = false;
        elements.btnSalvar.textContent = 'Salvar Todas as Configurações';
      }
    }
  }

  function adicionarListenersDeEvento() {
    if (elements.form) elements.form.addEventListener('submit', handleFormSubmit);
    if (elements.btnCopiarLink) elements.btnCopiarLink.addEventListener('click', copiarLink);
    if (elements.btnUploadLogo) elements.btnUploadLogo.addEventListener('click', () => elements.logoInput && elements.logoInput.click());
    if (elements.logoInput) elements.logoInput.addEventListener('change', () => {
      if (elements.logoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { if (elements.logoPreview) elements.logoPreview.src = e.target.result; };
        reader.readAsDataURL(elements.logoInput.files[0]);
      }
    });
    if (elements.btnLogout) elements.btnLogout.addEventListener('click', async () => {
      try { await signOut(auth); window.location.href = 'login.html'; }
      catch (error) { console.error("Erro no logout:", error); alert("Ocorreu um erro ao sair."); }
    });
  }

  function copiarLink() {
    if (!empresaId) {
      alert("Salve seu perfil para gerar o link.");
      return;
    }
    const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
    navigator.clipboard.writeText(urlCompleta).then(() => {
      alert("Link da vitrine copiado!");
    }, () => {
      alert("Falha ao copiar o link.");
    });
  }
});
