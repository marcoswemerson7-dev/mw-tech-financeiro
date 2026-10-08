import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Clock3,
  Landmark,
  ChartNoAxesColumnIncreasing,
  CalendarDays,
  ReceiptText,
  Plus,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAccounts,
  getMovements,
  type Account,
  type Movement,
} from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { getExpenses } from "../services/expenses";
import {
  Badge,
  Empty,
  FinancialAmount,
  dateOnly,
  formatDate,
  money,
  PageHeader,
  SectionCard,
} from "../components/UI";

type ExpenseRow = {
  id: string;
  descricao?: string;
  valor?: number | string;
  status?: string;
  data_vencimento?: string;
  vencimento?: string;
  data_pagamento?: string;
};

const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

export default function Cash() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([
      getAccounts().catch(() => []),
      getMovements(500).catch(() => []),
      getExpenses().catch(() => []),
    ]).then(([accountRows, movementRows, expenseRows]) => {
      setAccounts(accountRows);
      setMovements(movementRows);
      setExpenses(expenseRows);
    });
  }, []);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const totals = useMemo(() => {
    const monthMovements = movements.filter((row) => dateOnly(row.data).startsWith(month));
    const todayMovements = movements.filter((row) => dateOnly(row.data) === today);
    const pendingExpenses = expenses.filter(
      (row) =>
        row.status === "pendente" &&
        dateOnly(row.data_vencimento || row.vencimento).startsWith(month),
    );
    const paidExpenses = expenses.filter(
      (row) =>
        row.status === "pago" &&
        dateOnly(row.data_pagamento || row.data_vencimento || row.vencimento).startsWith(month),
    );

    const sumMovements = (rows: Movement[], kind: "entrada" | "saida") =>
      rows
        .filter((row) => row.tipo.toLowerCase().includes(kind))
        .reduce((sum, row) => sum + Number(row.valor || 0), 0);

    return {
      cash: accounts
        .filter((row) => row.tipo_conta === "caixa")
        .reduce((sum, row) => sum + Number(row.saldo_atual || 0), 0),
      bank: accounts
        .filter((row) => row.tipo_conta !== "caixa")
        .reduce((sum, row) => sum + Number(row.saldo_atual || 0), 0),
      todayIn: sumMovements(todayMovements, "entrada"),
      todayOut: sumMovements(todayMovements, "saida"),
      monthIn: sumMovements(monthMovements, "entrada"),
      monthOut: sumMovements(monthMovements, "saida"),
      pendingCount: pendingExpenses.length,
      pendingAmount: pendingExpenses.reduce((sum, row) => sum + Number(row.valor || 0), 0),
      paidAmount: paidExpenses.reduce((sum, row) => sum + Number(row.valor || 0), 0),
      monthCount: monthMovements.length,
    };
  }, [accounts, expenses, month, movements, today]);

  const available = totals.cash + totals.bank;
  const monthResult = totals.monthIn - totals.monthOut;
  const chart = useMemo(() => buildMonthlyChart(movements), [movements]);
  const recent = movements.slice(0, 6);

  return (
    <div className="space-y-5 lg:space-y-5">
      <PageHeader
        title="Caixa"
        subtitle="Central financeira para receber, pagar, acompanhar entradas e saídas e enxergar o saldo em tempo real."
        actions={
          <Link
            to="/movimentacoes"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-[#061426] px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#0b2b50]"
          >
            <Plus size={18} />
            Novo lançamento
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <CashMetric title="Entradas hoje" value={money(totals.todayIn)} hint="Recebimentos lançados na data atual" icon={<ArrowUpRight size={24} />} tone="green" href="/receitas" />
        <CashMetric title="Saídas hoje" value={<FinancialAmount value={totals.todayOut} kind="saida" />} hint="Pagamentos e retiradas de hoje" icon={<ArrowDownRight size={24} />} tone="red" href="/movimentacoes" />
        <CashMetric title="A pagar no mês" value={<FinancialAmount value={totals.pendingAmount} kind="pendente" />} hint={`${totals.pendingCount} pendência${totals.pendingCount === 1 ? "" : "s"} em aberto`} icon={<Clock3 size={24} />} tone="orange" href="/despesas" />
        <CashMetric title="Saldo disponível" value={money(available)} hint="Soma do caixa e contas bancárias" icon={<Wallet size={24} />} tone="gold" href="/contas" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <SectionCard
          title="Fluxo de caixa"
          subtitle={`Entradas e saídas de ${monthLabel.format(now)}`}
          icon={ChartNoAxesColumnIncreasing}
          action={
            <Link
              to="/movimentacoes"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-[#061426] transition hover:border-[#e8ac35] hover:bg-amber-50"
            >
              <CalendarDays size={16} /> Últimos 6 meses <ArrowRight size={16} />
            </Link>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
            <div className="min-w-0"><ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} barGap={10}>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={70} />
                <Tooltip formatter={(value) => money(value)} cursor={{ fill: "#f8fafc" }} />
                <Bar name="Entradas" dataKey="entradas" fill="#059669" radius={[8, 8, 0, 0]} maxBarSize={38} />
                <Bar name="Saídas" dataKey="saidas" fill="#e11d48" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer><div className="mt-1 flex gap-5 pl-5 text-xs font-medium text-slate-500"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-emerald-600" />Entradas</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-rose-600" />Saídas</span></div></div>
            <div className="grid content-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <BalanceLine label="Entradas" value={totals.monthIn} kind="entrada" />
              <BalanceLine label="Saídas" value={totals.monthOut} kind="saida" />
              <div className="my-1 h-px bg-slate-200" />
              <BalanceLine label="Resultado" value={monthResult} kind="resultado" strong />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Posição das contas" subtitle="Dinheiro disponível agora" icon={Banknote}>
          <div className="space-y-3">
            <AccountSummary
              title="Caixa físico"
              value={totals.cash}
              icon={<Banknote size={22} />}
              href="/contas"
            />
            <AccountSummary
              title="Bancos"
              value={totals.bank}
              icon={<Landmark size={22} />}
              href="/contas"
            />
            <AccountSummary
              title="Total disponível"
              value={available}
              icon={<Wallet size={22} />}
              href="/contas"
              featured
            />
          </div>
        </SectionCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h3 className="flex items-center gap-3 text-[20px] font-semibold text-[#061426]"><ReceiptText size={21} /> Últimos lançamentos</h3>
            <p className="mt-1 text-[13px] text-slate-500">
              Visual rápido das movimentações mais recentes do caixa.
            </p>
          </div>
          <Link
            to="/movimentacoes"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-[#061426] transition hover:bg-blue-50"
          >
            Abrir entradas e saídas <ArrowRight size={17} />
          </Link>
        </div>

        {recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  {["Data", "Descrição", "Tipo", "Conta", "Valor", "Status"].map((item) => (
                    <th className="px-5 py-3" key={item}>
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr className="border-t border-slate-100 transition hover:bg-slate-50/70" key={row.id}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(row.data)}</td>
                    <td className="max-w-[360px] break-words px-5 py-3.5 font-semibold text-[#061426]">
                      {row.descricao}
                    </td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${row.tipo.toLowerCase().includes("entrada") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{row.tipo.toLowerCase().includes("entrada") ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{row.tipo.replace("_", " ")}</span></td>
                    <td className="px-5 py-3.5 text-slate-600">{row.contas_bancarias?.nome || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-[15px] font-semibold">
                      <FinancialAmount value={row.valor} kind={row.tipo} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={row.tipo.includes("estorno") ? "estornado" : "pago"} />
                    </td>
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

function CashMetric({ title, value, hint, icon, tone, href }: {
  title: string; value: ReactNode; hint: string; icon: ReactNode;
  tone: "green" | "red" | "orange" | "gold"; href: string;
}) {
  const styles = {
    green: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-700" },
    red: { icon: "bg-rose-50 text-rose-600", value: "text-rose-700" },
    orange: { icon: "bg-amber-50 text-amber-600", value: "text-[#061426]" },
    gold: { icon: "bg-white/10 text-[#f5c75b]", value: "text-[#f5c75b]" },
  }[tone];
  return (
    <Link to={href} className={`group flex min-w-0 items-start gap-4 rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone === "gold" ? "border-[#17375f] bg-[#061426] text-white" : "border-slate-200 bg-white text-[#061426]"}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${styles.icon}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${tone === "gold" ? "text-slate-100" : "text-slate-600"}`}>{title}</p>
        <strong className={`mt-1 block text-[clamp(1.3rem,1.6vw,1.85rem)] font-semibold leading-tight tracking-tight ${styles.value}`}>{value}</strong>
        <p className={`mt-2 text-xs leading-snug ${tone === "gold" ? "text-slate-300" : "text-slate-500"}`}>{hint}</p>
      </div>
    </Link>
  );
}

function BalanceLine({
  label,
  value,
  kind,
  strong,
}: {
  label: string;
  value: number;
  kind: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-[14px] ${strong ? "font-semibold text-[#061426]" : "font-bold text-slate-500"}`}>
        {label}
      </span>
      <b className={`${strong ? "text-[22px]" : "text-[17px]"} whitespace-nowrap font-semibold`}>
        <FinancialAmount value={value} kind={kind} />
      </b>
    </div>
  );
}

function AccountSummary({
  title,
  value,
  icon,
  href,
  featured,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  href: string;
  featured?: boolean;
}) {
  return (
    <Link
      to={href}
      className={`flex min-h-[75px] items-center justify-between gap-4 rounded-xl border p-3.5 transition  ${
        featured
          ? "border-amber-200 bg-amber-50 text-[#061426] shadow-sm"
          : "border-slate-200 bg-slate-50/70 hover:bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${featured ? "bg-amber-100 text-amber-700" : "bg-white text-[#061426]"}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className={`text-[13px] font-bold ${featured ? "text-slate-600" : "text-slate-500"}`}>
            {title}
          </p>
          <b className={`mt-1 block truncate text-[22px] font-semibold ${featured ? "text-amber-700" : "text-[#061426]"}`}>
            {money(value)}
          </b>
        </div>
      </div>
      <ArrowRight size={17} className={featured ? "text-[#f5c75b]" : "text-slate-400"} />
    </Link>
  );
}

function buildMonthlyChart(rows: Movement[]) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const base = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthRows = rows.filter((row) => dateOnly(row.data).startsWith(key));
    return {
      mes: formatter.format(date).replace(".", ""),
      entradas: monthRows
        .filter((row) => row.tipo.toLowerCase().includes("entrada"))
        .reduce((sum, row) => sum + Number(row.valor || 0), 0),
      saidas: monthRows
        .filter((row) => row.tipo.toLowerCase().includes("saida"))
        .reduce((sum, row) => sum + Number(row.valor || 0), 0),
    };
  });
}
