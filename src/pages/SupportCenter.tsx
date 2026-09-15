import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  Clock3,
  FolderOpen,
  Headphones,
  Hourglass,
  Inbox,
  Landmark,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  TimerReset,
  UserRound,
} from "lucide-react";
import { supportService, type SupportMessage, type SupportTicket } from "../services/support";

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const statusClass: Record<string, string> = {
  novo: "border-rose-200 bg-rose-50 text-rose-700",
  em_atendimento: "border-amber-200 bg-amber-50 text-amber-700",
  aguardando_usuario: "border-blue-200 bg-blue-50 text-blue-700",
  resolvido: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fechado: "border-slate-200 bg-slate-100 text-slate-600",
};

type OrgConfig = {
  key: string;
  name: string;
  shortName: string;
  type: "Prefeitura" | "Câmara" | "Órgão";
  badge: string;
  header: string;
  dot: string;
  selected: string;
};

const orgRegistry: Record<string, OrgConfig> = {
  rg: {
    key: "rg",
    name: "Prefeitura Municipal de Ribeiro Gonçalves – PI",
    shortName: "Ribeiro Gonçalves",
    type: "Prefeitura",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    header: "border-blue-100 bg-blue-50/80 text-blue-900",
    dot: "bg-blue-500",
    selected: "border-[#d7a23b] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]",
  },
  bgr: {
    key: "bgr",
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro – PI",
    shortName: "Baixa Grande do Ribeiro",
    type: "Prefeitura",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    header: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
    dot: "bg-emerald-500",
    selected: "border-[#d7a23b] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]",
  },
  bg: {
    key: "bgr",
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro – PI",
    shortName: "Baixa Grande do Ribeiro",
    type: "Prefeitura",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    header: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
    dot: "bg-emerald-500",
    selected: "border-[#d7a23b] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]",
  },
  cmrg: {
    key: "cmrg",
    name: "Câmara Municipal de Ribeiro Gonçalves – PI",
    shortName: "Câmara de Ribeiro Gonçalves",
    type: "Câmara",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    header: "border-violet-100 bg-violet-50/80 text-violet-900",
    dot: "bg-violet-500",
    selected: "border-[#d7a23b] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]",
  },
};

