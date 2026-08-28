import { useEffect, useState } from "react";
import {
  Banknote,
  Landmark,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  getAccounts,
  getMovements,
  type Account,
  type Movement,
} from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty } from "../components/UI";
export default function Cash() {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [mov, setMov] = useState<Movement[]>([]);
  useEffect(() => {
    if (isConfigured)
      Promise.all([getAccounts(), getMovements(30)]).then(([a, m]) => {
        setAccounts(a);
        setMov(m);
      });
  }, []);
  const cash = accounts
      .filter((x) => x.tipo_conta === "caixa")
      .reduce((a, x) => a + Number(x.saldo_atual), 0),
    bank = accounts
      .filter((x) => x.tipo_conta !== "caixa")
      .reduce((a, x) => a + Number(x.saldo_atual), 0),
    today = new Date().toISOString().slice(0, 10),
    daily = mov.filter((x) => x.data === today),
    ins = daily
      .filter((x) => x.tipo.includes("entrada"))
      .reduce((a, x) => a + Number(x.valor), 0),
    outs = daily
      .filter((x) => x.tipo.includes("saida"))
      .reduce((a, x) => a + Number(x.valor), 0);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1d3a]">Caixa</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dinheiro disponível em caixa e nas contas bancárias.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Balance title="Saldo em caixa" value={cash} icon={<Banknote />} />
        <Balance title="Saldo bancário" value={bank} icon={<Landmark />} />
        <Balance
          title="Saldo total"
          value={cash + bank}
          icon={<Wallet />}
          featured
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-bold">Evolução do caixa</h3>
          <p className="text-xs text-slate-500">
            O histórico será formado pelas movimentações registradas.
          </p>
          <div className="mt-8 grid h-56 place-items-center rounded-xl bg-slate-50 text-sm text-slate-400">
            Saldo consolidado: {money(cash + bank)}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-bold">Resumo do dia</h3>
          <div className="mt-8 space-y-5">
            <Daily label="Entradas" value={ins} icon={<ArrowUpRight />} green />
            <Daily label="Saídas" value={outs} icon={<ArrowDownRight />} />
            <div className="border-t pt-5">
              <p className="text-sm text-slate-500">Saldo final</p>
              <b className="text-2xl">{money(ins - outs)}</b>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white">
        <div className="border-b p-5">
          <h3 className="font-bold">Lançamentos de caixa</h3>
        </div>
        {mov.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Data", "Descrição", "Tipo", "Conta", "Valor"].map((x) => (
                    <th className="px-5 py-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mov.map((x) => (
                  <tr className="border-t" key={x.id}>
                    <td className="px-5 py-4">
                      {new Date(x.data + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                      )}
                    </td>
                    <td className="px-5">{x.descricao}</td>
                    <td className="px-5 capitalize">
                      {x.tipo.replace("_", " ")}
                    </td>
                    <td className="px-5">{x.contas_bancarias?.nome}</td>
                    <td className="px-5 font-semibold">{money(x.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </div>
    </div>
  );
}
function Balance({
  title,
  value,
  icon,
  featured,
}: {
  title: string;
  value: number;
  icon: any;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${featured ? "bg-[#0b2b66] text-white" : "bg-white"}`}
    >
      <div className="flex justify-between">
        <div>
          <p className="text-sm opacity-70">{title}</p>
          <b className="mt-2 block text-3xl">{money(value)}</b>
        </div>
        <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-[#c78b35]">
          {icon}
        </span>
      </div>
    </div>
  );
}
function Daily({
  label,
  value,
  icon,
  green,
}: {
  label: string;
  value: number;
  icon: any;
  green?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-lg ${green ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
        >
          {icon}
        </span>
        {label}
      </div>
      <b>{money(value)}</b>
    </div>
  );
}
