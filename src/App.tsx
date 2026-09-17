import { Component, lazy, Suspense, useEffect, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import SupportNotifier from "./components/SupportNotifier";
import SidebarCollapseControl from "./components/SidebarCollapseControl";

function lazyWithRecovery<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string,
) {
  return lazy(async () => {
    const retryKey = `mw-control:chunk-retry:${key}`;
    try {
      const module = await importer();
      sessionStorage.removeItem(retryKey);
      return module;
    } catch (error) {
      const alreadyRetried = sessionStorage.getItem(retryKey) === "1";
      if (!alreadyRetried) {
        sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => undefined);
      }
      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}

const Login = lazyWithRecovery(() => import("./pages/Login"), "login");
const Dashboard = lazyWithRecovery(() => import("./pages/Dashboard"), "dashboard");
const Cash = lazyWithRecovery(() => import("./pages/Cash"), "cash");
const Transactions = lazyWithRecovery(() => import("./pages/Transactions"), "transactions");
const DataPage = lazyWithRecovery(() => import("./pages/DataPage"), "data-page");
const Expenses = lazyWithRecovery(() => import("./pages/Expenses"), "expenses");
const Reports = lazyWithRecovery(() => import("./pages/Reports"), "reports");
const Settings = lazyWithRecovery(() => import("./pages/Settings"), "settings");
const Accounts = lazyWithRecovery(() => import("./pages/Accounts"), "accounts");
const SupportCenter = lazyWithRecovery(() => import("./pages/SupportCenter"), "support");
const Systems = lazyWithRecovery(() => import("./pages/Systems"), "systems");
const UsersAccess = lazyWithRecovery(() => import("./pages/UsersAccess"), "users");
const Storage = lazyWithRecovery(() => import("./pages/Storage"), "storage");
const RemoteAccess = lazyWithRecovery(() => import("./pages/RemoteAccess"), "remote-access");

function LoadingScreen() {
  return (
    <div className="grid min-h-[45vh] place-items-center">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        Carregando módulo...
      </div>
    </div>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MW TECH Control runtime error", error, info);
  }

  private recover = () => {
    sessionStorage.setItem("mw-control:last-recovery", String(Date.now()));
    window.location.reload();
  };

  private goHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-[#f3f6fa] p-5">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-[0_20px_60px_rgba(7,24,45,.12)]">
          <img src="/mw-tech-logo.png" alt="MW TECH" className="mx-auto h-24 w-40 object-contain" />
          <h1 className="mt-4 text-2xl font-black text-[#07182d]">A tela encontrou um erro temporário</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Seus dados não foram apagados. O sistema pode ter recebido uma atualização ou falhado ao carregar um módulo.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button onClick={this.recover} className="rounded-xl bg-[#082743] px-4 py-3 text-sm font-black text-white hover:bg-[#0b355d]">
              Recarregar sistema
            </button>
            <button onClick={this.goHome} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
              Ir para Visão geral
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function Private() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!session) return;
    const preload = () => {
      void Promise.allSettled([
        import("./pages/Dashboard"),
        import("./pages/Cash"),
        import("./pages/Transactions"),
        import("./pages/Accounts"),
        import("./pages/Expenses"),
        import("./pages/Reports"),
        import("./pages/Systems"),
        import("./pages/UsersAccess"),
        import("./pages/Storage"),
        import("./pages/RemoteAccess"),
        import("./pages/SupportCenter"),
        import("./pages/Settings"),
        import("./pages/DataPage"),
      ]);
      void import("./services/managedSystems").then(({ getManagedSystems }) => getManagedSystems()).catch(() => undefined);
    };

    const win = window as typeof window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(preload, { timeout: 1200 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(preload, 250);
    return () => window.clearTimeout(id);
  }, [session]);

  if (loading) return <LoadingScreen />;
  return session ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <SupportNotifier />
        <SidebarCollapseControl />
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
              <Route path="acesso-remoto" element={<RemoteAccess />} />
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
    </AppErrorBoundary>
  );
}
