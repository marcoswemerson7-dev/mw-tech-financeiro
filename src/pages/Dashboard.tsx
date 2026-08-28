import { useEffect, useState } from "react";
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
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  ArrowRight,
  MoreHorizontal,
} from "lucide-react";
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isConfigured } from "../lib/supabase";
import { money, Empty, Badge } from "../components/UI";
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
    current = rows.filter((x) => x.data.startsWith(month)),
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
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1d3a]">Resumo financeiro</h2>
        <p className="mt-1 text-sm text-slate-500">
          Uma visão simples da situação financeira da MW TECH.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Saldo em caixa" value={cash} icon={<Wallet />} />
        <Kpi
          title="Entradas do mês"
          value={ins}
          icon={<ArrowUpRight />}
          green
        />
        <Kpi title="Saídas do mês" value={outs} icon={<ArrowDownRight />} red />
        <Kpi title="Valor em conta" value={account} icon={<Landmark />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">Entradas x Saídas</h3>
          <p className="mb-6 text-xs text-slate-500">Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={chart}>
              <CartesianGrid stroke="#edf0f4" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar
                dataKey="entradas"
                fill="#16a34a"
                radius={[6, 6, 0, 0]}
                maxBarSize={34}
              />
              <Bar
                dataKey="saidas"
                fill="#dc2626"
                radius={[6, 6, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">Contas do mês</h3>
          <p className="mb-7 text-xs text-slate-500">
            Situação dos compromissos
          </p>
          <div className="space-y-4">
            <Status
              label="A pagar"
              value={outs}
              count={current.filter((x) => x.tipo.includes("saida")).length}
              color="amber"
            />
            <Status
              label="Pagas"
              value={outs}
              count={current.filter((x) => x.tipo.includes("saida")).length}
              color="green"
            />
            <Status label="Pendentes" value={0} count={0} color="red" />
          </div>
        </section>
      </div>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h3 className="text-lg font-bold">Movimentações recentes</h3>
            <p className="text-xs text-slate-500">
              Últimos lançamentos registrados
            </p>
          </div>
          <a
            href="/movimentacoes"
            className="flex items-center gap-2 text-sm font-semibold text-[#0b2b66]"
          >
            Ver todas <ArrowRight size={16} />
          </a>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Data",
                    "Descrição",
                    "Categoria",
                    "Tipo",
                    "Valor",
                    "Status",
                    "Ações",
                  ].map((x) => (
                    <th key={x} className="px-6 py-3.5">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="px-6 py-4">
                      {new Date(x.data + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                      )}
                    </td>
                    <td className="px-6 font-medium">{x.descricao}</td>
                    <td className="px-6">
                      {x.categorias_financeiras?.nome || "—"}
                    </td>
                    <td className="px-6 capitalize">
                      {x.tipo.replace("_", " ")}
                    </td>
                    <td
                      className={`px-6 font-semibold ${x.tipo.includes("entrada") ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {money(x.valor)}
                    </td>
                    <td className="px-6">
                      <Badge status="pago" />
                    </td>
                    <td className="px-6">
                      <MoreHorizontal size={17} />
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
function Kpi({
  title,
  value,
  icon,
  green,
  red,
}: {
  title: string;
  value: number;
  icon: any;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <b className="mt-3 block text-3xl tracking-tight">{money(value)}</b>
        </div>
        <span
          className={`grid size-12 place-items-center rounded-xl ${green ? "bg-emerald-50 text-emerald-600" : red ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-[#c58a33]"}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
function Status({
  label,
  value,
  count,
  color,
}: {
  label: string;
  value: number;
  count: number;
  color: string;
}) {
  const c =
    color === "green"
      ? "bg-emerald-500"
      : color === "red"
        ? "bg-rose-500"
        : "bg-amber-500";
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <i className={`size-2.5 rounded-full ${c}`} />
        <div>
          <b className="block text-sm">{label}</b>
          <span className="text-xs text-slate-500">{count} contas</span>
        </div>
      </div>
      <strong>{money(value)}</strong>
    </div>
  );
}
