import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { ShieldCheck, UserCircle, Key } from 'lucide-react';

export function Login() {
  const { needsSetup, configurarAdmin, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (needsSetup) {
        await configurarAdmin(username, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl relative overflow-hidden">
        
        {/* Decoração Orange Mode */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-900 via-orange-500 to-orange-900"></div>

        <div className="text-center mb-8 mt-2">
          <img src="/logo_vulpe_instinct.png" alt="Logótipo Vulpe Mart" className="w-24 h-24 mx-auto rounded-xl mb-4 shadow-[0_0_20px_rgba(249,115,22,0.15)] border border-zinc-800" />
          <h1 className="text-2xl font-bold text-zinc-100 tracking-wider">VULPE <span className="text-orange-500">MART</span></h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
            {needsSetup ? 'Configuração Inicial' : 'Acesso Reservado'}
          </p>
        </div>

        {erro && <div className="bg-orange-950 border border-orange-700 text-orange-200 p-3 mb-6 rounded text-sm text-center">{erro}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {needsSetup && (
            <div className="bg-orange-950/30 border border-orange-900/50 p-4 rounded text-orange-200 text-sm flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-orange-500" size={24} />
              <p>Nenhum administrador detetado. Cria a conta principal para desbloquear e encriptar a base de dados.</p>
            </div>
          )}

          <div className="relative">
            <UserCircle className="absolute left-3 top-3.5 text-zinc-500" size={20} />
            <input 
              type="text" required placeholder="Nome de Utilizador"
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 p-3 pl-10 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="relative">
            <Key className="absolute left-3 top-3.5 text-zinc-500" size={20} />
            <input 
              type="password" required placeholder="Senha"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 p-3 pl-10 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded transition-colors shadow-[0_0_15px_rgba(249,115,22,0.3)] mt-2">
            {needsSetup ? 'Registar e Abrir Loja' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}