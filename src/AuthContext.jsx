import { createContext, useContext, useState, useEffect } from 'react';
import { db } from './db';
import bcrypt from 'bcryptjs';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verificarSistema();
  }, []);

  const verificarSistema = async () => {
    const adminExist = await db.usuarios.where('role').equals('admin').first();
    setNeedsSetup(!adminExist);

    const sessaoGuardada = localStorage.getItem('vulpe_mart_session');
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
    localStorage.setItem('vulpe_mart_session', JSON.stringify(sessao));
    setUser(sessao);
  };

  const logout = () => {
    localStorage.removeItem('vulpe_mart_session');
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