import React, { useState, useEffect } from 'react';
import { Plus, Users, X, Upload, User } from 'lucide-react';

// Simulação de dados para demonstração
const mockProfissionais = [
  {
    id: 1,
    nome: "Ana Silva",
    fotoUrl: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
    ehDono: true
  },
  {
    id: 2,
    nome: "Carlos Santos",
    fotoUrl: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
    ehDono: false
  }
];

function App() {
  const [profissionais, setProfissionais] = useState(mockProfissionais);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const abrirModal = () => {
    console.log('🎭 Abrindo modal...');
    setModalAberto(true);
    setNome('');
    setFoto(null);
  };

  const fecharModal = () => {
    console.log('🙈 Fechando modal...');
    setModalAberto(false);
    setNome('');
    setFoto(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      alert('O nome do profissional é obrigatório.');
      return;
    }

    setSalvando(true);
    console.log('💾 Salvando profissional:', { nome, foto: !!foto });

    // Simular salvamento
    setTimeout(() => {
      const novoProfissional = {
        id: Date.now(),
        nome: nome.trim(),
        fotoUrl: foto ? URL.createObjectURL(foto) : "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
        ehDono: false
      };

      setProfissionais(prev => [...prev, novoProfissional]);
      setSalvando(false);
      fecharModal();
      
      alert('✅ Profissional adicionado com sucesso!');
    }, 1000);
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      console.log('📸 Foto selecionada:', file.name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-8 h-8" />
            <h1 className="text-3xl font-light">Gerenciamento de Equipe</h1>
          </div>
          <p className="text-blue-100 text-lg">Gerencie sua equipe de profissionais de forma simples e eficiente</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Debug Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 font-mono text-sm">
          <h4 className="text-gray-700 font-semibold mb-2">🔍 Status do Sistema:</h4>
          <div className="text-gray-600">
            <div>✅ Sistema inicializado</div>
            <div>✅ {profissionais.length} profissionais carregados</div>
            <div>✅ Modal: {modalAberto ? 'Aberto' : 'Fechado'}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">Minha Equipe</h2>
          <button
            onClick={abrirModal}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            Adicionar Profissional
          </button>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profissionais.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">Equipe Vazia</h3>
              <p className="text-gray-500">Nenhum profissional na equipe ainda. Clique em "Adicionar Profissional" para começar.</p>
            </div>
          ) : (
            profissionais.map(profissional => (
              <div key={profissional.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-blue-200 flex-shrink-0">
                    <img 
                      src={profissional.fotoUrl} 
                      alt={`Foto de ${profissional.nome}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop";
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800 mb-1">{profissional.nome}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      profissional.ehDono 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {profissional.ehDono ? 'Dono' : 'Funcionário'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Adicionar Novo Profissional</h2>
              <p className="text-gray-600">Preencha os dados do novo membro da equipe</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="nome" className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Digite o nome completo do profissional"
                  required
                />
              </div>

              <div>
                <label htmlFor="foto" className="block text-sm font-semibold text-gray-700 mb-2">
                  Foto do Profissional
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="foto"
                    onChange={handleFotoChange}
                    accept="image/*"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <Upload className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Formatos aceitos: JPG, PNG, GIF (máx. 5MB)</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {salvando ? 'Salvando...' : 'Salvar Profissional'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
