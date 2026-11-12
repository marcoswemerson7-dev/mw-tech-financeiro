import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink, Globe2, ImagePlus, Pencil, Plus, Server, Trash2, X, Landmark, Truck, FolderKanban, FileCheck2, ShieldCheck } from "lucide-react";
import { ActionButton, Empty, PageHeader, Toast } from "../components/UI";
import { deleteManagedSystem, getManagedSystems, getManagedSystemsCached, saveManagedSystem, type ManagedSystem, uploadSystemLogo } from "../services/managedSystems";

// Catálogo visual de implantação: não cria registros no Appwrite nem inventa URLs.
// Registros efetivamente cadastrados substituem estes rascunhos por chave estável.
const CATALOG: Array<Partial<ManagedSystem> & { catalogKey: string }> = [
  {catalogKey:"rg",orgao:"Prefeitura Municipal de Ribeiro Gonçalves - PI",tipo_orgao:"Prefeitura",sistema:"Gestão Licita RG",monitoring_key:"rg",ambiente:"Produção",status:"implantacao",infraestrutura:"Vercel + Supabase"},
  {catalogKey:"bg",orgao:"Prefeitura Municipal de Baixa Grande do Ribeiro - PI",tipo_orgao:"Prefeitura",sistema:"Gestão Licita BG",monitoring_key:"bg",ambiente:"Produção",status:"implantacao",infraestrutura:"Vercel + Supabase"},
  {catalogKey:"camara_licita",github_url:"https://github.com/marcoswemerson7-dev/gestao-licita-camara-mwtech",orgao:"Câmara Municipal de Ribeiro Gonçalves - PI",tipo_orgao:"Câmara",sistema:"Gestão Licita Câmara RG",monitoring_key:"camara_licita",ambiente:"Produção",status:"implantacao",infraestrutura:"Vercel + Supabase + Cloudflare R2",supabase_url:"https://supabase.com/dashboard/project/qnitcxoekxkwyqoirdka"},
  {catalogKey:"camara_frota",github_url:"https://github.com/marcoswemerson7-dev/frotagov-mwtech",orgao:"Câmara Municipal de Ribeiro Gonçalves - PI",tipo_orgao:"Câmara",sistema:"Gestão Frota Câmara RG",monitoring_key:"camara_frota",ambiente:"Produção",status:"implantacao",infraestrutura:"Vercel + Supabase",supabase_url:"https://uydappvzmdpkkyxslrye.supabase.co"},
  {catalogKey:"camara_patrimonio",github_url:"https://github.com/marcoswemerson7-dev/patrimonio_mwtech",orgao:"Câmara Municipal de Ribeiro Gonçalves - PI",tipo_orgao:"Câmara",sistema:"MW TECH Patrimônio — Câmara RG",monitoring_key:"camara_patrimonio",ambiente:"Produção",status:"implantacao",infraestrutura:"Vercel + Supabase + Google Drive",supabase_url:"https://supabase.com/dashboard/project/ybljkroautoqzmifrkbi"},
  {catalogKey:"rg_controladoria",github_url:"https://github.com/marcoswemerson7-dev/mw-tech-controladoria",orgao:"Prefeitura Municipal de Ribeiro Gonçalves - PI",tipo_orgao:"Prefeitura",sistema:"Controladoria Digital RG",monitoring_key:"rg_controladoria",ambiente:"Produção",status:"implantacao",infraestrutura:"Vercel + Supabase"},
];
const normalized = (value?: string) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function systemKey(item: Partial<ManagedSystem>) {
  const key = normalized(item.monitoring_key);
  if (key) return key;
  const title = normalized(item.sistema);
  const org = normalized(item.orgao);
  if (title.includes("patrimonio")) return "camara_patrimonio";
  if (title.includes("frota")) return "camara_frota";
  if (title.includes("controladoria")) return "rg_controladoria";
  if (title.includes("licita") && (org.includes("camara") || title.includes("camara"))) return "camara_licita";
  if (title.includes("licita") && (org.includes("baixa grande") || title.includes("bg"))) return "bg";
  if (title.includes("licita") && (org.includes("ribeiro") || title.includes("rg"))) return "rg";
  return normalized(item.orgao) + ":" + title;
}
function systemIcon(item: Partial<ManagedSystem>) {
  const title = normalized(item.sistema);
  if (title.includes("frota")) return Truck;
  if (title.includes("patrimonio")) return Landmark;
  if (title.includes("controladoria")) return ShieldCheck;
  if (title.includes("licita")) return FileCheck2;
  return FolderKanban;
}

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
      header: "bg-[#163f35]",
      accentBar: "bg-emerald-500",
      badge: "border border-emerald-200/40 bg-emerald-400/15 text-emerald-100",
      icon: "text-emerald-600",
      iconBox: "bg-emerald-50 ring-1 ring-emerald-100",
      button: "bg-emerald-600",
      buttonHover: "hover:bg-emerald-700",
      edit: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
      glow: "shadow-sm",
    };
  }

  if (org.includes("câmara") || org.includes("camara")) {
    return {
      header: "bg-[#34334d]",
      accentBar: "bg-violet-500",
      badge: "border border-violet-200/40 bg-violet-300/15 text-violet-100",
      icon: "text-violet-700",
      iconBox: "bg-violet-50 ring-1 ring-violet-100",
      button: "bg-violet-600",
      buttonHover: "hover:bg-violet-700",
      edit: "border-violet-200 text-violet-700 hover:bg-violet-50",
      glow: "shadow-sm",
    };
  }

  if (org.includes("ribeiro gonçalves") || org.includes("ribeiro goncalves")) {
    return {
      header: "bg-[#173b61]",
      accentBar: "bg-amber-400",
      badge: "border border-amber-200/40 bg-amber-300/15 text-amber-100",
      icon: "text-blue-700",
      iconBox: "bg-blue-50 ring-1 ring-blue-100",
      button: "bg-blue-600",
      buttonHover: "hover:bg-blue-700",
      edit: "border-blue-200 text-blue-700 hover:bg-blue-50",
      glow: "shadow-sm",
    };
  }



  return {
    header: "bg-[#55452b]",
    accentBar: "bg-amber-500",
    badge: "border border-amber-200/40 bg-amber-300/15 text-amber-100",
    icon: "text-amber-700",
    iconBox: "bg-amber-50 ring-1 ring-amber-100",
    button: "bg-amber-600",
    buttonHover: "hover:bg-amber-700",
    edit: "border-amber-200 text-amber-700 hover:bg-amber-50",
    glow: "shadow-sm",
  };
}

