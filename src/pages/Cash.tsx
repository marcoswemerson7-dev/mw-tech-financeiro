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
import { money, Empty, dateOnly, formatDate } from "../components/UI";

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
    daily = mov.filter((x) => dateOnly(x.data) === today),
    ins = daily
      .filter((x) => x.tipo.includes("entrada"))
      .reduce((a, x) => a + Number(x.valor), 0),
    outs = daily
      .filter((x) => x.tipo.includes("saida"))
      .reduce((a, x) => a + Number(x.valor), 0);

  return (
    <div className="space-y-8 lg:space-y-9">
      <section>
        <h2 className="text-[30px] font-bold tracking-[-0.025em] text-[#0b1d3a] sm:text-[34px]">Caixa</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-500">
          Acompanhe com clareza o dinheiro disponível em caixa e nas contas bancárias.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <Balance title="Saldo em caixa" value={cash} icon={<Banknote size={25} />} />
        <Balance title="Saldo bancário" value={bank} icon={<Landmark size={25} />} />
        <Balance title="Saldo total" value={cash + bank} icon={<Wallet size={25} />} featured />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_10px_32px_rgba(15,35,70,.05)] sm:p-7">
          <h3 className="text-[20px] font-bold text-[#0b1d3a]">Evolução do caixa</h3>
          <p className="mt-1 text-[13px] text-slate-500">O histórico é formado pelas movimentações registradas.</p>
          <div className="mt-7 flex min-h-[255px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-[#b9802f]"><Wallet size={26} /></span>
            <p className="mt-4 text-[14px] font-medium text-slate-500">Saldo consolidado atual</p>
            <strong className="mt-2 text-[34px] font-bold tracking-[-0.03em] text-[#0b1d3a]">{money(cash + bank)}</strong>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_10px_32px_rgba(15,35,70,.05)] sm:p-7">
          <h3 className="text-[20px] font-bold text-[#0b1d3a]">Resumo do dia</h3>
          <p className="mt-1 text-[13px] text-slate-500">Movimentação financeira de hoje</p>
          <div className="mt-7 space-y-4">
            <Daily label="Entradas" value={ins} icon={<ArrowUpRight size={21} />} green />
            <Daily label="Saídas" value={outs} icon={<ArrowDownRight size={21} />} />
            <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/80 p-5">
              <p className="text-[14px] font-medium text-slate-500">Saldo final do dia</p>
              <b className="mt-2 block text-[28px] font-bold tracking-[-0.025em] text-[#0b1d3a]">{money(ins - outs)}</b>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_32px_rgba(15,35,70,.05)]">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7 sm:py-6">
          <h3 className="text-[20px] font-bold text-[#0b1d3a]">Lançamentos de caixa</h3>
          <p className="mt-1 text-[13px] text-slate-500">Entradas e saídas registradas recentemente</p>
        </div>
        {mov.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[14px]">
              <thead className="bg-slate-50/90 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Data", "Descrição", "Tipo", "Conta", "Valor"].map((x) => (
                    <th className="px-6 py-4" key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mov.map((x) => (
                  <tr className="border-t border-slate-100 transition hover:bg-slate-50/70" key={x.id}>
                    <td className="whitespace-nowrap px-6 py-5 text-slate-600">
                      {formatDate(x.data)}
                    </td>
                    <td className="px-6 py-5 font-semibold text-slate-800">{x.descricao}</td>
                    <td className="px-6 py-5 capitalize text-slate-600">{x.tipo.replace("_", " ")}</td>
                    <td className="px-6 py-5 text-slate-600">{x.contas_bancarias?.nome || "—"}</td>
                    <td className={`whitespace-nowrap px-6 py-5 text-[15px] font-bold ${x.tipo.includes("entrada") ? "text-emerald-600" : "text-rose-600"}`}>{money(x.valor)}</td>
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

function Balance({ title, value, icon, featured }: { title: string; value: number; icon: any; featured?: boolean }) {
  return (
    <div className={`min-h-[166px] rounded-2xl border p-6 shadow-[0_10px_32px_rgba(15,35,70,.055)] sm:p-7 ${featured ? "border-[#0b2b66] bg-[#0b2b66] text-white" : "border-slate-200/90 bg-white"}`}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className={`text-[15px] font-semibold ${featured ? "text-blue-100" : "text-slate-600"}`}>{title}</p>
          <b className="mt-4 block break-words text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[33px]">{money(value)}</b>
          <p className={`mt-3 text-[12px] ${featured ? "text-blue-200" : "text-slate-400"}`}>Saldo atualizado</p>
        </div>
        <span className={`grid size-13 shrink-0 place-items-center rounded-2xl ${featured ? "bg-white/10 text-[#f0c66f]" : "bg-amber-50 text-[#b9802f]"}`}>{icon}</span>
      </div>
    </div>
  );
}

function Daily({ label, value, icon, green }: { label: string; value: number; icon: any; green?: boolean }) {
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-3.5">
        <span className={`grid size-11 place-items-center rounded-xl ${green ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{icon}</span>
        <span className="text-[15px] font-semibold text-slate-700">{label}</span>
      </div>
      <b className={`whitespace-nowrap text-[17px] ${green ? "text-emerald-600" : "text-rose-600"}`}>{money(value)}</b>
    </div>
  );
}
