import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, ExternalLink, FolderKanban, Search, ShieldCheck, Plus, Pencil, Trash2, X, Layers3, Activity, Link2, RefreshCw, Settings2 } from "lucide-react";
import { PageHeader } from "../components/UI";
import { deleteManagedSystem, getManagedSystems, getManagedSystemsCached, saveManagedSystem, uploadSystemLogo, type ManagedSystem } from "../services/managedSystems";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const statusNames: Record<string, string> = { ativo: "Ativo", implantacao: "Em implantação", suspenso: "Suspenso", inativo: "Inativo" };
const blank: Partial<ManagedSystem> = { tipo_orgao: "Prefeitura", orgao: "", sistema: "", ambiente: "Produção", status: "implantacao", infraestrutura: "Vercel" };
function webUrl(value?: string) {
  if (!value?.trim()) return null;
  try { const u = new URL(/^https?:\/\//i.test(value) ? value.trim() : `https://${value.trim()}`); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function labelInput(title: string, field: string, value: string, set: (field: string, value: string) => void, placeholder = "", required = false) {
  return <label className="block text-sm font-semibold text-slate-700">{title}<input className="input mt-2" value={value} onChange={e => set(field, e.target.value)} placeholder={placeholder} required={required}/></label>;
}

export default function MunicipalCentral() {
  const [systems, setSystems] = useState<ManagedSystem[]>(() => getManagedSystemsCached() || []);
  const [loading, setLoading] = useState(!getManagedSystemsCached());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [environmentFilter, setEnvironmentFilter] = useState("todos");
  const [editor, setEditor] = useState<Partial<ManagedSystem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState<File | null>(null);
  const [newMunicipality, setNewMunicipality] = useState(false);
  const [tab, setTab] = useState<"modulos" | "informacoes">("modulos");
  const [busyId, setBusyId] = useState("");

  async function reload() {
    setLoading(true); setError("");
    try { setSystems(await getManagedSystems(true)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar."); } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    getManagedSystems(true).then(rows => { if (active) setSystems(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar os sistemas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const municipalities = useMemo(() => {
    const map = new Map<string, string>();
    systems.filter(i => normalized(i.tipo_orgao || "").includes("prefeitura")).forEach(i => {
      if (i.orgao?.trim() && !map.has(normalized(i.orgao))) map.set(normalized(i.orgao), i.orgao.trim());
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [systems]);
  const current = municipalities.find(name => normalized(name) === normalized(selected)) || "";
  const belonging = useMemo(() => systems.filter(i => current && normalized(i.orgao || "") === normalized(current) && normalized(i.tipo_orgao || "").includes("prefeitura")), [systems, current]);
  const visible = useMemo(() => belonging.filter(i =>
    (statusFilter === "todos" || i.status === statusFilter) &&
    (environmentFilter === "todos" || i.ambiente === environmentFilter) &&
    normalized(`${i.sistema} ${i.ambiente} ${i.status} ${i.dominio_url || ""}`).includes(normalized(query))
  ), [belonging, query, statusFilter, environmentFilter]);
  const active = belonging.filter(i => i.status === "ativo").length;
  const environments = new Set(belonging.map(i => i.ambiente));
  function setField(field: string, value: string) { setEditor(current => ({ ...current, [field]: value })); }
  function startNew(isNewMunicipality = false) {
    setNewMunicipality(isNewMunicipality);
    setUpload(null);
    setError(""); setNotice("");
    setEditor({ ...blank, orgao: isNewMunicipality ? "" : current });
  }
  function startEdit(item: ManagedSystem) { setNewMunicipality(false); setUpload(null); setError(""); setEditor({ ...item }); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const orgao = String(editor.orgao || "").trim();
    const sistema = String(editor.sistema || "").trim();
    if (!orgao || !sistema) { setError("Informe a prefeitura e o nome do sistema."); return; }
    if (newMunicipality && municipalities.some(name => normalized(name) === normalized(orgao))) { setError("Esta prefeitura já existe. Selecione-a e adicione o módulo."); return; }
    for (const field of ["acesso_url", "dominio_url", "vercel_url", "supabase_url"] as const) {
      if (editor[field] && !webUrl(editor[field])) { setError("Revise o endereço informado no campo " + field + "."); return; }
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const logo_url = upload ? await uploadSystemLogo(upload) : editor.logo_url;
      const saved = await saveManagedSystem({ ...editor, orgao, sistema, logo_url, tipo_orgao: "Prefeitura" });
      setSystems(rows => editor.id ? rows.map(item => item.id === saved.id ? saved : item) : [...rows, saved]);
      setSelected(orgao);
      setEditor(null); setUpload(null); setNewMunicipality(false);
      setNotice(editor.id ? "Cadastro atualizado com sucesso." : "Sistema cadastrado com sucesso.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar o cadastro."); } finally { setSaving(false); }
  }
  async function remove(item: ManagedSystem) {
    if (!window.confirm(`Remover "${item.sistema}" do cadastro da Central? Isso não exclui o sistema externo, mas remove seu registro administrativo.`)) return;
    setBusyId(item.id); setError(""); setNotice("");
    try { await deleteManagedSystem(item.id); setSystems(rows => rows.filter(i => i.id !== item.id)); setNotice("Registro removido da Central."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover."); }
    finally { setBusyId(""); }
  }
  const stat = (title: string, value: number, Icon: typeof Layers3) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{title}</span><Icon size={20} className="text-[#173b61]"/></div><strong className="mt-2 block text-2xl text-[#102a43]">{value}</strong></div>;

  return <div className="space-y-6">
    <PageHeader title="Central Municipal" subtitle="Administração de prefeituras, módulos e acessos cadastrados no MW TECH Control."/>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block min-w-[260px] flex-1 text-sm font-semibold text-slate-700">Prefeitura
          <select className="input mt-2" value={current} onChange={e => { setSelected(e.target.value); setQuery(""); setTab("modulos"); }}>
            <option value="">Selecione uma prefeitura</option>{municipalities.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16}/> Atualizar</button>
          <button type="button" onClick={() => startNew(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#102a43] hover:bg-slate-50"><Building2 size={17}/> Nova prefeitura</button>
          <button type="button" onClick={() => startNew()} disabled={!current} className="inline-flex items-center gap-2 rounded-xl bg-[#102a43] px-4 py-3 text-sm font-semibold text-white hover:bg-[#173b61] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17}/> Adicionar sistema</button>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">O cadastro de uma nova prefeitura começa com seu primeiro sistema. Todos os módulos permanecem independentes, com login e permissões próprios.</p>
    </section>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {loading ? <p className="text-sm text-slate-500">Atualizando cadastros...</p> : !current ?
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><Building2 className="mx-auto mb-3 text-slate-400" size={35}/><h2 className="font-semibold">Selecione uma prefeitura</h2><p className="mt-2 text-sm text-slate-500">Escolha um órgão cadastrado ou inicie o cadastro de uma nova prefeitura.</p></div>
      : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-[#102a43]">{current}</h2><p className="text-sm text-slate-500">Painel institucional dos sistemas cadastrados</p></div><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "modulos" ? "bg-[#102a43] text-white" : "text-slate-600"}`} onClick={() => setTab("modulos")}>Módulos</button><button className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "informacoes" ? "bg-[#102a43] text-white" : "text-slate-600"}`} onClick={() => setTab("informacoes")}>Informações</button></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stat("Sistemas cadastrados", belonging.length, Layers3)}{stat("Ativos", active, Activity)}{stat("Em implantação", belonging.filter(i => i.status === "implantacao").length, Settings2)}{stat("Ambientes", environments.size, FolderKanban)}</div>
        {tab === "modulos" ? <>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_180px]">
            <label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Pesquisar sistema" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar sistema ou domínio..." className="input !mt-0 !pl-10"/></label>
            <select aria-label="Filtrar situação" className="input !mt-0" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="todos">Todos os status</option><option value="ativo">Ativo</option><option value="implantacao">Em implantação</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></select>
            <select aria-label="Filtrar ambiente" className="input !mt-0" value={environmentFilter} onChange={e => setEnvironmentFilter(e.target.value)}><option value="todos">Todos os ambientes</option><option>Produção</option><option>Homologação</option><option>Teste</option></select>
          </div>
          {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(item => {
            const link = webUrl(item.acesso_url || item.dominio_url);
            const enabled = item.status === "ativo";
            return <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{item.logo_url ? <img src={item.logo_url} alt="" className="h-full w-full object-contain p-1"/> : <FolderKanban size={23} className="text-[#173b61]"/>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{statusNames[item.status] || "Não informado"}</span></div>
              <h3 className="mt-4 text-base font-semibold text-[#102a43]">{item.sistema}</h3><p className="mt-1 text-sm text-slate-500">{item.ambiente} · {item.infraestrutura || "Infraestrutura não informada"}</p>
              <p className="mt-2 truncate text-xs text-slate-500">{item.dominio_url || item.acesso_url || "Sem endereço cadastrado"}</p>
              <div className="mt-auto flex gap-2 pt-5">{enabled && link ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#102a43] px-3 py-3 text-sm font-semibold text-white hover:bg-[#173b61]">Abrir <ExternalLink size={16}/></a> : <span className="flex flex-1 items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-xs text-slate-500">Acesso indisponível</span>}<button title="Editar sistema" aria-label={`Editar ${item.sistema}`} onClick={() => startEdit(item)} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"><Pencil size={17}/></button><button disabled={busyId === item.id} title="Remover registro" aria-label={`Remover ${item.sistema}`} onClick={() => void remove(item)} className="grid size-11 place-items-center rounded-xl border border-rose-100 text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={17}/></button></div>
            </article>;
          })}</div> : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhum módulo corresponde aos filtros. Use “Adicionar sistema” para cadastrar outro.</div>}
        </> : <section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-base font-semibold text-[#102a43]">Cadastro institucional</h3><p className="mt-2 text-sm text-slate-600">Prefeitura: {current}</p><p className="mt-2 text-sm text-slate-600">Sistemas registrados: {belonging.length}</p><p className="mt-4 text-sm leading-6 text-slate-500">Esta primeira versão mantém os dados de prefeitura associados aos sistemas existentes. Cadastro independente de CNPJ, responsáveis, servidores e permissões municipais dependerá de uma estrutura administrativa própria, com autorização no servidor. Nenhum usuário de prefeitura recebe acesso ao MW TECH Control por esta tela.</p></section>}
      </>}
    {editor && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setEditor(null); }}>
      <section role="dialog" aria-modal="true" aria-label="Cadastro de sistema municipal" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><h2 className="text-xl font-semibold text-[#102a43]">{editor.id ? "Editar sistema" : newMunicipality ? "Cadastrar prefeitura e primeiro sistema" : "Adicionar sistema"}</h2><p className="mt-1 text-xs text-slate-500">Dados administrativos da Central MW TECH</p></div><button aria-label="Fechar" onClick={() => setEditor(null)} disabled={saving}><X size={21}/></button></div>
        <form onSubmit={e => void save(e)} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{newMunicipality ? labelInput("Nome oficial da prefeitura", "orgao", editor.orgao || "", setField, "Prefeitura Municipal de...", true) : <label className="block text-sm font-semibold text-slate-700">Prefeitura<select required className="input mt-2" value={editor.orgao || ""} onChange={e => setField("orgao", e.target.value)}>{editor.orgao && !municipalities.some(name => normalized(name) === normalized(editor.orgao || "")) && <option value={editor.orgao}>{editor.orgao}</option>}{municipalities.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}</div>
            {labelInput("Nome do sistema", "sistema", editor.sistema || "", setField, "Ex.: Gestão Lícita, Controladoria...", true)}
            <label className="block text-sm font-semibold text-slate-700">Situação<select className="input mt-2" value={editor.status || "implantacao"} onChange={e => setField("status", e.target.value)}><option value="implantacao">Em implantação</option><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></select></label>
            <label className="block text-sm font-semibold text-slate-700">Ambiente<select className="input mt-2" value={editor.ambiente || "Produção"} onChange={e => setField("ambiente", e.target.value)}><option>Produção</option><option>Homologação</option><option>Teste</option></select></label>
            <label className="block text-sm font-semibold text-slate-700">Hospedagem<select className="input mt-2" value={editor.infraestrutura || "Vercel"} onChange={e => setField("infraestrutura", e.target.value)}><option>Vercel</option><option>VPS</option><option>Servidor dedicado</option><option>Local</option><option>Outro</option></select></label>
            {labelInput("Link de acesso", "acesso_url", editor.acesso_url || "", setField, "https://...")}
            {labelInput("Domínio oficial", "dominio_url", editor.dominio_url || "", setField, "https://...")}
            {labelInput("Painel da Vercel", "vercel_url", editor.vercel_url || "", setField, "https://vercel.com/...")}
            {labelInput("Painel do Supabase (interno)", "supabase_url", editor.supabase_url || "", setField, "https://supabase.com/...")}
            {labelInput("Identificador do monitoramento", "monitoring_key", editor.monitoring_key || "", setField, "Ex.: rg-controladoria")}
            {labelInput("Provedor", "provedor", editor.provedor || "", setField, "Hospedagem ou datacenter")}
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Logomarca do módulo (opcional)<input type="file" accept="image/png,image/jpeg,image/webp" className="input mt-2" onChange={e => setUpload(e.target.files?.[0] || null)}/><span className="mt-1 block text-xs font-normal text-slate-500">Até 3 MB. Se não enviar outra imagem, a atual permanece.</span></label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Observações<textarea rows={3} className="input mt-2" value={editor.observacao || ""} onChange={e => setField("observacao", e.target.value)} placeholder="Informações sobre implantação, contatos institucionais e orientações..."/></label>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><ShieldCheck size={18} className="shrink-0"/>Não informe senhas, tokens ou chaves secretas. Os links administrativos são restritos ao ambiente MW TECH Control.</div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setEditor(null)} disabled={saving} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-[#102a43] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : editor.id ? "Salvar alterações" : "Cadastrar sistema"}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
