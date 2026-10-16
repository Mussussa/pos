import { useEffect } from "react"; // <-- Adicionado
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  Package,
  BarChart3,
  ShoppingCart,
  LogOut,
  DatabaseBackup,
  Users
} from "lucide-react";

import { GestaoProdutos } from "./components/admin/GestaoProdutos";
import { RelatoriosAdmin } from "./components/admin/RelatoriosAdmin";
import { BackupGlobal } from "./components/admin/BackupGlobal";
import { GestaoUsuarios } from "./components/admin/GestaoUsuarios";
import { TerminalVendas } from "./components/vendedor/TerminalVendas";
import { Login } from "./components/Login";
import { AuthProvider, useAuth } from "./AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const linkAtivo = (caminho) =>
    location.pathname === caminho
      ? "bg-zinc-900 text-orange-500 border-r-4 border-orange-600 shadow-[inset_0px_0px_15px_rgba(249,115,22,0.05)]"
      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-orange-400 border-r-4 border-transparent";

  return (
    <aside className="group w-[80px] hover:w-64 h-screen sticky top-0 bg-zinc-950 flex flex-col border-r border-zinc-800 print:hidden shrink-0 transition-all duration-300 ease-in-out z-50 overflow-hidden shadow-2xl">
      
      {/* Cabeçalho do Menu (Logótipo e Perfil) */}
      <div className="mb-6 py-6 border-b border-zinc-800 flex flex-col items-center">
        <img
          src="/logo_vulpe_instinct.png"
          alt="Vulpe Mart Logótipo"
          className="w-10 group-hover:w-24 h-auto rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.15)] border border-zinc-800 transition-all duration-300 object-cover"
        />
        
        <div className="flex flex-col items-center overflow-hidden transition-all duration-300 max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 group-hover:mt-4">
          <h1 className="text-xl font-bold text-zinc-100 tracking-wider whitespace-nowrap">
            VULPE <span className="text-orange-500">MART</span>
          </h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1 whitespace-nowrap">
            Op: <span className="text-zinc-300 font-bold">{user.username}</span>
          </p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar px-3">
        {user.role === "admin" && (
          <>
            <Link
              to="/"
              className={`flex items-center p-3 rounded-lg transition-all font-medium ${linkAtivo("/")}`}
            >
              <div className="w-8 flex justify-center shrink-0"><BarChart3 size={22} /></div>
              <span className="ml-3 opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap overflow-hidden transition-all duration-300">
                Relatórios e Lucros
              </span>
            </Link>

            <Link
              to="/stock"
              className={`flex items-center p-3 rounded-lg transition-all font-medium ${linkAtivo("/stock")}`}
            >
              <div className="w-8 flex justify-center shrink-0"><Package size={22} /></div>
              <span className="ml-3 opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap overflow-hidden transition-all duration-300">
                Gestão de Stock
              </span>
            </Link>

            <Link
              to="/usuarios"
              className={`flex items-center p-3 rounded-lg transition-all font-medium ${linkAtivo("/usuarios")}`}
            >
              <div className="w-8 flex justify-center shrink-0"><Users size={22} /></div>
              <span className="ml-3 opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap overflow-hidden transition-all duration-300">
                Equipa e Acessos
              </span>
            </Link>

            <Link
              to="/backup"
              className={`flex items-center p-3 rounded-lg transition-all font-medium ${linkAtivo("/backup")}`}
            >
              <div className="w-8 flex justify-center shrink-0"><DatabaseBackup size={22} /></div>
              <span className="ml-3 opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap overflow-hidden transition-all duration-300">
                Segurança e Backup
              </span>
            </Link>
          </>
        )}
        
        <Link
          to="/pos"
          className={`flex items-center p-3 rounded-lg transition-all font-medium ${linkAtivo("/pos")}`}
        >
          <div className="w-8 flex justify-center shrink-0"><ShoppingCart size={22} /></div>
          <span className="ml-3 opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap overflow-hidden transition-all duration-300">
            Terminal de Vendas
          </span>
        </Link>
      </nav>

      {/* Botão de Logout */}
      <div className="p-3 border-t border-zinc-900 mt-auto">
        <button
          onClick={logout}
          className="w-full flex items-center p-3 text-zinc-500 hover:bg-orange-950/30 hover:text-orange-500 rounded-lg transition-colors font-medium"
        >
          <div className="w-8 flex justify-center shrink-0"><LogOut size={22} /></div>
          <span className="ml-3 opacity-0 w-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap overflow-hidden transition-all duration-300">
            Sair do Sistema
          </span>
        </button>
      </div>
    </aside>
  );
}

function RotaProtegida({ children, apenasAdmin = false }) {
  const { user } = useAuth();
  if (apenasAdmin && user.role !== "admin") {
    return <Navigate to="/pos" />;
  }
  return children;
}

function SistemaPrincipal() {
  const { user } = useAuth();

  if (!user) return <Login />;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 print:bg-white font-sans text-zinc-100">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto print:overflow-visible transition-all duration-300">
        <Routes>
          <Route path="/pos" element={<TerminalVendas />} />

          <Route
            path="/"
            element={
              <RotaProtegida apenasAdmin={true}>
                <RelatoriosAdmin />
              </RotaProtegida>
            }
          />
          <Route
            path="/stock"
            element={
              <RotaProtegida apenasAdmin={true}>
                <GestaoProdutos />
              </RotaProtegida>
            }
          />
          <Route
            path="/backup"
            element={
              <RotaProtegida apenasAdmin={true}>
                <BackupGlobal />
              </RotaProtegida>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RotaProtegida apenasAdmin={true}>
                <GestaoUsuarios />
              </RotaProtegida>
            }
          />

          <Route
            path="*"
            element={<Navigate to={user.role === "admin" ? "/" : "/pos"} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  // Lógica de proteção de armazenamento inserida aqui
  useEffect(() => {
    const garantirArmazenamentoCritico = async () => {
      if (navigator.storage && navigator.storage.persist) {
        const persistido = await navigator.storage.persist();
        
        if (persistido) {
          console.log("✅ DB");
        } else {
          console.warn("⚠️ O navegador negou o armazenamento persistente. O IndexedDB ainda pode ser limpo se faltar espaço no dispositivo.");
        }
      }
    };

    garantirArmazenamentoCritico();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <SistemaPrincipal />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}