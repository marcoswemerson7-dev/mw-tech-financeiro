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
    <div className="space-y-8 lg:space-y-9">
      <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#0d3159] to-[#17456f] px-7 py-5 text-white">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[.2em] text-[#efbd5f]">Painel financeiro</p>
            <h2 className="mt-1 text-[31px] font-extrabold tracking-[-.03em] sm:text-[35px]">Resumo financeiro</h2>
          </div>
          <div className="rounded-md border border-white/15 bg-white/10 px-4 py-2 text-[13px] font-semibold text-slate-100">Atualização do mês atual</div>
        </div>
        <div className="border-t border-[#31577d] bg-[#f8fafc] px-7 py-4">
          <p className="text-[15px] font-medium text-slate-600">Uma visão direta da situação financeira da MW TECH, com entradas, saídas, saldo e compromissos.</p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Saldo em caixa" value={cash} loading={loading && account === null} icon={<Wallet size={27} />} tone="gold" />
        <Kpi title="Entradas do mês" value={ins} loading={loading && !cachedMovements} icon={<ArrowUpRight size={27} />} tone="green" />
        <Kpi title="Saídas do mês" value={outs} loading={loading && !cachedMovements} icon={<ArrowDownRight size={27} />} tone="red" />
        <Kpi title="Valor em conta" value={account} loading={loading && account === null} icon={<Landmark size={27} />} tone="blue" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
          <PanelHeader title="Entradas x Saídas" subtitle="Fluxo financeiro dos últimos 6 meses" />
          <div className="p-6 sm:p-7">
            {loading && !cachedMovements ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chart} barGap={10}>
                  <CartesianGrid stroke="#e7edf4" vertical={false} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "#43536a", fontSize: 14, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 13 }} width={72} />
                  <Tooltip formatter={(v) => money(v)} cursor={{ fill: "#f5f8fc" }} />
                  <Legend wrapperStyle={{ fontSize: 14, paddingTop: 12, fontWeight: 600 }} />
                  <Bar name="Entradas" dataKey="entradas" fill="#16a34a" radius={[5, 5, 0, 0]} maxBarSize={42} />
                  <Bar name="Saídas" dataKey="saidas" fill="#dc2626" radius={[5, 5, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
          <PanelHeader title="Contas do mês" subtitle="Situação dos compromissos financeiros" />
          <div className="space-y-4 p-6 sm:p-7">
            {loading && !cachedMovements ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : <>
              <Status label="A pagar" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="amber" />
              <Status label="Pagas" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="green" />
              <Status label="Pendentes" value={0} count={0} color="red" />
            </>}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d3159] px-6 py-5 text-white sm:px-7">
          <div>
            <h3 className="text-[21px] font-extrabold">Movimentações recentes</h3>
            <p className="mt-1 text-[13px] font-medium text-slate-200">Últimos lançamentos registrados</p>
          </div>
          <a href="/movimentacoes" className="flex min-h-[42px] items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 text-[14px] font-bold text-white transition hover:bg-white/15">
            Ver todas <ArrowRight size={17} />
          </a>
        </div>

        {loading && !cachedMovements ? <TableSkeleton /> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[15px]">
              <thead><tr>{["Data", "Descrição", "Categoria", "Tipo", "Valor", "Status", "Ações"].map((x) => <th key={x} className="px-6 py-4">{x}</th>)}</tr></thead>
              <tbody>{rows.map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap px-6 py-5 font-medium text-slate-600">{formatDate(x.data)}</td>
                  <td className="px-6 py-5 font-bold text-slate-800">{x.descricao}</td>
                  <td className="px-6 py-5 text-slate-600">{x.categorias_financeiras?.nome || "—"}</td>
                  <td className="px-6 py-5 font-semibold capitalize text-slate-600">{x.tipo.replace("_", " ")}</td>
                  <td className={`whitespace-nowrap px-6 py-5 text-[16px] font-extrabold ${x.tipo.includes("entrada") ? "text-emerald-600" : "text-rose-600"}`}>{money(x.valor)}</td>
                  <td className="px-6 py-5"><Badge status="pago" /></td>
                  <td className="px-6 py-5 text-slate-500"><MoreHorizontal size={20} /></td>
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
  return <div className="border-b border-[#173f68] bg-[#10365f] px-6 py-4 text-white sm:px-7"><h3 className="text-[20px] font-extrabold">{title}</h3><p className="mt-1 text-[13px] font-medium text-slate-200">{subtitle}</p></div>;
}

function Kpi({ title, value, icon, tone, loading }: { title: string; value: number | null; icon: any; tone: "gold" | "green" | "red" | "blue"; loading?: boolean }) {
  const tones = {
    gold: ["from-[#d99b2f] to-[#e5b34e]", "bg-[#fff6df] text-[#a56c14]"],
    green: ["from-[#0f9f72] to-[#18b886]", "bg-emerald-50 text-emerald-700"],
    red: ["from-[#d74646] to-[#ed5e5e]", "bg-rose-50 text-rose-700"],
    blue: ["from-[#315ea8] to-[#4779c8]", "bg-blue-50 text-blue-700"],
  }[tone];
  return <div className="overflow-hidden rounded-md border border-[#cad5e3] bg-white shadow-[0_8px_20px_rgba(15,35,70,.08)]"><div className={`h-3 bg-gradient-to-r ${tones[0]}`} /><div className="flex min-h-[172px] items-start justify-between gap-4 p-6"><div className="min-w-0"><p className="text-[15px] font-extrabold uppercase tracking-[.035em] text-slate-600">{title}</p>{loading ? <div className="mt-4 h-10 w-40 animate-pulse rounded-md bg-slate-200" /> : <b className="mt-4 block break-words text-[32px] font-extrabold leading-tight tracking-[-.035em] text-[#091a35] sm:text-[35px]">{money(value || 0)}</b>}<p className="mt-3 text-[12px] font-medium text-slate-400">{loading ? "Carregando dados..." : "Atualizado com os lançamentos registrados"}</p></div><span className={`grid size-14 shrink-0 place-items-center rounded-md ${tones[1]}`}>{icon}</span></div></div>;
}

function Status({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  const c = color === "green" ? "bg-emerald-500" : color === "red" ? "bg-rose-500" : "bg-amber-500";
  return <div className="flex min-h-[88px] items-center justify-between gap-4 rounded-md border border-[#d7e0ea] bg-[#f7f9fc] p-4.5"><div className="flex items-center gap-3.5"><i className={`size-3.5 rounded-full ${c}`} /><div><b className="block text-[16px] font-extrabold text-slate-800">{label}</b><span className="mt-1 block text-[13px] font-medium text-slate-500">{count} contas</span></div></div><strong className="whitespace-nowrap text-[18px] font-extrabold text-slate-800">{money(value)}</strong></div>;
}

function RowSkeleton() { return <div className="h-[88px] animate-pulse rounded-md border border-slate-200 bg-slate-100" />; }
function ChartSkeleton() { return <div className="h-[350px] animate-pulse rounded-md bg-slate-100" />; }
function TableSkeleton() { return <div className="space-y-3 p-6">{[1,2,3,4].map((x) => <div key={x} className="h-14 animate-pulse rounded-md bg-slate-100" />)}</div>; }
