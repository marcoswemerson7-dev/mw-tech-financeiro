import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Headphones,
  Landmark,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  UserRound,
  XCircle,
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
  novo: "border-blue-200 bg-blue-50 text-blue-700",
  em_atendimento: "border-amber-200 bg-amber-50 text-amber-700",
  aguardando_usuario: "border-violet-200 bg-violet-50 text-violet-700",
  resolvido: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fechado: "border-slate-200 bg-slate-100 text-slate-600",
};

type OrgConfig = {
  key: string;
  name: string;
  shortName: string;
  badge: string;
  dot: string;
};

const orgRegistry: Record<string, OrgConfig> = {
  rg: {
    key: "rg",
    name: "Prefeitura Municipal de Ribeiro Gonçalves – PI",
    shortName: "Ribeiro Gonçalves",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  bg: {
    key: "bg",
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro – PI",
    shortName: "Baixa Grande do Ribeiro",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  bgr: {
    key: "bg",
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro – PI",
    shortName: "Baixa Grande do Ribeiro",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

function normalizeTenant(value?: string) {
  return String(value || "orgao")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getOrg(tenantKey?: string): OrgConfig {
  const key = normalizeTenant(tenantKey);
  if (orgRegistry[key]) return orgRegistry[key];
  if (key.includes("baixa") && key.includes("ribeiro")) return orgRegistry.bg;
  if (key.includes("ribeiro") && key.includes("goncalves")) return orgRegistry.rg;
  const label = String(tenantKey || "Órgão não identificado").replace(/[_-]+/g, " ").trim();
  return {
    key,
    name: label || "Órgão não identificado",
    shortName: label || "Órgão",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  };
}

function fmt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortFmt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name?: string | null) {
  return String(name || "Usuário")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "US";
}

export default function SupportCenter() {
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState("todos");
  const [orgFilter, setOrgFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const detailCacheRef = useRef(new Map<string, SupportMessage[]>());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await supportService.list("todos");
      setTickets(data.tickets);
      setError("");
      if (selected) {
        const fresh = data.tickets.find((ticket) => ticket.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar chamados");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDetail = async (ticket: SupportTicket, silent = false) => {
    if (!silent) {
      const cached = detailCacheRef.current.get(ticket.id);
      setMessages(cached || []);
      setDetailLoading(!cached);
    }

    try {
      const data = await supportService.detail(ticket.id);
      detailCacheRef.current.set(ticket.id, data.messages);
      if (selectedIdRef.current === ticket.id) {
        setSelected(data.ticket);
        setMessages(data.messages);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar conversa");
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  useEffect(() => { void loadTickets(); }, []);

  useEffect(() => {
    selectedIdRef.current = selected?.id || null;
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const id = window.setInterval(() => void loadDetail(selected, true), 5000);
    return () => window.clearInterval(id);
  }, [selected?.id]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ tickets?: SupportTicket[] }>).detail;
      if (!detail?.tickets) return;
      setTickets(detail.tickets);
      if (selected) {
        const fresh = detail.tickets.find((ticket) => ticket.id === selected.id);
        if (fresh) {
          const changed = String(fresh.last_message_at || "") !== String(selected.last_message_at || "");
          setSelected(fresh);
          if (changed && fresh.last_message_is_staff === false) void loadDetail(fresh, true);
        }
      }
    };

    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<{ ticket?: SupportTicket }>).detail;
      if (detail?.ticket?.id && detail.ticket.id === selected?.id) {
        void loadDetail(detail.ticket, true);
      }
    };

    window.addEventListener("mw-support-updated", onUpdated);
    window.addEventListener("mw-support-notification", onNotification);
    return () => {
      window.removeEventListener("mw-support-updated", onUpdated);
      window.removeEventListener("mw-support-notification", onNotification);
    };
  }, [selected?.id, selected?.last_message_at]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selected?.id]);

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (!ticketId || selected?.id === ticketId) return;
    const match = tickets.find((ticket) => ticket.id === ticketId);
    if (match) openTicket(match);
  }, [tickets, searchParams, selected?.id]);

  const openTicket = (ticket: SupportTicket) => {
    if (selected?.id === ticket.id) return;
    selectedIdRef.current = ticket.id;
    setSelected(ticket);
    setError("");
    const cached = detailCacheRef.current.get(ticket.id);
    setMessages(cached || []);
    setDetailLoading(!cached);
    void loadDetail(ticket, Boolean(cached));
  };

  const organizations = useMemo(() => {
    const map = new Map<string, OrgConfig>();
    tickets.forEach((ticket) => {
      const org = getOrg(ticket.tenant_key);
      if (!map.has(org.key)) map.set(org.key, org);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tickets]);

  const counts = useMemo(() => ({
    novo: tickets.filter((ticket) => ticket.status === "novo").length,
    em_atendimento: tickets.filter((ticket) => ["em_atendimento", "aguardando_usuario"].includes(ticket.status)).length,
    encerrados: tickets.filter((ticket) => ["resolvido", "fechado"].includes(ticket.status)).length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter === "novo" && ticket.status !== "novo") return false;
      if (filter === "em_atendimento" && !["em_atendimento", "aguardando_usuario"].includes(ticket.status)) return false;
      if (filter === "encerrados" && !["resolvido", "fechado"].includes(ticket.status)) return false;
      if (filter === "todos" && ["resolvido", "fechado"].includes(ticket.status)) return false;
      const org = getOrg(ticket.tenant_key);
      if (orgFilter !== "todos" && org.key !== orgFilter) return false;
      if (!q) return true;
      return [ticket.ticket_number, ticket.subject, ticket.requester_name, ticket.requester_email, org.name, org.shortName]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [tickets, filter, orgFilter, query]);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => file.size <= 10 * 1024 * 1024);
    if (valid.length !== incoming.length) setError("Cada anexo pode ter no máximo 10 MB.");
    setFiles((current) => [...current, ...valid].slice(0, 5));
  };

  const send = async () => {
    if (!selected || (!text.trim() && files.length === 0) || sending) return;

    const body = text.trim() || (files.length ? "Anexo enviado" : "");
    const tempId = `temp-${Date.now()}`;
    const optimistic: SupportMessage = {
      id: tempId,
      ticket_id: selected.id,
      sender_id: "mw-tech",
      body,
      is_staff: true,
      created_at: new Date().toISOString(),
      attachments: files.map((file, index) => ({
        path: `local-${index}`,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size,
      })),
    };

    const pendingFiles = files;
    setMessages((current) => [...current, optimistic]);
    setText("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(true);
    setError("");

    try {
      await supportService.sendMessage(selected.id, body, pendingFiles);
      await Promise.all([loadDetail(selected, true), loadTickets(true)]);
    } catch (e) {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      setText(body === "Anexo enviado" ? "" : body);
      setFiles(pendingFiles);
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
    if (!window.confirm("Encerrar este atendimento e marcar o chamado como resolvido?")) return;
    setClosing(true);
    try {
      await supportService.updateStatus(selected.id, "resolvido");
      await loadDetail(selected, true);
      await loadTickets(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao encerrar atendimento");
    } finally {
      setClosing(false);
    }
  };

  const selectedOrg = selected ? getOrg(selected.tenant_key) : null;
  const isFinished = selected ? ["resolvido", "fechado"].includes(selected.status) : false;

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 text-slate-900">
      <section className="flex flex-col gap-4 rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[0_12px_34px_rgba(7,24,45,0.05)] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#082743] text-[#f0b83f] shadow-sm sm:size-16"><Headphones size={30} /></div>
          <div>
            <h1 className="text-[28px] font-black leading-tight tracking-[-0.03em] text-[#07182d] sm:text-[34px] xl:text-[38px]">Central de Suporte</h1>
            <p className="mt-1 text-[14px] font-medium text-slate-500 sm:text-[15px]">Atendimento técnico e operacional dos sistemas atendidos.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-5 py-3 text-right">
          <p className="text-[13px] font-black text-[#8c681d]">MW TECH</p>
          <p className="text-[12px] text-slate-500">Sistemas e Soluções Digitais</p>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] font-semibold text-rose-700">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="grid min-h-[760px] grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(480px,1fr)_280px] 2xl:grid-cols-[390px_minmax(620px,1fr)_320px]">
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-black text-[#07182d] sm:text-[20px]">Chamados</h2>
              <button onClick={() => void loadTickets()} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50" title="Atualizar chamados"><RefreshCw size={16} /></button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar chamado, assunto ou solicitante..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#d6a33a] focus:ring-4 focus:ring-[#d6a33a]/10"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1.5">
              {[
                ["novo", `Novo ${counts.novo}`],
                ["em_atendimento", `Em atendimento ${counts.em_atendimento}`],
                ["encerrados", `Encerrados ${counts.encerrados}`],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} className={`min-h-10 rounded-lg px-2 py-2 text-[12px] font-bold transition sm:text-[13px] ${filter === key ? "bg-[#082743] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{label}</button>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Filtrar por órgão</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setOrgFilter("todos")} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[12px] font-bold ${orgFilter === "todos" ? "border-[#082743] bg-[#082743] text-white" : "border-slate-200 bg-white text-slate-600"}`}>Todos</button>
                {organizations.map((org) => (
                  <button key={org.key} onClick={() => setOrgFilter(org.key)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[12px] font-bold ${orgFilter === org.key ? org.badge : "border-slate-200 bg-white text-slate-600"}`}>
                    <span className={`mr-1.5 inline-block size-2 rounded-full ${org.dot}`} />{org.key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[590px] overflow-y-auto bg-white p-3 sm:p-4">
            {loading ? (
              <div className="grid min-h-[280px] place-items-center text-[14px] text-slate-400">Carregando chamados...</div>
            ) : filtered.length === 0 ? (
              <div className="grid min-h-[280px] place-items-center px-6 text-center">
                <div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquare size={22} /></div><p className="mt-3 text-[14px] font-bold text-slate-500">Nenhum chamado encontrado.</p></div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((ticket) => {
                  const org = getOrg(ticket.tenant_key);
                  const active = selected?.id === ticket.id;
                  return (
                    <button key={ticket.id} onClick={() => openTicket(ticket)} className={`w-full rounded-2xl border p-4 text-left transition sm:p-5 ${active ? "border-[#e1b04b] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.07)]" : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-[16px] font-black text-[#07182d]">#{String(ticket.ticket_number).padStart(4, "0")}</b>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass[ticket.status] || statusClass.fechado}`}>{statusLabels[ticket.status] || ticket.status}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[16px] font-black leading-5 text-slate-800 sm:text-[17px]">{ticket.subject}</p>
                      <div className="mt-2 flex items-center gap-2 text-[13px] font-medium text-slate-500"><UserRound size={14} /><span className="truncate">{ticket.requester_name || ticket.requester_email || "Usuário"}</span></div>
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-500"><Landmark size={13} className="shrink-0" /><span className="truncate">{org.name}</span></div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`inline-flex min-w-0 items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-[11px] font-bold ${org.badge}`}><span className={`size-1.5 shrink-0 rounded-full ${org.dot}`} />{org.shortName}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400">{shortFmt(ticket.last_message_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <section className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          {!selected ? (
            <div className="grid h-full min-h-[760px] place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid size-20 place-items-center rounded-[24px] bg-[#07182d] text-[#f4c45a]"><Headphones size={34} /></div>
                <h3 className="mt-6 text-[24px] font-black text-[#07182d]">Selecione um chamado</h3>
                <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-slate-500">Escolha um atendimento à esquerda para visualizar a conversa, responder e acompanhar o status.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[760px] flex-col">
              <div className="border-b border-slate-100 bg-white px-5 py-5 sm:px-6" style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-[20px] font-black text-[#07182d] sm:text-[22px]">#{String(selected.ticket_number).padStart(4, "0")}</h3>
                      <span className={`rounded-full border px-3 py-1 text-[12px] font-bold ${statusClass[selected.status] || statusClass.fechado}`}>{statusLabels[selected.status] || selected.status}</span>
                    </div>
                    <h2 className="mt-2 truncate text-[24px] font-black tracking-[-0.02em] text-[#07182d] sm:text-[28px]">{selected.subject}</h2>
                    <div className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-slate-600"><Landmark size={16} /><span className="truncate">{selectedOrg?.name || selected.tenant_key}</span></div>
                    <p className="mt-2 text-[12px] text-slate-400">Aberto por {selected.requester_name || selected.requester_email || "Usuário"} em {fmt(selected.created_at)}</p>
                  </div>
                  <button onClick={() => void loadDetail(selected, true)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" title="Atualizar conversa"><RefreshCw size={16} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#fbfcfe] px-4 py-5 sm:px-6 sm:py-6">
                <div className="mb-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />Conversa<span className="h-px flex-1 bg-slate-200" /></div>
                {detailLoading && messages.length === 0 ? (
                  <div className="grid min-h-[360px] place-items-center">
                    <div className="flex items-center gap-3 text-[14px] font-semibold text-slate-500">
                      <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#082743]" />
                      Carregando conversa...
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="grid min-h-[360px] place-items-center text-[14px] text-slate-400">Nenhuma mensagem neste chamado.</div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((message) => {
                      const staff = message.is_staff;
                      return (
                        <div key={message.id} className={`flex items-end gap-2 ${staff ? "justify-end" : "justify-start"}`}>
                          {!staff && <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0a3158] text-[12px] font-black text-white">{initials(selected.requester_name)}</div>}
                          <div className={`max-w-[82%] ${staff ? "text-right" : "text-left"}`}>
                            <div className={`mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-500 ${staff ? "justify-end" : "justify-start"}`}><span>{staff ? "MW TECH" : selected.requester_name || "Usuário"}</span><span>•</span><span>{fmt(message.created_at)}</span></div>
                            <div className={`rounded-2xl px-4 py-3.5 shadow-sm ${staff ? "rounded-br-md bg-[#dbeafe] text-[#153b64]" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
                              <p className="whitespace-pre-wrap text-[15px] font-medium leading-6 sm:text-[16px]">{message.body}</p>
                              {!!message.attachments?.length && (
                                <div className="mt-3 space-y-2">
                                  {message.attachments.map((attachment, index) => (
                                    <a
                                      key={`${attachment.path || attachment.name}-${index}`}
                                      href={attachment.url || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`block overflow-hidden rounded-xl border p-2 text-left text-[12px] font-semibold ${staff ? "border-blue-200 bg-white/70 text-[#153b64]" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                                    >
                                      {attachment.mime_type?.startsWith("image/") && attachment.url ? (
                                        <img src={attachment.url} alt={attachment.name} className="mb-2 max-h-56 w-auto rounded-lg object-contain" />
                                      ) : null}
                                      <span className="break-all">📎 {attachment.name}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {staff && <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#07182d] text-[11px] font-black text-[#f0b83f]">MW</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <footer className="border-t border-slate-100 bg-white p-4 sm:p-5">
                {isFinished ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-[14px] font-bold text-emerald-800">Atendimento encerrado.</div>
                ) : (
                  <div>
                    {files.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {files.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700">
                            <span className="truncate">📎 {file.name}</span>
                            <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="text-rose-500">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2 sm:gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        className="hidden"
                        onChange={(event) => addFiles(Array.from(event.target.files || []))}
                      />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="grid size-12 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Adicionar anexo"><Paperclip size={18} /></button>
                      <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onPaste={(event) => {
                          const pasted = Array.from(event.clipboardData?.files || []);
                          if (pasted.length) {
                            event.preventDefault();
                            addFiles(pasted);
                          }
                        }}
                        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                        placeholder="Digite sua mensagem ou cole um print aqui..."
                        rows={2}
                        className="min-h-[62px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] outline-none transition focus:border-[#d6a33a] focus:ring-4 focus:ring-[#d6a33a]/10 sm:text-[15px]"
                      />
                      <button onClick={() => void send()} disabled={(!text.trim() && files.length === 0) || sending} className="flex h-[62px] min-w-[108px] items-center justify-center gap-2 rounded-xl bg-[#082743] px-4 text-[14px] font-bold text-white transition hover:bg-[#0b355d] disabled:opacity-50"><Send size={17} />{sending ? "Enviando" : "Enviar"}</button>
                    </div>
                  </div>
                )}
              </footer>
            </div>
          )}
        </section>

        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)] lg:col-span-2 xl:col-span-1">
          {!selected ? (
            <div className="grid min-h-[280px] place-items-center px-6 text-center text-[14px] text-slate-400 xl:min-h-[760px]">Os detalhes do chamado aparecerão aqui.</div>
          ) : (
            <div className="p-5 sm:p-6">
              <h2 className="text-[18px] font-black text-[#07182d] sm:text-[20px]">Detalhes do chamado</h2>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-[12px] font-semibold text-slate-500">Status</label>
                  <select value={selected.status} onChange={(event) => void changeStatus(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-700 outline-none">
                    <option value="novo">Novo</option><option value="em_atendimento">Em atendimento</option><option value="aguardando_usuario">Aguardando usuário</option><option value="resolvido">Resolvido</option><option value="fechado">Fechado</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[12px] font-semibold text-slate-500">Prioridade</label>
                  <div className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[14px] font-semibold text-slate-700"><span className={`size-2 rounded-full ${String(selected.priority || "baixa").toLowerCase().includes("alta") ? "bg-rose-500" : "bg-emerald-500"}`} />{selected.priority || "Baixa"}</div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[12px] font-semibold text-slate-500">Órgão / Entidade</p>
                  <div className="mt-2 flex items-start gap-2 text-[14px] font-semibold leading-5 text-slate-700"><Building2 size={16} className="mt-0.5 shrink-0 text-[#0a3158]" />{selectedOrg?.name || selected.tenant_key}</div>
                </div>
                <div><p className="text-[12px] font-semibold text-slate-500">Solicitante</p><div className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-slate-700"><UserRound size={16} />{selected.requester_name || selected.requester_email || "Usuário"}</div></div>
                <div><p className="text-[12px] font-semibold text-slate-500">Data de abertura</p><div className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-slate-700"><CalendarDays size={16} />{fmt(selected.created_at)}</div></div>
                <div><p className="text-[12px] font-semibold text-slate-500">Atendente responsável</p><div className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-slate-700"><Headphones size={16} />MW TECH</div></div>

                <div className="border-t border-slate-100 pt-4"><p className="text-[12px] font-semibold text-slate-500">Assunto</p><p className="mt-2 text-[15px] font-black text-slate-800">{selected.subject}</p></div>
                {selected.category && <div><p className="text-[12px] font-semibold text-slate-500">Categoria</p><p className="mt-2 text-[14px] font-semibold text-slate-700">{selected.category}</p></div>}
                {selected.source_path && <div><p className="text-[12px] font-semibold text-slate-500">Origem</p><p className="mt-2 text-[14px] font-semibold text-slate-700">{selected.source_path}</p></div>}

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-[12px] font-black uppercase tracking-[0.12em] text-slate-400">Ações</p>
                  <div className="space-y-2">
                    <button onClick={() => void finishAttendance()} disabled={closing || isFinished} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#082743] px-4 text-[14px] font-bold text-white disabled:opacity-50"><CheckCircle2 size={17} />{closing ? "Resolvendo..." : "Resolver chamado"}</button>
                    <button onClick={() => void changeStatus("aguardando_usuario")} disabled={isFinished} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 disabled:opacity-50">Aguardar retorno</button>
                    <button onClick={() => void changeStatus("fechado")} disabled={isFinished} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-[14px] font-semibold text-rose-600 disabled:opacity-50"><XCircle size={16} />Cancelar chamado</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
