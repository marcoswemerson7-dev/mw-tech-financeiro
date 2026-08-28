import { useEffect, useMemo, useState } from "react";
import { Banknote, Landmark, Wallet, ArrowUpRight, ArrowDownRight, CalendarRange } from "lucide-react";
import { getAccounts, getMovements, peekAccounts, peekMovements, type Account, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, dateOnly, formatDate } from "../components/UI";

const currentMonth = new Date().toISOString().slice(0,7);
export default function Cash() {
  const [accounts, setAccounts] = useState<Account[]>(peekAccounts() || []),
    [mov, setMov] = useState<Movement[]>(peekMovements(100) || []),
    [period, setPeriod] = useState(currentMonth);

  useEffect(() => {
    if (isConfigured) Promise.all([getAccounts(), getMovements(100)]).then(([a,m])=>{setAccounts(a);setMov(m)});
  }, []);

  const filtered = useMemo(()=>mov.filter(x=>!period||dateOnly(x.data).startsWith(period)),[mov,period]);
  const cash = accounts.filter(x=>x.tipo_conta==="caixa").reduce((a,x)=>a+Number(x.saldo_atual),0),
    bank = accounts.filter(x=>x.tipo_conta!=="caixa").reduce((a,x)=>a+Number(x.saldo_atual),0),
    ins = filtered.filter(x=>x.tipo.includes("entrada")).reduce((a,x)=>a+Number(x.valor),0),
    outs = filtered.filter(x=>x.tipo.includes("saida")).reduce((a,x)=>a+Number(x.valor),0);

  return <div className="space-y-7">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-[30px] font-extrabold tracking-tight text-[#0b1d3a]">Caixa</h2><p className="mt-1 text-[15px] text-slate-500">Acompanhe o dinheiro disponível e consulte os lançamentos por período.</p></div><label className="relative min-w-[220px]"><CalendarRange className="absolute left-3 top-4 text-slate-400" size={18}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="h-13 w-full rounded-lg border bg-white pl-10 pr-3"/></label></section>

    <div className="grid gap-5 md:grid-cols-3"><Balance title="Saldo em caixa" value={cash} icon={<Banknote size={25}/>}/><Balance title="Saldo bancário" value={bank} icon={<Landmark size={25}/>}/><Balance title="Saldo total" value={cash+bank} icon={<Wallet size={25}/>} featured/></div>

    <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="bg-[#10365f] px-6 py-4 text-white"><h3 className="text-xl font-extrabold">Movimentação do período</h3><p className="mt-1 text-sm text-slate-200">Resumo das entradas e saídas selecionadas</p></div><div className="grid gap-4 p-6 sm:grid-cols-2"><Daily label="Entradas" value={ins} icon={<ArrowUpRight size={21}/>} green/><Daily label="Saídas" value={outs} icon={<ArrowDownRight size={21}/>}/><div className="sm:col-span-2 rounded-lg border bg-slate-50 p-5"><p className="text-sm font-semibold text-slate-500">Resultado do período</p><b className="mt-2 block text-[30px] font-extrabold text-[#0b1d3a]">{money(ins-outs)}</b></div></div></section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="bg-[#10365f] px-6 py-4 text-white"><h3 className="text-xl font-extrabold">Saldo consolidado</h3><p className="mt-1 text-sm text-slate-200">Posição atual das contas</p></div><div className="grid min-h-[210px] place-items-center p-6 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-xl bg-amber-50 text-[#b9802f]"><Wallet size={26}/></span><p className="mt-4 text-sm font-semibold text-slate-500">Disponível agora</p><strong className="mt-2 block text-[36px] font-extrabold text-[#0b1d3a]">{money(cash+bank)}</strong></div></div></section>
    </div>

    <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="bg-[#0d3159] px-6 py-4 text-white"><h3 className="text-xl font-extrabold">Lançamentos de caixa</h3><p className="mt-1 text-sm text-slate-200">A rolagem acontece dentro deste quadro</p></div>{filtered.length?<div className="max-h-[480px] overflow-auto"><table className="w-full min-w-[920px] text-left"><thead className="sticky top-0 z-10"><tr>{["Data","Descrição","Tipo","Conta","Valor"].map(x=><th key={x} className="px-6 py-4">{x}</th>)}</tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td className="whitespace-nowrap px-6 py-5">{formatDate(x.data)}</td><td className="px-6 py-5 font-bold">{x.descricao}</td><td className="px-6 py-5 capitalize">{x.tipo.replace("_"," ")}</td><td className="px-6 py-5">{x.contas_bancarias?.nome||"—"}</td><td className={`whitespace-nowrap px-6 py-5 font-extrabold ${x.tipo.includes("entrada")?"text-emerald-700":x.tipo.includes("saida")?"text-rose-700":"text-blue-700"}`}>{money(x.valor)}</td></tr>)}</tbody></table></div>:<Empty/>}</section>
  </div>
}

function Balance({title,value,icon,featured}:any){return <div className={`rounded-xl border p-6 shadow-sm ${featured?"border-[#0b2b66] bg-[#0b2b66] text-white":"bg-white"}`}><div className="flex justify-between gap-4"><div><p className={`font-semibold ${featured?"text-blue-100":"text-slate-500"}`}>{title}</p><b className="mt-3 block text-[31px] font-extrabold">{money(value)}</b><p className={`mt-2 text-xs ${featured?"text-blue-200":"text-slate-400"}`}>Saldo atualizado</p></div><span className={`grid size-13 place-items-center rounded-xl ${featured?"bg-white/10 text-amber-300":"bg-amber-50 text-amber-700"}`}>{icon}</span></div></div>}
function Daily({label,value,icon,green}:any){return <div className="flex min-h-[82px] items-center justify-between rounded-lg border bg-white p-4"><div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-lg ${green?"bg-emerald-50 text-emerald-600":"bg-rose-50 text-rose-600"}`}>{icon}</span><b>{label}</b></div><strong className={green?"text-emerald-700":"text-rose-700"}>{money(value)}</strong></div>}
