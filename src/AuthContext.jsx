import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from './db';

export const AuthContext = createContext();

const SESSION_KEY = 'vulpe_mart_session';

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return null;
};

const deleteLegacyCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict; Secure`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [loading, setLoading] = useState(true);

  // logout precisa estar memorizado com useCallback para ser usado dentro do useEffect
  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    deleteLegacyCookie(SESSION_KEY);
    setUser(null);
  }, []);

  const verificarSistema = useCallback(async () => {
    const adminExist = await db.usuarios.where('role').equals('admin').first();
    setNeedsSetup(!adminExist);

    let sessaoGuardada = localStorage.getItem(SESSION_KEY);
    if (!sessaoGuardada) {
      sessaoGuardada = getCookie(SESSION_KEY);
      if (sessaoGuardada) {
        localStorage.setItem(SESSION_KEY, sessaoGuardada);
        deleteLegacyCookie(SESSION_KEY);
      }
    }
    if (sessaoGuardada) {
      setUser(JSON.parse(sessaoGuardada));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    verificarSistema();
  }, [verificarSistema]);

  const configurarAdmin = async (username, password) => {
    const { default: bcrypt } = await import('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    const novoAdmin = { username, passwordHash: hash, role: 'admin' };
    await db.usuarios.add(novoAdmin);
    
    setNeedsSetup(false);
    await login(username, password);
  };

  const login = async (username, password) => {
    const dbUser = await db.usuarios.where('username').equals(username).first();
    if (!dbUser) throw new Error('Utilizador não encontrado.');

    const { default: bcrypt } = await import('bcryptjs');
    const senhaValida = await bcrypt.compare(password, dbUser.passwordHash);
    if (!senhaValida) throw new Error('Senha incorreta.');

    const sessao = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
    setUser(sessao);
  };

  if (loading) return <div className="h-screen bg-zinc-950 flex items-center justify-center text-orange-500 font-mono">A iniciar sistema Vulpe Mart...</div>;

  return (
    <AuthContext.Provider value={{ user, needsSetup, configurarAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);