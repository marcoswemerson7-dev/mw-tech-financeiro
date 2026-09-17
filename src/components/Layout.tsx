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
  CircleDollarSign,
  PanelsTopLeft,
  UsersRound,
  Search,
  Cloud,
  Headphones,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";

const items = [
  ["/", "Visão geral", House],
  ["/caixa", "Caixa", Wallet],
  ["/sistemas", "Sistemas e órgãos", PanelsTopLeft],
  ["/usuarios", "Usuários e acessos", UsersRound],
] as const;

const financeItems = [
  ["/movimentacoes", "Entradas e saídas", ArrowLeftRight],
  ["/contas", "Contas bancárias", Landmark],
  ["/despesas", "Contas a pagar", Receipt],
  ["/relatorios", "Relatórios", FileChartColumn],
] as const;

const bottomItems = [
  ["/suporte", "Central de Suporte", Headphones],
  ["/configuracoes", "Configurações", Settings],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { logout } = useAuth();
  const financeActive = financeItems.some(([path]) => loc.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[258px] flex-col overflow-y-auto bg-gradient-to-b from-[#071d35] via-[#061a31] to-[#071a2e] text-white shadow-[12px_0_35px_rgba(6,20,38,.12)] transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative flex min-h-[180px] items-center justify-center border-b border-white/[.06] px-5 py-5">
          <img
            src="/mw-tech-logo.png"
            className="h-[142px] w-[210px] object-contain"
            alt="MW TECH"
          />
          <button
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-3 rounded-xl border-l-[4px] px-4 text-[14px] font-bold transition-all ${
                  isActive
                    ? "border-[#f0b83f] bg-white/[.085] text-[#f5c75b] shadow-[inset_0_0_0_1px_rgba(255,255,255,.025)]"
                    : "border-transparent text-slate-100 hover:bg-white/[.05] hover:text-white"
                }`
              }
            >
              <I size={21} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="pt-1">
            <div
              className={`flex min-h-[48px] items-center gap-3 rounded-xl border-l-[4px] px-4 text-[14px] font-bold ${
                financeActive
                  ? "border-[#f0b83f] bg-white/[.085] text-[#f5c75b]"
                  : "border-transparent text-slate-100"
              }`}
            >
              <CircleDollarSign size={21} strokeWidth={2} />
              <span>Financeiro</span>
              <ChevronDown size={15} className="ml-auto" />
            </div>
            <div className="mt-1 space-y-1 pl-6">
              {financeItems.map(([to, label, I]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-[36px] items-center gap-2.5 rounded-lg px-3 text-[12px] font-semibold transition ${
                      isActive
                        ? "bg-white/[.07] text-[#f5c75b]"
                        : "text-slate-300 hover:bg-white/[.05] hover:text-white"
                    }`
                  }
                >
                  <I size={15} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex min-h-[48px] items-center gap-3 rounded-xl border-l-[4px] border-transparent px-4 text-[14px] font-bold text-slate-100">
            <Cloud size={21} strokeWidth={2} />
            <span>Armazenamento (Drive)</span>
          </div>

          {bottomItems.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-3 rounded-xl border-l-[4px] px-4 text-[14px] font-bold transition-all ${
                  isActive
                    ? "border-[#f0b83f] bg-white/[.085] text-[#f5c75b]"
                    : "border-transparent text-slate-100 hover:bg-white/[.05] hover:text-white"
                }`
              }
            >
              <I size={21} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-[#c99a38]/35 bg-white/[.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0b83f]/10 text-[#f0b83f]">
              <Building2 size={21} />
            </span>
            <div>
              <b className="text-sm">MW TECH</b>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                Gestão hoje.
                <br />
                Resultados amanhã.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="mx-4 mb-4 flex min-h-[42px] items-center gap-3 rounded-xl px-4 text-sm font-semibold text-slate-400 transition hover:bg-white/[.05] hover:text-white"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          aria-label="Fechar menu"
        />
      )}

      <div className="lg:pl-[258px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#082743] via-[#0a3155] to-[#082743] px-4 text-white shadow-[0_7px_24px_rgba(6,20,38,.16)] sm:px-7 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <div className="hidden h-11 w-[500px] max-w-[40vw] items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:flex">
              <Search size={18} className="text-slate-300" />
              <input
                aria-label="Buscar no sistema"
                placeholder="Buscar no sistema..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
              />
              <span className="rounded-md bg-white/[.07] px-2 py-1 text-[11px] text-slate-300">Ctrl + K</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="relative grid size-10 place-items-center rounded-xl text-white transition hover:bg-white/10"
              aria-label="Notificações"
            >
              <Bell size={20} />
              <i className="absolute right-2 top-2 size-2 rounded-full bg-[#f5c75b]" />
            </button>
            <div className="h-7 w-px bg-white/15" />
            <button className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.025] px-2 py-1.5 transition hover:bg-white/[.06]">
              <span className="grid size-9 place-items-center rounded-full bg-[#061426] text-xs font-black text-[#e5b557]">MW</span>
              <span className="hidden text-left leading-tight sm:block">
                <b className="block text-[13px]">Administrador</b>
                <small className="text-[11px] text-blue-100">Acesso completo</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <main className="w-full p-4 sm:p-6 lg:p-7 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
