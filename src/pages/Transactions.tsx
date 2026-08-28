import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Building2, CalendarRange, Eye, Paperclip, Pencil, Plus, Search, Trash2, UserRoundPlus, X } from "lucide-react";
import { deleteMovement, getAccounts, getMovements, peekMovements, registerMovement, updateMovement, uploadReceipt, type Account, type Movement } from "../lib/finance";
import { createCounterparty, getCounterparties, updateCounterparty, type Counterparty } from "../services/counterparties";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { dateOnly, Empty, formatDate, money } from "../components/UI";

const now = new Date();
const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

export default function Transactions() {
  const [rows, setRows] = useState<Movement[]>(peekMovements(200) ?? []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Movement | null>(null);
  const [details, setDetails] = useState<Movement | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [launchType, setLaunchType] = useState("entrada");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    if (!isConfigured) return;
    try {
      const [movementRows, accountRows, partyRows] = await Promise.all([
        getMovements(200, force),
        getAccounts(force),
        getCounterparties(true).catch(() => [] as Counterparty[]),
      ]);
      setRows(movementRows);
      setAccounts(accountRows);
      setCounterparties(partyRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as movimentações.");
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((movement) => {
      const movementDate = dateOnly(movement.data);
      return (!from || movementDate >= from) && (!to || movementDate <= to) && (!type || movement.tipo.includes(type)) && (!term || JSON.stringify(movement).toLowerCase().includes(term));
    });
  }, [rows, search, type, from, to]);

  const entries = visible.filter((m) => m.tipo.includes("entrada")).reduce((s, m) => s + Number(m.valor), 0);
  const outputs = visible.filter((m) => m.tipo.includes("saida")).reduce((s, m) => s + Number(m.valor), 0);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const form = e.currentTarget;
      const data = Object.fromEntries(new FormData(form)) as Record<string, unknown>;
      const file = (form.elements.namedItem("arquivo") as HTMLInputElement | null)?.files?.[0];
      if (file) data.comprovante_id = await uploadReceipt(file);
      if (edit) {
        await updateMovement(edit.id, data);
        setEdit(null);
        alert("Movimentação atualizada com sucesso.");
      } else {
        if (data.tipo !== "transferencia") {
          const party = counterparties.find((item) => item.id === String(data.parte_id || ""));
          if (!party) throw new Error(data.tipo === "entrada" ? "Informe de quem o valor foi recebido." : "Informe para quem o valor foi pago.");
          const original = String(data.descricao || "").trim();
          const prefix = data.tipo === "entrada" ? `Recebido de ${party.nome}` : `Pago para ${party.nome}`;
          data.descricao = original ? `${prefix} — ${original}` : prefix;
          const note = String(data.observacao || "").trim();
          data.observacao = `Parte financeira: ${party.nome}${party.documento ? ` (${party.documento})` : ""}${note ? `\n${note}` : ""}`;
        }
        delete data.parte_id;
        await registerMovement(data);
        setOpen(false); setLaunchType("entrada");
        alert("Movimentação cadastrada com sucesso.");
      }
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar a movimentação."); }
    finally { setBusy(false); }
  }

  async function remove(movement: Movement) {
    const linked = Boolean(movement.despesa_id || movement.pagamento_id);
    const message = linked
      ? "Este lançamento foi gerado por uma despesa/pagamento. A exclusão removerá os registros vinculados quando permitido. Deseja continuar?"
      : `Excluir esta movimentação de ${money(movement.valor)}? O saldo será corrigido automaticamente.`;
    if (!confirm(message)) return;
    setBusy(true);
    try {
      await deleteMovement(movement.id);
      await load(true);
      alert(linked ? "Registros financeiros vinculados excluídos com sucesso." : "Movimentação excluída com sucesso.");
    } catch (err) { alert(err instanceof Error ? err.message : "Não foi possível excluir a movimentação."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-[28px] font-extrabold text-[#0b1d3a]">Entradas e saídas</h2><p className="mt-1 text-[15px] text-slate-500">Consulte por período e mantenha as movimentações organizadas.</p></div>
      <div className="flex gap-3">
        <button type="button" onClick={() => setPartyOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 font-bold text-[#0b2b66]"><UserRoundPlus size={18}/> Cadastros</button>
        <button type="button" onClick={() => { setEdit(null); setLaunchType("entrada"); setError(""); setOpen(true); }} className="flex items-center gap-2 rounded-lg bg-[#0b2b66] px-5 py-3 font-bold text-white"><Plus size={18}/> Novo lançamento</button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3"><SummaryCard title="Entradas no período" value={money(entries)} icon={<ArrowUpRight size={24}/>} tone="green"/><SummaryCard title="Saídas no período" value={money(outputs)} icon={<ArrowDownRight size={24}/>} tone="red"/><SummaryCard title="Movimentações" value={String(visible.length)} icon={<ArrowLeftRight size={24}/>} tone="blue"/></div>

    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_185px_185px_190px]">
      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar descrição, prefeitura, fornecedor..." className="h-13 w-full rounded-lg border border-slate-200 pl-11 pr-4"/></div>
      <label className="relative"><CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="h-13 w-full rounded-lg border border-slate-200 pl-10 pr-2"/></label>
      <label className="relative"><CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="h-13 w-full rounded-lg border border-slate-200 pl-10 pr-2"/></label>
      <select value={type} onChange={(e)=>setType(e.target.value)} className="h-13 rounded-lg border border-slate-200 px-4"><option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option><option value="transferencia">Transferências</option><option value="estorno">Estornos</option></select>
    </div>

    <div className="overflow-hidden rounded-xl border border-[#cad5e3] bg-white shadow-sm">{visible.length ? <div className="max-h-[500px] overflow-auto"><table className="w-full min-w-[1120px] table-fixed text-left text-[14px]"><thead className="sticky top-0 z-20 bg-[#10365f] text-white"><tr><th className="w-[105px] px-4 py-4">Data</th><th className="w-[245px] px-4 py-4">Origem / Destino</th><th className="px-4 py-4">Descrição</th><th className="w-[115px] px-4 py-4">Tipo</th><th className="w-[245px] px-4 py-4">Conta</th><th className="w-[120px] px-4 py-4">Valor</th><th className="sticky right-0 w-[145px] bg-[#10365f] px-4 py-4 text-center">Ações</th></tr></thead><tbody>{visible.map((movement) => { const parsed = parseDescription(movement.descricao); const protectedMovement = Boolean(movement.despesa_id || movement.pagamento_id); return <tr key={movement.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50"><td className="px-4 py-4">{formatDate(movement.data)}</td><td className="px-4 py-4 font-bold"><div className="flex gap-2"><Building2 size={16} className="mt-0.5 text-slate-400"/><span>{parsed.party}</span></div></td><td className="px-4 py-4 font-semibold">{parsed.description}</td><td className="px-4 py-4"><TypeBadge type={movement.tipo}/></td><td className="px-4 py-4">{movement.contas_bancarias?.nome || "—"}</td><td className={`px-4 py-4 font-extrabold ${movement.tipo.includes("entrada")?"text-emerald-700":movement.tipo.includes("saida")?"text-rose-700":"text-amber-700"}`}>{money(movement.valor)}</td><td className="sticky right-0 bg-white px-3 py-4"><div className="flex justify-center gap-1.5"><ActionButton title="Ver detalhes" onClick={()=>setDetails(movement)}><Eye size={17}/></ActionButton><ActionButton title={protectedMovement?"Edição deve ser feita em Despesas":"Editar"} onClick={()=>{setEdit(movement);setLaunchType(movement.tipo);setError("");}} disabled={protectedMovement}><Pencil size={17}/></ActionButton><ActionButton title="Excluir" onClick={()=>void remove(movement)} danger><Trash2 size={17}/></ActionButton></div></td></tr>; })}</tbody></table></div> : <Empty/>}</div>

    {(open || edit) && <MovementDialog edit={edit} accounts={accounts} counterparties={counterparties.filter(x=>x.ativo)} launchType={launchType} setLaunchType={setLaunchType} busy={busy} error={error} onSubmit={save} onClose={()=>{setOpen(false);setEdit(null);setError("");}} onAddParty={()=>setPartyOpen(true)}/>} 
    {details && <DetailsDialog movement={details} onClose={()=>setDetails(null)}/>} 
    {partyOpen && <CounterpartyManager rows={counterparties} onClose={()=>setPartyOpen(false)} onChanged={async()=>{setCounterparties(await getCounterparties(true));}}/>}
  </div>;
}

function CounterpartyManager({ rows, onClose, onChanged }: { rows: Counterparty[]; onClose:()=>void; onChanged:()=>Promise<void> }) {
  const [editing,setEditing]=useState<Counterparty|null>(null); const [creating,setCreating]=useState(false); const [q,setQ]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const filtered=rows.filter(x=>!q||`${x.nome} ${x.documento||""} ${x.tipo}`.toLowerCase().includes(q.toLowerCase()));
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");try{const d=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,unknown>; if(editing) await updateCounterparty(editing.id,d); else await createCounterparty(d); await onChanged(); setEditing(null);setCreating(false);alert(editing?"Cadastro atualizado com sucesso.":"Cadastro criado com sucesso.");}catch(e:any){setError(e.message)}finally{setSaving(false)}}
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-6 py-5"><div><h3 className="text-2xl font-extrabold text-[#0b1d3a]">Cadastros financeiros</h3><p className="text-sm text-slate-500">Órgãos, clientes, fornecedores e outras origens/destinos.</p></div><button onClick={onClose}><X/></button></div>{(creating||editing)?<form onSubmit={submit} className="p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome / Razão social" wide><input name="nome" required className="input" defaultValue={editing?.nome||""}/></Field><Field label="Tipo"><select name="tipo" required className="input" defaultValue={editing?.tipo||"orgao_publico"}><option value="orgao_publico">Órgão público</option><option value="cliente">Cliente</option><option value="fornecedor">Fornecedor</option><option value="outro">Outro</option></select></Field><Field label="CPF / CNPJ"><input name="documento" className="input" defaultValue={editing?.documento||""}/></Field><Field label="Observação" wide><textarea name="observacao" className="input min-h-24" defaultValue={editing?.observacao||""}/></Field></div>{error&&<p className="mt-3 text-red-600">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>{setCreating(false);setEditing(null);}} className="rounded-lg border px-5 py-2.5">Voltar</button><button disabled={saving} className="rounded-lg bg-[#0b2b66] px-5 py-2.5 font-bold text-white">{saving?"Salvando...":"Salvar cadastro"}</button></div></form>:<div className="p-6"><div className="mb-4 flex gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ..." className="h-11 w-full rounded-lg border pl-10 pr-3"/></div><button onClick={()=>setCreating(true)} className="rounded-lg bg-[#0b2b66] px-4 font-bold text-white">+ Novo cadastro</button></div><div className="max-h-[460px] overflow-auto rounded-lg border"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-[#10365f] text-white"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CPF/CNPJ</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Ações</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} className="border-t"><td className="px-4 py-3 font-bold">{x.nome}</td><td className="px-4 py-3">{x.documento||"—"}</td><td className="px-4 py-3">{labelType(x.tipo)}</td><td className="px-4 py-3">{x.ativo?"Ativo":"Inativo"}</td><td className="px-4 py-3 text-center"><button onClick={()=>setEditing(x)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-bold text-[#0b2b66]"><Pencil size={15}/> Editar</button></td></tr>)}</tbody></table></div></div>}</div></div>;
}

function MovementDialog({edit,accounts,counterparties,launchType,setLaunchType,busy,error,onSubmit,onClose,onAddParty}:any){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-7 py-5"><div><h3 className="text-2xl font-extrabold text-[#0b1d3a]">{edit?"Editar movimentação":"Novo lançamento"}</h3><p className="mt-1 text-sm text-slate-500">{edit?"O saldo será recalculado automaticamente.":"Informe a origem/destino e a conta utilizada."}</p></div><button type="button" onClick={onClose}><X/></button></div><div className="grid gap-5 p-7 sm:grid-cols-2"><Field label="Tipo"><select name="tipo" required className="input" value={launchType} onChange={(e)=>setLaunchType(e.target.value)}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="transferencia">Transferência</option>{edit?.tipo==="estorno"&&<option value="estorno">Estorno</option>}</select></Field><Field label="Data"><input name="data" type="date" required defaultValue={edit?dateOnly(edit.data):new Date().toISOString().slice(0,10)} className="input"/></Field>{!edit&&launchType!=="transferencia"&&<Field label={launchType==="entrada"?"Recebido de":"Pago para"} wide><div className="flex gap-2"><select name="parte_id" required className="input"><option value="">Selecione</option>{counterparties.map((p:Counterparty)=><option key={p.id} value={p.id}>{p.nome}{p.documento?` · ${p.documento}`:""}</option>)}</select><button type="button" onClick={onAddParty} className="mt-2 min-w-12 rounded-lg border text-[#0b2b66]"><Plus size={20} className="mx-auto"/></button></div></Field>}<Field label="Descrição" wide><input name="descricao" required className="input" defaultValue={edit?.descricao||""}/></Field><Field label={launchType==="entrada"?"Entrar na conta":launchType==="saida"?"Sair da conta":"Conta de origem"}><select name="conta_id" required className="input" defaultValue={edit?.conta_id||""}><option value="">Selecione</option>{accounts.map((a:Account)=><option key={a.id} value={a.id}>{a.nome} · {money(a.saldo_atual)}</option>)}</select></Field>{launchType==="transferencia"&&<Field label="Conta de destino"><select name="conta_destino_id" required className="input" defaultValue={edit?.conta_destino_id||""}><option value="">Selecione</option>{accounts.map((a:Account)=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>}<Field label="Valor"><input name="valor" type="number" min="0.01" step="0.01" required className="input" defaultValue={edit?.valor??""}/></Field><Field label="Comprovante"><label className="input flex cursor-pointer items-center gap-2"><Paperclip size={17}/>Selecionar arquivo<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"/></label></Field><Field label="Observação" wide><textarea name="observacao" className="input min-h-24" defaultValue={edit?.observacao||""}/></Field>{error&&<p className="text-sm text-red-600 sm:col-span-2">{error}</p>}</div><div className="flex justify-end gap-3 border-t px-7 py-5"><button type="button" onClick={onClose} className="rounded-lg border px-5 py-3">Cancelar</button><button disabled={busy} className="rounded-lg bg-[#0b2b66] px-6 py-3 font-bold text-white">{busy?"Salvando...":edit?"Salvar alterações":"Salvar lançamento"}</button></div></form></div>}
function DetailsDialog({movement,onClose}:{movement:Movement;onClose:()=>void}){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-2xl rounded-xl bg-white"><div className="flex items-center justify-between border-b p-6"><h3 className="text-xl font-extrabold">Detalhes da movimentação</h3><button onClick={onClose}><X/></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><Info label="Data" value={formatDate(movement.data)}/><Info label="Tipo" value={movement.tipo}/><Info label="Descrição" value={movement.descricao} wide/><Info label="Conta" value={movement.contas_bancarias?.nome||"—"}/><Info label="Valor" value={money(movement.valor)}/><Info label="Observação" value={movement.observacao||"—"} wide/></div></div></div>}
function SummaryCard({title,value,icon,tone}:any){const c=tone==="green"?"bg-emerald-50 text-emerald-700":tone==="red"?"bg-rose-50 text-rose-700":"bg-blue-50 text-blue-700";return <div className="rounded-xl border bg-white p-6 shadow-sm"><div className="flex justify-between"><div><p className="text-sm font-semibold text-slate-500">{title}</p><strong className="mt-3 block text-[29px] text-[#0b1d3a]">{value}</strong></div><span className={`grid size-12 place-items-center rounded-xl ${c}`}>{icon}</span></div></div>}
function TypeBadge({type}:{type:string}){const c=type.includes("entrada")?"border-emerald-200 bg-emerald-50 text-emerald-700":type.includes("saida")?"border-rose-200 bg-rose-50 text-rose-700":type.includes("estorno")?"border-amber-200 bg-amber-50 text-amber-700":"border-blue-200 bg-blue-50 text-blue-700";return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${c}`}>{type.replace("_"," ")}</span>}
function ActionButton({children,onClick,title,danger=false,disabled=false}:any){return <button type="button" onClick={onClick} disabled={disabled} title={title} className={`grid size-9 place-items-center rounded-md border disabled:opacity-30 ${danger?"border-rose-200 text-rose-600":"border-slate-200 text-[#0b2b66]"}`}>{children}</button>}
function Field({label,children,wide=false}:any){return <label className={`text-sm font-semibold text-slate-700 ${wide?"sm:col-span-2":""}`}><span className="mb-1.5 block">{label}</span>{children}</label>}
function Info({label,value,wide=false}:any){return <div className={`rounded-lg border bg-slate-50 p-4 ${wide?"sm:col-span-2":""}`}><small className="font-bold uppercase text-slate-400">{label}</small><p className="mt-1 font-semibold">{value}</p></div>}
function parseDescription(description:string){const i=description.indexOf(" — ");if(i===-1)return{party:"—",description};const prefix=description.slice(0,i);return{party:prefix.replace(/^Recebido de /,"").replace(/^Pago para /,""),description:description.slice(i+3)||description}}
function labelType(type:Counterparty["tipo"]){return type==="orgao_publico"?"Órgão público":type==="cliente"?"Cliente":type==="fornecedor"?"Fornecedor":"Outro"}
