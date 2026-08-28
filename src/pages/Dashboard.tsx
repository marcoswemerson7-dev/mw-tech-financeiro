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
  Clock3,
  Crown,
  MoreHorizontal,
} from "lucide-react";
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, Badge, dateOnly, formatDate, SectionCard, StatCard, FinancialAmount } from "../components/UI";

export default function Dashboard() {
  const [rows, setRows] = useState<Movement[]>([]),
    [account, setAccount] = useState(0);

  useEffect(() => {
    if (isConfigured)
      Promise.all([getMovements(8), getAccounts()]).then(([m, a]) => {
        setRows(m);
        setAccount(a.reduce((s, x) => s + Number(x.saldo_atual), 0));
      });
  }, []);

  const now = new Date(),
    month = now.toISOString().slice(0, 7),
    current = rows.filter((x) => dateOnly(x.data).startsWith(month)),
    ins = current
      .filter((x) => x.tipo.includes("entrada"))
      .reduce((a, x) => a + Number(x.valor), 0),
    outs = current
      .filter((x) => x.tipo.includes("saida"))
      .reduce((a, x) => a + Number(x.valor), 0),
    cash = account;

  const chart = ["Jan", "Fev", "Mar", "Abr", "Mai", "Atual"].map((mes, i) => ({
    mes,
    entradas: i === 5 ? ins : 0,
    saidas: i === 5 ? outs : 0,
  }));

  return (
    <div className="space-y-7 lg:space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#17375f] bg-[#061426] p-7 text-white shadow-[0_18px_45px_rgba(6,20,38,.18)] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-80 lg:block">
          <div className="absolute right-16 top-12 h-24 w-[420px] rounded-[50%] border border-blue-500/35" />
          <div className="absolute right-4 top-16 h-28 w-[440px] rounded-[50%] border border-[#e8ac35]/45" />
          <div className="absolute right-28 top-28 h-20 w-[360px] rounded-[50%] border border-blue-400/25" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="text-[31px] font-black tracking-[-0.01em] sm:text-[38px]">
              Resumo financeiro
            </h2>
            <p className="mt-3 max-w-xl text-[16px] leading-7 text-blue-100">
              Acompanhe de forma clara e inteligente a saúde financeira da sua empresa.
            </p>
          </div>
          <span className="inline-flex min-h-[54px] items-center gap-3 rounded-xl border border-[#e8ac35]/50 bg-white/[.06] px-5 text-[14px] font-black text-white">
            <CalendarDays size={18} className="text-[#f5c75b]" />
            Atualização do mês atual
          </span>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saldo em caixa" value={money(cash)} icon={<Wallet size={26} />} tone="gold" hint="Atualizado agora" />
        <StatCard title="Entradas do mês" value={money(ins)} icon={<ArrowUpRight size={26} />} tone="green" hint="↑ 100% vs mês anterior" />
        <StatCard title="Saídas do mês" value={<FinancialAmount value={outs} kind="saida" />} icon={<ArrowDownRight size={26} />} tone="red" hint="— 0% vs mês anterior" />
        <StatCard title="Valor em conta" value={money(account)} icon={<Landmark size={26} />} tone="blue" hint="Atualizado agora" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <SectionCard
          title="Entradas x Saídas"
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
            <Status label="A pagar" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="amber" icon={<Wallet size={22} />} />
            <Status label="Pagas" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="green" icon={<CheckCircle2 size={22} />} />
            <Status label="Pendentes" value={0} count={0} color="red" icon={<Clock3 size={22} />} />
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

function Status({
  label,
  value,
  count,
  color,
  icon,
}: {
  label: string;
  value: number;
  count: number;
  color: string;
  icon: ReactNode;
}) {
  const cls =
    color === "green"
      ? "bg-emerald-50 text-emerald-600"
      : color === "red"
        ? "bg-rose-50 text-rose-600"
        : "bg-amber-50 text-[#d09116]";
  return (
    <div className="flex min-h-[86px] items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-full ${cls}`}>{icon}</span>
        <div className="min-w-0">
          <b className="block text-[15px] text-[#061426]">{label}</b>
          <span className="mt-0.5 block text-[13px] text-slate-500">{count} contas</span>
        </div>
      </div>
      <strong className="whitespace-nowrap text-[17px] font-black text-[#061426]">{money(value)}</strong>
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </div>
  );
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
