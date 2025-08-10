// Importa tudo que o Firebase precisa
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  query, where, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";

// Segurança extra: verificar inicialização
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
    listaProfissionaisPainel: document.getElementById('lista-profissionais-painel'),
    btnAddProfissional: document.getElementById('btn-add-profissional'),
    modalAddProfissional: document.getElementById('modal-add-profissional'),
    formAddProfissional: document.getElementById('form-add-profissional'),
    btnCancelarProfissional: document.getElementById('btn-cancelar-profissional')
  };

  let currentUser;
  let empresaId = null;
  let unsubProfissionais = null;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      verificarOuCriarEmpresa(user.uid);
      adicionarListenersDeEvento();
    } else {
      window.location.href = 'login.html';
    }
  });

  async function verificarOuCriarEmpresa(uid) {
    try {
      console.log("[DEBUG] Buscando empresa do dono:", uid);

      const empresariosRef = collection(db, "empresarios");
      const q = query(empresariosRef, where("donoId", "==", uid));
      const snapshot = await getDocs(q);

      const secaoEquipe = elements.btnAddProfissional?.closest?.('.form-section');

      if (snapshot.empty) {
        console.warn("[DEBUG] Nenhuma empresa encontrada. Criando nova empresa...");
        empresaId = (await addDoc(collection(db, "empresarios"), {
          nomeFantasia: "",
          descricao: "",
          donoId: uid,
          logoUrl: ""
        })).id;

        await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), {
          nome: currentUser.displayName || "Proprietário",
          fotoUrl: currentUser.photoURL || "",
          ehDono: true
        });

        atualizarTelaParaNovoPerfil(secaoEquipe);
      } else {
        const empresaDoc = snapshot.docs[0];
        empresaId = empresaDoc.id;
        const dadosEmpresa = empresaDoc.data();

        console.log("[DEBUG] Empresa encontrada:", empresaId, dadosEmpresa);

        // Buscar dados do profissional
        const profissionalRef = doc(db, "empresarios", empresaId, "profissionais", uid);
        const profissionalSnap = await getDoc(profissionalRef);

        let dadosProfissional = {};
        let ehDono = false;
        if (profissionalSnap.exists()) {
          dadosProfissional = profissionalSnap.data();
          ehDono = dadosProfissional.ehDono === true;
        }

        preencherFormulario(dadosEmpresa);

        if (ehDono) {
          if (secaoEquipe) secaoEquipe.style.display = 'block';
          iniciarListenerProfissionais(empresaId);
        } else {
          if (secaoEquipe) secaoEquipe.style.display = 'none';
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      console.error("Tipo do erro:", error.name);
      console.error("Mensagem do erro:", error.message);
      console.error("Stack:", error.stack);
      alert("Erro ao carregar dados do perfil: " + error.message);
    }
  }

  function atualizarTelaParaNovoPerfil(secaoEquipe) {
    if (elements.h1Titulo) elements.h1Titulo.textContent = "Crie seu Perfil de Negócio";
    if (elements.containerLinkVitrine) elements.containerLinkVitrine.style.display = 'none';
    if (elements.btnAbrirVitrine) elements.btnAbrirVitrine.style.display = 'none';
    if (secaoEquipe) secaoEquipe.style.display = 'none';
    if (elements.linkVitrineMenu) {
      elements.linkVitrineMenu.classList.add('disabled');
      elements.linkVitrineMenu.style.pointerEvents = 'none';
      elements.linkVitrineMenu.style.opacity = '0.5';
      elements.linkVitrineMenu.href = '#';
    }
  }

  function iniciarListenerProfissionais(idDaEmpresa) {
    if (!elements.listaProfissionaisPainel) return;
    if (unsubProfissionais) unsubProfissionais();
    const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");
    unsubProfissionais = onSnapshot(profissionaisRef, (snapshot) => {
      const profissionais = snapshot.docs.map(doc => doc.data());
      renderizarListaProfissionais(profissionais);
    });
  }

  function renderizarListaProfissionais(profissionais) {
    if (!elements.listaProfissionaisPainel) return;
    if (profissionais.length === 0) {
      elements.listaProfissionaisPainel.innerHTML = `<p>Nenhum profissional na equipe ainda.</p>`;
      return;
    }
    elements.listaProfissionaisPainel.innerHTML = profissionais.map(profissional => (
      `<div class="profissional-card" style="border:1px solid #e5e7eb;padding:10px;border-radius:8px;display:flex;align-items:center;gap:10px;background:white;margin-bottom:8px;">
        <img src="${profissional.fotoUrl || 'https://placehold.co/40x40/eef2ff/4f46e5?text=P'}" alt="Foto de ${profissional.nome}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        <span class="profissional-nome" style="font-weight:500;">${profissional.nome}</span>
      </div>`
    )).join('');
  }

  function preencherFormulario(dadosEmpresa) {
    if (elements.nomeNegocioInput) elements.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
    if (elements.descricaoInput) elements.descricaoInput.value = dadosEmpresa.descricao || '';
    if (elements.logoPreview && dadosEmpresa.logoUrl) elements.logoPreview.src = dadosEmpresa.logoUrl;

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
        nome: currentUser.displayName || nomeNegocio,
        fotoUrl: currentUser.photoURL || "",
        ehDono: true
      };

      const logoFile = elements.logoInput && elements.logoInput.files[0];
      if (logoFile) {
        const storagePath = `logos/${uid}/logo`;
        const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
        dadosEmpresa.logoUrl = await uploadFile(firebaseDependencies, logoFile, storagePath);
      } else if (empresaId) {
        const empresaAtualSnap = await getDoc(doc(db, "empresarios", empresaId));
        if (empresaAtualSnap.exists()) dadosEmpresa.logoUrl = empresaAtualSnap.data().logoUrl || '';
      }

      if (empresaId) {
        await setDoc(doc(db, "empresarios", empresaId), dadosEmpresa, { merge: true });
        await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional, { merge: true });
        alert("Perfil atualizado com sucesso!");
      } else {
        const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
        empresaId = novaEmpresaRef.id;
        await setDoc(doc(db, "empresarios", empresaId, "profissionais", uid), dadosProfissional, { merge: true });
        alert("Seu negócio foi cadastrado com sucesso!");
        window.location.reload();
      }
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

  async function handleAdicionarProfissional(event) {
    event.preventDefault();
    const btnSubmit = event.target.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Salvando...';
    try {
      const nomeInput = document.getElementById('nome-profissional');
      const fotoInput = document.getElementById('foto-profissional');
      const nome = nomeInput ? nomeInput.value.trim() : '';
      const fotoFile = fotoInput ? fotoInput.files[0] : undefined;
      if (!nome) throw new Error("O nome do profissional é obrigatório.");

      let fotoUrl = '';
      if (fotoFile) {
        const storagePath = `fotos-profissionais/${empresaId}/${Date.now()}-${fotoFile.name}`;
        const firebaseDependencies = { storage, ref, uploadBytes, getDownloadURL };
        fotoUrl = await uploadFile(firebaseDependencies, fotoFile, storagePath);
      }

      const novoProfissional = { nome, fotoUrl, servicos: [], ehDono: false };
      await addDoc(collection(db, "empresarios", empresaId, "profissionais"), novoProfissional);

      alert("Profissional adicionado com sucesso!");
      if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
    } catch (error) {
      console.error("Erro ao adicionar profissional:", error);
      alert("Erro ao adicionar profissional: " + error.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Salvar Profissional';
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

    if (elements.btnAddProfissional) {
      elements.btnAddProfissional.addEventListener('click', () => {
        if (!empresaId) {
          alert("Você precisa salvar as configurações do seu negócio antes de adicionar um funcionário.");
          return;
        }
        if (elements.formAddProfissional) elements.formAddProfissional.reset();
        if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'flex';
      });
    }

    if (elements.btnCancelarProfissional) {
      elements.btnCancelarProfissional.addEventListener('click', () => {
        if (elements.modalAddProfissional) elements.modalAddProfissional.style.display = 'none';
      });
    }
    if (elements.formAddProfissional) {
      elements.formAddProfissional.addEventListener('submit', handleAdicionarProfissional);
    }
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

