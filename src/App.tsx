import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cash from "./pages/Cash";
import Transactions from "./pages/Transactions";
import DataPage from "./pages/DataPage";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Accounts from "./pages/Accounts";
import SupportCenter from "./pages/SupportCenter";
function Private() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">Carregando...</div>
    );
  return session ? <Layout /> : <Navigate to="/login" replace />;
}
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Private />}>
          <Route index element={<Dashboard />} />
          <Route path="caixa" element={<Cash />} />
          <Route path="movimentacoes" element={<Transactions />} />
          <Route path="contas" element={<Accounts />} />
          <Route path="despesas" element={<Expenses />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="suporte" element={<SupportCenter />} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="receitas" element={<DataPage kind="receitas" />} />
          <Route path="clientes" element={<DataPage kind="clientes" />} />
          <Route
            path="contas-receber"
            element={<DataPage kind="contas-receber" />}
          />
          <Route path="retiradas" element={<DataPage kind="retiradas" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}
