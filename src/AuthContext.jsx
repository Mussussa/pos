import { createContext, useContext, useState, useEffect } from 'react';
import { db } from './db';
import bcrypt from 'bcryptjs';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [loading, setLoading] = useState(true);

  // 2 horas em milissegundos
  const TEMPO_EXPIRACAO_SESSAO = 2 * 60 * 60 * 1000;

  useEffect(() => {
    verificarSistema();
  }, []);

  const verificarSistema = async () => {
    // Verifica se já há um admin criado na base de dados
    const adminExist = await db.usuarios.where('role').equals('admin').first();
    setNeedsSetup(!adminExist);

    // Verifica se o navegador já tem uma sessão guardada
    const sessaoGuardada = localStorage.getItem('loja_session');
    
    if (sessaoGuardada) {
      const dadosSessao = JSON.parse(sessaoGuardada);
      const tempoDecorrido = Date.now() - dadosSessao.timestamp;

      // Se passou o tempo limite, destrói a sessão
      if (tempoDecorrido >= TEMPO_EXPIRACAO_SESSAO) {
        localStorage.removeItem('loja_session');
        setUser(null);
      } else {
        setUser(dadosSessao);
      }
    }
    setLoading(false);
  };

  const configurarAdmin = async (username, password) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    
    const novoAdmin = { username, passwordHash: hash, role: 'admin' };
    await db.usuarios.add(novoAdmin);
    
    setNeedsSetup(false);
    await login(username, password);
  };

  const login = async (username, password) => {
    const dbUser = await db.usuarios.where('username').equals(username).first();
    if (!dbUser) throw new Error('Utilizador não encontrado.');

    const senhaValida = bcrypt.compareSync(password, dbUser.passwordHash);
    if (!senhaValida) throw new Error('Senha incorreta.');

    // Adiciona o timestamp exato do momento do login
    const sessao = { 
      id: dbUser.id, 
      username: dbUser.username, 
      role: dbUser.role,
      timestamp: Date.now()
    };
    
    localStorage.setItem('loja_session', JSON.stringify(sessao));
    setUser(sessao);
  };

  const logout = () => {
    localStorage.removeItem('loja_session');
    setUser(null);
  };

  if (loading) return <div className="h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono">A iniciar sistema de segurança...</div>;

  return (
    <AuthContext.Provider value={{ user, needsSetup, configurarAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);