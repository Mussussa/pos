import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from './db';
import bcrypt from 'bcryptjs';

export const AuthContext = createContext();

// Funções auxiliares para gerir o cookie
const getCookieOptions = () => {
  const isSecureContext = window.location.protocol === 'https:';
  return [
    'path=/',
    'SameSite=Lax',
    ...(isSecureContext ? ['Secure'] : [])
  ].join('; ');
};

const setCookie = (name, value, hours) => {
  const date = new Date();
  date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; ${getCookieOptions()}`;
};

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; ${getCookieOptions()}`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [loading, setLoading] = useState(true);

  // logout precisa estar memorizado com useCallback para ser usado dentro do useEffect
  const logout = useCallback(() => {
    deleteCookie('vulpe_mart_session');
    setUser(null);
  }, []);

  useEffect(() => {
    verificarSistema();

    // O browser destrói o cookie sozinho ao fim de 6h.
    // Este intervalo serve para avisar a interface visual e executar o logout se a aba ficar aberta.
    const intervaloValidade = setInterval(() => {
      if (!getCookie('vulpe_mart_session') && user) {
        logout();
        alert("A tua sessão expirou após 6 horas. Faz login novamente.");
      }
    }, 60000); // Verifica a cada 60 segundos

    return () => clearInterval(intervaloValidade);
  }, [user, logout]);

  const verificarSistema = async () => {
    const adminExist = await db.usuarios.where('role').equals('admin').first();
    setNeedsSetup(!adminExist);

    const sessaoGuardada = getCookie('vulpe_mart_session');
    if (sessaoGuardada) {
      try {
        setUser(JSON.parse(sessaoGuardada));
      } catch {
        deleteCookie('vulpe_mart_session');
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

    const sessao = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
    
    // Grava o cookie com expiração matemática exata de 6 horas
    setCookie('vulpe_mart_session', JSON.stringify(sessao), 6);
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