import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink, Globe2, ImagePlus, Pencil, Plus, Server, Trash2, X } from "lucide-react";
import { ActionButton, Empty, PageHeader, Toast } from "../components/UI";
import { deleteManagedSystem, getManagedSystems, saveManagedSystem, type ManagedSystem, uploadSystemLogo } from "../services/managedSystems";

type SystemTheme = {
  header: string;
  accentBar: string;
  badge: string;
  icon: string;
  iconBox: string;
  button: string;
  buttonHover: string;
  edit: string;
  glow: string;
};

function getSystemTheme(item: Partial<ManagedSystem>): SystemTheme {
  const org = `${item.orgao || ""} ${item.tipo_orgao || ""}`.toLowerCase();

  if (org.includes("baixa grande")) {
    return {
      header: "bg-gradient-to-br from-[#061426] via-[#073523] to-[#0b5b38]",
      accentBar: "bg-emerald-500",
      badge: "border border-emerald-200/40 bg-emerald-400/15 text-emerald-100",
      icon: "text-emerald-600",
      iconBox: "bg-emerald-50 ring-1 ring-emerald-100",
      button: "bg-emerald-600",
      buttonHover: "hover:bg-emerald-700",
      edit: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
      glow: "shadow-[0_18px_45px_rgba(5,150,105,.12)]",
    };
  }

  if (org.includes("ribeiro gonçalves") || org.includes("ribeiro goncalves")) {
    return {
      header: "bg-gradient-to-br from-[#061426] via-[#0b2d5b] to-[#174d8f]",
      accentBar: "bg-amber-400",
      badge: "border border-amber-200/40 bg-amber-300/15 text-amber-100",
      icon: "text-blue-700",
      iconBox: "bg-blue-50 ring-1 ring-blue-100",
      button: "bg-blue-600",
      buttonHover: "hover:bg-blue-700",
      edit: "border-blue-200 text-blue-700 hover:bg-blue-50",
      glow: "shadow-[0_18px_45px_rgba(37,99,235,.12)]",
    };
  }

  if (org.includes("câmara") || org.includes("camara")) {
    return {
      header: "bg-gradient-to-br from-[#061426] via-[#31235f] to-[#5b3ba6]",
      accentBar: "bg-violet-500",
      badge: "border border-violet-200/40 bg-violet-300/15 text-violet-100",
      icon: "text-violet-700",
      iconBox: "bg-violet-50 ring-1 ring-violet-100",
      button: "bg-violet-600",
      buttonHover: "hover:bg-violet-700",
      edit: "border-violet-200 text-violet-700 hover:bg-violet-50",
      glow: "shadow-[0_18px_45px_rgba(124,58,237,.12)]",
    };
  }

  return {
    header: "bg-gradient-to-br from-[#061426] via-[#3b2b0d] to-[#6f4a0b]",
    accentBar: "bg-amber-500",
    badge: "border border-amber-200/40 bg-amber-300/15 text-amber-100",
    icon: "text-amber-700",
    iconBox: "bg-amber-50 ring-1 ring-amber-100",
    button: "bg-amber-600",
    buttonHover: "hover:bg-amber-700",
    edit: "border-amber-200 text-amber-700 hover:bg-amber-50",
    glow: "shadow-[0_18px_45px_rgba(217,119,6,.12)]",
  };
}

