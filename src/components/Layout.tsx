import { Outlet, NavLink, useLocation } from "react-router-dom";
import { House, Wallet, ArrowLeftRight, Landmark, Receipt, FileChartColumn, Settings, LogOut, Menu, X, Bell, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getAccounts, getMovements } from "../lib/finance";
import { getExpenses } from "../services/expenses";
import { getCounterparties } from "../services/counterparties";

const items = [
  ["/", "Visão geral", House], ["/caixa", "Caixa", Wallet], ["/movimentacoes", "Entradas e saídas", ArrowLeftRight],
  ["/contas", "Contas", Landmark], ["/despesas", "Despesas", Receipt], ["/relatorios", "Relatórios", FileChartColumn],
  ["/configuracoes", "Configurações", Settings],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false), loc = useLocation(), { logout } = useAuth();

  useEffect(() => {
    // Uma única carga compartilhada abastece Dashboard, Caixa, Movimentações e Relatórios.
    const preload = () => void Promise.allSettled([getAccounts(), getMovements(200), getExpenses(), getCounterparties(true)]);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 800 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 80);
    return () => window.clearTimeout(id);
  }, []);

  const title = items.find(([p]) => p === "/" ? loc.pathname === "/" : loc.pathname.startsWith(p))?.[1];

  return (
    <div className="min-h-screen bg-[#edf1f6] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[300px] flex-col bg-[#07182d] text-white shadow-2xl shadow-slate-950/20 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[154px] items-center justify-center border-b border-white/10 bg-[#061426] px-6">
          <img src="/mw-tech-logo.png" className="h-[130px] w-[205px] object-contain mix-blend-screen" alt="MW TECH Financeiro" decoding="async" fetchPriority="high" />
          <button className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={23} /></button>
        </div>
        <div className="border-b border-white/8 bg-[#0a203b] px-6 py-4"><p className="text-[11px] font-extrabold uppercase tracking-[.24em] text-[#e9b659]">Financeiro</p><p className="mt-1 text-[13px] font-semibold text-slate-300">Controle administrativo MW TECH</p></div>
        <p className="px-6 pb-3 pt-6 text-[12px] font-bold uppercase tracking-[.2em] text-slate-400">Menu principal</p>
        <nav className="flex-1 space-y-2 px-3.5">
          {items.map(([to, label, I]) => <NavLink key={to} to={to} end={to === "/"} onMouseEnter={() => {
            if (to === "/movimentacoes" || to === "/caixa" || to === "/relatorios") void getMovements(200);
            if (to === "/despesas") void getExpenses();
            if (to === "/contas" || to === "/caixa") void getAccounts();
          }} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-[60px] items-center gap-4 rounded-md border-l-4 px-4 py-3 text-[17px] font-bold transition-all ${isActive ? "border-[#ffd06a] bg-gradient-to-r from-[#d99b2f] to-[#e7b24d] text-white shadow-lg shadow-black/15" : "border-transparent text-slate-200 hover:border-white/20 hover:bg-white/[.07] hover:text-white"}`}><I size={23} strokeWidth={2.1} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="border-t border-white/10 p-4">
          <button onClick={logout} className="flex min-h-[54px] w-full items-center gap-3 rounded-md px-4 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"><LogOut size={20} />Sair</button>
          <div className="mt-2 flex items-center gap-3 rounded-md border border-white/10 bg-white/[.06] p-3.5"><span className="grid size-12 shrink-0 place-items-center rounded-md bg-[#d9a443] text-sm font-extrabold text-[#071426]">MW</span><div className="min-w-0"><b className="block truncate text-[14px]">Administrador</b><small className="text-[12px] text-slate-400">Acesso completo</small></div><ChevronDown size={15} className="ml-auto shrink-0 text-slate-400" /></div>
        </div>
      </aside>

      {open && <button onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-black/50 lg:hidden" aria-label="Fechar menu" />}
      <div className="lg:pl-[300px]">
        <header className="sticky top-0 z-10 flex min-h-[116px] items-center justify-between border-b border-[#163b66] bg-gradient-to-r from-[#0b2949] via-[#0b3159] to-[#0b2b4d] px-5 shadow-[0_5px_18px_rgba(6,20,38,.16)] sm:px-8 lg:px-11">
          <div className="flex min-w-0 items-center"><button className="mr-4 rounded-md border border-white/15 bg-white/10 p-2.5 text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={23} /></button><div className="min-w-0"><p className="text-[12px] font-extrabold uppercase tracking-[.2em] text-[#efbd5f]">MW TECH Financeiro</p><h1 className="mt-1 truncate text-[31px] font-extrabold tracking-[-0.025em] text-white sm:text-[34px]">{title}</h1></div></div>
          <div className="flex items-center gap-3"><button className="relative grid size-13 place-items-center rounded-md border border-white/15 bg-white/10 text-white shadow-sm transition hover:bg-white/15"><Bell size={21} /><i className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-amber-400 ring-2 ring-[#0b2b4d]" /></button><button className="hidden min-h-[54px] items-center gap-2.5 rounded-md border border-white/15 bg-white/10 p-1.5 pr-4 shadow-sm sm:flex"><span className="grid size-11 place-items-center rounded-sm bg-[#061426] text-xs font-bold text-[#f0bd5d]">MW</span><span className="text-left leading-tight"><b className="block text-[14px] text-white">Administrador</b><small className="text-[12px] text-slate-300">Acesso completo</small></span></button></div>
        </header>
        <main className="mx-auto w-full max-w-[1660px] p-5 sm:p-8 lg:p-9 xl:p-10"><Outlet /></main>
      </div>
    </div>
  );
}
