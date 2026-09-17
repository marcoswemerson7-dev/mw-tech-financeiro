import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Landmark,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Crown,
  MoreHorizontal,
  ReceiptText,
  TrendingUp,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { getExpenses } from "../services/expenses";
import { getDriveStorageUsage, type DriveStorageUsage } from "../services/googleDrive";
import { money, Empty, Badge, dateOnly, formatDate, SectionCard, StatCard, FinancialAmount } from "../components/UI";

export default function Dashboard() {
  const [rows, setRows] = useState<Movement[]>([]),
    [account, setAccount] = useState(0),
    [expenses, setExpenses] = useState<any[]>([]),
    [drive, setDrive] = useState<DriveStorageUsage | null>(null),
    [driveLoading, setDriveLoading] = useState(true),
    [driveError, setDriveError] = useState("");

  useEffect(() => {
    if (isConfigured)
      Promise.all([getMovements(500), getAccounts(), getExpenses().catch(() => [])]).then(([m, a, e]) => {
        setRows(m);
        setAccount(a.reduce((s, x) => s + Number(x.saldo_atual), 0));
        setExpenses(e);
      });
  }, []);

  const loadDriveStorage = () => {
    setDriveLoading(true);
    setDriveError("");
    getDriveStorageUsage()
      .then(setDrive)
      .catch((error: Error) => setDriveError(error.message))
      .finally(() => setDriveLoading(false));
  };

  useEffect(() => {
    if (isConfigured) loadDriveStorage();
    else setDriveLoading(false);
  }, []);

  const now = new Date(),
    month = now.toISOString().slice(0, 7),
    today = now.toISOString().slice(0, 10),
    current = rows.filter((x) => dateOnly(x.data).startsWith(month)),
    ins = current
      .filter((x) => x.tipo.includes("entrada"))
      .reduce((a, x) => a + Number(x.valor), 0),
    outs = current
      .filter((x) => x.tipo.includes("saida"))
      .reduce((a, x) => a + Number(x.valor), 0),
    receivedToday = current
      .filter((x) => x.tipo.includes("entrada") && dateOnly(x.data) === today)
      .reduce((a, x) => a + Number(x.valor), 0),
    paidToday = current
      .filter((x) => x.tipo.includes("saida") && dateOnly(x.data) === today)
      .reduce((a, x) => a + Number(x.valor), 0),
    pendingExpenses = expenses
      .filter((x) => x.status === "pendente" && dateOnly(x.data_vencimento || x.vencimento).startsWith(month)),
    pendingTotal = pendingExpenses.reduce((a, x) => a + Number(x.valor), 0),
    paidExpensesTotal = expenses
      .filter((x) => x.status === "pago" && dateOnly(x.data_pagamento || x.vencimento).startsWith(month))
      .reduce((a, x) => a + Number(x.valor), 0),
    cash = account;

  const chart = buildMonthlyChart(rows);

  return (
    <div className="space-y-7 lg:space-y-8">
      <section className="rounded-2xl border border-[#17375f] bg-[#061426] p-7 text-white shadow-[0_18px_45px_rgba(6,20,38,.18)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[13px] font-black uppercase tracking-[.24em] text-[#f5c75b]">Bom dia, Marcos</p>
            <h2 className="mt-2 text-[31px] font-black tracking-[-0.01em] sm:text-[38px]">
              Painel financeiro
            </h2>
            <p className="mt-3 max-w-xl text-[16px] leading-7 text-blue-100">
              Fluxo de caixa, pagamentos, recebimentos e atalhos para trabalhar sem demora.
            </p>
          </div>
          <span className="inline-flex min-h-[54px] items-center gap-3 rounded-lg border border-[#e8ac35]/50 bg-white/[.06] px-5 text-[14px] font-black text-white">
            <CalendarDays size={18} className="text-[#f5c75b]" />
            Atualização do mês atual
          </span>
        </div>
      </section>

      <DriveStoragePanel
        data={drive}
        loading={driveLoading}
        error={driveError}
        onRefresh={loadDriveStorage}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_2.1fr]">
        <QuickCard title="A receber hoje" value={receivedToday} tone="green" href="/movimentacoes" cta="Ir para entradas" icon={<ArrowUpRight size={24} />} />
        <QuickCard title="A pagar hoje" value={paidToday} tone="orange" href="/despesas" cta="Ir para despesas" icon={<ArrowDownRight size={24} />} />
        <section className="grid gap-4 rounded-lg bg-cyan-500 p-5 text-white shadow-sm md:grid-cols-2">
          <MonthProgress title="Recebimentos do mês" realized={ins} planned={ins + pendingTotal} tone="green" />
          <MonthProgress title="Pagamentos do mês" realized={paidExpensesTotal || outs} planned={(paidExpensesTotal || outs) + pendingTotal} tone="white" />
          <a href="/movimentacoes" className="md:col-span-2 flex min-h-[42px] items-center justify-center gap-2 rounded-md bg-cyan-600/45 text-[14px] font-black transition hover:bg-cyan-700/45">
            Ir para fluxo de caixa <ArrowRight size={16} />
          </a>
        </section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saldo em caixa" value={money(cash)} icon={<Wallet size={26} />} tone="gold" hint="Atualizado agora" />
        <StatCard title="Entradas do mês" value={money(ins)} icon={<ArrowUpRight size={26} />} tone="green" hint="Recebimentos confirmados" />
        <StatCard title="Saídas do mês" value={<FinancialAmount value={outs} kind="saida" />} icon={<ArrowDownRight size={26} />} tone="red" hint="Pagamentos lançados" />
        <StatCard title="A pagar no mês" value={<FinancialAmount value={pendingTotal} kind="pendente" />} icon={<ReceiptText size={26} />} tone="orange" hint={`${pendingExpenses.length} pendência${pendingExpenses.length === 1 ? "" : "s"}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <SectionCard
          title="Fluxo de caixa"
          subtitle="Fluxo financeiro dos últimos 6 meses"
          action={<select className="h-10 rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 outline-none"><option>Últimos 6 meses</option></select>}
        >
          <ResponsiveContainer width="100%" height={335}>
            <BarChart data={chart} barGap={10}>
              <CartesianGrid stroke="#edf0f4" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 13 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={72} />
              <Tooltip formatter={(v) => money(v)} cursor={{ fill: "#f8fafc" }} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
              <Bar name="Entradas" dataKey="entradas" fill="#16a34a" radius={[7, 7, 0, 0]} maxBarSize={38} />
              <Bar name="Saídas" dataKey="saidas" fill="#dc2626" radius={[7, 7, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Contas do mês" subtitle="Situação dos compromissos financeiros">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Status label="A pagar" value={pendingTotal} count={pendingExpenses.length} color="amber" icon={<Wallet size={22} />} href="/despesas" />
            <Status label="Pagas" value={paidExpensesTotal || outs} count={expenses.filter((x) => x.status === "pago").length} color="green" icon={<CheckCircle2 size={22} />} href="/despesas" />
            <Status label="Recebidas" value={ins} count={current.filter((x) => x.tipo.includes("entrada")).length} color="green" icon={<TrendingUp size={22} />} href="/movimentacoes" />
          </div>
        </SectionCard>
      </div>

      <section className="grid gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_14px_36px_rgba(15,35,70,.055)] md:grid-cols-5">
        <BottomStat title="Entradas no mês" value={money(ins)} icon={<ArrowUpRight size={22} />} tone="green" />
        <BottomStat title="Saídas no mês" value={<FinancialAmount value={outs} kind="saida" />} icon={<ArrowDownRight size={22} />} tone="red" />
        <BottomStat title="Resultado do mês" value={<FinancialAmount value={ins - outs} kind="resultado" />} icon={<Crown size={22} />} tone="gold" />
        <BottomStat title="Saldo bancário" value={money(account)} icon={<Landmark size={22} />} tone="blue" />
        <BottomStat title="Movimentações" value={String(current.length)} icon={<ChevronRight size={22} />} tone="purple" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_14px_36px_rgba(15,35,70,.055)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7 sm:py-6">
          <div>
            <h3 className="text-[21px] font-black text-[#061426]">Movimentações recentes</h3>
            <p className="mt-1 text-[13px] text-slate-500">Últimos lançamentos registrados</p>
          </div>
          <a href="/movimentacoes" className="flex min-h-[42px] items-center gap-2 rounded-xl px-3 text-[14px] font-black text-[#061426] transition hover:bg-blue-50">
            Ver todas <ArrowRight size={17} />
          </a>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[14px]">
              <thead className="bg-[#061426] text-[12px] font-black uppercase tracking-wide text-white">
                <tr>
                  {["Data", "Descrição", "Categoria", "Tipo", "Valor", "Status", "Ações"].map((x) => (
                    <th key={x} className="px-6 py-4">{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-6 py-5 text-slate-600">{formatDate(x.data)}</td>
                    <td className="max-w-[300px] break-words px-6 py-5 font-bold text-[#061426]">{x.descricao}</td>
                    <td className="px-6 py-5 text-slate-600">{x.categorias_financeiras?.nome || "—"}</td>
                    <td className="px-6 py-5 capitalize text-slate-600">{x.tipo.replace("_", " ")}</td>
                    <td className={`whitespace-nowrap px-6 py-5 text-right text-[15px] font-black ${x.tipo.includes("entrada") ? "text-emerald-700" : "text-rose-700"}`}>
                      <FinancialAmount value={x.valor} kind={x.tipo} />
                    </td>
                    <td className="px-6 py-5"><Badge status="pago" /></td>
                    <td className="px-6 py-5 text-slate-400"><MoreHorizontal size={19} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </div>
  );
}


function DriveStoragePanel({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: DriveStorageUsage | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const percent = Math.max(0, Math.min(100, data?.percent || 0));
  const tone = percent >= 90 ? "bg-rose-500" : percent >= 75 ? "bg-amber-400" : "bg-emerald-500";
  const status = percent >= 90 ? "Crítico" : percent >= 75 ? "Atenção" : "Espaço saudável";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_14px_36px_rgba(15,35,70,.055)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <HardDrive size={24} />
          </span>
          <div>
            <h3 className="text-[21px] font-black text-[#061426]">Armazenamento Google Drive</h3>
            <p className="mt-1 text-[13px] text-slate-500">Uso geral e consumo das pastas de cada prefeitura</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-[14px] font-black text-[#061426] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="grid min-h-[190px] place-items-center px-6 py-8 text-slate-500">
          <div className="text-center">
            <RefreshCw size={28} className="mx-auto animate-spin text-blue-600" />
            <p className="mt-3 font-semibold">Consultando o Google Drive...</p>
          </div>
        </div>
      ) : error ? (
        <div className="m-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle size={21} className="mt-0.5 shrink-0" />
          <div>
            <b className="block">Google Drive aguardando configuração</b>
            <p className="mt-1 text-[14px] leading-6">{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className="grid gap-6 p-6 sm:p-7 xl:grid-cols-[1.05fr_1.95fr]">
          <div className="rounded-2xl bg-[#061426] p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-black uppercase tracking-[.16em] text-blue-200">Uso total</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-black">{status}</span>
            </div>
            <strong className="mt-5 block text-[38px] font-black tracking-tight">{percent.toFixed(1)}%</strong>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <DriveMetric label="Usado" value={`${data.usedGb.toFixed(2)} GB`} />
              <DriveMetric label="Disponível" value={`${data.availableGb.toFixed(2)} GB`} />
              <DriveMetric label="Plano" value={`${data.totalGb.toFixed(0)} GB`} />
            </div>
            <p className="mt-5 text-[12px] text-blue-200">
              Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-[15px] font-black text-[#061426]">Consumo por prefeitura</h4>
              <span className="text-[12px] font-semibold text-slate-500">{data.folders.length} pasta{data.folders.length === 1 ? "" : "s"} monitorada{data.folders.length === 1 ? "" : "s"}</span>
            </div>
            {data.folders.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.folders.map((folder) => (
                  <article key={folder.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#d09116] shadow-sm">
                          <FolderOpen size={20} />
                        </span>
                        <div className="min-w-0">
                          <b className="block truncate text-[14px] text-[#061426]">{folder.name}</b>
                          <span className="text-[12px] text-slate-500">{folder.files.toLocaleString("pt-BR")} arquivos</span>
                        </div>
                      </div>
                      <strong className="whitespace-nowrap text-[16px] font-black text-[#061426]">{folder.usedGb.toFixed(2)} GB</strong>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, folder.percentOfTotal)}%` }} />
                    </div>
                    <p className="mt-2 text-right text-[11px] font-bold text-slate-500">{folder.percentOfTotal.toFixed(1)}% do armazenamento total</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[145px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <div>
                  <FolderOpen size={26} className="mx-auto text-slate-400" />
                  <p className="mt-2 text-[14px] font-bold text-slate-600">Nenhuma pasta de prefeitura configurada</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DriveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[.07] px-2 py-3">
      <span className="block text-[11px] font-bold text-blue-200">{label}</span>
      <b className="mt-1 block text-[14px]">{value}</b>
    </div>
  );
}

