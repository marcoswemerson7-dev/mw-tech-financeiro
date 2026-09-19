import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, CalendarDays, Download, Eye, FileDown, Filter,
  RefreshCw, Search, ShieldCheck, UserRound, X, Building2, FileText, Database
} from "lucide-react";
import { account } from "../lib/appwrite";

type AuditRow = {
  id?: string;
  tenant: "rg" | "bg";
  tenant_label: string;
  created_at?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action_type?: string;
  module?: string;
  description?: string;
  process_number?: string;
  entity_id?: string;
  before_data?: unknown;
  after_data?: unknown;
  user_agent?: string;
  ip_address?: string;
};

const ACTION_LABELS: Record<string, string> = {
  login: "Login no sistema", logout: "Logout do sistema",
  process_create: "Cadastrou processo", process_update: "Editou processo",
  process_delete: "Excluiu processo", process_view: "Visualizou processo",
  process_status_change: "Alterou status do processo",
  user_create: "Criou usuário", user_invite: "Convidou usuário",
  user_update: "Editou usuário", user_role_change: "Alterou cargo/permissão",
  user_delete: "Excluiu usuário", import_spreadsheet: "Importou planilha",
  report_export: "Exportou relatório", report_print: "Imprimiu relatório",
  file_upload: "Fez upload de anexo", file_delete: "Removeu anexo",
  profile_photo_update: "Alterou foto", profile_update: "Atualizou perfil",
  user_request_access: "Solicitou acesso", user_approval: "Aprovou acesso",
  user_denial: "Recusou acesso", password_update: "Alterou senha",
  password_temp_generate: "Gerou senha temporária",
  numbering_reserve: "Reservou numeração", numbering_cancel: "Cancelou numeração",
  numbering_edit: "Editou numeração", numbering_bulk_mark_used: "Marcou numerações em lote",
  numbering_delete: "Excluiu numeração",
  calendar_event_create: "Criou evento", calendar_event_update: "Editou evento",
  calendar_event_delete: "Excluiu evento", additive_create: "Adicionou aditivo",
  additive_update: "Editou aditivo", additive_delete: "Removeu aditivo",
  contractor_create: "Adicionou contratado", contractor_update: "Editou contratado",
  contractor_delete: "Removeu contratado",
  protocol_create: "Criou protocolo", protocol_update: "Editou protocolo",
  protocol_delete: "Excluiu protocolo", protocol_print: "Imprimiu protocolo",
  normative_act_create: "Cadastrou ato normativo", normative_act_update: "Editou ato normativo",
  normative_act_delete: "Excluiu ato normativo", normative_act_file_upload: "Enviou PDF de ato normativo",
  normative_act_view: "Visualizou ato normativo", normative_act_download: "Baixou ato normativo",

  contract_balance_movement_insert: "Registrou movimentação de saldo",
  contract_balance_movement_update: "Alterou movimentação de saldo",
  contract_balance_movement_delete: "Excluiu movimentação de saldo",
  contract_balance_insert: "Criou controle de saldo",
  contract_balance_update: "Alterou controle de saldo",
  contract_balance_delete: "Excluiu controle de saldo",
  contract_balance_layer_insert: "Criou camada de saldo",
  contract_balance_layer_update: "Alterou camada de saldo",
  contract_balance_layer_delete: "Excluiu camada de saldo",
  contract_balance_allocation_insert: "Criou alocação de saldo",
  contract_balance_allocation_update: "Alterou alocação de saldo",
  contract_balance_allocation_delete: "Excluiu alocação de saldo",
  contract_item_movement_insert: "Registrou movimentação de item",
  contract_item_movement_update: "Alterou movimentação de item",
  contract_item_movement_delete: "Excluiu movimentação de item",
  invoice_insert: "Registrou nota fiscal",
  invoice_update: "Alterou nota fiscal",
  invoice_delete: "Excluiu nota fiscal",
  invoice_file_insert: "Anexou arquivo à nota fiscal",
  invoice_file_update: "Alterou arquivo da nota fiscal",
  invoice_file_delete: "Excluiu arquivo da nota fiscal",
  payment_insert: "Registrou pagamento",
  payment_update: "Alterou pagamento",
  payment_delete: "Excluiu pagamento",
  payment_receipt_insert: "Anexou comprovante de pagamento",
  payment_receipt_update: "Alterou comprovante de pagamento",
  payment_receipt_delete: "Excluiu comprovante de pagamento",
  execution_invoice_create: "Cadastrou nota fiscal na execução",
  execution_invoice_update: "Editou nota fiscal da execução",
  execution_invoice_delete: "Excluiu nota fiscal da execução",
  execution_invoice_status_change: "Alterou status da nota fiscal",
  execution_payment_schedule_create: "Agendou pagamento",
  execution_payment_schedule_update: "Alterou agendamento de pagamento",
  execution_payment_schedule_delete: "Excluiu agendamento de pagamento",
  execution_payment_create: "Registrou pagamento de nota fiscal",
  execution_payment_update: "Alterou pagamento de nota fiscal",
  execution_payment_delete: "Excluiu pagamento de nota fiscal",
  execution_payment_cancel: "Cancelou pagamento de nota fiscal",
  execution_invoice_file_upload: "Anexou arquivo à nota fiscal",
  execution_invoice_file_update: "Alterou arquivo da nota fiscal",
  execution_invoice_file_delete: "Removeu arquivo da nota fiscal",
  execution_payment_file_upload: "Anexou comprovante de pagamento",
  execution_payment_file_update: "Alterou comprovante de pagamento",
  execution_payment_file_delete: "Removeu comprovante de pagamento",
  execution_permission_grant: "Concedeu permissão de execução",
  execution_permission_revoke: "Revogou permissão de execução",
  execution_permission_update: "Alterou permissão de execução",
  execution_schedule_insert: "Criou agendamento da execução",
  execution_schedule_update: "Alterou agendamento da execução",
  execution_schedule_delete: "Excluiu agendamento da execução",
  execution_permission_insert: "Concedeu permissão de execução",
  execution_permission_delete: "Removeu permissão de execução",
  supplier_payment_request_insert: "Criou solicitação de pagamento do fornecedor",
  supplier_payment_request_update: "Alterou solicitação de pagamento do fornecedor",
  supplier_payment_request_delete: "Excluiu solicitação de pagamento do fornecedor",
  supplier_payment_file_insert: "Anexou arquivo à solicitação do fornecedor",
  supplier_payment_file_update: "Alterou arquivo da solicitação do fornecedor",
  supplier_payment_file_delete: "Excluiu arquivo da solicitação do fornecedor",
  supplier_link_insert: "Criou vínculo de fornecedor",
  supplier_link_update: "Alterou vínculo de fornecedor",
  supplier_link_delete: "Excluiu vínculo de fornecedor",
};

