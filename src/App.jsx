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
      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-orange-400";

  return (
    // Transformado em <aside> fixo com 'sticky top-0 h-screen shrink-0'
    <aside className="w-64 h-screen sticky top-0 bg-zinc-950 p-4 flex flex-col border-r border-zinc-800 print:hidden shrink-0">
      <div className="mb-8 p-2 border-b border-zinc-800 pb-6 flex flex-col items-center text-center">
        <img
          src="/logo_vulpe_instinct.png"
          alt="Vulpe Mart Logótipo"
          className="w-32 h-auto mb-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.15)] border border-zinc-800"
        />
        <h1 className="text-xl font-bold text-zinc-100 tracking-wider">
          VULPE <span className="text-orange-500">MART</span>
        </h1>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
          Operador:{" "}
          <span className="text-zinc-300 font-bold">{user.username}</span>
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {user.role === "admin" && (
          <>
            <Link
              to="/"
              className={`flex items-center gap-3 p-3 rounded-lg transition-all font-medium ${linkAtivo("/")}`}
            >
              <BarChart3 size={20} /> Relatórios e Lucros
            </Link>
            <Link
              to="/stock"
              className={`flex items-center gap-3 p-3 rounded-lg transition-all font-medium ${linkAtivo("/stock")}`}
            >
              <Package size={20} /> Gestão de Stock
            </Link>
            <Link
              to="/usuarios"
              className={`flex items-center gap-3 p-3 rounded-lg transition-all font-medium ${linkAtivo("/usuarios")}`}
            >
              <Users size={20} /> Equipa e Acessos
            </Link>
            <Link
              to="/backup"
              className={`flex items-center gap-3 p-3 rounded-lg transition-all font-medium ${linkAtivo("/backup")}`}
            >
              <DatabaseBackup size={20} /> Segurança e Backup
            </Link>
          </>
        )}
        <Link
          to="/pos"
          className={`flex items-center gap-3 p-3 rounded-lg transition-all font-medium ${linkAtivo("/pos")}`}
        >
          <ShoppingCart size={20} /> Terminal de Vendas
        </Link>
      </nav>

      <button
        onClick={logout}
        className="flex items-center gap-3 p-3 text-zinc-500 hover:bg-orange-950/30 hover:text-orange-500 rounded-lg transition-colors mt-auto font-medium pt-4 border-t border-zinc-900"
      >
        <LogOut size={20} /> Sair do Sistema
      </button>
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
    // Layout ajustado para conter a altura total do ecrã e rolar apenas o <main>
    <div className="flex h-screen overflow-hidden bg-zinc-950 print:bg-white font-sans text-zinc-100">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto print:overflow-visible">
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