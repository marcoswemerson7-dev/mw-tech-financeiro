import { useEffect, useState } from "react";
import {
  Banknote,
  Landmark,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Layers3,
  Trophy,
} from "lucide-react";
import {
  getAccounts,
  getMovements,
  type Account,
  type Movement,
} from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, dateOnly, formatDate, PageHeader, SectionCard, StatCard, FinancialAmount } from "../components/UI";

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
    <div className="space-y-7 lg:space-y-8">
      <PageHeader
        title="Caixa"
        subtitle="Acompanhe o dinheiro disponível e consulte os lançamentos por período."
        actions={
          <select className="min-h-[56px] rounded-xl border border-slate-200 bg-white px-5 text-[15px] font-semibold text-[#061426] shadow-sm outline-none">
            <option>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</option>
          </select>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard title="Saldo em caixa" value={money(cash)} icon={<Banknote size={27} />} tone="gold" hint="Atualizado agora" />
        <StatCard title="Saldo bancário" value={money(bank)} icon={<Landmark size={27} />} tone="green" hint="Atualizado agora" />
        <StatCard title="Saldo total" value={money(cash + bank)} icon={<Wallet size={27} />} tone="gold" hint="Atualizado agora" featured />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <SectionCard title="Movimentação do período" subtitle="Resumo das entradas e saídas selecionadas." icon={ArrowUpRight}>
          <div className="grid gap-5 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2">
            <Daily label="Entradas" value={ins} icon={<ArrowUpRight size={24} />} green />
            <Daily label="Saídas" value={outs} icon={<ArrowDownRight size={24} />} />
          </div>
          <div className="mt-6 flex min-h-[120px] items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Trophy size={30} />
            </span>
            <div className="text-right">
              <p className="text-[16px] font-black text-[#061426]">Resultado do período</p>
            <strong className="mt-1 block text-[34px] font-black tracking-[-0.02em]">
              <FinancialAmount value={ins - outs} kind="resultado" />
            </strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Saldo consolidado" subtitle="Posição atual das contas." icon={Layers3}>
          <div className="grid min-h-[315px] place-items-center">
            <div className="relative grid size-[260px] place-items-center rounded-full border-[8px] border-amber-100">
              <div className="absolute inset-[-8px] rounded-full border-[8px] border-transparent border-r-[#e8ac35] border-t-[#e8ac35]" />
              <div className="text-center">
                <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-amber-50 text-[#d09116]">
                  <Wallet size={34} />
                </span>
                <p className="mt-5 text-[16px] text-slate-500">Disponível agora</p>
                <strong className="mt-1 block text-[36px] font-black tracking-[-0.02em] text-[#061426]">{money(cash + bank)}</strong>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-bold text-emerald-700">
                  <CalendarDays size={15} />
                  Atualizado
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_32px_rgba(15,35,70,.05)]">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7 sm:py-6">
          <h3 className="text-[20px] font-bold text-[#0b1d3a]">Lançamentos de caixa</h3>
          <p className="mt-1 text-[13px] text-slate-500">Entradas e saídas registradas recentemente</p>
        </div>
        {mov.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[14px]">
              <thead className="bg-[#061426] text-[12px] font-black uppercase tracking-wide text-white">
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
                    <td className="whitespace-nowrap px-6 py-5 text-right text-[15px] font-bold">
                      <FinancialAmount value={x.valor} kind={x.tipo} />
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

function Daily({ label, value, icon, green }: { label: string; value: number; icon: any; green?: boolean }) {
  return (
    <div className="flex min-h-[102px] items-center justify-between gap-4 rounded-xl bg-white p-4">
      <div className="flex items-center gap-3.5">
        <span className={`grid size-14 place-items-center rounded-2xl ${green ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{icon}</span>
        <span className="text-[16px] font-black text-[#061426]">{label}</span>
      </div>
      <b className="whitespace-nowrap text-[22px] font-black">
        <FinancialAmount value={value} kind={green ? "entrada" : "saida"} />
      </b>
    </div>
  );
}
