import { useState, useEffect } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import bcrypt from 'bcryptjs';
import { useAuth } from '../../AuthContext';
import { UserPlus, Trash2, Shield, User, Store, Save, Users } from 'lucide-react';
export function GestaoUsuarios() {
  const { user: currentUser } = useAuth();
  
  // --- ESTADOS: GESTÃO DE UTILIZADORES ---
  const usuarios = useLiveQuery(() => db.usuarios.toArray());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vendedor');
  const [erroUsers, setErroUsers] = useState('');

  // --- ESTADOS: PERFIL DA LOJA ---
  const perfilDB = useLiveQuery(() => db.sistema.get('perfil_loja'));
  const [nomeLoja, setNomeLoja] = useState('');
  const [telefoneLoja, setTelefoneLoja] = useState('');
  const [enderecoLoja, setEnderecoLoja] = useState('');
  const [msgPerfil, setMsgPerfil] = useState('');

  // Carrega os dados da loja para os inputs assim que abres a página
  useEffect(() => {
    if (perfilDB) {
      setNomeLoja(perfilDB.nome_loja || '');
      setTelefoneLoja(perfilDB.telefone || '');
      setEnderecoLoja(perfilDB.endereco || '');
    }
  }, [perfilDB]);

  // --- FUNÇÕES: PERFIL DA LOJA ---
  const guardarPerfilLoja = async (e) => {
    e.preventDefault();
    try {
      // O put atualiza ou cria o registo com id 'perfil_loja'
      await db.sistema.put({
        id: 'perfil_loja',
        nome_loja: nomeLoja,
        telefone: telefoneLoja,
        endereco: enderecoLoja
      });
      setMsgPerfil('✅ Dados do recibo atualizados!');
      setTimeout(() => setMsgPerfil(''), 3000);
    } catch (err) {
      setMsgPerfil('🚨 Erro ao guardar configurações.');
    }
  };

  // --- FUNÇÕES: UTILIZADORES ---
  const adicionarUsuario = async (e) => {
    e.preventDefault();
    setErroUsers('');

    const userLimpo = username.trim();
    if (!userLimpo || !password) return setErroUsers('Preenche todos os campos.');
    if (password.length < 4) return setErroUsers('A senha deve ter pelo menos 4 caracteres.');

    try {
      const existe = await db.usuarios.where('username').equals(userLimpo).first();
      if (existe) return setErroUsers('Este nome de utilizador já existe no sistema.');

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      await db.usuarios.add({
        username: userLimpo,
        passwordHash: hash,
        role
      });

      setUsername('');
      setPassword('');
    } catch (err) {
      setErroUsers('Erro ao criar o utilizador na base de dados.');
    }
  };

  const apagarUsuario = async (id) => {
    if (id === currentUser.id) {
      alert('Ação Bloqueada: Não podes apagar a tua própria conta enquanto estás ligado.');
      return;
    }
    const confirmar = window.confirm('Tens a certeza que queres remover o acesso a este utilizador?');
    if (confirmar) await db.usuarios.delete(id);
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-full text-zinc-900 font-sans">
      <h2 className="text-2xl font-bold mb-6 text-orange-500 uppercase tracking-wider flex items-center gap-2">
        <Users size={28} /> Configurações Gerais
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Formulários */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* 1. Formulário do Perfil da Loja */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <Store size={20} className="text-orange-500" /> Perfil da Loja e Recibo
            </h3>
            
            {msgPerfil && (
              <div className={`p-2 mb-4 rounded text-sm font-bold ${msgPerfil.includes('🚨') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {msgPerfil}
              </div>
            )}

            <form onSubmit={guardarPerfilLoja} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase font-bold">Nome da Loja</label>
                <input 
                  type="text" required placeholder="Ex: Mercearia Central"
                  value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)}
                  className="w-full bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase font-bold">Contactos (Telefone)</label>
                <input 
                  type="text" placeholder="Ex: 845773342"
                  value={telefoneLoja} onChange={(e) => setTelefoneLoja(e.target.value)}
                  className="w-full bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase font-bold">Endereço (Bairro/Cidade)</label>
                <input 
                  type="text" placeholder="Ex: Chimoio, Manica"
                  value={enderecoLoja} onChange={(e) => setEnderecoLoja(e.target.value)}
                  className="w-full bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-900 text-white font-bold py-3 rounded transition-colors flex items-center justify-center gap-2">
                <Save size={18} /> Guardar Dados
              </button>
            </form>
          </div>

          {/* 2. Formulário de Utilizadores */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-orange-500" /> Adicionar Operador
            </h3>
            
            {erroUsers && (
              <div className="bg-orange-50 border border-orange-500 text-orange-700 p-3 mb-4 rounded shadow-sm text-sm">
                {erroUsers}
              </div>
            )}

            <form onSubmit={adicionarUsuario} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase font-bold">Utilizador</label>
                <input 
                  type="text" required placeholder="Ex: joao_silva"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase font-bold">Senha</label>
                <input 
                  type="password" required placeholder="Mínimo 4 caracteres"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase font-bold">Acesso</label>
                <select 
                  value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-zinc-300 text-zinc-900 p-3 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                >
                  <option value="vendedor">Vendedor (Apenas POS)</option>
                  <option value="admin">Administrador (Total)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded transition-colors mt-2">
                Registar Acesso
              </button>
            </form>
          </div>

        </div>

        {/* Coluna Direita: Lista de Utilizadores Ativos */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50">
              <h3 className="font-bold text-zinc-800">Contas Registadas no Dispositivo ({usuarios?.length || 0})</h3>
            </div>
            <ul className="divide-y divide-zinc-100">
              {usuarios?.map(u => (
                <li key={u.id} className="p-4 flex items-center justify-between hover:bg-orange-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${u.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
                      {u.role === 'admin' ? <Shield size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 text-lg flex items-center gap-2">
                        {u.username}
                        {u.id === currentUser.id && <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded uppercase">Tu</span>}
                      </p>
                      <p className="text-xs text-zinc-500 uppercase font-semibold">
                        Nível: {u.role === 'admin' ? 'Administrador' : 'Vendedor POS'}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => apagarUsuario(u.id)}
                    disabled={u.id === currentUser.id}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 cursor-pointer disabled:cursor-not-allowed"
                    title={u.id === currentUser.id ? "Não podes apagar a ti próprio" : "Remover acesso"}
                  >
                    <Trash2 size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}