function Status({
  label,
  value,
  count,
  color,
  icon,
  href,
}: {
  label: string;
  value: number;
  count: number;
  color: string;
  icon: ReactNode;
  href: string;
}) {
  const cls =
    color === "green"
      ? "bg-emerald-50 text-emerald-600"
      : color === "red"
        ? "bg-rose-50 text-rose-600"
        : "bg-amber-50 text-[#d09116]";
  return (
    <a href={href} className="flex min-h-[86px] items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 transition hover:bg-slate-50 last:border-b-0">
      <div className="flex min-w-0 items-center gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-full ${cls}`}>{icon}</span>
        <div className="min-w-0">
          <b className="block text-[15px] text-[#061426]">{label}</b>
          <span className="mt-0.5 block text-[13px] text-slate-500">{count} contas</span>
        </div>
      </div>
      <strong className="whitespace-nowrap text-[17px] font-black text-[#061426]">{money(value)}</strong>
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </a>
  );
}

function QuickCard({
  title,
  value,
  tone,
  href,
  cta,
  icon,
}: {
  title: string;
  value: number;
  tone: "green" | "orange";
  href: string;
  cta: string;
  icon: ReactNode;
}) {
  const cls = tone === "green" ? "bg-emerald-400 text-white" : "bg-orange-300 text-white";
  const footer = tone === "green" ? "bg-emerald-500/35" : "bg-orange-400/35";
  return (
    <a href={href} className={`flex min-h-[186px] flex-col justify-between overflow-hidden rounded-lg ${cls} shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg`}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-[16px] font-bold">{title}</p>
          <strong className="mt-8 block text-[34px] font-black tracking-tight">{money(value)}</strong>
        </div>
        <span className="mt-10 grid size-14 place-items-center rounded-lg bg-white/18">{icon}</span>
      </div>
      <span className={`flex min-h-[34px] items-center justify-end gap-2 px-5 text-[14px] font-black ${footer}`}>
        {cta} <ArrowRight size={16} />
      </span>
    </a>
  );
}

