import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cash = lazy(() => import("./pages/Cash"));
const Transactions = lazy(() => import("./pages/Transactions"));
const DataPage = lazy(() => import("./pages/DataPage"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Accounts = lazy(() => import("./pages/Accounts"));
const SupportCenter = lazy(() => import("./pages/SupportCenter"));
const Systems = lazy(() => import("./pages/Systems"));
const UsersAccess = lazy(() => import("./pages/UsersAccess"));
const Storage = lazy(() => import("./pages/Storage"));

function LoadingScreen() {
  return (
    <div className="grid min-h-[45vh] place-items-center">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        Carregando...
      </div>
    </div>
  );
}

function Private() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return session ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Private />}>
            <Route index element={<Dashboard />} />
            <Route path="caixa" element={<Cash />} />
            <Route path="movimentacoes" element={<Transactions />} />
            <Route path="contas" element={<Accounts />} />
            <Route path="despesas" element={<Expenses />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="armazenamento" element={<Storage />} />
            <Route path="suporte" element={<SupportCenter />} />
            <Route path="sistemas" element={<Systems />} />
            <Route path="usuarios" element={<UsersAccess />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="receitas" element={<DataPage kind="receitas" />} />
            <Route path="clientes" element={<DataPage kind="clientes" />} />
            <Route path="contas-receber" element={<DataPage kind="contas-receber" />} />
            <Route path="retiradas" element={<DataPage kind="retiradas" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
