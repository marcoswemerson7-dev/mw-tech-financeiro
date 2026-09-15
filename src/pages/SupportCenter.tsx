import { useEffect, useMemo, useState } from "react";
import { Headphones, MessageSquare, Search, Send, RefreshCw, Clock3, UserRound, Building2, AlertCircle, Landmark } from "lucide-react";
import { supportService, type SupportMessage, type SupportTicket } from "../services/support";

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const statusClass: Record<string, string> = {
  novo: "bg-red-50 text-red-700 border-red-200",
  em_atendimento: "bg-amber-50 text-amber-700 border-amber-200",
  aguardando_usuario: "bg-blue-50 text-blue-700 border-blue-200",
  resolvido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fechado: "bg-slate-100 text-slate-600 border-slate-200",
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
    selected: "border-blue-300 bg-blue-50/60",
  },
  bgr: {
    key: "bgr",
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro – PI",
    shortName: "Baixa Grande do Ribeiro",
    type: "Prefeitura",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    header: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
    dot: "bg-emerald-500",
    selected: "border-emerald-300 bg-emerald-50/60",
  },
  bg: {
    key: "bgr",
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro – PI",
    shortName: "Baixa Grande do Ribeiro",
    type: "Prefeitura",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    header: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
    dot: "bg-emerald-500",
    selected: "border-emerald-300 bg-emerald-50/60",
  },
  cmrg: {
    key: "cmrg",
    name: "Câmara Municipal de Ribeiro Gonçalves – PI",
    shortName: "Câmara de Ribeiro Gonçalves",
    type: "Câmara",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    header: "border-violet-100 bg-violet-50/80 text-violet-900",
    dot: "bg-violet-500",
    selected: "border-violet-300 bg-violet-50/60",
  },
};

function normalizeTenant(value?: string) {
  return String(value || "orgao").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
    selected: "border-[#d6a33a] bg-[#fffaf0]",
  };
}

