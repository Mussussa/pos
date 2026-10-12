import { createContext, useContext, useState, useEffect } from 'react';
import { db } from './db';
import bcrypt from 'bcryptjs';

export const AuthContext = createContext();

// Funções auxiliares para gerir o cookie
const setCookie = (name, value, hours) => {
  const date = new Date();
  date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Strict`;
};

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verificarSistema();

    // O browser destrói o cookie sozinho ao fim de 6h.
    // Este intervalo serve apenas para avisar a interface visual e mandar o utilizador para o login se a aba ficar aberta.
    const intervaloValidade = setInterval(() => {
      if (!getCookie('vulpe_mart_session') && user) {
        setUser(null);
        alert("A tua sessão expirou. Faz login novamente.");
      }
    }, 60000); // Verifica a cada minuto

    return () => clearInterval(intervaloValidade);
  }, [user]);

  const verificarSistema = async () => {
    const adminExist = await db.usuarios.where('role').equals('admin').first();
    setNeedsSetup(!adminExist);

    const sessaoGuardada = getCookie('vulpe_mart_session');
    if (sessaoGuardada) {
      setUser(JSON.parse(sessaoGuardada));
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

  const logout = () => {
    deleteCookie('vulpe_mart_session');
    setUser(null);
  };

  if (loading) return <div className="h-screen bg-zinc-950 flex items-center justify-center text-orange-500 font-mono">A iniciar sistema Vulpe Mart...</div>;

  return (
    <AuthContext.Provider value={{ user, needsSetup, configurarAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);