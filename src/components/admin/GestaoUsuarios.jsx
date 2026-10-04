import { useState } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import bcrypt from 'bcryptjs';
import { useAuth } from '../../AuthContext';
import { UserPlus, Trash2, Shield, User } from 'lucide-react';

export function GestaoUsuarios() {
  const { user: currentUser } = useAuth();
  const usuarios = useLiveQuery(() => db.usuarios.toArray());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vendedor');
  const [erro, setErro] = useState('');

  const adicionarUsuario = async (e) => {
    e.preventDefault();
    setErro('');

    const userLimpo = username.trim();
    if (!userLimpo || !password) return setErro('Preenche todos os campos.');
    if (password.length < 4) return setErro('A senha deve ter pelo menos 4 caracteres.');

    try {
      // Verifica se o nome já está em uso
      const existe = await db.usuarios.where('username').equals(userLimpo).first();
      if (existe) return setErro('Este nome de utilizador já existe no sistema.');

      // Encripta a senha antes de guardar
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
      setErro('Erro ao criar o utilizador na base de dados.');
    }
  };

  const apagarUsuario = async (id) => {
    if (id === currentUser.id) {
      alert('Ação Bloqueada: Não podes apagar a tua própria conta enquanto estás ligado.');
      return;
    }
    
    const confirmar = window.confirm('Tens a certeza que queres remover o acesso a este utilizador?');
    if (confirmar) {
      await db.usuarios.delete(id);
    }
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-full text-zinc-100">
      <h2 className="text-2xl font-bold mb-6 text-red-500 uppercase tracking-wider flex items-center gap-2">
        <UserPlus size={28} /> Gestão de Equipa
      </h2>

      {erro && (
        <div className="bg-red-950 border border-red-700 text-red-200 p-3 mb-6 rounded shadow-lg">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulário de Criação */}
        <div className="lg:col-span-1 bg-zinc-900 p-6 rounded-lg shadow-xl border border-zinc-800 h-fit">
          <h3 className="text-lg font-bold text-zinc-100 mb-4">Adicionar Utilizador</h3>
          <form onSubmit={adicionarUsuario} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 uppercase font-bold">Nome de Operador</label>
              <input 
                type="text" required placeholder="Ex: joao_silva"
                value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>
            
            <div>
              <label className="block text-xs text-zinc-400 mb-1 uppercase font-bold">Senha de Acesso</label>
              <input 
                type="password" required placeholder="Mínimo 4 caracteres"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1 uppercase font-bold">Nível de Acesso</label>
              <select 
                value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 p-3 rounded focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              >
                <option value="vendedor">Vendedor (Apenas POS)</option>
                <option value="admin">Administrador (Acesso Total)</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)] mt-2">
              Registar Acesso
            </button>
          </form>
        </div>

        {/* Lista de Utilizadores Ativos */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="font-bold text-zinc-100">Contas Registadas ({usuarios?.length || 0})</h3>
            </div>
            <ul className="divide-y divide-zinc-800">
              {usuarios?.map(u => (
                <li key={u.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${u.role === 'admin' ? 'bg-red-950/50 text-red-500' : 'bg-zinc-800 text-zinc-400'}`}>
                      {u.role === 'admin' ? <Shield size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-100 text-lg flex items-center gap-2">
                        {u.username}
                        {u.id === currentUser.id && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded uppercase">Tu</span>}
                      </p>
                      <p className="text-xs text-zinc-500 uppercase font-semibold">
                        Nível: {u.role === 'admin' ? 'Administrador' : 'Vendedor POS'}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => apagarUsuario(u.id)}
                    disabled={u.id === currentUser.id}
                    className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-950/30 rounded transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
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