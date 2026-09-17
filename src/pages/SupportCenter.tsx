import { useEffect, useMemo, useState } from "react";
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

export default function SupportCenter() {
  const [searchParams] = useSearchParams();
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
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void loadTickets(true), 10000);
    return () => window.clearInterval(id);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const id = window.setInterval(() => void loadDetail(selected, true), 5000);
    return () => window.clearInterval(id);
  }, [selected?.id]);

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (!ticketId || selected?.id === ticketId) return;
    const match = tickets.find((ticket) => ticket.id === ticketId);
    if (match) void loadDetail(match);
  }, [tickets, searchParams, selected?.id]);

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
    <div className="mx-auto w-full max-w-[1700px] space-y-4">
      <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_35px_rgba(7,24,45,0.05)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#082743] text-[#f0b83f]"><Headphones size={28} /></div>
          <div>
            <h1 className="text-2xl font-black tracking-[-0.02em] text-[#07182d]">Central de Suporte</h1>
            <p className="mt-1 text-sm text-slate-500">Atendimento técnico e operacional dos sistemas atendidos.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-3 text-right">
          <p className="text-xs font-black text-[#8c681d]">MW TECH</p>
          <p className="text-[11px] text-slate-500">Sistemas e Soluções Digitais</p>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle size={17} /> {error}
        </div>
      )}

      <div className="grid min-h-[735px] gap-4 xl:grid-cols-[350px_minmax(0,1fr)_300px]">
        <aside className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-[#07182d]">Chamados</h2>
              <button onClick={() => void loadTickets()} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50" title="Atualizar chamados"><RefreshCw size={15} /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar chamado, assunto ou solicitante..." className="h-11 w-full rounded-xl border border-slate-200 bg-[#f8fafc] pl-10 pr-3 text-xs font-medium outline-none focus:border-[#d6a33a] focus:bg-white" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {[
                ["novo", `Novo ${counts.novo}`],
                ["em_atendimento", `Em atendimento ${counts.em_atendimento}`],
                ["encerrados", `Encerrados ${counts.encerrados}`],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-2 py-2 text-[10px] font-extrabold transition ${filter === key ? "bg-[#082743] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}>{label}</button>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Filtrar por órgão</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setOrgFilter("todos")} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-extrabold ${orgFilter === "todos" ? "border-[#082743] bg-[#082743] text-white" : "border-slate-200 bg-white text-slate-600"}`}>Todos</button>
                {organizations.map((org) => (
                  <button key={org.key} onClick={() => setOrgFilter(org.key)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-extrabold ${orgFilter === org.key ? org.badge : "border-slate-200 bg-white text-slate-600"}`}>
                    <span className={`mr-1.5 inline-block size-2 rounded-full ${org.dot}`} />{org.key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto p-3">
            {loading ? (
              <div className="grid min-h-[260px] place-items-center text-sm text-slate-400">Carregando chamados...</div>
            ) : filtered.length === 0 ? (
              <div className="grid min-h-[260px] place-items-center px-6 text-center">
                <div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquare size={21} /></div><p className="mt-3 text-sm font-bold text-slate-500">Nenhum chamado encontrado.</p></div>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((ticket) => {
                  const org = getOrg(ticket.tenant_key);
                  const active = selected?.id === ticket.id;
                  return (
                    <button key={ticket.id} onClick={() => void loadDetail(ticket)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-[#d6a33a] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]" : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"}`}>
                      <div className="flex items-center justify-between gap-2"><b className="text-sm font-black text-[#07182d]">#{String(ticket.ticket_number).padStart(4, "0")}</b><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClass[ticket.status] || statusClass.fechado}`}>{statusLabels[ticket.status] || ticket.status}</span></div>
                      <p className="mt-2 line-clamp-2 text-sm font-black text-slate-800">{ticket.subject}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><UserRound size={13} /> <span className="truncate">{ticket.requester_name || ticket.requester_email || "Usuário"}</span></div>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500"><Landmark size={12} className="shrink-0" /><span className="truncate">{org.name}</span></div>
                      <div className="mt-3 flex items-center justify-between"><span className={`inline-flex max-w-[65%] items-center gap-1.5 truncate rounded-full border px-2 py-1 text-[9px] font-bold ${org.badge}`}><span className={`size-1.5 shrink-0 rounded-full ${org.dot}`} />{org.shortName}</span><span className="text-[9px] font-semibold text-slate-400">{shortFmt(ticket.last_message_at)}</span></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          {!selected ? (
            <div className="grid h-full min-h-[735px] place-items-center bg-[radial-gradient(circle_at_center,_rgba(214,163,58,0.06),_transparent_42%)] p-8 text-center">
              <div><div className="mx-auto grid size-20 place-items-center rounded-[24px] bg-[#07182d] text-[#f4c45a] shadow-[0_14px_32px_rgba(7,24,45,0.16)]"><Headphones size={34} /></div><h3 className="mt-6 text-2xl font-black text-[#07182d]">Selecione um chamado</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Escolha um atendimento à esquerda para visualizar a conversa e responder.</p></div>
            </div>
          ) : (
            <div className="flex h-full min-h-[735px] flex-col">
              <header className="border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-[#07182d]">#{String(selected.ticket_number).padStart(4, "0")}</h3><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClass[selected.status] || statusClass.fechado}`}>{statusLabels[selected.status] || selected.status}</span></div>
                    <h2 className="mt-2 truncate text-[22px] font-black text-[#07182d]">{selected.subject}</h2>
                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500"><Landmark size={14} /><span className="truncate">{selectedOrg?.name || selected.tenant_key}</span></div>
                    <p className="mt-2 text-[11px] text-slate-400">Aberto por {selected.requester_name || selected.requester_email || "Usuário"} em {fmt(selected.created_at)}</p>
                  </div>
                  <button onClick={() => void loadDetail(selected, true)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Atualizar conversa"><RefreshCw size={15} /></button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-5 py-4">
                <div className="mb-5 flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />Conversa<span className="h-px flex-1 bg-slate-200" /></div>
                {messages.length === 0 ? (
                  <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">Nenhuma mensagem neste chamado.</div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.is_staff ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] ${message.is_staff ? "text-right" : "text-left"}`}>
                          <div className={`mb-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-500 ${message.is_staff ? "justify-end" : "justify-start"}`}><span>{message.is_staff ? "MW TECH" : selected.requester_name || "Usuário"}</span><span>•</span><span>{fmt(message.created_at)}</span></div>
                          <div className={`rounded-2xl px-4 py-3 shadow-sm ${message.is_staff ? "rounded-br-md bg-[#0a3158] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}><p className="whitespace-pre-wrap text-sm font-medium leading-6">{message.body}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-100 bg-white p-4">
                {isFinished ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800">Atendimento encerrado.</div>
                ) : (
                  <div className="flex items-end gap-2">
                    <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400" title="Anexos em breve"><Paperclip size={17} /></button>
                    <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Digite sua mensagem aqui..." rows={2} className="min-h-[58px] flex-1 resize-none rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#d6a33a] focus:bg-white" />
                    <button onClick={() => void send()} disabled={!text.trim() || sending} className="flex h-[58px] min-w-[112px] items-center justify-center gap-2 rounded-xl bg-[#082743] px-4 text-sm font-black text-white disabled:opacity-50"><Send size={16} />{sending ? "Enviando" : "Enviar"}</button>
                  </div>
                )}
              </footer>
            </div>
          )}
        </section>

        <aside className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          {!selected ? (
            <div className="grid min-h-[735px] place-items-center px-6 text-center text-sm text-slate-400">Os detalhes do chamado aparecerão aqui.</div>
          ) : (
            <div className="p-5">
              <h2 className="text-base font-black text-[#07182d]">Detalhes do chamado</h2>

              <div className="mt-5 space-y-5">
                <div><label className="mb-1.5 block text-[11px] font-bold text-slate-500">Status</label><select value={selected.status} onChange={(event) => void changeStatus(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 outline-none"><option value="novo">Novo</option><option value="em_atendimento">Em atendimento</option><option value="aguardando_usuario">Aguardando usuário</option><option value="resolvido">Resolvido</option><option value="fechado">Fechado</option></select></div>
                <div><label className="mb-1.5 block text-[11px] font-bold text-slate-500">Prioridade</label><div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-extrabold text-slate-700"><span className={`size-2 rounded-full ${String(selected.priority || "baixa").toLowerCase().includes("alta") ? "bg-rose-500" : "bg-emerald-500"}`} />{selected.priority || "Baixa"}</div></div>

                <div className="border-t border-slate-100 pt-4"><p className="text-[11px] font-bold text-slate-500">Órgão / Entidade</p><div className="mt-2 flex items-start gap-2 text-xs font-bold leading-5 text-slate-700"><Landmark size={15} className="mt-0.5 shrink-0 text-[#0a3158]" />{selectedOrg?.name || selected.tenant_key}</div></div>
                <div><p className="text-[11px] font-bold text-slate-500">Solicitante</p><div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><UserRound size={15} />{selected.requester_name || selected.requester_email || "Usuário"}</div></div>
                <div><p className="text-[11px] font-bold text-slate-500">Data de abertura</p><div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><CalendarDays size={15} />{fmt(selected.created_at)}</div></div>
                <div><p className="text-[11px] font-bold text-slate-500">Atendente responsável</p><div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><Headphones size={15} />MW TECH</div></div>

                <div className="border-t border-slate-100 pt-4"><p className="text-[11px] font-bold text-slate-500">Assunto</p><p className="mt-2 text-sm font-black text-[#07182d]">{selected.subject}</p></div>
                <div><p className="text-[11px] font-bold text-slate-500">Categoria</p><p className="mt-2 text-xs font-semibold text-slate-700">{selected.category || "Suporte técnico"}</p></div>
                {selected.source_path && <div><p className="text-[11px] font-bold text-slate-500">Origem</p><div className="mt-2 flex items-start gap-2 text-xs font-semibold text-slate-700"><Building2 size={15} className="mt-0.5" />{selected.source_path}</div></div>}

                <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Ações</p><div className="space-y-2"><button onClick={() => void finishAttendance()} disabled={closing || isFinished} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#082743] px-4 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 size={16} />{closing ? "Encerrando..." : "Resolver chamado"}</button><button onClick={() => void changeStatus("aguardando_usuario")} disabled={isFinished} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-50">Aguardar retorno</button></div></div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
