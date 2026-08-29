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
  LayoutGrid,
  Plus,
  TrendingUp,
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
  StatCard,
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
    <div className="space-y-7 lg:space-y-8">
      <PageHeader
        title="Caixa"
        subtitle="Central financeira para receber, pagar, acompanhar entradas e saídas e enxergar o saldo em tempo real."
        actions={
          <Link
            to="/movimentacoes"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-[#061426] px-5 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(6,20,38,.18)] transition hover:bg-[#0b2b50]"
          >
            <Plus size={18} />
            Novo lançamento
          </Link>
        }
      />

      <section className="overflow-hidden rounded-3xl border border-[#17375f] bg-[#061426] text-white shadow-[0_22px_55px_rgba(6,20,38,.2)]">
        <div className="grid gap-6 p-6 sm:p-7 xl:grid-cols-[1.1fr_.9fr]">
          <div className="flex min-h-[230px] flex-col justify-between rounded-2xl border border-white/10 bg-white/[.05] p-6">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[.28em] text-[#f5c75b]">
                MW TECH Financeiro
              </p>
              <h3 className="mt-4 text-[30px] font-black leading-tight tracking-[-0.03em] sm:text-[42px]">
                Controle rápido de entradas e saídas
              </h3>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-blue-100">
                Clique nos blocos para ir direto ao recebimento, pagamento ou fluxo de caixa.
                Tudo pensado para lançar, consultar e decidir sem travar a rotina.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Disponível" value={money(available)} />
              <MiniMetric label="Resultado do mês" value={<FinancialAmount value={monthResult} kind="resultado" />} />
              <MiniMetric label="Movimentações" value={String(totals.monthCount)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FlowShortcut
              title="Receber"
              subtitle="Entradas e recebimentos"
              value={totals.todayIn}
              href="/receitas"
              cta="Ir para receber"
              icon={<ArrowUpRight size={25} />}
              tone="green"
            />
            <FlowShortcut
              title="Pagar"
              subtitle="Contas e despesas"
              value={totals.pendingAmount || totals.todayOut}
              href="/despesas"
              cta="Ir para pagar"
              icon={<ArrowDownRight size={25} />}
              tone="orange"
            />
            <FlowShortcut
              title="Fluxo"
              subtitle="Entradas e saídas"
              value={monthResult}
              href="/movimentacoes"
              cta="Ver fluxo"
              icon={<TrendingUp size={25} />}
              tone="blue"
            />
            <FlowShortcut
              title="Contas"
              subtitle="Saldos bancários"
              value={available}
              href="/contas"
              cta="Ver contas"
              icon={<Landmark size={25} />}
              tone="gold"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Entradas hoje"
          value={money(totals.todayIn)}
          icon={<ArrowUpRight size={27} />}
          tone="green"
          hint="Recebimentos lançados na data atual"
        />
        <StatCard
          title="Saídas hoje"
          value={<FinancialAmount value={totals.todayOut} kind="saida" />}
          icon={<ArrowDownRight size={27} />}
          tone="red"
          hint="Pagamentos e retiradas de hoje"
        />
        <StatCard
          title="A pagar no mês"
          value={<FinancialAmount value={totals.pendingAmount} kind="pendente" />}
          icon={<Clock3 size={27} />}
          tone="orange"
          hint={`${totals.pendingCount} pendência${totals.pendingCount === 1 ? "" : "s"} em aberto`}
        />
        <StatCard
          title="Saldo disponível"
          value={money(available)}
          icon={<Wallet size={27} />}
          tone="gold"
          hint="Soma do caixa e contas bancárias"
          featured
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_.82fr]">
        <SectionCard
          title="Fluxo de caixa"
          subtitle={`Entradas e saídas de ${monthLabel.format(now)}`}
          icon={LayoutGrid}
          action={
            <Link
              to="/movimentacoes"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-black text-[#061426] transition hover:border-[#e8ac35] hover:bg-amber-50"
            >
              Ver completo <ArrowRight size={16} />
            </Link>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_230px]">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chart} barGap={10}>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={70} />
                <Tooltip formatter={(value) => money(value)} cursor={{ fill: "#f8fafc" }} />
                <Bar name="Entradas" dataKey="entradas" fill="#059669" radius={[8, 8, 0, 0]} maxBarSize={38} />
                <Bar name="Saídas" dataKey="saidas" fill="#e11d48" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid content-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <BalanceLine label="Entradas" value={totals.monthIn} kind="entrada" />
              <BalanceLine label="Saídas" value={totals.monthOut} kind="saida" />
              <div className="my-1 h-px bg-slate-200" />
              <BalanceLine label="Resultado" value={monthResult} kind="resultado" strong />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Posição das contas" subtitle="Dinheiro disponível agora" icon={Banknote}>
          <div className="space-y-4">
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

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_14px_36px_rgba(15,35,70,.055)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7 sm:py-6">
          <div>
            <h3 className="text-[21px] font-black text-[#061426]">Últimos lançamentos</h3>
            <p className="mt-1 text-[13px] text-slate-500">
              Visual rápido das movimentações mais recentes do caixa.
            </p>
          </div>
          <Link
            to="/movimentacoes"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-3 text-[14px] font-black text-[#061426] transition hover:bg-blue-50"
          >
            Abrir entradas e saídas <ArrowRight size={17} />
          </Link>
        </div>

        {recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[14px]">
              <thead className="bg-[#061426] text-[12px] font-black uppercase tracking-wide text-white">
                <tr>
                  {["Data", "Descrição", "Tipo", "Conta", "Valor", "Status"].map((item) => (
                    <th className="px-6 py-4" key={item}>
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr className="border-t border-slate-100 transition hover:bg-slate-50/70" key={row.id}>
                    <td className="whitespace-nowrap px-6 py-5 text-slate-600">{formatDate(row.data)}</td>
                    <td className="max-w-[360px] break-words px-6 py-5 font-black text-[#061426]">
                      {row.descricao}
                    </td>
                    <td className="px-6 py-5 capitalize text-slate-600">{row.tipo.replace("_", " ")}</td>
                    <td className="px-6 py-5 text-slate-600">{row.contas_bancarias?.nome || "—"}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-right text-[15px] font-black">
                      <FinancialAmount value={row.valor} kind={row.tipo} />
                    </td>
                    <td className="px-6 py-5">
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

function FlowShortcut({
  title,
  subtitle,
  value,
  href,
  cta,
  icon,
  tone,
}: {
  title: string;
  subtitle: string;
  value: number;
  href: string;
  cta: string;
  icon: ReactNode;
  tone: "green" | "orange" | "blue" | "gold";
}) {
  const styles = {
    green: "from-emerald-500 to-emerald-400 text-white",
    orange: "from-orange-400 to-amber-300 text-white",
    blue: "from-cyan-500 to-blue-500 text-white",
    gold: "from-[#e8ac35] to-[#f6cc68] text-[#061426]",
  }[tone];

  return (
    <Link
      to={href}
      className={`group relative flex min-h-[156px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${styles} p-5 shadow-[0_14px_30px_rgba(6,20,38,.18)] transition hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(6,20,38,.25)]`}
    >
      <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/18" />
      <span className="pointer-events-none absolute -bottom-12 right-8 size-24 rounded-full bg-white/12" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[19px] font-black">{title}</p>
          <p className="mt-1 text-[13px] font-bold opacity-85">{subtitle}</p>
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/18">
          {icon}
        </span>
      </div>
      <div className="relative">
        <strong className="block text-[31px] font-black tracking-[-0.03em]">
          <FinancialAmount value={value} kind={tone === "orange" ? "saida" : "resultado"} className={tone === "gold" ? "text-[#061426]" : "text-white"} />
        </strong>
        <span className="mt-4 inline-flex items-center gap-2 text-[14px] font-black">
          {cta}
          <ArrowRight size={16} className="transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3">
      <p className="text-[12px] font-bold uppercase tracking-[.16em] text-blue-100">{label}</p>
      <b className="mt-1 block truncate text-[18px] font-black text-white">{value}</b>
    </div>
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
      <span className={`text-[14px] ${strong ? "font-black text-[#061426]" : "font-bold text-slate-500"}`}>
        {label}
      </span>
      <b className={`${strong ? "text-[22px]" : "text-[17px]"} whitespace-nowrap font-black`}>
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
      className={`flex min-h-[86px] items-center justify-between gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
        featured
          ? "border-[#17375f] bg-[#061426] text-white shadow-[0_14px_30px_rgba(6,20,38,.18)]"
          : "border-slate-200 bg-slate-50/70 hover:bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${featured ? "bg-white/10 text-[#f5c75b]" : "bg-white text-[#061426]"}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className={`text-[13px] font-bold ${featured ? "text-blue-100" : "text-slate-500"}`}>
            {title}
          </p>
          <b className={`mt-1 block truncate text-[22px] font-black ${featured ? "text-[#f5c75b]" : "text-[#061426]"}`}>
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
    const key = date.toISOString().slice(0, 7);
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
