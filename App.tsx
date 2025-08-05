import React, { useState, useEffect } from 'react';
import { Plus, Users } from 'lucide-react';

// 1. IMPORTAÇÕES DO FIREBASE
import { db, auth, storage } from './firebase-config.js'; // Verifique se este caminho está correto
import { collection, addDoc, onSnapshot, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';

// Define a estrutura de um Profissional
interface Profissional {
  id: string;
  nome: string;
  fotoUrl: string;
  ehDono: boolean;
}

function App() {
  // 2. ESTADOS DA APLICAÇÃO
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // 3. EFEITO PARA AUTENTICAÇÃO E BUSCA DE DADOS
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Encontra a empresa do usuário logado
        const q = query(collection(db, "empresarios"), where("donoId", "==", user.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const id = snapshot.docs[0].id;
          setEmpresaId(id); // Guarda o ID da empresa
        } else {
            setLoading(false);
            console.warn("Nenhuma empresa encontrada para este usuário.");
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Efeito para carregar os profissionais em tempo real QUANDO o empresaId for encontrado
  useEffect(() => {
    if (!empresaId) return;

    setLoading(true);
    const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
    const q = query(profissionaisRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profissional));
      setProfissionais(lista);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar profissionais:", error);
      setLoading(false);
    });

    return () => unsubscribe(); // Desliga o "ouvinte"
  }, [empresaId]);


  const abrirModal = () => {
    setModalAberto(true);
    setNome('');
    setFoto(null);
  };

  const fecharModal = () => {
    setModalAberto(false);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFoto(e.target.files[0]);
    }
  };

  // 4. FUNÇÃO DE SALVAR (handleSubmit) ATUALIZADA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !empresaId) {
      alert('O nome do profissional é obrigatório.');
      return;
    }

    setSalvando(true);
    let fotoURL = '';

    if (foto) {
      try {
        const storageRef = ref(storage, `fotos-profissionais/${empresaId}/${Date.now()}-${foto.name}`);
        await uploadBytes(storageRef, foto);
        fotoURL = await getDownloadURL(storageRef);
      } catch (error) {
        console.error("Erro no upload da foto: ", error);
        alert("Falha ao enviar a foto.");
        setSalvando(false);
        return;
      }
    }

    const novoProfissional = {
      nome: nome.trim(),
      fotoUrl: fotoURL,
      ehDono: false,
      servicos: [],
      horarios: {},
      criadoEm: serverTimestamp()
    };

    try {
      const profissionaisRef = collection(db, "empresarios", empresaId, "profissionais");
      await addDoc(profissionaisRef, novoProfissional);
      alert('✅ Profissional adicionado com sucesso!');
      fecharModal();
    } catch (error) {
      console.error("Erro ao salvar profissional: ", error);
      alert("Falha ao salvar o profissional.");
    } finally {
      setSalvando(false);
    }
  };

  // O seu JSX para a interface vai aqui. 
  // Este é um exemplo baseado na sua interface anterior.
  return (
    <div>
        {/* Aqui entra o seu layout, a lista de profissionais e o modal */}
        <h1>Minha Equipe</h1>
        <button onClick={abrirModal}>+ Adicionar Profissional</button>
        {/* ... etc */}
    </div>
  );
}

export default App;