export default function Systems() {
  const [rows, setRows] = useState<ManagedSystem[]>([]);
  const [edit, setEdit] = useState<Partial<ManagedSystem> | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState("");
  useEffect(() => { getManagedSystems().then(setRows).catch((e) => setError(e.message)); }, []);
  const visible = useMemo(() => rows.filter((x) => JSON.stringify(x).toLowerCase().includes(query.toLowerCase())), [rows, query]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const form = e.currentTarget;
      const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
      const file = (form.elements.namedItem("logo") as HTMLInputElement).files?.[0];
      if (file) {
        values.logo_url = await uploadSystemLogo(file);
      } else if (!values.logo_url) {
        values.logo_url = faviconFor(values.acesso_url || values.dominio_url || values.vercel_url);
      }
      const saved = await saveManagedSystem({ ...edit, ...values });
      setRows((current) => edit?.id ? current.map((x) => x.id === edit.id ? saved : x) : [...current, saved]);
      setEdit(null); setToast("Sistema salvo com sucesso."); setTimeout(() => setToast(""), 2500);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Excluir este sistema da central?")) return;
    setError(""); setBusyRow(id);
    try {
      await deleteManagedSystem(id);
      setRows((x) => x.filter((row) => row.id !== id));
      setToast("Sistema excluído com sucesso."); setTimeout(() => setToast(""), 2500);
    } catch (e: any) {
      setError(e.message || "Não foi possível excluir o sistema.");
    } finally {
      setBusyRow("");
    }
  }

  return <div className="space-y-7">
    <Toast message={toast} />
    <PageHeader title="Sistemas e órgãos" subtitle="Central de domínios, projetos, ambientes e acessos dos clientes da MW TECH."
      actions={<ActionButton onClick={() => setEdit({ tipo_orgao: "Prefeitura", sistema: "Gestão Licita", ambiente: "Produção", status: "ativo" })}><Plus size={18}/>Adicionar sistema</ActionButton>} />
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar prefeitura, Câmara, domínio ou sistema..." className="input !mt-0" />
    </div>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
    {visible.length ? <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">{visible.map((item) => {
      const theme = getSystemTheme(item);
      return <article key={item.id} className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 ${theme.glow}`}>
        <div className={`h-1.5 w-full ${theme.accentBar}`} />
        <div className={`relative overflow-hidden border-b border-white/10 p-6 text-white ${theme.header}`}>
          <div className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/[.06] blur-2xl" />
          <div className="flex items-start justify-between gap-5">
            <span className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/25 bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,.2)]">
              {item.logo_url ? <img src={item.logo_url} alt={`Logomarca ${item.orgao}`} className="size-full object-contain"/> : <Building2 size={34} className="text-[#d9a441]"/>}
            </span>
            <span className={`rounded-full px-3.5 py-1.5 text-[12px] font-black uppercase tracking-wide ${theme.badge}`}>{statusLabel(item.status)}</span>
          </div>
          <h3 className="relative mt-5 max-w-[92%] text-[21px] font-black leading-[1.32] tracking-[.01em]">{item.orgao}</h3>
          <p className="relative mt-2 text-[13px] font-medium text-white/75">{item.tipo_orgao} · {item.ambiente}</p>
        </div>
        <div className="space-y-4 p-5">
          <div><span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Sistema</span><b className="mt-1 block text-[#061426]">{item.sistema}</b></div>
          <LinkRow icon={<Globe2 size={17}/>} label="Domínio" url={item.dominio_url} theme={theme}/>
          <LinkRow icon={<Server size={17}/>} label="Projeto Vercel" url={item.vercel_url} theme={theme}/>
          <LinkRow icon={<Server size={17}/>} label="Supabase" url={item.supabase_url} theme={theme}/>
          <div className="flex gap-3 pt-2">
            {item.acesso_url && <a href={safeUrl(item.acesso_url)} target="_blank" rel="noreferrer" className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-black text-white shadow-sm transition ${theme.button} ${theme.buttonHover}`}>Entrar no sistema <ExternalLink size={16}/></a>}
            <button onClick={() => setEdit(item)} className={`grid size-11 place-items-center rounded-xl border bg-white transition ${theme.edit}`}><Pencil size={17}/></button>
            <button onClick={() => remove(item.id)} disabled={busyRow === item.id} className="grid size-11 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"><Trash2 size={17}/></button>
          </div>
        </div>
      </article>;
    })}</div> : <Empty/>}
    {edit && <Modal title={edit.id ? "Editar sistema" : "Adicionar sistema"} close={() => setEdit(null)}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Órgão" wide><input name="orgao" required defaultValue={edit.orgao || ""} className="input"/></Field>
        <Field label="Tipo de órgão"><select name="tipo_orgao" defaultValue={edit.tipo_orgao || "Prefeitura"} className="input"><option>Prefeitura</option><option>Câmara</option><option>Empresa</option><option>Outro órgão</option></select></Field>
        <Field label="Sistema"><input name="sistema" required defaultValue={edit.sistema || "Gestão Licita"} className="input"/></Field>
        <Field label="Domínio"><input name="dominio_url" placeholder="https://..." defaultValue={edit.dominio_url || ""} className="input"/></Field>
        <Field label="URL da Vercel"><input name="vercel_url" placeholder="https://vercel.com/..." defaultValue={edit.vercel_url || ""} className="input"/></Field>
        <Field label="URL Supabase"><input name="supabase_url" placeholder="https://supabase.com/..." defaultValue={edit.supabase_url || ""} className="input"/></Field>
        <Field label="Link para entrar" wide><input name="acesso_url" placeholder="https://..." defaultValue={edit.acesso_url || ""} className="input"/></Field>
        <Field label="Ambiente"><select name="ambiente" defaultValue={edit.ambiente || "Produção"} className="input"><option>Produção</option><option>Homologação</option><option>Teste</option></select></Field>
        <Field label="Status"><select name="status" defaultValue={edit.status || "ativo"} className="input"><option value="ativo">Ativo</option><option value="implantacao">Em implantação</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></select></Field>
        <input type="hidden" name="logo_url" defaultValue={edit.logo_url || ""}/>
        <Field label="Logomarca" wide><label className="input flex cursor-pointer items-center gap-2"><ImagePlus size={17}/> Upload manual da logo<input name="logo" type="file" accept="image/png,image/jpeg" className="hidden"/></label></Field>
        <Field label="Observações" wide><textarea name="observacao" defaultValue={edit.observacao || ""} className="input"/></Field>
        <div className="flex justify-end gap-3 sm:col-span-2"><ActionButton tone="outline" onClick={() => setEdit(null)} disabled={busy}>Cancelar</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar sistema"}</ActionButton></div>
      </form>
    </Modal>}
  </div>;
}
const safeUrl=(url:string)=>/^https?:\/\//i.test(url)?url:`https://${url}`;
function faviconFor(url?: string) {
  if (!url) return "";
  try {
    const host = new URL(safeUrl(url)).hostname;
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : "";
  } catch {
    return "";
  }
}
function statusLabel(status?: string) {
  if (status === "implantacao") return "Implantação";
  if (status === "suspenso") return "Suspenso";
  if (status === "inativo") return "Inativo";
  return "Ativo";
}
function LinkRow({icon,label,url,theme}:{icon:any;label:string;url?:string;theme:SystemTheme}){return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-[13px] ring-1 ring-inset ring-slate-100"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${theme.iconBox} ${theme.icon}`}>{icon}</span><div className="min-w-0"><span className="block font-bold text-slate-500">{label}</span>{url?<a href={safeUrl(url)} target="_blank" rel="noreferrer" className="block truncate font-bold text-[#061426] transition hover:opacity-70">{url}</a>:<span className="text-slate-400">Não informado</span>}</div></div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:any}){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white"><div className="sticky top-0 z-10 flex justify-between border-b bg-white px-7 py-5"><h3 className="text-xl font-black">{title}</h3><button onClick={close}><X/></button></div><div className="p-7">{children}</div></div></div>}
function Field({label,children,wide}:{label:string;children:any;wide?:boolean}){return <label className={`text-sm font-bold text-slate-600 ${wide?"sm:col-span-2":""}`}>{label}{children}</label>}
