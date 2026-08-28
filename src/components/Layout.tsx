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
    <div className="min-h-screen bg-[#f7f8fa]">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-gradient-to-b from-[#061326] to-[#071a30] text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[126px] items-center justify-center border-b border-white/10">
          <img
            src="/mw-tech-logo.png"
            className="h-[112px] w-[165px] object-contain mix-blend-screen"
            alt="MW TECH Financeiro"
          />
          <button
            className="absolute right-4 top-4 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <p className="px-6 pb-3 pt-7 text-[10px] uppercase tracking-[.18em] text-slate-400">
          Menu principal
        </p>
        <nav className="flex-1 space-y-1.5 px-3">
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3.5 text-[14px] font-semibold transition ${isActive ? "bg-gradient-to-r from-[#ce9238] to-[#ebb859] text-white shadow-lg shadow-amber-950/20" : "text-slate-200 hover:bg-white/[.07]"}`
              }
            >
              <I size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300"
          >
            <LogOut size={18} />
            Sair
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/[.06] p-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[#d6a348] text-xs font-bold text-[#071426]">
              MW
            </span>
            <div>
              <b className="block text-xs">Administrador</b>
              <small className="text-[10px] text-slate-400">
                Acesso completo
              </small>
            </div>
            <ChevronDown size={13} className="ml-auto" />
          </div>
        </div>
      </aside>
      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
        />
      )}
      <div className="lg:pl-[248px]">
        <header className="flex min-h-[92px] items-center justify-between border-b bg-white px-5 sm:px-8 lg:px-10">
          <div className="flex items-center">
            <button className="mr-4 lg:hidden" onClick={() => setOpen(true)}>
              <Menu />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#c58a33]">
                MW TECH Financeiro
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#081a38]">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="relative grid size-11 place-items-center rounded-xl border">
              <Bell size={18} />
              <i className="absolute right-2 top-2 size-1.5 rounded-full bg-amber-500" />
            </button>
            <button className="hidden items-center gap-2 rounded-xl border p-1.5 pr-3 sm:flex">
              <span className="grid size-9 place-items-center rounded-lg bg-[#07182e] text-xs font-bold text-[#e5b557]">
                MW
              </span>
              <span className="text-left">
                <b className="block text-xs">Administrador</b>
                <small className="text-[10px] text-slate-500">
                  Acesso completo
                </small>
              </span>
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-7 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