function fmt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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

  useEffect(() => { void loadTickets(); }, [filter]);

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
    tickets.forEach((t) => {
      const org = getOrg(t.tenant_key);
      if (!map.has(org.key)) map.set(org.key, org);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      const org = getOrg(t.tenant_key);
      if (orgFilter !== "todos" && org.key !== orgFilter) return false;
      if (!q) return true;
      return [t.ticket_number, t.subject, t.requester_name, t.requester_email, t.tenant_key, org.name, org.shortName, org.type]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [tickets, query, orgFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { org: OrgConfig; tickets: SupportTicket[] }>();
    filtered.forEach((t) => {
      const org = getOrg(t.tenant_key);
      const current = map.get(org.key) || { org, tickets: [] };
      current.tickets.push(t);
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

  const counts = {
    novo: tickets.filter((t) => t.status === "novo").length,
    em_atendimento: tickets.filter((t) => t.status === "em_atendimento").length,
    aguardando_usuario: tickets.filter((t) => t.status === "aguardando_usuario").length,
  };

  const selectedOrg = selected ? getOrg(selected.tenant_key) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[.2em] text-[#c98d20]"><Headphones size={18}/> Central MW TECH</div>
            <h2 className="text-3xl font-black tracking-tight text-[#07182d]">Central de Suporte</h2>
            <p className="mt-2 text-sm text-slate-500">Chamados organizados por Prefeitura, Câmara ou órgão atendido.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3"><b className="block text-xl text-red-700">{counts.novo}</b><span className="text-xs font-semibold text-red-600">Novos</span></div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3"><b className="block text-xl text-amber-700">{counts.em_atendimento}</b><span className="text-xs font-semibold text-amber-600">Em atendimento</span></div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3"><b className="block text-xl text-blue-700">{counts.aguardando_usuario}</b><span className="text-xs font-semibold text-blue-600">Aguardando</span></div>
          </div>
        </div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><AlertCircle size={17}/>{error}</div>}

      <div className="grid min-h-[620px] gap-5 xl:grid-cols-[390px_1fr]">
        <aside className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar chamado, usuário ou órgão..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#d6a33a]"/></div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {["todos", "novo", "em_atendimento", "aguardando_usuario", "resolvido"].map((s) => <button key={s} onClick={() => setFilter(s)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === s ? "bg-[#07182d] text-white" : "bg-slate-100 text-slate-600"}`}>{s === "todos" ? "Todos" : statusLabels[s]}</button>)}
            </div>
            {organizations.length > 1 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Filtrar por órgão</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button onClick={() => setOrgFilter("todos")} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-bold ${orgFilter === "todos" ? "border-[#07182d] bg-[#07182d] text-white" : "border-slate-200 bg-white text-slate-600"}`}>Todos os órgãos</button>
                  {organizations.map((org) => <button key={org.key} onClick={() => setOrgFilter(org.key)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-bold ${orgFilter === org.key ? org.badge : "border-slate-200 bg-white text-slate-600"}`}><span className={`mr-1.5 inline-block size-2 rounded-full ${org.dot}`}/>{org.shortName}</button>)}
                </div>
              </div>
            )}
          </div>
          <div className="max-h-[540px] overflow-y-auto p-2">
            {loading ? <div className="p-8 text-center text-sm text-slate-400">Carregando chamados...</div> : grouped.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Nenhum chamado encontrado.</div> : grouped.map(({ org, tickets: orgTickets }) => (
              <div key={org.key} className="mb-4">
                <div className={`mb-2 rounded-xl border px-3 py-2.5 ${org.header}`}>
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 shrink-0 rounded-full ${org.dot}`}/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black uppercase tracking-[.08em]">{org.type}</p>
                      <p className="truncate text-xs font-bold">{org.name}</p>
                    </div>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black">{orgTickets.length}</span>
                  </div>
                </div>
                {orgTickets.map((t) => (
                  <button key={t.id} onClick={() => void loadDetail(t)} className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${selected?.id === t.id ? org.selected : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-2"><b className="text-sm text-[#07182d]">#{String(t.ticket_number).padStart(4, "0")}</b><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass[t.status] || statusClass.fechado}`}>{statusLabels[t.status] || t.status}</span></div>
                    <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-800">{t.subject}</p>
                    <p className="mt-2 truncate text-xs text-slate-500">{t.requester_name || t.requester_email || "Usuário"}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span className={`inline-flex max-w-[62%] items-center gap-1.5 truncate rounded-full border px-2 py-1 font-bold ${org.badge}`}><span className={`size-1.5 shrink-0 rounded-full ${org.dot}`}/>{org.shortName}</span><span>{fmt(t.last_message_at)}</span></div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          {!selected ? (
            <div className="grid h-full min-h-[620px] place-items-center p-8 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#07182d] text-[#f5c75b]"><MessageSquare size={30}/></div><h3 className="mt-5 text-xl font-black text-[#07182d]">Selecione um chamado</h3><p className="mt-2 text-sm text-slate-500">Escolha uma Prefeitura, Câmara ou órgão e abra um chamado para conversar.</p></div></div>
          ) : (
            <div className="flex h-full min-h-[620px] flex-col">
              <header className="border-b border-slate-100 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    {selectedOrg && <div className={`mb-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${selectedOrg.badge}`}><Landmark size={15}/><span><b className="block text-[10px] uppercase tracking-[.08em]">{selectedOrg.type}</b><span className="text-xs font-bold">{selectedOrg.name}</span></span></div>}
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-[#07182d]">#{String(selected.ticket_number).padStart(4, "0")} — {selected.subject}</h3><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass[selected.status] || statusClass.fechado}`}>{statusLabels[selected.status] || selected.status}</span></div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Building2 size={14}/>{selectedOrg?.shortName || selected.tenant_key?.toUpperCase()}</span><span className="flex items-center gap-1.5"><UserRound size={14}/>{selected.requester_name || selected.requester_email || "Usuário"}</span><span className="flex items-center gap-1.5"><Clock3 size={14}/>{fmt(selected.created_at)}</span></div>{selected.source_path && <p className="mt-2 text-[11px] text-slate-400">Origem: {selected.source_path}</p>}
                  </div>
                  <div className="flex items-center gap-2"><select value={selected.status} onChange={(e) => void changeStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="novo">Novo</option><option value="em_atendimento">Em atendimento</option><option value="aguardando_usuario">Aguardando usuário</option><option value="resolvido">Resolvido</option><option value="fechado">Fechado</option></select><button onClick={() => void loadDetail(selected, true)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Atualizar"><RefreshCw size={16}/></button></div>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-5">
                {messages.length === 0 ? <div className="py-10 text-center text-sm text-slate-400">Nenhuma mensagem neste chamado.</div> : messages.map((m) => <div key={m.id} className={`flex ${m.is_staff ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${m.is_staff ? "bg-[#0a3158] text-white" : "border border-slate-200 bg-white text-slate-800"}`}><p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p><p className={`mt-2 text-[10px] ${m.is_staff ? "text-blue-100" : "text-slate-400"}`}>{m.is_staff ? "MW TECH" : selected.requester_name || "Usuário"} • {fmt(m.created_at)}</p></div></div>)}
              </div>

              <footer className="border-t border-slate-100 bg-white p-4"><div className="flex gap-3"><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Digite sua resposta..." rows={2} className="min-h-[54px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#d6a33a]"/><button onClick={() => void send()} disabled={!text.trim() || sending} className="flex min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-[#07182d] px-5 font-bold text-white transition hover:bg-[#0a3158] disabled:opacity-50"><Send size={17}/>{sending ? "Enviando" : "Enviar"}</button></div><p className="mt-2 text-[10px] text-slate-400">Conversa atualizada apenas enquanto esta tela estiver aberta para manter o sistema leve.</p></footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
