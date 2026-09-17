import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
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
  ExternalLink,
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
    return { header: "from-[#07372f] to-[#0b5a4a]", accent: "text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (value.includes("câmara") || value.includes("camara")) {
    return { header: "from-[#2e1f5d] to-[#4c2f85]", accent: "text-violet-700", button: "bg-violet-600 hover:bg-violet-700", pill: "bg-violet-50 text-violet-700 border-violet-200" };
  }
  if ((value.includes("ribeiro") && value.includes("gonçalves")) || value.includes("goncalves")) {
    return { header: "from-[#082743] to-[#0f4b78]", accent: "text-blue-700", button: "bg-blue-600 hover:bg-blue-700", pill: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  return { header: "from-[#3b2b0b] to-[#7a5315]", accent: "text-amber-700", button: "bg-amber-600 hover:bg-amber-700", pill: "bg-amber-50 text-amber-700 border-amber-200" };
}

function typeTheme(type: string) {
  if (type === "Câmara Municipal") return "border-violet-200 bg-violet-50 text-violet-800";
  if (type === "Empresa") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (type === "Outros órgãos") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
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
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_14px_42px_rgba(7,24,45,.06)]">
        <div className="flex flex-col gap-5 bg-[radial-gradient(circle_at_top_right,_rgba(214,163,58,.11),_transparent_35%),linear-gradient(135deg,#fff_0%,#f9fbfd_100%)] p-6 lg:flex-row lg:items-center lg:justify-between xl:p-7">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.22em] text-[#c98d20]"><Monitor size={17}/> MW TECH Control</div>
            <h1 className="text-[34px] font-black tracking-[-.03em] text-[#07182d]">Acesso remoto · AnyDesk</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Dispositivos separados por Prefeitura, Câmara, empresa ou outro órgão, com indicação de acesso não supervisionado.</p>
          </div>
          <button onClick={openNew} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#082743] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(8,39,67,.18)] transition hover:-translate-y-0.5 hover:bg-[#0b355b]"><Plus size={18}/> Adicionar dispositivo</button>
        </div>
      </section>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar Prefeitura, Câmara, órgão, computador, setor, usuário ou ID AnyDesk..." className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#d6a33a] focus:bg-white focus:ring-4 focus:ring-[#d6a33a]/10" />
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertCircle size={17}/>{error}</div>}

      {loading ? (
        <div className="grid min-h-[320px] place-items-center rounded-[28px] border border-slate-200 bg-white text-sm font-semibold text-slate-400">Carregando dispositivos...</div>
      ) : grouped.length === 0 ? (
        <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center">
          <div><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Laptop size={28}/></div><h3 className="mt-4 text-lg font-black text-[#07182d]">Nenhum dispositivo cadastrado</h3><p className="mt-1 text-sm text-slate-500">Adicione o primeiro computador com o ID ou Alias do AnyDesk.</p></div>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([type, organizations]) => (
            <section key={type} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[.13em] ${typeTheme(type)}`}>{type}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {organizations.map(([org, items]) => {
                const theme = orgTheme(org);
                return (
                  <section key={org} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(7,24,45,.05)]">
                    <header className={`bg-gradient-to-r ${theme.header} px-5 py-5 text-white sm:px-6`}>
                      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-white/10"><Building2 size={23}/></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">{type}</p><h2 className="text-lg font-black">{org}</h2></div></div><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">{items.length} dispositivo{items.length === 1 ? "" : "s"}</span></div>
                    </header>
                    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 xl:p-5">
                      {items.map((device) => (
                        <article key={device.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(7,24,45,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(7,24,45,.09)]">
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-[#082743]"><Monitor size={23}/></div><div><h3 className="font-black text-[#07182d]">{device.dispositivo}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{device.setor || "Setor não informado"}</p></div></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${device.ativo ? theme.pill : "border-slate-200 bg-slate-100 text-slate-500"}`}>{device.ativo ? "Ativo" : "Inativo"}</span></div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {device.acesso_nao_supervisionado ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-emerald-700"><ShieldCheck size={13}/> Não supervisionado configurado</span> : <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-slate-500"><ShieldCheck size={13}/> Aceite manual</span>}
                            </div>
                            <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                              <div><span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">AnyDesk</span><p className={`mt-1 text-base font-black ${theme.accent}`}>{device.anydesk_id}</p></div>
                              {device.usuario && <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><UserRound size={15}/>{device.usuario}</div>}
                              {device.observacao && <p className="text-xs leading-5 text-slate-500">{device.observacao}</p>}
                            </div>
                            <div className="mt-4 flex gap-2">
                              <button onClick={() => connect(device)} disabled={!device.ativo} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${device.ativo ? theme.button : ""}`}><Wifi size={17}/> Acessar AnyDesk <ExternalLink size={14}/></button>
                              <button onClick={() => openEdit(device)} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"><Pencil size={17}/></button>
                              <button onClick={() => void remove(device)} className="grid size-11 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"><Trash2 size={17}/></button>
                            </div>
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

      {modalOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/65 p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h3 className="text-xl font-black text-[#07182d]">{editing ? "Editar dispositivo" : "Adicionar dispositivo"}</h3><p className="text-xs text-slate-500">Cadastre o órgão, o endereço do AnyDesk e informe se o acesso sem aceite já foi configurado.</p></div><button onClick={() => setModalOpen(false)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={20}/></button></div>
          <form onSubmit={save} className="grid gap-4 p-6 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-600">Tipo de órgão<select value={form.tipo_orgao} onChange={(e) => setForm({ ...form, tipo_orgao: e.target.value })} className="input mt-2">{organizationTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-600">Órgão<input required value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} placeholder="Ex.: Prefeitura Municipal de Ribeiro Gonçalves - PI" className="input mt-2" /></label>
            <label className="text-sm font-bold text-slate-600">Computador/dispositivo<input required value={form.dispositivo} onChange={(e) => setForm({ ...form, dispositivo: e.target.value })} placeholder="Ex.: CPL-01" className="input mt-2" /></label>
            <label className="text-sm font-bold text-slate-600">ID ou Alias do AnyDesk<input required value={form.anydesk_id} onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })} placeholder="123 456 789" className="input mt-2" /></label>
            <label className="text-sm font-bold text-slate-600">Setor<input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Ex.: Licitação" className="input mt-2" /></label>
            <label className="text-sm font-bold text-slate-600">Usuário/responsável<input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Ex.: Márcia" className="input mt-2" /></label>
            <label className="sm:col-span-2 text-sm font-bold text-slate-600">Observações<textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#d6a33a] focus:ring-4 focus:ring-[#d6a33a]/10" /></label>
            <label className={`sm:col-span-2 flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm font-bold ${form.acesso_nao_supervisionado ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}><input type="checkbox" checked={form.acesso_nao_supervisionado} onChange={(e) => setForm({ ...form, acesso_nao_supervisionado: e.target.checked })} className="mt-0.5 size-4" /><span><span className="flex items-center gap-2"><ShieldCheck size={17}/> Acesso não supervisionado configurado</span><small className="mt-1 block font-medium leading-5 opacity-75">Marque somente depois de configurar uma senha de Acesso Não Supervisionado no AnyDesk deste computador. A senha não é armazenada no MW TECH Control.</small></span></label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="size-4" /> Dispositivo ativo</label>
            {error && <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
            <div className="sm:col-span-2 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-[#082743] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar dispositivo"}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