const CRITICAL = new Set([
  "process_delete","user_delete","user_role_change","numbering_delete","calendar_event_delete",
  "additive_delete","contractor_delete","contract_balance_movement_delete","protocol_delete",
  "normative_act_delete","file_delete","user_denial"
]);
const ATTENTION = new Set([
  "process_update","process_status_change","user_update","numbering_edit","calendar_event_update",
  "additive_update","contractor_update","protocol_update","normative_act_update","password_temp_generate"
]);

function severity(action = "") {
  if (CRITICAL.has(action) || action.endsWith("_delete")) return "critical";
  if (ATTENTION.has(action) || action.endsWith("_update")) return "attention";
  return "normal";
}

function fmtDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function jsonText(value: unknown) {
  if (!value) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [tenant, setTenant] = useState("all");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("all");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [level, setLevel] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams();
      if (tenant !== "all") qs.set("tenant", tenant);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      qs.set("limit", "4000");
      const jwt = await account.createJWT();
      const response = await fetch(`/api/audit?${qs}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt.jwt}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha ao carregar auditoria.");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSystems(Array.isArray(data.systems) ? data.systems : []);
      if (!data.ok && data.systems?.length) {
        setError(data.systems.map((s: any) => s.error).filter(Boolean).join(" | "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a auditoria.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [tenant, from, to]);

  const users = useMemo(() => Array.from(new Map(rows.filter(r => r.user_email).map(r => [r.user_email!, r.user_name || r.user_email!])).entries()), [rows]);
  const modules = useMemo(() => Array.from(new Set(rows.map(r => r.module).filter(Boolean) as string[])).sort(), [rows]);
  const actions = useMemo(() => Array.from(new Set(rows.map(r => r.action_type).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (user !== "all" && r.user_email !== user) return false;
    if (module !== "all" && r.module !== module) return false;
    if (action !== "all" && r.action_type !== action) return false;
    if (level !== "all" && severity(r.action_type) !== level) return false;
    if (search) {
      const hay = [r.user_name,r.user_email,r.user_role,r.module,r.description,r.process_number,r.entity_id,ACTION_LABELS[r.action_type || ""]]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [rows,user,module,action,level,search]);

  const stats = useMemo(() => ({
    total: filtered.length,
    rg: filtered.filter(r => r.tenant === "rg").length,
    bg: filtered.filter(r => r.tenant === "bg").length,
    critical: filtered.filter(r => severity(r.action_type) === "critical").length,
    users: new Set(filtered.map(r => r.user_email).filter(Boolean)).size,
  }), [filtered]);

  const exportCsv = () => {
    const headers = ["Data/Hora","Órgão","Usuário","E-mail","Cargo","Módulo","Ação","Criticidade","Processo","Descrição","Antes","Depois","Dispositivo"];
    const data = filtered.map(r => [
      fmtDate(r.created_at),r.tenant_label,r.user_name,r.user_email,r.user_role,r.module,
      ACTION_LABELS[r.action_type || ""] || r.action_type,severity(r.action_type),r.process_number,
      r.description,jsonText(r.before_data),jsonText(r.after_data),r.user_agent
    ]);
    const csv = "\uFEFF" + [headers,...data].map(line => line.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `auditoria-gestao-licita-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    const lines = filtered.slice(0, 1000).map(r => `<tr><td>${fmtDate(r.created_at)}</td><td>${r.tenant.toUpperCase()}</td><td>${r.user_name || "—"}</td><td>${r.module || "—"}</td><td>${ACTION_LABELS[r.action_type || ""] || r.action_type || "—"}</td><td>${r.process_number || "—"}</td><td>${r.description || "—"}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><title>Relatório de Auditoria</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}h1{font-size:22px;margin:0}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:10px}th,td{border:1px solid #dbe2ea;padding:6px;text-align:left;vertical-align:top}th{background:#071d35;color:white}.meta{display:flex;gap:24px;margin-top:14px;font-size:12px}.logo{font-weight:900;color:#071d35}.small{font-size:10px;color:#64748b;margin-top:20px}@media print{body{padding:0}}</style></head><body><div class="logo">MW TECH Control</div><h1>Relatório de Auditoria — Gestão Licita</h1><p>Ribeiro Gonçalves e Baixa Grande do Ribeiro</p><div class="meta"><b>Registros: ${filtered.length}</b><span>Período: ${from || "início"} até ${to || "hoje"}</span><span>Gerado em: ${new Date().toLocaleString("pt-BR")}</span></div><table><thead><tr><th>Data/Hora</th><th>Órgão</th><th>Usuário</th><th>Módulo</th><th>Ação</th><th>Processo</th><th>Descrição</th></tr></thead><tbody>${lines}</tbody></table><div class="small">Relatório administrativo gerado pelo MW TECH Control. Exibindo até 1.000 eventos nesta versão de impressão.</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const inputClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400";

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b57b19]"><ShieldCheck size={16}/> Controle e rastreabilidade</div>
        <h1 className="text-3xl font-black tracking-tight text-[#07182d]">Auditoria — Gestão Licita</h1>
        <p className="mt-1 text-sm text-slate-500">Visão centralizada das atividades de Ribeiro Gonçalves e Baixa Grande do Ribeiro.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Atualizar</button>
        <button onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm disabled:opacity-50"><Download size={16}/>CSV/Excel</button>
        <button onClick={printReport} disabled={!filtered.length} className="flex items-center gap-2 rounded-xl bg-[#082743] px-4 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-50"><FileDown size={16}/>Relatório PDF</button>
      </div>
    </div>

    {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"><AlertTriangle size={16} className="mr-2 inline"/>{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        ["Eventos no filtro", stats.total, Activity],
        ["Ribeiro Gonçalves", stats.rg, Building2],
        ["Baixa Grande", stats.bg, Building2],
        ["Usuários", stats.users, UserRound],
        ["Ações críticas", stats.critical, AlertTriangle],
      ].map(([label,value,Icon]: any) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-[#07182d]">{value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-slate-50 text-[#0a3155]"><Icon size={20}/></span></div>
      </div>)}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#07182d]"><Filter size={17}/>Filtros de auditoria</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative xl:col-span-2"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Usuário, processo, ação ou descrição..." className={inputClass+" w-full pl-9"}/></div>
        <select value={tenant} onChange={e=>setTenant(e.target.value)} className={inputClass}><option value="all">Todos os órgãos</option><option value="rg">Ribeiro Gonçalves</option><option value="bg">Baixa Grande do Ribeiro</option></select>
        <select value={level} onChange={e=>setLevel(e.target.value)} className={inputClass}><option value="all">Toda criticidade</option><option value="critical">Crítica</option><option value="attention">Atenção</option><option value="normal">Normal</option></select>
        <select value={user} onChange={e=>setUser(e.target.value)} className={inputClass}><option value="all">Todos os usuários</option>{users.map(([email,name])=><option key={email} value={email}>{name}</option>)}</select>
        <select value={module} onChange={e=>setModule(e.target.value)} className={inputClass}><option value="all">Todos os módulos</option>{modules.map(m=><option key={m}>{m}</option>)}</select>
        <select value={action} onChange={e=>setAction(e.target.value)} className={inputClass}><option value="all">Todas as ações</option>{actions.map(a=><option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><label className="relative"><CalendarDays size={15} className="absolute left-3 top-3 text-slate-400"/><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={inputClass+" w-full pl-9"}/></label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className={inputClass+" w-full"}/></div>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><b className="text-sm text-[#07182d]">Linha do tempo de auditoria</b><p className="text-xs text-slate-500">{filtered.length} evento(s) encontrado(s)</p></div><Database size={18} className="text-slate-400"/></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data/Hora</th><th className="px-4 py-3">Órgão</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Processo</th><th className="px-4 py-3">Criticidade</th><th className="px-4 py-3 text-center">Detalhes</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="px-4 py-16 text-center text-sm font-semibold text-slate-500">Carregando auditoria...</td></tr> :
            filtered.length === 0 ? <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">Nenhum evento encontrado.</td></tr> :
            filtered.slice(0,1000).map((r,i) => {
              const sev=severity(r.action_type);
              return <tr key={r.id || `${r.tenant}-${r.created_at}-${i}`} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                <td className="px-4 py-3"><span className={"rounded-lg px-2 py-1 font-black "+(r.tenant==="rg"?"bg-blue-50 text-blue-700":"bg-emerald-50 text-emerald-700")}>{r.tenant.toUpperCase()}</span></td>
                <td className="px-4 py-3"><b className="block text-slate-800">{r.user_name || "Usuário"}</b><span className="text-[10px] text-slate-400">{r.user_email || ""}</span></td>
                <td className="px-4 py-3 font-semibold text-slate-600">{r.module || "—"}</td>
                <td className="max-w-[260px] px-4 py-3"><b className="block text-slate-700">{ACTION_LABELS[r.action_type || ""] || r.action_type || "—"}</b><span className="line-clamp-1 text-[10px] text-slate-400">{r.description || ""}</span></td>
                <td className="px-4 py-3 font-mono font-bold text-slate-600">{r.process_number || "—"}</td>
                <td className="px-4 py-3"><span className={"rounded-full px-2.5 py-1 text-[10px] font-black uppercase "+(sev==="critical"?"bg-rose-50 text-rose-700":sev==="attention"?"bg-amber-50 text-amber-700":"bg-slate-100 text-slate-600")}>{sev==="critical"?"Crítica":sev==="attention"?"Atenção":"Normal"}</span></td>
                <td className="px-4 py-3 text-center"><button onClick={()=>setSelected(r)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-black text-blue-700 hover:bg-blue-50"><Eye size={14}/>Ver</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > 1000 && <div className="border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-500">Exibindo os 1.000 registros mais recentes do filtro. Use período e filtros para refinar.</div>}
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      {systems.map(s => <div key={s.tenant} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><b className="text-sm text-[#07182d]">{s.label}</b><p className="text-xs text-slate-500">Fonte de auditoria · Gestão Licita {String(s.tenant).toUpperCase()}</p></div><span className={"size-3 rounded-full "+(s.configured&&!s.error?"bg-emerald-500":"bg-amber-500")}/></div></div>)}
    </div>

    {selected && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/65 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><div><div className="text-xs font-black uppercase tracking-wider text-[#b57b19]">{selected.tenant_label}</div><h2 className="text-xl font-black text-[#07182d]">{ACTION_LABELS[selected.action_type || ""] || selected.action_type}</h2></div><button onClick={()=>setSelected(null)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={20}/></button></div>
        <div className="grid gap-5 p-6 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4"><b className="text-sm text-[#07182d]">Identificação</b>{[["Data/Hora",fmtDate(selected.created_at)],["Usuário",selected.user_name],["E-mail",selected.user_email],["Cargo",selected.user_role],["Módulo",selected.module],["Processo",selected.process_number],["Entidade",selected.entity_id]].map(([k,v])=><div key={k} className="flex justify-between gap-4 border-t border-slate-100 pt-2 text-xs"><span className="font-bold text-slate-400">{k}</span><span className="text-right font-semibold text-slate-700">{v || "—"}</span></div>)}</div>
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4"><b className="text-sm text-[#07182d]">Descrição</b><p className="text-sm leading-6 text-slate-600">{selected.description || "Sem descrição adicional."}</p><div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">{selected.user_agent || "Dispositivo não informado"}{selected.ip_address ? ` · IP ${selected.ip_address}` : ""}</div></div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4"><div className="mb-3 flex items-center gap-2 font-black text-rose-800"><FileText size={16}/>Antes</div><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{jsonText(selected.before_data) || "Sem dados anteriores registrados."}</pre></div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><div className="mb-3 flex items-center gap-2 font-black text-emerald-800"><FileText size={16}/>Depois</div><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{jsonText(selected.after_data) || "Sem dados posteriores registrados."}</pre></div>
        </div>
      </div>
    </div>}
  </div>;
}
