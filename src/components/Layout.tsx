import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  House,
  Wallet,
  ArrowLeftRight,
  Landmark,
  Receipt,
  FileChartColumn,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";

const items = [
  ["/", "Visão geral", House],
  ["/caixa", "Caixa", Wallet],
  ["/configuracoes", "Configurações", Settings],
] as const;
const financeItems = [
  ["/movimentacoes", "Entradas e saídas", ArrowLeftRight],
  ["/contas", "Contas bancárias", Landmark],
  ["/despesas", "Contas a pagar", Receipt],
  ["/relatorios", "Relatórios", FileChartColumn],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false),
    [collapsed, setCollapsed] = useState(() => localStorage.getItem("mw-sidebar-collapsed") === "true"),
    loc = useLocation(),
    { logout } = useAuth();

  const title = [...items, ...financeItems].find(([p]) =>
    p === "/" ? loc.pathname === "/" : loc.pathname.startsWith(p),
  )?.[1];
  const financeActive = financeItems.some(([path]) => loc.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-[#f2f5f9] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[278px] flex-col bg-gradient-to-b from-[#061426] via-[#07182d] to-[#061426] text-white shadow-2xl shadow-slate-950/20 transition-all duration-300 lg:translate-x-0 ${collapsed ? "lg:w-[92px]" : "lg:w-[278px]"} ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          type="button"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("mw-sidebar-collapsed", String(next));
          }}
          className="absolute -right-4 top-[118px] z-40 hidden size-9 place-items-center rounded-full border border-white/15 bg-[#061426] text-[#f5c75b] shadow-lg shadow-slate-950/25 transition hover:bg-[#0b2b50] lg:grid"
          aria-label={collapsed ? "Mostrar barra lateral" : "Esconder barra lateral"}
          title={collapsed ? "Mostrar barra lateral" : "Esconder barra lateral"}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        <div className={`relative flex h-[154px] items-center justify-center border-b border-white/10 transition-all ${collapsed ? "lg:h-[110px] lg:px-3" : "px-6"}`}>
          <img
            src="/mw-tech-logo.png"
            className={`object-contain transition-all duration-300 ${collapsed ? "h-[58px] w-[58px] lg:rounded-xl" : "h-[124px] w-[190px]"}`}
            alt="MW TECH Financeiro"
          />
          <button
            className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={22} />
          </button>
        </div>

        <p className={`px-6 pb-3 pt-7 text-[11px] font-bold uppercase tracking-[.22em] text-slate-400 transition-all ${collapsed ? "lg:px-0 lg:text-center lg:text-[9px] lg:tracking-[.12em]" : ""}`}>
          Menu principal
        </p>

        <nav className={`flex-1 space-y-2.5 px-4 ${collapsed ? "lg:px-3" : ""}`}>
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[56px] items-center gap-4 rounded-xl border-l-[4px] px-4 py-3 text-[15px] font-bold transition-all ${collapsed ? "lg:justify-center lg:px-2" : ""} ${isActive ? "border-l-[#e8ac35] bg-white/[.075] text-[#f5c75b] shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)]" : "border-l-transparent text-slate-200 hover:bg-white/[.055] hover:text-white"}`
              }
              title={label}
            >
              <I size={21} strokeWidth={2} />
              <span className={collapsed ? "lg:sr-only" : ""}>{label}</span>
            </NavLink>
          ))}
          <div>
            <div
              className={`flex min-h-[56px] items-center gap-4 rounded-xl border-l-[4px] px-4 py-3 text-[15px] font-bold transition-all ${collapsed ? "lg:justify-center lg:px-2" : ""} ${financeActive ? "border-l-[#e8ac35] bg-white/[.075] text-[#f5c75b]" : "border-l-transparent text-slate-200"}`}
              title="Financeiro"
            >
              <CircleDollarSign size={21} strokeWidth={2} />
              <span className={collapsed ? "lg:sr-only" : ""}>Financeiro</span>
              <ChevronDown size={15} className={`ml-auto ${collapsed ? "lg:hidden" : ""}`} />
            </div>
            <div className={`mt-1 space-y-1 ${collapsed ? "lg:hidden" : ""}`}>
              {financeItems.map(([to, label, I]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `ml-7 flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition ${isActive ? "bg-white/[.075] text-[#f5c75b]" : "text-slate-300 hover:bg-white/[.055] hover:text-white"}`
                  }
                >
                  <I size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <div className={`border-t border-white/10 p-4 ${collapsed ? "lg:px-3" : ""}`}>
          <button
            onClick={logout}
            className={`flex min-h-[50px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
            title="Sair"
          >
            <LogOut size={19} />
            <span className={collapsed ? "lg:sr-only" : ""}>Sair</span>
          </button>
          <div className={`mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] ${collapsed ? "lg:justify-center lg:p-2.5" : ""}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f5c75b] to-[#d99a24] text-xs font-black text-[#071426]">
              MW
            </span>
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <b className="block truncate text-[13px]">Administrador</b>
              <small className="text-[11px] text-slate-400">Acesso completo</small>
            </div>
            <ChevronDown size={14} className={`ml-auto shrink-0 text-slate-400 ${collapsed ? "lg:hidden" : ""}`} />
          </div>
        </div>
      </aside>

      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          aria-label="Fechar menu"
        />
      )}

      <div className={`transition-all duration-300 ${collapsed ? "lg:pl-[92px]" : "lg:pl-[270px]"}`}>
        <header className="sticky top-0 z-10 flex min-h-[108px] items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#061426] via-[#082b50] to-[#061426] px-5 text-white shadow-[0_8px_28px_rgba(6,20,38,.18)] sm:px-8 lg:px-11">
          <div className="flex min-w-0 items-center">
            <button
              className="mr-4 rounded-xl border border-white/15 bg-white/10 p-2.5 text-white lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[.24em] text-[#f5c75b]">
                MW TECH Financeiro
              </p>
              <h1 className="mt-1 truncate text-[28px] font-black tracking-[-0.01em] text-white sm:text-[32px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[.06] text-white shadow-sm transition hover:bg-white/[.1]" aria-label="Notificações">
              <Bell size={20} />
              <i className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-[#f5c75b] ring-2 ring-[#082b50]" />
            </button>
            <button className="hidden min-h-[54px] items-center gap-2.5 rounded-xl border border-white/12 bg-white/[.06] p-1.5 pr-3 shadow-sm sm:flex">
              <span className="grid size-11 place-items-center rounded-lg bg-[#061426] text-xs font-black text-[#e5b557]">
                MW
              </span>
              <span className="text-left leading-tight">
                <b className="block text-[14px] text-white">Administrador</b>
                <small className="text-[12px] text-blue-100">Acesso completo</small>
              </span>
              <ChevronDown size={16} className="text-blue-100" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-5 sm:p-8 lg:p-10 xl:p-11">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
