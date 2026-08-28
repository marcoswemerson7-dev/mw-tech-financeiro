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
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[270px] flex-col bg-gradient-to-b from-[#061326] via-[#07182d] to-[#081d35] text-white shadow-2xl shadow-slate-950/10 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[142px] items-center justify-center border-b border-white/10 px-6">
          <img
            src="/mw-tech-logo.png"
            className="h-[120px] w-[185px] object-contain mix-blend-screen"
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

        <p className="px-6 pb-3 pt-7 text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Menu principal
        </p>

        <nav className="flex-1 space-y-2 px-4">
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[52px] items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-semibold transition-all ${isActive ? "bg-gradient-to-r from-[#c98d35] to-[#e7b65d] text-white shadow-lg shadow-amber-950/20" : "text-slate-200 hover:bg-white/[.07] hover:text-white"}`
              }
            >
              <I size={21} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={logout}
            className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium text-slate-300 transition hover:bg-white/[.06] hover:text-white"
          >
            <LogOut size={19} />
            Sair
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/[.065] p-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#d6a348] text-xs font-bold text-[#071426]">
              MW
            </span>
            <div className="min-w-0">
              <b className="block truncate text-[13px]">Administrador</b>
              <small className="text-[11px] text-slate-400">Acesso completo</small>
            </div>
            <ChevronDown size={14} className="ml-auto shrink-0 text-slate-400" />
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

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-10 flex min-h-[104px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur sm:px-8 lg:px-11">
          <div className="flex min-w-0 items-center">
            <button
              className="mr-4 rounded-xl border border-slate-200 p-2.5 text-slate-700 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#b97f2e]">
                MW TECH Financeiro
              </p>
              <h1 className="mt-1 truncate text-[28px] font-bold tracking-[-0.02em] text-[#081a38] sm:text-[30px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative grid size-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Bell size={20} />
              <i className="absolute right-2.5 top-2.5 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
            </button>
            <button className="hidden min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-1.5 pr-3 shadow-sm sm:flex">
              <span className="grid size-10 place-items-center rounded-lg bg-[#07182e] text-xs font-bold text-[#e5b557]">
                MW
              </span>
              <span className="text-left leading-tight">
                <b className="block text-[13px] text-slate-800">Administrador</b>
                <small className="text-[11px] text-slate-500">Acesso completo</small>
              </span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1560px] p-5 sm:p-8 lg:p-11 xl:p-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