export default function Systems() {
  const cachedRows = getManagedSystemsCached();
  const [rows, setRows] = useState<ManagedSystem[]>(cachedRows || []);
  const [loading, setLoading] = useState(!cachedRows);
  const [edit, setEdit] = useState<Partial<ManagedSystem> | null>(null);
  const [query, setQuery] = useState("");
  const [environment, setEnvironment] = useState("");
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState("");

  useEffect(() => {
    let active = true;
    getManagedSystems()
      .then((data) => { if (active) setRows(data); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const catalogRows = useMemo(() => {
    const existing = new Set(rows.map(systemKey));
    const missing = CATALOG.filter(item => !existing.has(item.catalogKey)).map(item => ({
      ...item, id: "catalog:" + item.catalogKey, created_at: "", updated_at: "",
    } as ManagedSystem));
    return [...rows, ...missing].sort((a,b) => a.tipo_orgao.localeCompare(b.tipo_orgao,"pt-BR") || a.orgao.localeCompare(b.orgao,"pt-BR") || a.sistema.localeCompare(b.sistema,"pt-BR"));
  }, [rows]);
  const visible = useMemo(() => catalogRows.filter((item) =>
    (!environment || item.ambiente === environment) &&
    (!status || item.status === status) &&
    normalized(Object.values(item).join(" ")).includes(normalized(query)),
  ), [catalogRows, environment, query, status]);
  const groups = useMemo(() => {
    const result = new Map<string,ManagedSystem[]>();
    for (const item of visible) {
      const name = item.orgao || "Órgão não informado";
      result.set(name,[...(result.get(name) || []),item]);
    }
    return [...result.entries()];
  },[visible]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const form = e.currentTarget;
      const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
      const file = (form.elements.namedItem("logo") as HTMLInputElement).files?.[0];
      if (file) {
        values.logo_url = await uploadSystemLogo(file);
      }
      // Nunca substituir brasão ou logomarca oficial por favicon de outro domínio.
      const saved = await saveManagedSystem({ ...edit, id: edit?.id?.startsWith("catalog:") ? undefined : edit?.id, ...values });
      setRows((current) => edit?.id && !edit.id.startsWith("catalog:") ? current.map((x) => x.id === edit.id ? saved : x) : [...current, saved]);
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
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
      <Field label="Buscar"><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Órgão, sistema, projeto ou e-mail" className="input" /></Field>
      <Field label="Ambiente"><select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="input">
        <option value="">Todos os ambientes</option><option>Produção</option><option>Homologação</option><option>Teste</option>
      </select></Field>
      <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
        <option value="">Todos os status</option><option value="ativo">Ativo</option><option value="implantacao">Em implantação</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option>
      </select></Field>
    </div>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
    {loading ? <SystemsSkeleton /> : visible.length ? <div className="space-y-7">{groups.map(([orgao, systems]) => (
      <section key={orgao} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2"><Building2 size={19} className="text-blue-700"/><h2 className="text-base font-semibold text-[#102a43]">{orgao}</h2></div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{systems.length} sistema(s)</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{systems.map((item) => {
      const draft = item.id.startsWith("catalog:");
      const Icon = systemIcon(item);
      const theme = getSystemTheme(item);
      return <article key={item.id} className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200  ${theme.glow}`}>
        <div className={`h-1.5 w-full ${theme.accentBar}`} />
        <div className={`relative overflow-hidden border-b border-white/10 p-6 text-white ${theme.header}`}>
          <div className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/[.06] blur-2xl" />
          <div className="flex items-start justify-between gap-5">
            <span className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/25 bg-white p-2 shadow-sm">
              {item.logo_url ? <img src={item.logo_url} alt={`Logomarca de ${item.sistema}`} className="size-full object-contain"/> : <div className="flex flex-col items-center gap-1 text-slate-500"><Icon size={28} /><span className="text-[8px] font-semibold">Logo pendente</span></div>}
            </span>
            <span className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide ${theme.badge}`}>{draft ? "Preparar cadastro" : statusLabel(item.status)}</span>
          </div>
          <h3 className="relative mt-5 max-w-[92%] text-[18px] font-semibold leading-[1.32] tracking-[.01em]">{item.sistema}</h3>
          <p className="relative mt-2 text-[12px] font-medium text-white/75">{item.tipo_orgao} · {item.ambiente}</p>
        </div>
        <div className="space-y-4 p-5">
          <div><span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Órgão</span><b className="mt-1 block text-sm text-[#061426]">{item.orgao}</b></div>
          <LinkRow icon={<Globe2 size={17}/>} label="Domínio" url={item.dominio_url} theme={theme}/>
          <InfoRow icon={<Server size={17}/>} label="Infraestrutura" value={item.infraestrutura || (item.vercel_url ? "Vercel" : item.ambiente === "Teste" ? "VPS / Servidor" : "Não informado")} theme={theme}/>
          {item.provedor && <InfoRow icon={<Server size={17}/>} label="Provedor" value={item.provedor} theme={theme}/>} 
          {item.servidor_endereco && <InfoRow icon={<Server size={17}/>} label="Servidor / IP" value={item.servidor_endereco} theme={theme}/>} 
          {item.servidor_os && <InfoRow icon={<Server size={17}/>} label="Sistema operacional" value={item.servidor_os} theme={theme}/>} 
          {item.vercel_url && <LinkRow icon={<Server size={17}/>} label="Projeto Vercel" url={item.vercel_url} theme={theme}/>} 
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Projetos e contas</summary>
            <dl className="mt-3 grid gap-3 text-sm">
              <TechnicalDetail label="Projeto Supabase" value={item.supabase_project} />
              <TechnicalDetail label="Painel Supabase" value={supabaseDashboardUrl(item.supabase_url)} link />
              <TechnicalDetail label="E-mail da conta Supabase" value={item.supabase_email} />
              <TechnicalDetail label="Repositório GitHub" value={item.github_url} link />
              <TechnicalDetail label="E-mail da conta Vercel" value={item.vercel_email} />
              <TechnicalDetail label="Pasta Google Drive" value={item.drive_url} link />
              <TechnicalDetail label="E-mail da conta Google Drive" value={item.drive_email} />
            </dl>
          </details>
          <div className="flex gap-3 pt-2">
            {item.acesso_url && <a href={safeUrl(item.acesso_url)} target="_blank" rel="noreferrer" className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold text-white shadow-sm transition ${theme.button} ${theme.buttonHover}`}>Entrar no sistema <ExternalLink size={16}/></a>}
            <button onClick={() => setEdit(item)} aria-label={draft ? "Completar cadastro" : "Editar cadastro"} title={draft ? "Completar cadastro" : "Editar cadastro"} className={`grid size-11 place-items-center rounded-xl border bg-white transition ${theme.edit}`}><Pencil size={17}/></button>
            {!draft && <button onClick={() => remove(item.id)} disabled={busyRow === item.id} className="grid size-11 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"><Trash2 size={17}/></button>}
          </div>
        </div>
      </article>;
    })}</div></section>))}</div> : <Empty/>}
    {edit && <Modal title={edit.id && !edit.id.startsWith("catalog:") ? "Editar sistema" : "Completar cadastro do sistema"} close={() => setEdit(null)}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Órgão" wide><input name="orgao" required defaultValue={edit.orgao || ""} className="input"/></Field>
        <Field label="Tipo de órgão"><select name="tipo_orgao" defaultValue={edit.tipo_orgao || "Prefeitura"} className="input"><option>Prefeitura</option><option>Câmara</option><option>Empresa</option><option>Outro órgão</option></select></Field>
        <Field label="Sistema"><input name="sistema" required defaultValue={edit.sistema || "Gestão Licita"} className="input"/></Field>
        <Field label="Domínio"><input name="dominio_url" placeholder="https://..." defaultValue={edit.dominio_url || ""} className="input"/></Field>
        <Field label="Infraestrutura"><select name="infraestrutura" defaultValue={edit.infraestrutura || (edit.vercel_url ? "Vercel" : "VPS")} className="input"><option>Vercel + Supabase</option><option>Vercel + Supabase + Google Drive</option><option>Vercel + Supabase + Cloudflare R2</option><option>Vercel</option><option>VPS</option><option>Servidor dedicado</option><option>Local</option><option>Outro</option></select></Field>
        <Field label="Provedor / datacenter"><input name="provedor" placeholder="Ex.: Hostinger, Contabo, Oracle Cloud..." defaultValue={edit.provedor || ""} className="input"/></Field>
        <Field label="Servidor / IP"><input name="servidor_endereco" placeholder="Ex.: 192.0.2.10 ou vps.exemplo.com" defaultValue={edit.servidor_endereco || ""} className="input"/></Field>
        <Field label="Sistema operacional"><input name="servidor_os" placeholder="Ex.: Ubuntu 24.04 LTS" defaultValue={edit.servidor_os || ""} className="input"/></Field>
        <Field label="URL da Vercel"><input name="vercel_url" placeholder="https://vercel.com/..." defaultValue={edit.vercel_url || ""} className="input"/></Field>
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-2 text-sm font-semibold text-slate-700">Projetos e contas</legend>
          <Field label="Projeto Supabase"><input name="supabase_project" defaultValue={edit.supabase_project || ""} placeholder="Nome ou referência do projeto" className="input"/></Field>
          <Field label="URL Supabase"><input name="supabase_url" placeholder="https://supabase.com/dashboard/project/..." defaultValue={edit.supabase_url || ""} className="input"/></Field>
          <Field label="E-mail da conta Supabase"><input name="supabase_email" type="email" defaultValue={edit.supabase_email || ""} className="input"/></Field>
          <Field label="E-mail da conta Vercel"><input name="vercel_email" type="email" defaultValue={edit.vercel_email || ""} className="input"/></Field>
          <Field label="Repositório GitHub"><input name="github_url" type="url" defaultValue={edit.github_url || ""} placeholder="https://github.com/..." className="input"/></Field>
          <Field label="Pasta Google Drive"><input name="drive_url" type="url" defaultValue={edit.drive_url || ""} placeholder="https://drive.google.com/..." className="input"/></Field>
          <Field label="E-mail da conta Google Drive"><input name="drive_email" type="email" defaultValue={edit.drive_email || ""} className="input"/></Field>
        </fieldset>
        <Field label="Chave de monitoramento"><input name="monitoring_key" placeholder="Ex.: rg, bg, alagoinha" defaultValue={edit.monitoring_key || ""} className="input"/><span className="mt-1 block text-[11px] font-medium text-slate-400">Identificador único usado por métricas, usuários e auditoria. Não coloque senha ou chave secreta aqui.</span></Field>
        <Field label="Link para entrar" wide><input name="acesso_url" placeholder="https://..." defaultValue={edit.acesso_url || ""} className="input"/></Field>
        <Field label="Ambiente"><select name="ambiente" defaultValue={edit.ambiente || "Produção"} className="input"><option>Produção</option><option>Homologação</option><option>Teste</option></select></Field>
        <Field label="Status"><select name="status" defaultValue={edit.status || "ativo"} className="input"><option value="ativo">Ativo</option><option value="implantacao">Em implantação</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></select></Field>
        <input type="hidden" name="logo_url" defaultValue={edit.logo_url || ""}/>
        <Field label="Logomarca" wide><label className="input flex cursor-pointer items-center gap-2"><ImagePlus size={17}/> Upload manual da logo<input name="logo" type="file" accept="image/png,image/jpeg" className="hidden"/></label></Field>
        <Field label="Observações" wide><textarea name="observacao" defaultValue={edit.observacao || ""} className="input"/></Field>
        {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2"><ActionButton tone="outline" onClick={() => setEdit(null)} disabled={busy}>Cancelar</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar sistema"}</ActionButton></div>
      </form>
    </Modal>}
  </div>;
}
function supabaseDashboardUrl(url?: string) {
  const projectRef = url?.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1];
  return projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : url;
}

function TechnicalDetail({ label, value, link }: { label: string; value?: string; link?: boolean }) {
  return <div className="min-w-0">
    <dt className="font-semibold text-slate-500">{label}</dt>
    <dd className="break-all text-slate-900">
      {link && value ? <a href={safeUrl(value)} target="_blank" rel="noreferrer" className="text-blue-700 underline">{value}</a> : value || "Não informado"}
    </dd>
  </div>;
}

const safeUrl=(url:string)=>/^https?:\/\//i.test(url)?url:`https://${url}`;
function statusLabel(status?: string) {
  if (status === "implantacao") return "Implantação";
  if (status === "suspenso") return "Suspenso";
  if (status === "inativo") return "Inativo";
  return "Ativo";
}
function SystemsSkeleton(){return <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">{[0,1].map((item)=><div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="h-48 animate-pulse bg-slate-200"/><div className="space-y-3 p-5"><div className="h-5 w-1/3 animate-pulse rounded bg-slate-200"/><div className="h-14 animate-pulse rounded-xl bg-slate-100"/><div className="h-14 animate-pulse rounded-xl bg-slate-100"/><div className="h-12 animate-pulse rounded-xl bg-slate-200"/></div></div>)}</div>}
function InfoRow({icon,label,value,theme}:{icon:any;label:string;value?:string;theme:SystemTheme}){return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-[13px] ring-1 ring-inset ring-slate-100"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${theme.iconBox} ${theme.icon}`}>{icon}</span><div className="min-w-0"><span className="block font-bold text-slate-500">{label}</span><span className="block truncate font-bold text-[#061426]">{value || "Não informado"}</span></div></div>}
function LinkRow({icon,label,url,theme}:{icon:any;label:string;url?:string;theme:SystemTheme}){return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-[13px] ring-1 ring-inset ring-slate-100"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${theme.iconBox} ${theme.icon}`}>{icon}</span><div className="min-w-0"><span className="block font-bold text-slate-500">{label}</span>{url?<a href={safeUrl(url)} target="_blank" rel="noreferrer" className="block truncate font-bold text-[#061426] transition hover:opacity-70">{url}</a>:<span className="text-slate-400">Não informado</span>}</div></div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:any}){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white"><div className="sticky top-0 z-10 flex justify-between border-b bg-white px-7 py-5"><h3 className="text-xl font-semibold">{title}</h3><button onClick={close}><X/></button></div><div className="p-7">{children}</div></div></div>}
function Field({label,children,wide}:{label:string;children:any;wide?:boolean}){return <label className={`text-sm font-bold text-slate-600 ${wide?"sm:col-span-2":""}`}>{label}{children}</label>}
