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
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";

const items = [
  ["/", "Visão geral", House],
  ["/caixa", "Caixa", Wallet],
  ["/movimentacoes", "Entradas e saídas", ArrowLeftRight],
  ["/contas", "Contas", Landmark],
  ["/despesas", "Despesas", Receipt],
  ["/relatorios", "Relatórios", FileChartColumn],
  ["/configuracoes", "Configurações", Settings],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false),
    loc = useLocation(),
    { logout } = useAuth();

  const title = items.find(([p]) =>
    p === "/" ? loc.pathname === "/" : loc.pathname.startsWith(p),
  )?.[1];

  return (
    <div className="min-h-screen bg-[#eef2f7] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[292px] flex-col bg-[#07182d] text-white shadow-2xl shadow-slate-950/15 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[150px] items-center justify-center border-b border-white/10 bg-[#061426] px-6">
          <img
            src="/mw-tech-logo.png"
            className="h-[126px] w-[198px] object-contain mix-blend-screen"
            alt="MW TECH Financeiro"
          />
          <button
            className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={23} />
          </button>
        </div>

        <p className="px-6 pb-3 pt-7 text-[12px] font-bold uppercase tracking-[.2em] text-slate-400">
          Menu principal
        </p>

        <nav className="flex-1 space-y-1.5 px-3.5">
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[58px] items-center gap-4 rounded-lg border-l-4 px-4 py-3 text-[16.5px] font-semibold transition-all ${isActive ? "border-[#f0b44a] bg-[#dca541] text-white shadow-md shadow-black/10" : "border-transparent text-slate-200 hover:border-white/20 hover:bg-white/[.065] hover:text-white"}`
              }
            >
              <I size={22} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={logout}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"
          >
            <LogOut size={20} />
            Sair
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.06] p-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#d9a443] text-sm font-extrabold text-[#071426]">
              MW
            </span>
            <div className="min-w-0">
              <b className="block truncate text-[14px]">Administrador</b>
              <small className="text-[12px] text-slate-400">Acesso completo</small>
            </div>
            <ChevronDown size={15} className="ml-auto shrink-0 text-slate-400" />
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

      <div className="lg:pl-[292px]">
        <header className="sticky top-0 z-10 flex min-h-[112px] items-center justify-between border-b border-slate-200 bg-white px-5 shadow-[0_1px_0_rgba(15,23,42,.03)] sm:px-8 lg:px-11">
          <div className="flex min-w-0 items-center">
            <button
              className="mr-4 rounded-lg border border-slate-200 p-2.5 text-slate-700 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={23} />
            </button>
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold uppercase tracking-[.17em] text-[#b97f2e]">
                MW TECH Financeiro
              </p>
              <h1 className="mt-1 truncate text-[30px] font-extrabold tracking-[-0.025em] text-[#071a38] sm:text-[32px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative grid size-13 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Bell size={21} />
              <i className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
            </button>
            <button className="hidden min-h-[52px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-1.5 pr-4 shadow-sm sm:flex">
              <span className="grid size-11 place-items-center rounded-md bg-[#07182e] text-xs font-bold text-[#e5b557]">
                MW
              </span>
              <span className="text-left leading-tight">
                <b className="block text-[14px] text-slate-800">Administrador</b>
                <small className="text-[12px] text-slate-500">Acesso completo</small>
              </span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1640px] p-5 sm:p-8 lg:p-10 xl:p-11">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
