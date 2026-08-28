import { useEffect, useState } from "react";
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
  Landmark,
  ArrowRight,
  MoreHorizontal,
} from "lucide-react";
import { getAccounts, getMovements, peekAccounts, peekMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, Badge, dateOnly, formatDate } from "../components/UI";

export default function Dashboard() {
  const cachedMovements = peekMovements(8);
  const cachedAccounts = peekAccounts();
  const [rows, setRows] = useState<Movement[]>(cachedMovements || []);
  const [account, setAccount] = useState<number | null>(cachedAccounts ? cachedAccounts.reduce((s, x) => s + Number(x.saldo_atual), 0) : null);
  const [loading, setLoading] = useState(!cachedMovements || !cachedAccounts);

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([getMovements(8), getAccounts()])
      .then(([m, a]) => {
        setRows(m);
        setAccount(a.reduce((s, x) => s + Number(x.saldo_atual), 0));
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date(),
    month = now.toISOString().slice(0, 7),
    current = rows.filter((x) => dateOnly(x.data).startsWith(month)),
    ins = current.filter((x) => x.tipo.includes("entrada")).reduce((a, x) => a + Number(x.valor), 0),
    outs = current.filter((x) => x.tipo.includes("saida")).reduce((a, x) => a + Number(x.valor), 0),
    cash = account;

  const chart = ["Jan", "Fev", "Mar", "Abr", "Mai", "Atual"].map((mes, i) => ({
    mes,
    entradas: i === 5 ? ins : 0,
    saidas: i === 5 ? outs : 0,
  }));

  return (
    <div className="space-y-5 2xl:space-y-6">
      <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0d3159] to-[#17456f] px-5 py-4 text-white 2xl:px-6 2xl:py-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#efbd5f] 2xl:text-[11px]">Painel financeiro</p>
            <h2 className="mt-1 text-[25px] font-extrabold tracking-[-.03em] sm:text-[27px] 2xl:text-[31px]">Resumo financeiro</h2>
          </div>
          <div className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold text-slate-100 2xl:px-4 2xl:text-[12px]">Atualização do mês atual</div>
        </div>
        <div className="border-t border-[#31577d] bg-[#f8fafc] px-5 py-3 2xl:px-6">
          <p className="text-[13px] font-medium text-slate-600 2xl:text-[14px]">Uma visão direta da situação financeira da MW TECH, com entradas, saídas, saldo e compromissos.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-4">
        <Kpi title="Saldo em caixa" value={cash} loading={loading && account === null} icon={<Wallet size={23} />} tone="gold" />
        <Kpi title="Entradas do mês" value={ins} loading={loading && !cachedMovements} icon={<ArrowUpRight size={23} />} tone="green" />
        <Kpi title="Saídas do mês" value={outs} loading={loading && !cachedMovements} icon={<ArrowDownRight size={23} />} tone="red" />
        <Kpi title="Valor em conta" value={account} loading={loading && account === null} icon={<Landmark size={23} />} tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
          <PanelHeader title="Entradas x Saídas" subtitle="Fluxo financeiro dos últimos 6 meses" />
          <div className="p-4 2xl:p-5">
            {loading && !cachedMovements ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chart} barGap={8}>
                  <CartesianGrid stroke="#e7edf4" vertical={false} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "#43536a", fontSize: 12, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={58} />
                  <Tooltip formatter={(v) => money(v)} cursor={{ fill: "#f5f8fc" }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, fontWeight: 600 }} />
                  <Bar name="Entradas" dataKey="entradas" fill="#16a34a" radius={[5, 5, 0, 0]} maxBarSize={38} />
                  <Bar name="Saídas" dataKey="saidas" fill="#dc2626" radius={[5, 5, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
          <PanelHeader title="Contas do mês" subtitle="Situação dos compromissos financeiros" />
          <div className="space-y-3 p-4 2xl:p-5">
            {loading && !cachedMovements ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : <>
              <Status label="A pagar" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="amber" />
              <Status label="Pagas" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="green" />
              <Status label="Pendentes" value={0} count={0} color="red" />
            </>}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d3159] px-5 py-4 text-white 2xl:px-6">
          <div>
            <h3 className="text-[17px] font-extrabold 2xl:text-[19px]">Movimentações recentes</h3>
            <p className="mt-1 text-[11px] font-medium text-slate-200 2xl:text-[12px]">Últimos lançamentos registrados</p>
          </div>
          <a href="/movimentacoes" className="flex min-h-[38px] items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-[12px] font-bold text-white transition hover:bg-white/15">
            Ver todas <ArrowRight size={15} />
          </a>
        </div>

        {loading && !cachedMovements ? <TableSkeleton /> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px] 2xl:text-[14px]">
              <thead><tr>{["Data", "Descrição", "Categoria", "Tipo", "Valor", "Status", "Ações"].map((x) => <th key={x} className="px-4 py-3 2xl:px-5">{x}</th>)}</tr></thead>
              <tbody>{rows.map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-600 2xl:px-5">{formatDate(x.data)}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-800 2xl:px-5">{x.descricao}</td>
                  <td className="px-4 py-3.5 text-slate-600 2xl:px-5">{x.categorias_financeiras?.nome || "—"}</td>
                  <td className="px-4 py-3.5 font-semibold capitalize text-slate-600 2xl:px-5">{x.tipo.replace("_", " ")}</td>
                  <td className={`whitespace-nowrap px-4 py-3.5 text-[14px] font-extrabold 2xl:px-5 ${x.tipo.includes("entrada") ? "text-emerald-600" : "text-rose-600"}`}>{money(x.valor)}</td>
                  <td className="px-4 py-3.5 2xl:px-5"><Badge status="pago" /></td>
                  <td className="px-4 py-3.5 text-slate-500 2xl:px-5"><MoreHorizontal size={18} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty />}
      </section>
    </div>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="border-b border-[#173f68] bg-[#10365f] px-5 py-3.5 text-white 2xl:px-6"><h3 className="text-[16px] font-extrabold 2xl:text-[18px]">{title}</h3><p className="mt-1 text-[11px] font-medium text-slate-200 2xl:text-[12px]">{subtitle}</p></div>;
}

function Kpi({ title, value, icon, tone, loading }: { title: string; value: number | null; icon: any; tone: "gold" | "green" | "red" | "blue"; loading?: boolean }) {
  const tones = {
    gold: ["from-[#d99b2f] to-[#e5b34e]", "bg-[#fff6df] text-[#a56c14]"],
    green: ["from-[#0f9f72] to-[#18b886]", "bg-emerald-50 text-emerald-700"],
    red: ["from-[#d74646] to-[#ed5e5e]", "bg-rose-50 text-rose-700"],
    blue: ["from-[#315ea8] to-[#4779c8]", "bg-blue-50 text-blue-700"],
  }[tone];
  return <div className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-[0_8px_20px_rgba(15,35,70,.08)]"><div className={`h-2.5 bg-gradient-to-r ${tones[0]}`} /><div className="flex min-h-[142px] items-start justify-between gap-3 p-4 2xl:min-h-[154px] 2xl:p-5"><div className="min-w-0 flex-1"><p className="text-[12px] font-extrabold uppercase leading-snug tracking-[.025em] text-slate-600 2xl:text-[13px]">{title}</p>{loading ? <div className="mt-3 h-8 w-32 animate-pulse rounded-md bg-slate-200" /> : <b className="mt-3 block whitespace-nowrap text-[26px] font-extrabold leading-tight tracking-[-.03em] text-[#091a35] 2xl:text-[30px]">{money(value || 0)}</b>}<p className="mt-2 text-[10px] font-medium leading-snug text-slate-400 2xl:text-[11px]">{loading ? "Carregando dados..." : "Atualizado com os lançamentos registrados"}</p></div><span className={`grid size-11 shrink-0 place-items-center rounded-md 2xl:size-12 ${tones[1]}`}>{icon}</span></div></div>;
}

function Status({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  const c = color === "green" ? "bg-emerald-500" : color === "red" ? "bg-rose-500" : "bg-amber-500";
  return <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-md border border-[#d7e0ea] bg-[#f7f9fc] p-3.5"><div className="flex items-center gap-3"><i className={`size-3 rounded-full ${c}`} /><div><b className="block text-[14px] font-extrabold text-slate-800">{label}</b><span className="mt-1 block text-[11px] font-medium text-slate-500">{count} contas</span></div></div><strong className="whitespace-nowrap text-[15px] font-extrabold text-slate-800">{money(value)}</strong></div>;
}

function RowSkeleton() { return <div className="h-[72px] animate-pulse rounded-md border border-slate-200 bg-slate-100" />; }
function ChartSkeleton() { return <div className="h-[280px] animate-pulse rounded-md bg-slate-100" />; }
function TableSkeleton() { return <div className="space-y-2 p-4">{[1,2,3,4].map((x) => <div key={x} className="h-12 animate-pulse rounded-md bg-slate-100" />)}</div>; }
