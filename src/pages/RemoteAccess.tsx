import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  ExternalLink,
  Laptop,
  Monitor,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Wifi,
  X,
} from "lucide-react";
import {
  anyDeskUrl,
  deleteRemoteDevice,
  getRemoteDevices,
  saveRemoteDevice,
  type RemoteDevice,
} from "../services/remoteAccess";

const organizationTypes = ["Prefeitura Municipal", "Câmara Municipal", "Empresa", "Outros órgãos"];

const emptyForm = {
  tipo_orgao: "Prefeitura Municipal",
  orgao: "",
  setor: "",
  usuario: "",
  dispositivo: "",
  anydesk_id: "",
  observacao: "",
  acesso_nao_supervisionado: false,
  ativo: true,
};

function orgTheme(org: string) {
  const value = org.toLowerCase();
  if (value.includes("baixa") && value.includes("ribeiro")) {
    return { header: "from-[#0b4b41] to-[#126555]", accent: "text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (value.includes("câmara") || value.includes("camara")) {
    return { header: "from-[#3b2a70] to-[#5b3d92]", accent: "text-violet-700", button: "bg-violet-600 hover:bg-violet-700", pill: "bg-violet-50 text-violet-700 border-violet-200" };
  }
  if ((value.includes("ribeiro") && value.includes("gonçalves")) || value.includes("goncalves")) {
    return { header: "from-[#0b3154] to-[#135b8d]", accent: "text-blue-700", button: "bg-blue-600 hover:bg-blue-700", pill: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  return { header: "from-[#6b4914] to-[#9b6a1c]", accent: "text-amber-700", button: "bg-amber-600 hover:bg-amber-700", pill: "bg-amber-50 text-amber-700 border-amber-200" };
}

function typeTheme(type: string) {
  if (type === "Câmara Municipal") return "border-violet-200 bg-violet-50 text-violet-700";
  if (type === "Empresa") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (type === "Outros órgãos") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function RemoteAccess() {
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RemoteDevice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setDevices(await getRemoteDevices());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os dispositivos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = devices.filter((item) => !q || [item.tipo_orgao, item.orgao, item.dispositivo, item.setor, item.usuario, item.anydesk_id].some((value) => String(value || "").toLowerCase().includes(q)));
    const typeMap = new Map<string, Map<string, RemoteDevice[]>>();
    filtered.forEach((item) => {
      const type = item.tipo_orgao || "Outros órgãos";
      if (!typeMap.has(type)) typeMap.set(type, new Map());
      const orgMap = typeMap.get(type)!;
      orgMap.set(item.orgao, [...(orgMap.get(item.orgao) || []), item]);
    });
    return Array.from(typeMap.entries())
      .sort((a, b) => organizationTypes.indexOf(a[0]) - organizationTypes.indexOf(b[0]))
      .map(([type, orgMap]) => [type, Array.from(orgMap.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))] as const);
  }, [devices, query]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (device: RemoteDevice) => {
    setEditing(device);
    setForm({
      tipo_orgao: device.tipo_orgao || "Prefeitura Municipal",
      orgao: device.orgao,
      setor: device.setor || "",
      usuario: device.usuario || "",
      dispositivo: device.dispositivo,
      anydesk_id: device.anydesk_id,
      observacao: device.observacao || "",
      acesso_nao_supervisionado: device.acesso_nao_supervisionado === true,
      ativo: device.ativo,
    });
    setError("");
    setModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveRemoteDevice({ ...form, id: editing?.id });
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o dispositivo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (device: RemoteDevice) => {
    if (!window.confirm(`Excluir ${device.dispositivo}?`)) return;
    try {
      await deleteRemoteDevice(device.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir o dispositivo.");
    }
  };

  const connect = (device: RemoteDevice) => {
    window.location.href = anyDeskUrl(device.anydesk_id);
  };

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-4 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_7px_24px_rgba(15,23,42,.045)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#b98222]"><Monitor size={15}/> MW TECH Control</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-.025em] text-[#0b2239] sm:text-[32px]">Acesso remoto · AnyDesk</h1>
            <p className="mt-1.5 max-w-3xl text-[13px] text-slate-500">Gerencie os computadores por órgão, setor e responsável em uma visão simples e organizada.</p>
          </div>
          <button onClick={openNew} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0b3154] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(11,49,84,.16)] transition hover:bg-[#12456f]"><Plus size={17}/> Adicionar dispositivo</button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,.04)]">
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar órgão, computador, setor, responsável ou ID AnyDesk..." className="h-11 w-full rounded-xl border border-slate-200 bg-[#f8fafc] pl-11 pr-4 text-[13px] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60" />
        </div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700"><AlertCircle size={16}/>{error}</div>}

      {loading ? (
        <div className="grid min-h-[240px] place-items-center rounded-2xl border border-slate-200 bg-white text-[13px] text-slate-400">Carregando dispositivos...</div>
      ) : grouped.length === 0 ? (
        <div className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Laptop size={25}/></div><h3 className="mt-4 text-base font-semibold text-[#0b2239]">Nenhum dispositivo cadastrado</h3><p className="mt-1 text-[13px] text-slate-500">Adicione um computador com o ID ou Alias do AnyDesk.</p></div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([type, organizations]) => (
            <section key={type} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] ${typeTheme(type)}`}>{type}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {organizations.map(([org, items]) => {
                const theme = orgTheme(org);
                return (
                  <section key={org} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_7px_22px_rgba(15,23,42,.045)]">
                    <header className={`bg-gradient-to-r ${theme.header} px-4 py-3.5 text-white sm:px-5`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><Building2 size={18}/></div>
                          <div className="min-w-0"><p className="text-[9px] font-medium uppercase tracking-[.16em] text-white/65">{type}</p><h2 className="truncate text-[15px] font-semibold">{org}</h2></div>
                        </div>
                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium">{items.length} dispositivo{items.length === 1 ? "" : "s"}</span>
                      </div>
                    </header>

                    <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 2xl:grid-cols-3">
                      {items.map((device) => (
                        <article key={device.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,.035)] transition hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,.06)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#0b3154]"><Monitor size={19}/></div>
                              <div className="min-w-0"><h3 className="truncate text-[14px] font-semibold text-[#0b2239]">{device.dispositivo}</h3><p className="mt-0.5 truncate text-[11px] text-slate-500">{device.setor || "Setor não informado"}</p></div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold ${device.ativo ? theme.pill : "border-slate-200 bg-slate-100 text-slate-500"}`}>{device.ativo ? "Ativo" : "Inativo"}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {device.acesso_nao_supervisionado ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.06em] text-emerald-700"><ShieldCheck size={11}/> Não supervisionado</span> : <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.06em] text-slate-500"><ShieldCheck size={11}/> Aceite manual</span>}
                          </div>

                          <div className="mt-3 rounded-xl bg-[#f7f9fc] p-3.5">
                            <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-400">AnyDesk</span>
                            <p className={`mt-1 text-[17px] font-semibold tracking-[.01em] ${theme.accent}`}>{device.anydesk_id}</p>
                            {device.usuario && <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-600"><UserRound size={13}/>{device.usuario}</div>}
                            {device.observacao && <p className="mt-2 text-[11px] leading-4 text-slate-500">{device.observacao}</p>}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button onClick={() => connect(device)} disabled={!device.ativo} className={`flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${device.ativo ? theme.button : ""}`}><Wifi size={15}/> Acessar AnyDesk <ExternalLink size={12}/></button>
                            <button onClick={() => openEdit(device)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"><Pencil size={15}/></button>
                            <button onClick={() => void remove(device)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"><Trash2 size={15}/></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {modalOpen && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/65 p-4">
        <div className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-lg font-semibold text-[#0b2239]">{editing ? "Editar dispositivo" : "Adicionar dispositivo"}</h3><p className="text-[11px] text-slate-500">Cadastre o órgão e os dados necessários para o acesso remoto.</p></div><button onClick={() => setModalOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-slate-100"><X size={18}/></button></div>
          <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-slate-600">Tipo de órgão<select value={form.tipo_orgao} onChange={(e) => setForm({ ...form, tipo_orgao: e.target.value })} className="input mt-2">{organizationTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="text-[12px] font-medium text-slate-600">Órgão<input required value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} placeholder="Ex.: Prefeitura Municipal de Ribeiro Gonçalves - PI" className="input mt-2" /></label>
            <label className="text-[12px] font-medium text-slate-600">Computador/dispositivo<input required value={form.dispositivo} onChange={(e) => setForm({ ...form, dispositivo: e.target.value })} placeholder="Ex.: CPL-01" className="input mt-2" /></label>
            <label className="text-[12px] font-medium text-slate-600">ID ou Alias do AnyDesk<input required value={form.anydesk_id} onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })} placeholder="123 456 789" className="input mt-2" /></label>
            <label className="text-[12px] font-medium text-slate-600">Setor<input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Ex.: Licitação" className="input mt-2" /></label>
            <label className="text-[12px] font-medium text-slate-600">Usuário/responsável<input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Ex.: Márcia" className="input mt-2" /></label>
            <label className="sm:col-span-2 text-[12px] font-medium text-slate-600">Observações<textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/60" /></label>
            <label className={`sm:col-span-2 flex items-start gap-3 rounded-xl border px-4 py-3 text-[12px] font-medium ${form.acesso_nao_supervisionado ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}><input type="checkbox" checked={form.acesso_nao_supervisionado} onChange={(e) => setForm({ ...form, acesso_nao_supervisionado: e.target.checked })} className="mt-0.5 size-4" /><span><span className="flex items-center gap-2"><ShieldCheck size={15}/> Acesso não supervisionado configurado</span><small className="mt-1 block font-normal leading-4 opacity-75">A senha do AnyDesk não é armazenada no MW TECH Control.</small></span></label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-600"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="size-4" /> Dispositivo ativo</label>
            {error && <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-medium text-rose-700">{error}</div>}
            <div className="sm:col-span-2 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-medium text-slate-600">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-[#0b3154] px-5 py-2.5 text-[12px] font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar dispositivo"}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
