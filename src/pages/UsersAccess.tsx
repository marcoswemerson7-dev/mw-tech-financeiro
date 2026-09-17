import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { ActionButton, Badge, Empty, PageHeader, Toast } from "../components/UI";
import { ACCESS_MODULES, deleteTeamAccess, getTeamAccess, saveTeamAccess, type TeamAccess } from "../services/teamAccess";

export default function UsersAccess() {
  const [rows, setRows] = useState<TeamAccess[]>([]);
  const [edit, setEdit] = useState<Partial<TeamAccess> | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState("");
  useEffect(() => { getTeamAccess().then(setRows).catch((e) => setError(e.message)); }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const saved = await saveTeamAccess({
        ...edit,
        nome: String(form.get("nome") || ""),
        email: String(form.get("email") || ""),
        cargo: String(form.get("cargo") || ""),
        status: String(form.get("status") || "ativo"),
        modulos: form.getAll("modulos").map(String),
      });
      setRows((current) => edit?.id ? current.map((x) => x.id === edit.id ? saved : x) : [...current, saved]);
      setEdit(null); setToast("Permissões salvas com sucesso."); setTimeout(() => setToast(""), 2500);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Remover este funcionário da gestão de acessos?")) return;
    setError(""); setBusyRow(id);
    try {
      await deleteTeamAccess(id);
      setRows((x) => x.filter((row) => row.id !== id));
      setToast("Acesso removido com sucesso."); setTimeout(() => setToast(""), 2500);
    } catch (e: any) {
      setError(e.message || "Não foi possível remover o acesso.");
    } finally {
      setBusyRow("");
    }
  }

  return <div className="space-y-7">
    <Toast message={toast}/>
    <PageHeader title="Usuários e acessos" subtitle="Defina o que cada funcionário poderá visualizar e administrar dentro do MW TECH Control."
      actions={<ActionButton onClick={() => setEdit({ status: "ativo", cargo: "Colaborador", modulos: ["dashboard"] })}><Plus size={18}/>Adicionar funcionário</ActionButton>}/>
    <div className="grid gap-5 sm:grid-cols-3">
      <Summary title="Funcionários" value={rows.length} icon={<UsersRound size={25}/>} tone="blue"/>
      <Summary title="Ativos" value={rows.filter((x) => x.status === "ativo").length} icon={<ShieldCheck size={25}/>} tone="green"/>
      <Summary title="Acessos configurados" value={rows.reduce((n,x)=>n+x.modulos.length,0)} icon={<KeyRound size={25}/>} tone="gold"/>
    </div>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
    {rows.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[14px]">
        <thead className="bg-[#061426] text-[12px] uppercase tracking-wide text-white"><tr>{["Funcionário","Cargo","Status","Permissões","Ações"].map((x)=><th key={x} className="px-6 py-4">{x}</th>)}</tr></thead>
        <tbody>{rows.map((item)=><tr key={item.id} className="border-t border-slate-100">
          <td className="px-6 py-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={20}/></span><div><b className="block text-[#061426]">{item.nome}</b><span className="text-[12px] text-slate-500">{item.email}</span></div></div></td>
          <td className="px-6 py-5 font-semibold text-slate-600">{item.cargo}</td>
          <td className="px-6 py-5"><Badge status={item.status}/></td>
          <td className="max-w-[390px] px-6 py-5"><div className="flex flex-wrap gap-1.5">{item.modulos.map((key)=><span key={key} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{ACCESS_MODULES.find(([id])=>id===key)?.[1]||key}</span>)}</div></td>
          <td className="px-6 py-5"><div className="flex gap-2"><button onClick={()=>setEdit(item)} disabled={Boolean(busyRow)} className="grid size-10 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 disabled:opacity-50"><Pencil size={16}/></button><button onClick={()=>remove(item.id)} disabled={busyRow===item.id} className="grid size-10 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700 disabled:opacity-50"><Trash2 size={16}/></button></div></td>
        </tr>)}</tbody>
      </table></div>
    </div>:<Empty/>}
    {edit && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-7 py-5"><div><h3 className="text-xl font-black">Acesso do funcionário</h3><p className="mt-1 text-sm text-slate-500">Marque somente os módulos necessários para o trabalho.</p></div><button onClick={()=>setEdit(null)}><X/></button></div>
      <form onSubmit={save} className="grid gap-5 p-7 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-600">Nome<input name="nome" required defaultValue={edit.nome||""} className="input"/></label>
        <label className="text-sm font-bold text-slate-600">E-mail<input name="email" type="email" required defaultValue={edit.email||""} className="input"/></label>
        <label className="text-sm font-bold text-slate-600">Cargo<input name="cargo" required defaultValue={edit.cargo||"Colaborador"} className="input"/></label>
        <label className="text-sm font-bold text-slate-600">Status<select name="status" defaultValue={edit.status||"ativo"} className="input"><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></select></label>
        <fieldset className="sm:col-span-2"><legend className="text-sm font-black text-[#061426]">Módulos permitidos</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{ACCESS_MODULES.map(([id,label])=><label key={id} className="flex min-h-[54px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-700"><input type="checkbox" name="modulos" value={id} defaultChecked={(edit.modulos||[]).includes(id)} className="size-5 accent-blue-600"/>{label}</label>)}</div></fieldset>
        <p className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px] leading-6 text-blue-900">O cadastro define as permissões administrativas. A conta de login correspondente deve existir no Appwrite Auth para o funcionário entrar no sistema.</p>
        <div className="flex justify-end gap-3 sm:col-span-2"><ActionButton tone="outline" onClick={()=>setEdit(null)} disabled={busy}>Cancelar</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar permissões"}</ActionButton></div>
      </form>
    </div></div>}
  </div>;
}
function Summary({title,value,icon,tone}:{title:string;value:number;icon:any;tone:string}){const cls=tone==="green"?"bg-emerald-50 text-emerald-600":tone==="gold"?"bg-amber-50 text-amber-600":"bg-blue-50 text-blue-600";return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid size-13 place-items-center rounded-xl ${cls}`}>{icon}</span><div><span className="text-[13px] font-bold text-slate-500">{title}</span><b className="block text-[28px] font-black text-[#061426]">{value}</b></div></div>}