function MonthProgress({ title, realized, planned, tone }: { title: string; realized: number; planned: number; tone: "green" | "white" }) {
  const percent = planned > 0 ? Math.min(100, Math.round((realized / planned) * 100)) : 0;
  const ring = tone === "green" ? "border-lime-300 text-white" : "border-white text-white";
  return (
    <div className="flex items-center gap-5">
      <span className={`grid size-20 shrink-0 place-items-center rounded-full border-[8px] ${ring}`}>
        <b>{percent}%</b>
      </span>
      <div className="min-w-0">
        <h3 className="text-[16px] font-black">{title}</h3>
        <p className="mt-3 text-[14px] font-semibold">Realizado: {money(realized)}</p>
        <p className="text-[14px] font-semibold">Falta: {money(Math.max(planned - realized, 0))}</p>
        <p className="text-[14px] font-semibold">Previsto: {money(planned)}</p>
      </div>
    </div>
  );
}

function buildMonthlyChart(rows: Movement[]) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const base = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1);
    const key = date.toISOString().slice(0, 7);
    const monthRows = rows.filter((row) => dateOnly(row.data).startsWith(key));
    return {
      mes: formatter.format(date).replace(".", ""),
      entradas: monthRows.filter((row) => row.tipo.includes("entrada")).reduce((sum, row) => sum + Number(row.valor), 0),
      saidas: monthRows.filter((row) => row.tipo.includes("saida")).reduce((sum, row) => sum + Number(row.valor), 0),
    };
  });
}

function BottomStat({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  tone: "green" | "red" | "gold" | "blue" | "purple";
}) {
  const cls = {
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    gold: "bg-amber-50 text-[#d09116]",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  }[tone];
  return (
    <div className="flex min-w-0 items-center gap-4 border-slate-200 px-2 py-3 md:border-r md:last:border-r-0">
      <span className={`grid size-13 shrink-0 place-items-center rounded-full ${cls}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-500">{title}</p>
        <b className="mt-1 block truncate text-[20px] font-black text-[#061426]">{value}</b>
      </div>
    </div>
  );
}
