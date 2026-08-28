import { useEffect, useMemo, useState } from "react";
import {
  Plus, X, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Search, Paperclip,
  Building2, UserRoundPlus, Pencil, Trash2, Eye, CalendarRange,
} from "lucide-react";
import {
  getAccounts, getMovements, peekMovements, registerMovement, updateMovement, deleteMovement,
  uploadReceipt, type Account, type Movement,
} from "../lib/finance";
import { createCounterparty, getCounterparties, type Counterparty } from "../services/counterparties";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, formatDate, dateOnly } from "../components/UI";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

export default function Transactions() {
  const [rows, setRows] = useState<Movement[]>(peekMovements() || []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Movement | null>(null);
  const [details, setDetails] = useState<Movement | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [launchType, setLaunchType] = useState("entrada");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    if (!isConfigured) return;
    try {
      const [movements, accountRows, partyRows] = await Promise.all([
        getMovements(200, force), getAccounts(), getCounterparties().catch(() => []),
      ]);
      setRows(movements); setAccounts(accountRows); setCounterparties(partyRows);
    } catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((x) => {
    const d = dateOnly(x.data);
    return (!type || x.tipo.includes(type)) && (!from || d >= from) && (!to || d <= to) &&
      JSON.stringify(x).toLowerCase().includes(search.toLowerCase());
  }), [rows, search, type, from, to]);

  const entries = visible.filter((x) => x.tipo.includes("entrada")).reduce((a, x) => a + Number(x.valor), 0);
  const outputs = visible.filter((x) => x.tipo.includes("saida")).reduce((a, x) => a + Number(x.valor), 0);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const form = e.currentTarget; const d: any = Object.fromEntries(new FormData(form));
      const file = (form.elements.namedItem("arquivo") as HTMLInputElement).files?.[0];
      if (file) d.comprovante_id = await uploadReceipt(file);
      if (edit) {
        await updateMovement(edit.id, d);
        setEdit(null);
      } else {
        if (d.tipo !== "transferencia") {
          const party = counterparties.find((x) => x.id === d.parte_id);
          if (!party) throw new Error(d.tipo === "entrada" ? "Informe de quem o valor foi recebido." : "Informe para quem o valor foi pago.");
          const original = String(d.descricao || "").trim();
          const prefix = d.tipo === "entrada" ? `Recebido de ${party.nome}` : `Pago para ${party.nome}`;
          d.descricao = original ? `${prefix} — ${original}` : prefix;
          const note = String(d.observacao || "").trim();
          d.observacao = `Parte financeira: ${party.nome}${party.documento ? ` (${party.documento})` : ""}${note ? `\n${note}` : ""}`;
        }
        delete d.parte_id;
        await registerMovement(d);
        setOpen(false); setLaunchType("entrada");
      }
      await load(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function remove(x: Movement) {
    if (!confirm(`Excluir esta movimentação de ${money(x.valor)}? O saldo será estornado automaticamente.`)) return;
    try { setBusy(true); await deleteMovement(x.id); await load(true); }
    catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  async function saveCounterparty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try { const d: any = Object.fromEntries(new FormData(e.currentTarget)); await createCounterparty(d); setPartyOpen(false); setCounterparties(await getCounterparties()); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-[28px] font-extrabold text-[#0b1d3a]">Entradas e saídas</h2><p className="mt-1 text-[15px] text-slate-500">Controle as movimentações por período sem alongar a página.</p></div>
        <div className="flex gap-3"><button onClick={() => setPartyOpen(true)} className="flex items-center gap-2 rounded-lg border bg-white px-5 py-3 font-bold text-[#0b2b66]"><UserRoundPlus size={18}/>Cadastros</button><button onClick={() => {setEdit(null);setOpen(true);}} className="flex items-center gap-2 rounded-lg bg-[#0b2b66] px-5 py-3 font-bold text-white"><Plus size={18}/>Novo lançamento</button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-3"><Mini title="Entradas no período" value={entries} icon={<ArrowUpRight/>} color="green"/><Mini title="Saídas no período" value={outputs} icon={<ArrowDownRight/>} color="red"/><Mini title="Movimentações" value={visible.length} icon={<ArrowLeftRight/>} count/></div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_185px_185px_190px]">
        <div className="relative"><Search className="absolute left-4 top-4 text-slate-400" size={19}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar descrição, prefeitura, fornecedor..." className="h-13 w-full rounded-lg border border-slate-200 pl-11 pr-4 outline-none"/></div>
        <label className="relative"><CalendarRange className="absolute left-3 top-4 text-slate-400" size={18}/><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="h-13 w-full rounded-lg border border-slate-200 pl-10 pr-2" title="Data inicial"/></label>
        <label className="relative"><CalendarRange className="absolute left-3 top-4 text-slate-400" size={18}/><input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="h-13 w-full rounded-lg border border-slate-200 pl-10 pr-2" title="Data final"/></label>
        <select value={type} onChange={(e)=>setType(e.target.value)} className="h-13 rounded-lg border border-slate-200 px-4"><option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option><option value="transferencia">Transferências</option><option value="estorno">Estornos</option></select>
      </div>

      <MovementTable rows={visible} onEdit={(x)=>{setEdit(x);setLaunchType(x.tipo);}} onDelete={remove} onDetails={setDetails}/>

      {(open || edit) && <MovementModal edit={edit} accounts={accounts} counterparties={counterparties} launchType={launchType} setLaunchType={setLaunchType} busy={busy} error={error} close={()=>{setOpen(false);setEdit(null);setError("");}} save={save} addParty={()=>setPartyOpen(true)}/>} 
      {details && <Details x={details} close={()=>setDetails(null)}/>} 
      {partyOpen && <PartyModal busy={busy} error={error} close={()=>setPartyOpen(false)} save={saveCounterparty}/>} 
    </div>
  );
}

function MovementModal({edit,accounts,counterparties,launchType,setLaunchType,busy,error,close,save,addParty}:any){
  const rawDate=edit?dateOnly(edit.data):new Date().toISOString().slice(0,10);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={save} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-7 py-5"><div><h3 className="text-2xl font-extrabold text-[#0b1d3a]">{edit?"Editar movimentação":"Novo lançamento"}</h3><p className="mt-1 text-sm text-slate-500">{edit?"O saldo será recalculado automaticamente.":"Informe origem/destino e conta utilizada."}</p></div><button type="button" onClick={close}><X/></button></div><div className="grid gap-5 p-7 sm:grid-cols-2">
    <Field label="Tipo"><select name="tipo" required className="input" value={launchType} onChange={(e)=>setLaunchType(e.target.value)} disabled={!!edit && edit.tipo==="estorno"}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="transferencia">Transferência</option>{edit?.tipo==="estorno"&&<option value="estorno">Estorno</option>}</select></Field>
    <Field label="Data"><input name="data" type="date" required defaultValue={rawDate} className="input"/></Field>
    {!edit && launchType!=="transferencia" && <Field label={launchType==="entrada"?"Recebido de":"Pago para"} wide><div className="flex gap-2"><select name="parte_id" required className="input"><option value="">Selecione um cadastro</option>{counterparties.map((p:Counterparty)=><option key={p.id} value={p.id}>{p.nome}{p.documento?` · ${p.documento}`:""}</option>)}</select><button type="button" onClick={addParty} className="mt-2 min-w-12 rounded-lg border text-[#0b2b66]"><Plus size={20} className="mx-auto"/></button></div></Field>}
    <Field label="Descrição" wide><input name="descricao" required className="input" defaultValue={edit?.descricao||""}/></Field>
    <Field label={launchType==="entrada"?"Entrar na conta":launchType==="saida"?"Sair da conta":"Conta de origem"}><select name="conta_id" required className="input" defaultValue={edit?.conta_id||""}><option value="">Selecione</option>{accounts.map((a:Account)=><option key={a.id} value={a.id}>{a.nome} · {money(a.saldo_atual)}</option>)}</select></Field>
    {launchType==="transferencia"&&<Field label="Conta de destino"><select name="conta_destino_id" required className="input" defaultValue={edit?.conta_destino_id||""}><option value="">Selecione</option>{accounts.map((a:Account)=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>}
    <Field label="Valor"><input name="valor" type="number" min="0.01" step="0.01" required className="input" defaultValue={edit?.valor||""}/></Field>
    <Field label="Comprovante"><label className="input flex cursor-pointer items-center gap-2"><Paperclip size={17}/>Selecionar arquivo<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"/></label></Field>
    <Field label="Observação" wide><textarea name="observacao" className="input" defaultValue={edit?.observacao||""}/></Field>{error&&<p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
  </div><div className="flex justify-end gap-3 border-t px-7 py-5"><button type="button" onClick={close} className="rounded-lg border px-5 py-3">Cancelar</button><button disabled={busy} className="rounded-lg bg-[#0b2b66] px-6 py-3 font-bold text-white disabled:opacity-50">{busy?"Salvando...":edit?"Salvar alterações":"Salvar lançamento"}</button></div></form></div>;
}

function MovementTable({rows,onEdit,onDelete,onDetails}:any){return <div className="overflow-hidden rounded-xl border border-[#cad5e3] bg-white shadow-sm">{rows.length?<div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[1180px] text-left"><thead className="sticky top-0 z-10"><tr>{["Data","Origem / Destino","Descrição","Tipo","Conta","Valor","Ações"].map(x=><th key={x} className="px-5 py-4">{x}</th>)}</tr></thead><tbody>{rows.map((x:Movement)=>{const p=parseDescription(x.descricao);return <tr key={x.id}><td className="px-5 py-4 whitespace-nowrap">{formatDate(x.data)}</td><td className="px-5 py-4 font-bold"><div className="flex items-center gap-2"><Building2 size={16} className="text-slate-400"/>{p.party}</div></td><td className="px-5 py-4 font-semibold">{p.description}</td><td className="px-5 py-4"><TypeBadge type={x.tipo}/></td><td className="px-5 py-4">{x.contas_bancarias?.nome||"—"}</td><td className={`px-5 py-4 whitespace-nowrap font-extrabold ${x.tipo.includes("entrada")?"text-emerald-700":x.tipo.includes("saida")?"text-rose-700":"text-blue-700"}`}>{money(x.valor)}</td><td className="px-5 py-4"><div className="flex gap-1"><Action title="Detalhes" onClick={()=>onDetails(x)}><Eye size={17}/></Action><Action title="Editar" onClick={()=>onEdit(x)} disabled={!!x.despesa_id||!!x.pagamento_id}><Pencil size={17}/></Action><Action title="Excluir" danger onClick={()=>onDelete(x)} disabled={!!x.despesa_id||!!x.pagamento_id}><Trash2 size={17}/></Action></div></td></tr>})}</tbody></table></div>:<Empty/>}</div>}
function Action({children,onClick,title,danger,disabled}:any){return <button type="button" onClick={onClick} disabled={disabled} title={disabled?"Gerenciada pela tela de Despesas":title} className={`grid size-9 place-items-center rounded-md border ${danger?"border-rose-200 text-rose-600":"border-slate-200 text-[#0b2b66]"} hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30`}>{children}</button>}
function TypeBadge({type}:{type:string}){const c=type.includes("entrada")?"bg-emerald-50 text-emerald-700 border-emerald-200":type.includes("saida")?"bg-rose-50 text-rose-700 border-rose-200":type.includes("estorno")?"bg-amber-50 text-amber-700 border-amber-200":"bg-blue-50 text-blue-700 border-blue-200";return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${c}`}>{type.replace("_"," ")}</span>}
function Details({x,close}:{x:Movement;close:()=>void}){return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-xl bg-white shadow-2xl"><div className="flex justify-between border-b p-5"><h3 className="text-xl font-extrabold">Detalhes da movimentação</h3><button onClick={close}><X/></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><Info l="Data" v={formatDate(x.data)}/><Info l="Tipo" v={x.tipo}/><Info l="Valor" v={money(x.valor)}/><Info l="Conta" v={x.contas_bancarias?.nome||"—"}/><Info l="Descrição" v={x.descricao} wide/><Info l="Observação" v={x.observacao||"—"} wide/></div></div></div>}
function Info({l,v,wide}:any){return <div className={wide?"sm:col-span-2":""}><span className="text-xs font-bold uppercase text-slate-400">{l}</span><p className="mt-1 font-semibold text-slate-800">{v}</p></div>}
function PartyModal({busy,error,close,save}:any){return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4"><form onSubmit={save} className="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div className="flex justify-between border-b p-6"><div><h3 className="text-2xl font-bold">Novo cadastro</h3><p className="text-sm text-slate-500">Cadastre pagadores e favorecidos.</p></div><button type="button" onClick={close}><X/></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><Field label="Nome / Razão social" wide><input name="nome" required className="input"/></Field><Field label="Tipo"><select name="tipo" className="input"><option value="orgao_publico">Órgão público</option><option value="cliente">Cliente</option><option value="fornecedor">Fornecedor</option><option value="outro">Outro</option></select></Field><Field label="CPF / CNPJ"><input name="documento" className="input"/></Field><Field label="Observação" wide><textarea name="observacao" className="input"/></Field>{error&&<p className="text-red-600 sm:col-span-2">{error}</p>}</div><div className="flex justify-end gap-2 border-t p-5"><button type="button" onClick={close} className="rounded-lg border px-5 py-2">Cancelar</button><button disabled={busy} className="rounded-lg bg-[#0b2b66] px-5 py-2 font-bold text-white">Cadastrar</button></div></form></div>}
function Mini({title,value,icon,color,count}:any){return <div className="rounded-xl border bg-white p-6 shadow-sm"><div className="flex justify-between"><div><p className="font-semibold text-slate-500">{title}</p><b className="mt-3 block text-[30px] text-[#0b1d3a]">{count?value:money(value)}</b></div><span className={`grid size-13 place-items-center rounded-xl ${color==="green"?"bg-emerald-50 text-emerald-600":color==="red"?"bg-rose-50 text-rose-600":"bg-blue-50 text-blue-600"}`}>{icon}</span></div></div>}
function Field({label,children,wide}:any){return <label className={`text-[15px] font-semibold text-slate-700 ${wide?"sm:col-span-2":""}`}>{label}{children}</label>}
function parseDescription(value:string){const e=value.match(/^Recebido de (.+?) — (.+)$/);if(e)return{party:e[1],description:e[2]};const o=value.match(/^Pago para (.+?) — (.+)$/);if(o)return{party:o[1],description:o[2]};if(value.startsWith("Recebido de "))return{party:value.replace("Recebido de ",""),description:"Recebimento"};if(value.startsWith("Pago para "))return{party:value.replace("Pago para ",""),description:"Pagamento"};return{party:"—",description:value}}
