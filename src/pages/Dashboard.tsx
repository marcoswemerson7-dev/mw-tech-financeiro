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
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, Badge, dateOnly, formatDate } from "../components/UI";

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
    <div className="space-y-8 lg:space-y-9">
      <section>
        <h2 className="text-[30px] font-bold tracking-[-0.025em] text-[#0b1d3a] sm:text-[34px]">
          Resumo financeiro
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-500">
          Uma visão simples e direta da situação financeira da MW TECH.
        </p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Saldo em caixa" value={cash} icon={<Wallet size={25} />} />
        <Kpi title="Entradas do mês" value={ins} icon={<ArrowUpRight size={25} />} green />
        <Kpi title="Saídas do mês" value={outs} icon={<ArrowDownRight size={25} />} red />
        <Kpi title="Valor em conta" value={account} icon={<Landmark size={25} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_10px_32px_rgba(15,35,70,.05)] sm:p-7">
          <div className="mb-7">
            <h3 className="text-[20px] font-bold text-[#0b1d3a]">Entradas x Saídas</h3>
            <p className="mt-1 text-[13px] text-slate-500">Fluxo financeiro dos últimos 6 meses</p>
          </div>
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
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_10px_32px_rgba(15,35,70,.05)] sm:p-7">
          <h3 className="text-[20px] font-bold text-[#0b1d3a]">Contas do mês</h3>
          <p className="mb-7 mt-1 text-[13px] text-slate-500">Situação dos compromissos financeiros</p>
          <div className="space-y-4">
            <Status label="A pagar" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="amber" />
            <Status label="Pagas" value={outs} count={current.filter((x) => x.tipo.includes("saida")).length} color="green" />
            <Status label="Pendentes" value={0} count={0} color="red" />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_32px_rgba(15,35,70,.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7 sm:py-6">
          <div>
            <h3 className="text-[20px] font-bold text-[#0b1d3a]">Movimentações recentes</h3>
            <p className="mt-1 text-[13px] text-slate-500">Últimos lançamentos registrados</p>
          </div>
          <a href="/movimentacoes" className="flex min-h-[42px] items-center gap-2 rounded-xl px-3 text-[14px] font-bold text-[#0b2b66] transition hover:bg-blue-50">
            Ver todas <ArrowRight size={17} />
          </a>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[14px]">
              <thead className="bg-slate-50/90 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Data", "Descrição", "Categoria", "Tipo", "Valor", "Status", "Ações"].map((x) => (
                    <th key={x} className="px-6 py-4">{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-6 py-5 text-slate-600">
                      {formatDate(x.data)}
                    </td>
                    <td className="px-6 py-5 font-semibold text-slate-800">{x.descricao}</td>
                    <td className="px-6 py-5 text-slate-600">{x.categorias_financeiras?.nome || "—"}</td>
                    <td className="px-6 py-5 capitalize text-slate-600">{x.tipo.replace("_", " ")}</td>
                    <td className={`whitespace-nowrap px-6 py-5 text-[15px] font-bold ${x.tipo.includes("entrada") ? "text-emerald-600" : "text-rose-600"}`}>
                      {money(x.valor)}
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

function Kpi({ title, value, icon, green, red }: { title: string; value: number; icon: any; green?: boolean; red?: boolean }) {
  return (
    <div className="min-h-[166px] rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_10px_32px_rgba(15,35,70,.055)] sm:p-7">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-600">{title}</p>
          <b className="mt-4 block break-words text-[30px] font-bold leading-tight tracking-[-0.03em] text-[#0b1736] sm:text-[33px]">{money(value)}</b>
          <p className="mt-3 text-[12px] text-slate-400">Atualizado com os lançamentos registrados</p>
        </div>
        <span className={`grid size-13 shrink-0 place-items-center rounded-2xl ${green ? "bg-emerald-50 text-emerald-600" : red ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-[#b9802f]"}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function Status({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  const c = color === "green" ? "bg-emerald-500" : color === "red" ? "bg-rose-500" : "bg-amber-500";
  return (
    <div className="flex min-h-[82px] items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4.5">
      <div className="flex items-center gap-3.5">
        <i className={`size-3 rounded-full ${c}`} />
        <div>
          <b className="block text-[15px] text-slate-800">{label}</b>
          <span className="mt-1 block text-[12px] text-slate-500">{count} contas</span>
        </div>
      </div>
      <strong className="whitespace-nowrap text-[17px] text-slate-800">{money(value)}</strong>
    </div>
  );
}
