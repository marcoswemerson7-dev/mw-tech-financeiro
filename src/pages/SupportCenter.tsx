import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
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
    em_atendimento: tickets.filter((ticket) => ticket.status === "em_atendimento").length,
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
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_35px_rgba(7,24,45,0.05)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#082743] text-[#f0b83f]"><Headphones size={28} /></div>
          <div>
            <h1 className="text-2xl font-black tracking-[-0.02em] text-[#07182d]">Central de Suporte</h1>
            <p className="mt-1 text-sm text-slate-500">Atendimento técnico e operacional dos sistemas atendidos.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-3 text-right">
          <p className="text-xs font-bold text-[#8c681d]">MW TECH</p>
          <p className="text-[11px] text-slate-500">Sistemas e Soluções Digitais</p>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle size={17} /> {error}
        </div>
      )}

      <div className="grid min-h-[720px] gap-4 2xl:grid-cols-[360px_minmax(620px,1fr)_300px] xl:grid-cols-[340px_minmax(560px,1fr)]">
        <aside className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          <div className="border-b border-slate-100 p-4">
            <h2 className="mb-3 text-base font-black text-[#07182d]">Chamados</h2>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar chamado, assunto ou solicitante..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-[#f8fafc] pl-10 pr-3 text-xs font-medium outline-none focus:border-[#d6a33a] focus:bg-white"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-1.5">
              {[
                ["novo", `Novo ${counts.novo}`],
                ["em_atendimento", `Em atendimento ${counts.em_atendimento}`],
                ["encerrados", `Encerrados ${counts.encerrados}`],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-2 py-2 text-[10px] font-extrabold transition ${filter === key ? "bg-[#082743] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Filtrar por órgão</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setOrgFilter("todos")} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-extrabold ${orgFilter === "todos" ? "border-[#082743] bg-[#082743] text-white" : "border-slate-200 bg-white text-slate-600"}`}>Todos</button>
                {organizations.map((org) => (
                  <button key={org.key} onClick={() => setOrgFilter(org.key)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-extrabold ${orgFilter === org.key ? org.badge : "border-slate-200 bg-white text-slate-600"}`}>
                    <span className={`mr-1.5 inline-block size-2 rounded-full ${org.dot}`} />{org.shortName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[585px] overflow-y-auto p-3">
            {loading ? (
              <div className="grid min-h-[280px] place-items-center text-sm text-slate-400">Carregando chamados...</div>
            ) : filtered.length === 0 ? (
              <div className="grid min-h-[280px] place-items-center px-6 text-center">
                <div>
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquare size={21} /></div>
                  <p className="mt-3 text-sm font-bold text-slate-500">Nenhum chamado encontrado.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((ticket) => {
                  const org = getOrg(ticket.tenant_key);
                  const active = selected?.id === ticket.id;
                  return (
                    <button key={ticket.id} onClick={() => void loadDetail(ticket)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-[#d6a33a] bg-[#fffaf0] shadow-[0_8px_24px_rgba(7,24,45,0.08)]" : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-sm font-black text-[#07182d]">#{String(ticket.ticket_number).padStart(4, "0")}</b>
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusClass[ticket.status] || statusClass.fechado}`}>{statusLabels[ticket.status] || ticket.status}</span>
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-extrabold text-slate-800">{ticket.subject}</p>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">{ticket.requester_name || ticket.requester_email || "Usuário"}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`inline-flex max-w-[70%] items-center gap-1.5 truncate rounded-full border px-2 py-1 text-[9px] font-bold ${org.badge}`}><Landmark size={11} />{org.shortName}</span>
                        <span className="whitespace-nowrap text-[9px] font-semibold text-slate-400">{shortFmt(ticket.last_message_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)]">
          {!selected ? (
            <div className="grid h-full min-h-[720px] place-items-center bg-[radial-gradient(circle_at_center,_rgba(214,163,58,0.06),_transparent_40%)] p-8 text-center">
              <div>
                <div className="mx-auto grid size-20 place-items-center rounded-[24px] bg-[#07182d] text-[#f4c45a]"><Headphones size={34} /></div>
                <h3 className="mt-5 text-2xl font-black text-[#07182d]">Selecione um chamado</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Escolha um atendimento para visualizar a conversa, responder e gerenciar o status.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[720px] flex-col">
              <header className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-[#07182d]">#{String(selected.ticket_number).padStart(4, "0")}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClass[selected.status] || statusClass.fechado}`}>{statusLabels[selected.status] || selected.status}</span>
                    </div>
                    <h2 className="mt-2 text-xl font-black text-[#07182d]">{selected.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Landmark size={13} />{selectedOrg?.name}</span>
                      <span className="flex items-center gap-1.5"><UserRound size={13} />{selected.requester_name || selected.requester_email || "Usuário"}</span>
                    </div>
                  </div>
                  <button onClick={() => void loadDetail(selected, true)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Atualizar"><RefreshCw size={17} /></button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto bg-[#fbfcfe] px-5 py-5">
                <div className="mx-auto max-w-4xl space-y-5">
                  {messages.length === 0 ? (
                    <div className="grid min-h-[360px] place-items-center text-center text-sm text-slate-400">Nenhuma mensagem neste chamado.</div>
                  ) : messages.map((message) => {
                    const staff = message.is_staff;
                    return (
                      <div key={message.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                        <div className={`flex max-w-[78%] items-end gap-2 ${staff ? "flex-row-reverse" : ""}`}>
                          <div className={`grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-black ${staff ? "bg-[#07182d] text-[#f0b83f]" : "bg-[#0b426d] text-white"}`}>{staff ? "MW" : (selected.requester_name || "U").slice(0, 2).toUpperCase()}</div>
                          <div>
                            <div className={`mb-1 flex items-center gap-2 text-[10px] font-semibold text-slate-400 ${staff ? "justify-end" : ""}`}><span className="font-bold text-slate-600">{staff ? "MW TECH" : selected.requester_name || "Usuário"}</span><span>{shortFmt(message.created_at)}</span></div>
                            <div className={`rounded-2xl px-4 py-3 text-sm leading-5 shadow-sm ${staff ? "rounded-br-md bg-[#0b4b79] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}>{message.body}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 bg-white p-4">
                <div className="flex items-center gap-2">
                  <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400" title="Anexos"><Paperclip size={18} /></button>
                  <input
                    value={text}
                    disabled={isFinished}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void send(); }}
                    placeholder={isFinished ? "Chamado encerrado" : "Digite sua mensagem aqui..."}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-[#f8fafc] px-4 text-sm outline-none focus:border-[#d6a33a] focus:bg-white disabled:opacity-60"
                  />
                  <button onClick={() => void send()} disabled={isFinished || sending || !text.trim()} className="flex h-11 items-center gap-2 rounded-xl bg-[#082743] px-5 text-sm font-black text-white transition hover:bg-[#0b355d] disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} />{sending ? "Enviando..." : "Enviar"}</button>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,0.05)] 2xl:block">
          {!selected ? (
            <div className="grid min-h-[720px] place-items-center px-6 text-center text-sm text-slate-400">Selecione um chamado para ver os detalhes.</div>
          ) : (
            <div className="p-5">
              <h3 className="text-base font-black text-[#07182d]">Detalhes do chamado</h3>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-slate-400">Status</label>
                  <select value={selected.status} onChange={(event) => void changeStatus(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                    <option value="novo">Novo</option>
                    <option value="em_atendimento">Em atendimento</option>
                    <option value="aguardando_usuario">Aguardando usuário</option>
                    <option value="resolvido">Resolvido</option>
                    <option value="fechado">Fechado</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400">Prioridade</label>
                  <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700"><span className="size-2 rounded-full bg-emerald-500" />{selected.priority || "Normal"}</div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-bold text-slate-400">Órgão / Entidade</p>
                  <p className="mt-2 flex items-start gap-2 text-xs font-bold leading-5 text-slate-700"><Landmark size={15} className="mt-0.5 shrink-0 text-[#0b4b79]" />{selectedOrg?.name}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400">Solicitante</p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><UserRound size={15} className="text-[#0b4b79]" />{selected.requester_name || selected.requester_email || "Usuário"}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400">Data de abertura</p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><CalendarDays size={15} className="text-[#0b4b79]" />{fmt(selected.created_at)}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400">Atendente responsável</p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><Headphones size={15} className="text-[#0b4b79]" />MW TECH</p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-bold text-slate-400">Assunto</p>
                  <p className="mt-2 text-xs font-black text-slate-700">{selected.subject}</p>
                  {selected.category && <p className="mt-2 text-[11px] text-slate-500">Categoria: {selected.category}</p>}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-[11px] font-bold text-slate-400">Ações</p>
                  <div className="space-y-2">
                    {!isFinished ? (
                      <>
                        <button onClick={() => void finishAttendance()} disabled={closing} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#082743] text-xs font-black text-white disabled:opacity-50"><CheckCircle2 size={16} />{closing ? "Encerrando..." : "Resolver chamado"}</button>
                        <button onClick={() => void changeStatus("aguardando_usuario")} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-xs font-black text-slate-700"><Clock3 size={16} />Aguardar retorno</button>
                      </>
                    ) : (
                      <button onClick={() => void changeStatus("em_atendimento")} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#082743] text-xs font-black text-white">Reabrir chamado</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
