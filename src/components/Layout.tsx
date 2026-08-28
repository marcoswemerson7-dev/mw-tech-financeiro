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
    const id = globalThis.setTimeout(() => {
      void Promise.allSettled([getAccounts(), getMovements(200), getExpenses(), getCounterparties(true)]);
    }, 60);
    return () => globalThis.clearTimeout(id);
  }, []);

  const title = items.find(([p]) => p === "/" ? loc.pathname === "/" : loc.pathname.startsWith(p))?.[1];

  return (
    <div className="min-h-screen bg-[#edf1f6] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-[#07182d] text-white shadow-2xl shadow-slate-950/20 transition-transform lg:translate-x-0 2xl:w-[270px] ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[118px] items-center justify-center border-b border-white/10 bg-[#061426] px-5 2xl:h-[132px]">
          <img src="/mw-tech-logo.png" className="h-[100px] w-[165px] object-contain mix-blend-screen 2xl:h-[112px] 2xl:w-[180px]" alt="MW TECH Financeiro" decoding="async" fetchPriority="high" />
          <button className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={22} /></button>
        </div>
        <div className="border-b border-white/8 bg-[#0a203b] px-5 py-3 2xl:px-6 2xl:py-4"><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#e9b659] 2xl:text-[11px]">Financeiro</p><p className="mt-1 text-[12px] font-semibold text-slate-300 2xl:text-[13px]">Controle administrativo MW TECH</p></div>
        <p className="px-5 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[.18em] text-slate-400 2xl:px-6 2xl:pb-3 2xl:pt-6 2xl:text-[12px]">Menu principal</p>
        <nav className="flex-1 space-y-1.5 px-3 2xl:space-y-2 2xl:px-3.5">
          {items.map(([to, label, I]) => <NavLink key={to} to={to} end={to === "/"} onMouseEnter={() => {
            if (to === "/movimentacoes" || to === "/caixa" || to === "/relatorios") void getMovements(200);
            if (to === "/despesas") void getExpenses();
            if (to === "/contas" || to === "/caixa") void getAccounts();
          }} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-[50px] items-center gap-3 rounded-md border-l-4 px-3.5 py-2.5 text-[15px] font-bold transition-all 2xl:min-h-[56px] 2xl:gap-4 2xl:px-4 2xl:text-[16px] ${isActive ? "border-[#ffd06a] bg-gradient-to-r from-[#d99b2f] to-[#e7b24d] text-white shadow-lg shadow-black/15" : "border-transparent text-slate-200 hover:border-white/20 hover:bg-white/[.07] hover:text-white"}`}><I size={21} strokeWidth={2.1} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="border-t border-white/10 p-3 2xl:p-4">
          <button onClick={logout} className="flex min-h-[46px] w-full items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"><LogOut size={19} />Sair</button>
          <div className="mt-2 flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[.06] p-2.5 2xl:p-3"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#d9a443] text-xs font-extrabold text-[#071426]">MW</span><div className="min-w-0"><b className="block truncate text-[13px]">Administrador</b><small className="text-[11px] text-slate-400">Acesso completo</small></div><ChevronDown size={14} className="ml-auto shrink-0 text-slate-400" /></div>
        </div>
      </aside>
      {open && <button onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-black/50 lg:hidden" aria-label="Fechar menu" />}
      <div className="lg:pl-[248px] 2xl:pl-[270px]">
        <header className="sticky top-0 z-10 flex min-h-[88px] items-center justify-between border-b border-[#163b66] bg-gradient-to-r from-[#0b2949] via-[#0b3159] to-[#0b2b4d] px-5 shadow-[0_5px_18px_rgba(6,20,38,.16)] sm:px-7 lg:px-8 2xl:min-h-[100px] 2xl:px-10">
          <div className="flex min-w-0 items-center"><button className="mr-4 rounded-md border border-white/15 bg-white/10 p-2.5 text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.19em] text-[#efbd5f] 2xl:text-[11px]">MW TECH Financeiro</p><h1 className="mt-1 truncate text-[26px] font-extrabold tracking-[-0.025em] text-white sm:text-[28px] 2xl:text-[31px]">{title}</h1></div></div>
          <div className="flex items-center gap-2.5"><button className="relative grid size-11 place-items-center rounded-md border border-white/15 bg-white/10 text-white shadow-sm transition hover:bg-white/15 2xl:size-12"><Bell size={19} /><i className="absolute right-2 top-2 size-2.5 rounded-full bg-amber-400 ring-2 ring-[#0b2b4d]" /></button><button className="hidden min-h-[48px] items-center gap-2 rounded-md border border-white/15 bg-white/10 p-1.5 pr-3 shadow-sm sm:flex 2xl:min-h-[52px]"><span className="grid size-9 place-items-center rounded-sm bg-[#061426] text-[11px] font-bold text-[#f0bd5d] 2xl:size-10">MW</span><span className="text-left leading-tight"><b className="block text-[13px] text-white">Administrador</b><small className="text-[11px] text-slate-300">Acesso completo</small></span></button></div>
        </header>
        <main className="mx-auto w-full max-w-[1680px] p-4 sm:p-5 lg:p-6 xl:p-7 2xl:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
