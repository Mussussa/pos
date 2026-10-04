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
  Users // Ícone adicionado aqui
} from "lucide-react";

// Caminhos corrigidos para bater certo com as pastas criadas
import { GestaoProdutos } from "./components/admin/GestaoProdutos";
import { RelatoriosAdmin } from "./components/admin/RelatoriosAdmin";
import { BackupGlobal } from "./components/admin/BackupGlobal";
import { GestaoUsuarios } from "./components/admin/GestaoUsuarios";
import { TerminalVendas } from "./components/vendedor/TerminalVendas";
import { Login } from "./components/Login"; // Caminho corrigido
import { AuthProvider, useAuth } from "./AuthContext"; // Caminho corrigido

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const linkAtivo = (caminho) =>
    location.pathname === caminho
      ? "bg-zinc-900 text-red-500 border-r-4 border-red-600 shadow-[inset_0px_0px_15px_rgba(220,38,38,0.05)]"
      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-red-400";

  return (
    <div className="w-64 min-h-screen bg-zinc-950 p-4 flex flex-col border-r border-zinc-800 print:hidden">
      <div className="mb-8 p-2 border-b border-zinc-800 pb-6 flex flex-col items-center text-center">
        <img
          src="/logo_misto.jpeg"
          alt="Auto Center Logótipo"
          className="w-32 h-auto mb-4 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.15)] border border-zinc-800"
        />
        <h1 className="text-xl font-bold text-zinc-100 tracking-wider">
          AUTO <span className="text-red-600">CENTER</span>
        </h1>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
          Operador:{" "}
          <span className="text-zinc-300 font-bold">{user.username}</span>
        </p>
      </div>

      <nav className="flex-1 space-y-2">
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
        className="flex items-center gap-3 p-3 text-zinc-500 hover:bg-red-950/30 hover:text-red-500 rounded-lg transition-colors mt-auto font-medium"
      >
        <LogOut size={20} /> Sair do Sistema
      </button>
    </div>
  );
}

// Guarda Costas para bloquear URLs escritas à mão
function RotaProtegida({ children, apenasAdmin = false }) {
  const { user } = useAuth();
  if (apenasAdmin && user.role !== "admin") {
    return <Navigate to="/pos" />;
  }
  return children;
}

function SistemaPrincipal() {
  const { user } = useAuth();

  // Se não houver sessão ativa, a loja desaparece e só o login é renderizado
  if (!user) return <Login />;

  return (
    <div className="flex bg-zinc-950 print:bg-white min-h-screen font-sans text-zinc-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto print:overflow-visible">
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

          {/* Se a pessoa tentar um URL que não existe, empurra para a página inicial certa */}
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
    <AuthProvider>
      <Router>
        <SistemaPrincipal />
      </Router>
    </AuthProvider>
  );
}