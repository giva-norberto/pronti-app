import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  query, where, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { uploadFile } from './uploadService.js';
import { app, db, auth, storage } from "./firebase-config.js";

window.addEventListener('DOMContentLoaded', () => {
  // Elementos DOM
  const el = {
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
    linkVitrineMenu: document.querySelector('.sidebar-links a[href="vitrine.html"]'),
    btnLogout: document.getElementById('btn-logout'),
    listaProfissionaisPainel: document.getElementById('lista-profissionais-painel'),
    btnAddProfissional: document.getElementById('btn-add-profissional'),
    modalAddProfissional: document.getElementById('modal-add-profissional'),
    formAddProfissional: document.getElementById('form-add-profissional'),
    btnCancelarProfissional: document.getElementById('btn-cancelar-profissional')
  };

  let currentUser = null;
  let empresaId = null;
  let unsubProfissionais = null;
  let listenersAdicionados = false;

  // Inicia autenticação
  onAuthStateChanged(auth, (user) => {
    console.log("onAuthStateChanged disparou. Usuário:", user);
    if (user) {
      currentUser = user;
      carregarDadosPerfil(user.uid);
      if (!listenersAdicionados) {
        adicionarListenersDeEvento();
        listenersAdicionados = true;
      }
    } else {
      window.location.href = 'login.html';
    }
  });

  // Carrega dados do perfil/empresa
  async function carregarDadosPerfil(uid) {
    try {
      if (!uid) throw new Error("Usuário não autenticado (uid vazio)");
      if (!db) throw new Error("Firestore não inicializado (db vazio)");

      console.log('Buscando empresa para UID:', uid);

      // Checa se a coleção existe (consulta Firestore)
      const empresariosRef = collection(db, "empresarios");
      if (!empresariosRef) throw new Error("Não foi possível obter referência da coleção 'empresarios'");

      const q = query(empresariosRef, where("donoId", "==", uid));
      const snapshot = await getDocs(q);

      console.log('Snapshot resultado:', snapshot);
      console.log('Snapshot empty?', snapshot.empty);

      const secaoEquipe = el.btnAddProfissional?.closest?.('.form-section');

      if (snapshot.empty) {
        atualizarTelaParaNovoPerfil(secaoEquipe);
      } else {
        const empresaDoc = snapshot.docs[0];
        empresaId = empresaDoc.id;
        const dadosEmpresa = empresaDoc.data();

        console.log("Empresa encontrada:", empresaId, dadosEmpresa);

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
      console.error("Erro ao carregar dados: ", error.code, error.message, error.stack || error);
      alert("Erro ao carregar dados do perfil: " + error.message);
    }
  }

  // Atualiza tela para novo perfil
  function atualizarTelaParaNovoPerfil(secaoEquipe) {
    if (el.h1Titulo) el.h1Titulo.textContent = "Crie seu Perfil de Negócio";
    if (el.containerLinkVitrine) el.containerLinkVitrine.style.display = 'none';
    if (el.btnAbrirVitrine) el.btnAbrirVitrine.style.display = 'none';
    if (secaoEquipe) secaoEquipe.style.display = 'none';
    if (el.linkVitrineMenu) {
      el.linkVitrineMenu.classList.add('disabled');
      el.linkVitrineMenu.style.pointerEvents = 'none';
      el.linkVitrineMenu.style.opacity = '0.5';
      el.linkVitrineMenu.href = '#';
    }
  }

  function iniciarListenerProfissionais(idDaEmpresa) {
    if (!el.listaProfissionaisPainel) return;
    if (unsubProfissionais) unsubProfissionais();
    const profissionaisRef = collection(db, "empresarios", idDaEmpresa, "profissionais");
    unsubProfissionais = onSnapshot(profissionaisRef, (snapshot) => {
      const profissionais = snapshot.docs.map(doc => doc.data());
      renderizarListaProfissionais(profissionais);
    });
  }

  function renderizarListaProfissionais(profissionais) {
    if (!el.listaProfissionaisPainel) return;
    if (profissionais.length === 0) {
      el.listaProfissionaisPainel.innerHTML = `<p>Nenhum profissional na equipe ainda.</p>`;
      return;
    }
    el.listaProfissionaisPainel.innerHTML = profissionais.map(profissional => (
      `<div class="profissional-card" style="border:1px solid #e5e7eb;padding:10px;border-radius:8px;display:flex;align-items:center;gap:10px;background:white;margin-bottom:8px;">
        <img src="${profissional.fotoUrl || 'https://placehold.co/40x40/eef2ff/4f46e5?text=P'}" alt="Foto de ${profissional.nome}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        <span class="profissional-nome" style="font-weight:500;">${profissional.nome}</span>
      </div>`
    )).join('');
  }

  function preencherFormulario(dadosEmpresa) {
    if (el.nomeNegocioInput) el.nomeNegocioInput.value = dadosEmpresa.nomeFantasia || '';
    if (el.descricaoInput) el.descricaoInput.value = dadosEmpresa.descricao || '';
    if (el.logoPreview && dadosEmpresa.logoUrl) el.logoPreview.src = dadosEmpresa.logoUrl;

    const urlCompleta = `${window.location.origin}/vitrine.html?empresa=${empresaId}`;
    if (el.urlVitrineEl) el.urlVitrineEl.textContent = urlCompleta;
    if (el.btnAbrirVitrine) {
      el.btnAbrirVitrine.href = urlCompleta;
      el.btnAbrirVitrine.style.display = 'inline-flex';
    }
    if (el.linkVitrineMenu) {
      el.linkVitrineMenu.href = urlCompleta;
      el.linkVitrineMenu.classList.remove('disabled');
      el.linkVitrineMenu.style.pointerEvents = 'auto';
      el.linkVitrineMenu.style.opacity = '1';
    }
    if (el.containerLinkVitrine) el.containerLinkVitrine.style.display = 'block';
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    if (el.btnSalvar) {
      el.btnSalvar.disabled = true;
      el.btnSalvar.textContent = 'Salvando...';
    }
    try {
      const uid = currentUser.uid;
      const nomeNegocio = el.nomeNegocioInput ? el.nomeNegocioInput.value.trim() : '';
      if (!nomeNegocio) throw new Error("O nome do negócio é obrigatório.");

      const dadosEmpresa = {
        nomeFantasia: nomeNegocio,
        descricao: el.descricaoInput ? el.descricaoInput.value.trim() : '',
        donoId: uid
      };

      const logoFile = el.logoInput && el.logoInput.files[0];
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
        alert("Perfil atualizado com sucesso!");
      } else {
        const novaEmpresaRef = await addDoc(collection(db, "empresarios"), dadosEmpresa);
        empresaId = novaEmpresaRef.id;
        alert("Seu negócio foi cadastrado com sucesso!");
        window.location.reload();
      }
    } catch (error) {
      console.error("Erro ao salvar perfil:", error.code, error.message, error.stack || error);
      alert("Ocorreu um erro ao salvar: " + error.message);
    } finally {
      if (el.btnSalvar) {
        el.btnSalvar.disabled = false;
        el.btnSalvar.textContent = 'Salvar Todas as Configurações';
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
      if (el.modalAddProfissional) el.modalAddProfissional.style.display = 'none';
    } catch (error) {
      console.error("Erro ao adicionar profissional:", error.code, error.message, error.stack || error);
      alert("Erro ao adicionar profissional: " + error.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Salvar Profissional';
    }
  }

  function adicionarListenersDeEvento() {
    if (el.form) el.form.addEventListener('submit', handleFormSubmit);
    if (el.btnCopiarLink) el.btnCopiarLink.addEventListener('click', copiarLink);
    if (el.btnUploadLogo) el.btnUploadLogo.addEventListener('click', () => el.logoInput && el.logoInput.click());
    if (el.logoInput) el.logoInput.addEventListener('change', () => {
      if (el.logoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { if (el.logoPreview) el.logoPreview.src = e.target.result; };
        reader.readAsDataURL(el.logoInput.files[0]);
      }
    });
    if (el.btnLogout) el.btnLogout.addEventListener('click', async () => {
      try { await signOut(auth); window.location.href = 'login.html'; }
      catch (error) { console.error("Erro no logout:", error.code, error.message, error.stack || error); alert("Ocorreu um erro ao sair."); }
    });

    if (el.btnAddProfissional) {
      el.btnAddProfissional.addEventListener('click', () => {
        if (!empresaId) {
          alert("Você precisa salvar as configurações do seu negócio antes de adicionar um funcionário.");
          return;
        }
        if (el.formAddProfissional) el.formAddProfissional.reset();
        if (el.modalAddProfissional) el.modalAddProfissional.style.display = 'flex';
      });
    }

    if (el.btnCancelarProfissional) {
      el.btnCancelarProfissional.addEventListener('click', () => {
        if (el.modalAddProfissional) el.modalAddProfissional.style.display = 'none';
      });
    }
    if (el.formAddProfissional) {
      el.formAddProfissional.addEventListener('submit', handleAdicionarProfissional);
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
