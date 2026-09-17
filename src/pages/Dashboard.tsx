import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Cloud,
  ExternalLink,
  FileChartColumn,
  Folder,
  Headphones,
  Landmark,
  Link2,
  MoreHorizontal,
  PanelsTopLeft,
  Plus,
  RefreshCw,
  Settings2,
  UsersRound,
} from "lucide-react";
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { getExpenses } from "../services/expenses";
import { getDriveStorageUsage, type DriveStorageUsage } from "../services/googleDrive";

const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const onlyDate = (value: unknown) => String(value || "").slice(0, 10);

export default function Dashboard() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [account, setAccount] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [drive, setDrive] = useState<DriveStorageUsage | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState("");

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([getMovements(500), getAccounts(), getExpenses().catch(() => [])]).then(([m, a, e]) => {
      setRows(m);
      setAccount(a.reduce((sum, item) => sum + Number(item.saldo_atual || 0), 0));
      setExpenses(e);
    });
  }, []);

  const loadDrive = () => {
    if (!isConfigured) {
      setDriveLoading(false);
      return;
    }
    setDriveLoading(true);
    setDriveError("");
    getDriveStorageUsage()
      .then(setDrive)
      .catch((e: Error) => setDriveError(e.message))
      .finally(() => setDriveLoading(false));
  };

  useEffect(loadDrive, []);

  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const current = rows.filter((x) => onlyDate(x.data).startsWith(month));
  const receberHoje = current
    .filter((x) => x.tipo.includes("entrada") && onlyDate(x.data) === today)
    .reduce((sum, x) => sum + Number(x.valor || 0), 0);
  const pagarHoje = current
    .filter((x) => x.tipo.includes("saida") && onlyDate(x.data) === today)
    .reduce((sum, x) => sum + Number(x.valor || 0), 0);
  const recebimentosHoje = current.filter((x) => x.tipo.includes("entrada") && onlyDate(x.data) === today).length;
  const pagamentosHoje = current.filter((x) => x.tipo.includes("saida") && onlyDate(x.data) === today).length;
  const chart = useMemo(() => buildChart(rows), [rows]);
  const recent = rows.slice(0, 4);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8 xl:space-y-5">
      <section className="grid min-h-[126px] gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_10px_34px_rgba(15,35,70,.06)] lg:grid-cols-[1.45fr_.72fr_.65fr] lg:items-center xl:px-8">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[.24em] text-[#d49d24]">MW TECH CONTROL</p>
          <h1 className="mt-1 text-[36px] font-black leading-none tracking-[-.035em] text-[#071d35] sm:text-[42px]">
            Visão geral da empresa
          </h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Acompanhe em tempo real os principais indicadores, sistemas e informações da MW TECH.
          </p>
        </div>
        <div className="border-slate-200 lg:border-l lg:pl-8">
          <p className="flex items-center gap-2 text-[12px] font-semibold capitalize text-slate-500">
            <CalendarDays size={16} />
            {dateLabel}
          </p>
          <h2 className="mt-2 text-[23px] font-black text-[#071d35]">Olá, Administrador!</h2>
          <p className="mt-1.5 flex items-center gap-2 text-[12px] text-slate-500">
            <span className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
            Tudo funcionando normalmente.
          </p>
        </div>
        <div className="flex min-h-[92px] items-center gap-4 rounded-2xl border border-[#c99a38]/35 bg-gradient-to-br from-[#092440] via-[#0b2a48] to-[#182b37] px-5 text-white shadow-[0_12px_26px_rgba(7,29,53,.2)]">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#d5a336]/15 text-[#f5c75b]">
            <BarChart3 size={25} />
          </span>
          <div className="min-w-0 flex-1">
            <b className="block text-[14px]">Gestão eficiente</b>
            <span className="text-[12px] text-slate-300">para um futuro maior.</span>
          </div>
          <ArrowRight size={18} className="text-[#f5c75b]" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ArrowUpRight size={26} />} title="A receber hoje" value={brl(receberHoje)} hint={`${recebimentosHoje} título${recebimentosHoje === 1 ? "" : "s"}`} action="Ver recebimentos" href="/movimentacoes" tone="green" />
        <MetricCard icon={<ArrowDownRight size={26} />} title="A pagar hoje" value={brl(pagarHoje)} hint={`${pagamentosHoje} título${pagamentosHoje === 1 ? "" : "s"}`} action="Ver pagamentos" href="/despesas" tone="orange" />
        <MetricCard icon={<BarChart3 size={26} />} title="Saldo em caixa" value={brl(account)} hint="Saldo total disponível" action="Ver fluxo de caixa" href="/caixa" tone="blue" />
        <MetricCard icon={<UsersRound size={26} />} title="Usuários ativos" value="Controle central" hint="Permissões por função" action="Gerenciar usuários" href="/usuarios" tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[2.35fr_.85fr]">
        <DriveCard data={drive} loading={driveLoading} error={driveError} refresh={loadDrive} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,70,.06)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={22} /></span>
              <h3 className="text-[18px] font-black text-[#071d35]">Sistemas e órgãos</h3>
            </div>
            <a href="/sistemas" className="text-[12px] font-black text-blue-700">Ver todos →</a>
          </div>
          <div className="space-y-3">
            <SideItem icon={<Building2 size={19} />} title="Prefeituras" subtitle="Órgãos gerenciados" />
            <SideItem icon={<PanelsTopLeft size={19} />} title="Sistemas ativos" subtitle="Ambientes centralizados" />
            <SideItem icon={<Link2 size={19} />} title="Integrações" subtitle="Serviços conectados" />
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.12fr_.95fr_.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,70,.06)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><BarChart3 size={20} /></span>
              <h3 className="text-[17px] font-black text-[#071d35]">Fluxo financeiro do mês</h3>
            </div>
            <span className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-500">Últimos 6 meses</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chart} barGap={6}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis axisLine={false} tickLine={false} width={58} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Bar dataKey="entradas" name="Recebimentos" fill="#34c993" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="saidas" name="Pagamentos" fill="#f49b45" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-6 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-emerald-400" />Recebimentos</span>
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-orange-400" />Pagamentos</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,70,.06)] sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileChartColumn size={20} /></span>
              <h3 className="text-[17px] font-black text-[#071d35]">Últimos lançamentos</h3>
            </div>
            <a href="/movimentacoes" className="text-[12px] font-black text-blue-700">Ver todos →</a>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.length ? recent.map((x) => {
              const entry = x.tipo.includes("entrada");
              return (
                <div key={x.id} className="flex items-center gap-3 py-3.5">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${entry ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    {entry ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[12px] text-[#071d35]">{x.descricao || (entry ? "Recebimento" : "Pagamento")}</b>
                    <span className="text-[11px] text-slate-400">{new Date(x.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <b className={`text-[12px] ${entry ? "text-emerald-600" : "text-rose-600"}`}>{brl(Number(x.valor))}</b>
                </div>
              );
            }) : <div className="py-12 text-center text-[12px] text-slate-400">Nenhum lançamento recente.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,70,.06)] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-lg text-amber-600">⚡</span>
            <h3 className="text-[17px] font-black text-[#071d35]">Acesso rápido</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Quick href="/movimentacoes" icon={<Plus size={21} />} label="Novo lançamento" tone="green" />
            <Quick href="/contas" icon={<Landmark size={21} />} label="Contas bancárias" tone="blue" />
            <Quick href="/relatorios" icon={<FileChartColumn size={21} />} label="Relatórios" tone="purple" />
            <Quick href="/usuarios" icon={<UsersRound size={21} />} label="Usuários" tone="orange" />
            <Quick href="/suporte" icon={<Headphones size={21} />} label="Suporte" tone="blue" />
            <Quick href="/configuracoes" icon={<Settings2 size={21} />} label="Configurações" tone="slate" />
          </div>
        </section>
      </section>
    </div>
  );
}

function MetricCard({ icon, title, value, hint, action, href, tone }: { icon: ReactNode; title: string; value: string; hint: string; action: string; href: string; tone: "green" | "orange" | "blue" | "slate" }) {
  const iconStyle = {
    green: "bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60",
    orange: "bg-orange-50 text-orange-600 ring-8 ring-orange-50/60",
    blue: "bg-blue-50 text-blue-600 ring-8 ring-blue-50/60",
    slate: "bg-slate-100 text-slate-600 ring-8 ring-slate-50",
  }[tone];
  const valueStyle = tone === "orange" ? "text-rose-700" : "text-[#071d35]";
  return (
    <article className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_34px_rgba(15,35,70,.06)] sm:p-6">
      <div className="flex h-full items-start gap-5">
        <span className={`mt-1 grid size-11 shrink-0 place-items-center rounded-full ${iconStyle}`}>{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[14px] font-bold text-[#18324d]">{title}</p>
          <strong className={`mt-1 block truncate text-[26px] font-black tracking-[-.025em] ${valueStyle}`}>{value}</strong>
          <span className="mt-1 block text-[12px] text-slate-400">{hint}</span>
          <a href={href} className="mt-auto flex items-center justify-end gap-1.5 pt-3 text-[12px] font-black text-blue-700">{action}<ArrowRight size={14} /></a>
        </div>
      </div>
    </article>
  );
}

function DriveCard({ data, loading, error, refresh }: { data: DriveStorageUsage | null; loading: boolean; error: string; refresh: () => void }) {
  const pct = Math.max(0, Math.min(100, data?.percent || 0));
  const folders = data?.folders || [];
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_34px_rgba(15,35,70,.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><Cloud size={25} /></span>
          <div>
            <h3 className="text-[20px] font-black text-[#071d35]">Armazenamento Google Drive</h3>
            <p className="mt-1 text-[13px] text-slate-500">Pastas organizadas por prefeitura/órgão</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-[13px] font-black text-[#071d35] transition hover:bg-slate-50">Abrir no Drive<ExternalLink size={15} /></a>
          <button onClick={refresh} type="button" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50" aria-label="Atualizar armazenamento"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          <button type="button" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500" aria-label="Mais opções"><MoreHorizontal size={17} /></button>
        </div>
      </div>

      {error ? (
        <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800 sm:m-6">Google Drive aguardando configuração: {error}</div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr_1.35fr]">
          <div className="flex min-h-[210px] items-center gap-5 border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="relative grid size-[112px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#1677ff ${pct * 3.6}deg, #e8eef5 0deg)` }}>
              <div className="grid size-[82px] place-items-center rounded-full bg-white text-center shadow-inner"><b className="text-[25px] font-black text-[#071d35]">{Math.round(pct)}%</b></div>
            </div>
            <div>
              <b className="block text-[18px] font-black text-[#071d35]">{Math.round(pct)}% utilizado</b>
              <p className="mt-1 text-[13px] text-slate-500">{loading ? "Consultando..." : `${Number(data?.usedGb || 0).toFixed(1)} GB de ${Number(data?.totalGb || 0).toFixed(0)} GB`}</p>
              <div className="mt-4 h-2.5 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>

          <div className="grid min-h-[210px] content-center gap-4 border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <StorageLine label="Espaço utilizado" value={`${Number(data?.usedGb || 0).toFixed(1)} GB`} />
            <StorageLine label="Espaço disponível" value={`${Number(data?.availableGb || 0).toFixed(1)} GB`} />
            <StorageLine label="Total do plano" value={`${Number(data?.totalGb || 0).toFixed(0)} GB`} />
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-[14px] font-black text-[#071d35]">Pastas por prefeitura/órgão</h4><span className="text-[11px] font-bold text-blue-700">Ver todas →</span></div>
            <div className="space-y-2">
              {(folders.length ? folders.slice(0, 5) : placeholderFolders).map((folder) => (
                <div key={folder.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <Folder size={17} className="shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#18324d]">{folder.name}</span>
                  <span className="text-[11px] font-bold text-slate-500">{folder.usedGb.toFixed(1)} GB</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StorageLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3 text-[13px] text-slate-500"><span className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500"><Cloud size={15} /></span>{label}</div><b className="text-[13px] text-[#071d35]">{value}</b></div>;
}

function SideItem({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3"><span className="grid size-9 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">{icon}</span><div className="min-w-0 flex-1"><b className="block text-[13px] text-[#071d35]">{title}</b><span className="text-[11px] text-slate-400">{subtitle}</span></div><span className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" /></div>;
}

function Quick({ href, icon, label, tone }: { href: string; icon: ReactNode; label: string; tone: "green" | "blue" | "purple" | "orange" | "slate" }) {
  const style = { green: "bg-emerald-50 text-emerald-600", blue: "bg-blue-50 text-blue-700", purple: "bg-violet-50 text-violet-600", orange: "bg-orange-50 text-orange-600", slate: "bg-slate-100 text-slate-600" }[tone];
  return <a href={href} className={`flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-xl px-2 text-center text-[11px] font-black transition hover:-translate-y-0.5 ${style}`}>{icon}<span>{label}</span></a>;
}

function buildChart(rows: Movement[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = rows.filter((x) => onlyDate(x.data).startsWith(key));
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      entradas: list.filter((x) => x.tipo.includes("entrada")).reduce((sum, x) => sum + Number(x.valor || 0), 0),
      saidas: list.filter((x) => x.tipo.includes("saida")).reduce((sum, x) => sum + Number(x.valor || 0), 0),
    };
  });
}

const placeholderFolders = [
  { id: "rg", name: "Prefeitura de Ribeiro Gonçalves", usedGb: 0 },
  { id: "bg", name: "Prefeitura de Baixa Grande do Ribeiro", usedGb: 0 },
  { id: "outros", name: "Outros órgãos", usedGb: 0 },
];