function normalizeTenant(value?: string) {
  return String(value || "orgao")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getOrg(tenantKey?: string): OrgConfig {
  const key = normalizeTenant(tenantKey);
  if (orgRegistry[key]) return orgRegistry[key];
  if (key.includes("baixa") && key.includes("ribeiro")) return orgRegistry.bgr;
  if (key.includes("ribeiro") && key.includes("goncalves") && key.includes("camara")) return orgRegistry.cmrg;
  if (key.includes("ribeiro") && key.includes("goncalves")) return orgRegistry.rg;

  const label = String(tenantKey || "Órgão não identificado").replace(/[_-]+/g, " ").trim();
  return {
    key,
    name: label || "Órgão não identificado",
    shortName: label || "Órgão",
    type: key.includes("camara") ? "Câmara" : key.includes("pref") ? "Prefeitura" : "Órgão",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    header: "border-slate-200 bg-slate-50 text-slate-800",
    dot: "bg-slate-400",
    selected: "border-[#d7a23b] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]",
  };
}

function fmt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export default function SupportCenter() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState("todos");
  const [orgFilter, setOrgFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { tickets } = await supportService.list(filter);
      setTickets(tickets);
      setError("");
      if (selected) {
        const fresh = tickets.find((t) => t.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar chamados");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDetail = async (ticket: SupportTicket, silent = false) => {
    if (!silent) setMessages([]);
    try {
      const data = await supportService.detail(ticket.id);
      setSelected(data.ticket);
      setMessages(data.messages);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar conversa");
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [filter]);

  useEffect(() => {
    const id = window.setInterval(() => void loadTickets(true), 30000);
    return () => window.clearInterval(id);
  }, [filter, selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const id = window.setInterval(() => void loadDetail(selected, true), 7000);
    return () => window.clearInterval(id);
  }, [selected?.id]);

  const organizations = useMemo(() => {
    const map = new Map<string, OrgConfig>();
    tickets.forEach((ticket) => {
      const org = getOrg(ticket.tenant_key);
      if (!map.has(org.key)) map.set(org.key, org);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter === "todos" && ["resolvido", "fechado"].includes(ticket.status)) return false;
      const org = getOrg(ticket.tenant_key);
      if (orgFilter !== "todos" && org.key !== orgFilter) return false;
      if (!q) return true;
      return [ticket.ticket_number, ticket.subject, ticket.requester_name, ticket.requester_email, ticket.tenant_key, org.name, org.shortName, org.type]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [tickets, query, orgFilter, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { org: OrgConfig; tickets: SupportTicket[] }>();
    filtered.forEach((ticket) => {
      const org = getOrg(ticket.tenant_key);
      const current = map.get(org.key) || { org, tickets: [] };
      current.tickets.push(ticket);
      map.set(org.key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.org.name.localeCompare(b.org.name, "pt-BR"));
  }, [filtered]);

  const send = async () => {
    if (!selected || !text.trim() || sending) return;
    setSending(true);
    try {
      await supportService.sendMessage(selected.id, text.trim());
      setText("");
      await loadDetail(selected, true);
      await loadTickets(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!selected) return;
    try {
      await supportService.updateStatus(selected.id, status);
      await loadDetail(selected, true);
      await loadTickets(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar status");
    }
  };

  const finishAttendance = async () => {
    if (!selected || closing) return;
    const confirmed = window.confirm("Encerrar este atendimento e marcar o chamado como resolvido?");
    if (!confirmed) return;

    setClosing(true);
    try {
      await supportService.updateStatus(selected.id, "resolvido");
      setSelected(null);
      setMessages([]);
      setText("");
      await loadTickets(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao encerrar atendimento");
    } finally {
      setClosing(false);
    }
  };

  const reopenAttendance = async () => {
    if (!selected) return;
    try {
      await supportService.updateStatus(selected.id, "em_atendimento");
      await loadDetail(selected, true);
      await loadTickets(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao reabrir chamado");
    }
  };

  const activeTickets = tickets.filter((ticket) => !["resolvido", "fechado"].includes(ticket.status));
  const counts = {
    novo: activeTickets.filter((ticket) => ticket.status === "novo").length,
    em_atendimento: activeTickets.filter((ticket) => ticket.status === "em_atendimento").length,
    aguardando_usuario: activeTickets.filter((ticket) => ticket.status === "aguardando_usuario").length,
    resolvidos_hoje: tickets.filter((ticket) => ticket.status === "resolvido" && isToday(ticket.updated_at)).length,
  };

  const selectedOrg = selected ? getOrg(selected.tenant_key) : null;
  const isFinished = selected ? ["resolvido", "fechado"].includes(selected.status) : false;

  const metricCards = [
    { label: "Novos", value: counts.novo, icon: Inbox, box: "border-rose-100 bg-rose-50/80 text-rose-700", iconBox: "bg-white text-rose-600" },
    { label: "Em atendimento", value: counts.em_atendimento, icon: Clock3, box: "border-amber-100 bg-amber-50/80 text-amber-700", iconBox: "bg-white text-amber-600" },
    { label: "Aguardando", value: counts.aguardando_usuario, icon: Hourglass, box: "border-blue-100 bg-blue-50/80 text-blue-700", iconBox: "bg-white text-blue-600" },
    { label: "Resolvidos hoje", value: counts.resolvidos_hoje, icon: CircleCheckBig, box: "border-emerald-100 bg-emerald-50/80 text-emerald-700", iconBox: "bg-white text-emerald-600" },
  ];

  return (
    <div className="space-y-5 font-sans">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(7,24,45,0.06)]">
        <div className="flex flex-col gap-6 bg-[radial-gradient(circle_at_top_right,_rgba(214,163,58,0.09),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#fbfcfe_100%)] p-6 xl:flex-row xl:items-center xl:justify-between xl:p-7">
          <div className="max-w-xl">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#c98d20]"><Headphones size={17}/> Central MW TECH</div>
            <h2 className="text-[32px] font-black leading-tight tracking-[-0.03em] text-[#07182d]">Central de Suporte</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">Atendimento técnico e operacional dos sistemas atendidos.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metricCards.map(({ label, value, icon: Icon, box, iconBox }) => (
              <div key={label} className={`min-w-[150px] rounded-2xl border px-4 py-3.5 ${box}`}>
                <div className="flex items-center gap-3">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-xl shadow-sm ${iconBox}`}><Icon size={18}/></div>
                  <div>
                    <b className="block text-2xl font-black leading-none">{value}</b>
                    <span className="mt-1 block text-[11px] font-bold">{label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle size={17}/>{error}
        </div>
      )}

      <div className="grid min-h-[650px] gap-5 xl:grid-cols-[410px_1fr]">
        <aside className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(7,24,45,0.05)]">
          <div className="border-b border-slate-100 p-4.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17}/>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar chamado, usuário ou organização..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f8fafc] pl-10 pr-3 text-sm font-medium outline-none transition focus:border-[#d6a33a] focus:bg-white focus:ring-4 focus:ring-[#d6a33a]/10"
              />
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {["todos", "novo", "em_atendimento", "aguardando_usuario", "resolvido"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-extrabold transition ${filter === status ? "bg-[#07182d] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"}`}
                >
                  {status === "todos" ? "Ativos" : statusLabels[status]}
                </button>
              ))}
            </div>

            {organizations.length > 1 && (
              <div className="mt-4 border-t border-slate-100 pt-3.5">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Filtrar por órgão</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button onClick={() => setOrgFilter("todos")} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-extrabold ${orgFilter === "todos" ? "border-[#07182d] bg-[#07182d] text-white" : "border-slate-200 bg-white text-slate-600"}`}>Todos</button>
                  {organizations.map((org) => (
                    <button key={org.key} onClick={() => setOrgFilter(org.key)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-extrabold ${orgFilter === org.key ? org.badge : "border-slate-200 bg-white text-slate-600"}`}>
                      <span className={`mr-1.5 inline-block size-2 rounded-full ${org.dot}`}/>{org.shortName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[570px] overflow-y-auto p-3">
            {loading ? (
              <div className="grid min-h-[300px] place-items-center text-sm font-medium text-slate-400">Carregando chamados...</div>
            ) : grouped.length === 0 ? (
              <div className="grid min-h-[300px] place-items-center px-6 text-center">
                <div>
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquare size={22}/></div>
                  <p className="mt-3 text-sm font-bold text-slate-500">Nenhum chamado encontrado.</p>
                </div>
              </div>
            ) : grouped.map(({ org, tickets: orgTickets }) => (
              <div key={org.key} className="mb-5 last:mb-0">
                <div className={`mb-2 rounded-2xl border px-3.5 py-3 ${org.header}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"><Landmark size={15}/></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{org.type}</p>
                      <p className="truncate text-[11px] font-extrabold">{org.name}</p>
                    </div>
                    <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-black shadow-sm">{orgTickets.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {orgTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => void loadDetail(ticket)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${selected?.id === ticket.id ? org.selected : "border-slate-100 bg-white hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_8px_24px_rgba(7,24,45,0.06)]"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-sm font-black text-[#07182d]">#{String(ticket.ticket_number).padStart(4, "0")}</b>
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClass[ticket.status] || statusClass.fechado}`}>{statusLabels[ticket.status] || ticket.status}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-extrabold text-slate-800">{ticket.subject}</p>
                      <p className="mt-2 truncate text-xs font-medium text-slate-500">{ticket.requester_name || ticket.requester_email || "Usuário"}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                        <span className={`inline-flex max-w-[65%] items-center gap-1.5 truncate rounded-full border px-2 py-1 font-bold ${org.badge}`}><span className={`size-1.5 shrink-0 rounded-full ${org.dot}`}/>{org.shortName}</span>
                        <span className="font-semibold">{fmt(ticket.last_message_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(7,24,45,0.05)]">
          {!selected ? (
            <div className="grid h-full min-h-[650px] place-items-center bg-[radial-gradient(circle_at_center,_rgba(214,163,58,0.06),_transparent_40%)] p-8 text-center">
              <div>
                <div className="mx-auto grid size-20 place-items-center rounded-[24px] bg-[#07182d] text-[#f4c45a] shadow-[0_14px_32px_rgba(7,24,45,0.16)]"><Headphones size={34}/></div>
                <h3 className="mt-6 text-2xl font-black tracking-[-0.02em] text-[#07182d]">Selecione um chamado</h3>
                <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">Escolha um atendimento na coluna ao lado para visualizar a conversa, responder e gerenciar o status.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[650px] flex-col">
              <header className="border-b border-slate-100 bg-white p-5 xl:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    {selectedOrg && (
                      <div className={`mb-3 inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 ${selectedOrg.badge}`}>
                        <Landmark size={15}/>
                        <span className="min-w-0">
                          <b className="block text-[9px] uppercase tracking-[0.12em]">{selectedOrg.type}</b>
                          <span className="block truncate text-[11px] font-extrabold">{selectedOrg.name}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-[22px] font-black tracking-[-0.02em] text-[#07182d]">#{String(selected.ticket_number).padStart(4, "0")} — {selected.subject}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass[selected.status] || statusClass.fechado}`}>{statusLabels[selected.status] || selected.status}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1.5"><Building2 size={14}/>{selectedOrg?.shortName || selected.tenant_key?.toUpperCase()}</span>
                      <span className="flex items-center gap-1.5"><UserRound size={14}/>{selected.requester_name || selected.requester_email || "Usuário"}</span>
                      <span className="flex items-center gap-1.5"><CalendarDays size={14}/>{fmt(selected.created_at)}</span>
                      {selected.source_path && <span className="flex items-center gap-1.5"><FolderOpen size={14}/>Origem: {selected.source_path}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <select value={selected.status} onChange={(event) => void changeStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#d6a33a]">
                      <option value="novo">Novo</option>
                      <option value="em_atendimento">Em atendimento</option>
                      <option value="aguardando_usuario">Aguardando usuário</option>
                      <option value="resolvido">Resolvido</option>
                      <option value="fechado">Fechado</option>
                    </select>

                    {!isFinished ? (
                      <button onClick={() => void finishAttendance()} disabled={closing} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#07182d] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#0a3158] disabled:opacity-60" title="Encerrar atendimento e marcar como resolvido">
                        <CheckCircle2 size={16}/>{closing ? "Encerrando..." : "Encerrar atendimento"}
                      </button>
                    ) : (
                      <button onClick={() => void reopenAttendance()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                        <TimerReset size={16}/> Reabrir chamado
                      </button>
                    )}

                    <button onClick={() => void loadDetail(selected, true)} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700" title="Atualizar"><RefreshCw size={16}/></button>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-5 xl:p-6">
                <div className="mb-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><span className="h-px flex-1 bg-slate-200"/>Conversa<span className="h-px flex-1 bg-slate-200"/></div>

                {messages.length === 0 ? (
                  <div className="grid min-h-[340px] place-items-center text-sm font-medium text-slate-400">Nenhuma mensagem neste chamado.</div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.is_staff ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] ${message.is_staff ? "text-right" : "text-left"}`}>
                          <div className={`mb-1.5 flex items-center gap-2 text-[10px] font-bold ${message.is_staff ? "justify-end text-slate-500" : "text-slate-500"}`}>
                            <span>{message.is_staff ? "MW TECH" : selected.requester_name || "Usuário"}</span>
                            <span>•</span>
                            <span>{fmt(message.created_at)}</span>
                          </div>
                          <div className={`rounded-2xl px-4 py-3.5 shadow-sm ${message.is_staff ? "rounded-br-md bg-[#0a3158] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
                            <p className="whitespace-pre-wrap text-sm font-medium leading-6">{message.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-100 bg-white p-4 xl:p-5">
                {isFinished ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><CircleCheckBig size={19}/></div>
                      <div>
                        <p className="text-sm font-black text-emerald-800">Atendimento encerrado</p>
                        <p className="mt-0.5 text-xs font-medium text-emerald-700">Este chamado está {statusLabels[selected.status]?.toLowerCase()}. Você pode reabri-lo quando necessário.</p>
                      </div>
                    </div>
                    <button onClick={() => void reopenAttendance()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"><RefreshCw size={15}/> Reabrir chamado</button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                          }
                        }}
                        placeholder="Digite sua resposta ao cliente..."
                        rows={2}
                        className="min-h-[62px] flex-1 resize-none rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm font-medium outline-none transition focus:border-[#d6a33a] focus:bg-white focus:ring-4 focus:ring-[#d6a33a]/10"
                      />
                      <button onClick={() => void send()} disabled={!text.trim() || sending} className="flex min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-[#07182d] px-5 text-sm font-black text-white shadow-[0_10px_22px_rgba(7,24,45,0.18)] transition hover:bg-[#0a3158] disabled:cursor-not-allowed disabled:opacity-50"><Send size={17}/>{sending ? "Enviando..." : "Enviar resposta"}</button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-slate-400">
                      <span>Enter para enviar • Shift + Enter para nova linha</span>
                      <span>Conversa atualizada apenas enquanto esta tela estiver aberta.</span>
                    </div>
                  </>
                )}
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
