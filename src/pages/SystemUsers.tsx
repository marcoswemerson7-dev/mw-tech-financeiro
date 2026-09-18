import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { ActionButton, PageHeader } from "../components/UI";
import {
  getObservability,
  type ObservabilityIncident,
  type ObservabilityTenant,
  type ObservabilityUser,
} from "../services/observability";

const tenantNames: Record<ObservabilityTenant, string> = {
  rg: "Ribeiro Gonçalves",
  bg: "Baixa Grande do Ribeiro",
};

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value === "ativo") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "inativo" || value === "suspenso") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function SystemUsers() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedTenant = params.get("tenant");
  const initialTenant = requestedTenant === "rg" || requestedTenant === "bg" ? requestedTenant : "all";

  const [tenant, setTenant] = useState<"all" | ObservabilityTenant>(initialTenant);
  const [tab, setTab] = useState<"users" | "incidents">("users");
  const [users, setUsers] = useState<ObservabilityUser[]>([]);
  const [incidents, setIncidents] = useState<ObservabilityIncident[]>([]);
  const [selected, setSelected] = useState<ObservabilityUser | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const data = await getObservability();
      setUsers(data.flatMap((item) => item.users));
      setIncidents(data.flatMap((item) => item.incidents).sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setTenantFilter = (value: "all" | ObservabilityTenant) => {
    setTenant(value);
    if (value === "all") setParams({});
    else setParams({ tenant: value });
  };

  const filteredUsers = useMemo(() => users.filter((user) => {
    if (tenant !== "all" && user.tenant !== tenant) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [user.name, user.email, user.sector, user.function, user.role, user.status]
      .some((value) => String(value || "").toLowerCase().includes(q));
  }), [users, tenant, search]);

  const filteredIncidents = useMemo(() => incidents.filter((incident) => tenant === "all" || incident.tenant === tenant), [incidents, tenant]);

  const totals = useMemo(() => {
    const source = tenant === "all" ? users : users.filter((user) => user.tenant === tenant);
    const now = Date.now();
    return {
      users: source.length,
      active: source.filter((user) => user.status.toLowerCase() === "ativo").length,
      recent: source.filter((user) => user.lastSignInAt && new Date(user.lastSignInAt).getTime() >= now - 24 * 3600000).length,
      activity: source.reduce((sum, user) => sum + user.actions24h, 0),
    };
  }, [users, tenant]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuários dos sistemas"
        subtitle="Contas, acessos, atividade e incidentes dos sistemas de Ribeiro Gonçalves e Baixa Grande do Ribeiro."
        actions={<div className="flex gap-2">
          <ActionButton tone="outline" onClick={() => navigate("/monitoramento")}><ArrowLeft size={17}/>Monitoramento</ActionButton>
          <ActionButton onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? "animate-spin" : ""}/>{refreshing ? "Atualizando..." : "Atualizar"}</ActionButton>
        </div>}
      />

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {([["all","Todos"],["rg","Ribeiro Gonçalves"],["bg","Baixa Grande do Ribeiro"]] as const).map(([id,label]) => (
          <button key={id} onClick={() => setTenantFilter(id)} className={`rounded-lg px-4 py-2 text-xs font-black transition ${tenant === id ? "bg-[#082743] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>
        ))}
        <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1">
          <button onClick={() => setTab("users")} className={`rounded-md px-3 py-1.5 text-xs font-black ${tab === "users" ? "bg-white text-[#07182d] shadow-sm" : "text-slate-500"}`}>Usuários</button>
          <button onClick={() => setTab("incidents")} className={`rounded-md px-3 py-1.5 text-xs font-black ${tab === "incidents" ? "bg-white text-[#07182d] shadow-sm" : "text-slate-500"}`}>Incidentes {filteredIncidents.length ? `(${filteredIncidents.length})` : ""}</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Usuários" value={totals.users} icon={<UsersRound size={19}/>} />
        <Summary label="Habilitados" value={totals.active} icon={<ShieldCheck size={19}/>} tone="green" />
        <Summary label="Acesso em 24h" value={totals.recent} icon={<Clock3 size={19}/>} tone="violet" />
        <Summary label="Ações em 24h" value={totals.activity} icon={<Activity size={19}/>} tone="gold" />
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {tab === "users" ? (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search size={18} className="text-slate-400"/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, setor, função ou perfil..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"/>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? <div className="p-12 text-center text-sm text-slate-500">Carregando usuários...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-[13px]">
                  <thead className="bg-[#07182d] text-[10px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-5 py-3">Usuário</th>
                      <th className="px-5 py-3">Órgão</th>
                      <th className="px-5 py-3">Perfil / função</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Último login</th>
                      <th className="px-5 py-3">Ações 24h</th>
                      <th className="px-5 py-3">Última atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={`${user.tenant}:${user.id}`} onClick={() => setSelected(user)} className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/40">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {user.photoUrl ? <img src={user.photoUrl} alt="" className="size-9 rounded-full object-cover"/> : <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-700"><UserRound size={17}/></span>}
                            <div><b className="block text-[#07182d]">{user.name}</b><span className="text-[11px] text-slate-500">{user.email}</span></div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">{tenantNames[user.tenant]}</td>
                        <td className="px-5 py-4"><b className="block text-slate-700">{user.role || user.function || "—"}</b><span className="text-[11px] text-slate-500">{user.sector || user.fiscalSecretaria || "Sem setor"}</span></td>
                        <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(user.status)}`}>{user.status || "—"}</span></td>
                        <td className="px-5 py-4 text-slate-600">{dateTime(user.lastSignInAt)}</td>
                        <td className="px-5 py-4 font-black text-[#07182d]">{user.actions24h}</td>
                        <td className="px-5 py-4 text-slate-600">{dateTime(user.lastActionAt)}</td>
                      </tr>
                    ))}
                    {!filteredUsers.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">Nenhum usuário encontrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {!filteredIncidents.length && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm font-semibold text-emerald-700"><CheckCircle2 size={20} className="mb-2"/>Nenhum incidente operacional registrado.</div>}
          {filteredIncidents.map((incident) => (
            <div key={`${incident.tenant}:${incident.id}`} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle size={19}/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><b className="text-sm text-[#07182d]">{incident.title}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{tenantNames[incident.tenant]}</span></div>
                  <p className="mt-1 text-sm text-slate-600">{incident.message}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500"><span>{incident.context}</span><span>{dateTime(incident.occurredAt)}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-900">
        Este painel mostra informações administrativas e de uso necessárias para suporte e auditoria. CPF é mascarado e senha nunca é armazenada nem exibida aqui.
      </div>

      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)}/>}
    </div>
  );
}

function UserDrawer({ user, onClose }: { user: ObservabilityUser; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#061426]/70 p-3 backdrop-blur-[2px] sm:p-5">
    <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar detalhes"/>
    <div
      className="relative z-10 flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(3,18,35,.35)]"
      style={{ background: "#ffffff", color: "#0f172a" }}
    >
      <div className="relative overflow-hidden bg-gradient-to-r from-[#06192d] via-[#0a3155] to-[#0b416d] px-5 py-5 text-white sm:px-7">
        <div className="absolute -right-12 -top-16 size-56 rounded-full bg-white/[.06] blur-2xl"/>
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {user.photoUrl ? <img src={user.photoUrl} alt="" className="size-16 shrink-0 rounded-2xl border border-white/20 object-cover shadow-lg sm:size-20"/> : <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white sm:size-20"><UserRound size={30}/></span>}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/55">Detalhes do usuário · {tenantNames[user.tenant]}</p>
              <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{user.name}</h2>
              <p className="mt-1 truncate text-xs text-blue-100 sm:text-sm">{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-2.5 py-1 text-[10px] font-black text-emerald-100">{user.status || "—"}</span>
                {(user.role || user.function) && <span className="rounded-full border border-white/15 bg-white/[.08] px-2.5 py-1 text-[10px] font-bold text-white/85">{user.role || user.function}</span>}
                {(user.sector || user.fiscalSecretaria) && <span className="rounded-full border border-white/15 bg-white/[.08] px-2.5 py-1 text-[10px] font-bold text-white/85">{user.sector || user.fiscalSecretaria}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.06] text-white transition hover:bg-white/[.14]" aria-label="Fechar"><X size={20}/></button>
        </div>
      </div>

      <div className="overflow-y-auto bg-[#f6f8fb] p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <Section title="Cadastro">
                <Info icon={<Mail size={15}/>} label="E-mail" value={user.email || "—"}/>
                <Info icon={<Phone size={15}/>} label="Telefone" value={user.phone || "—"}/>
                <Info icon={<UserRound size={15}/>} label="CPF" value={user.cpfMasked || "Não informado"}/>
                <Info icon={<ShieldCheck size={15}/>} label="Perfil" value={user.role || "—"}/>
                <Info icon={<UsersRound size={15}/>} label="Setor" value={user.sector || user.fiscalSecretaria || "—"}/>
                <Info icon={<KeyRound size={15}/>} label="Função" value={user.function || "—"}/>
              </Section>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <Section title="Acesso e atividade">
                <Info icon={<Clock3 size={15}/>} label="Último login" value={dateTime(user.lastSignInAt)}/>
                <Info icon={<Activity size={15}/>} label="Ações nas últimas 24h" value={String(user.actions24h)}/>
                <Info icon={<Activity size={15}/>} label="Ações em 7 dias" value={String(user.actions7d)}/>
                <Info icon={<CalendarClock size={15}/>} label="Última ação" value={dateTime(user.lastActionAt)}/>
                <Info icon={<Mail size={15}/>} label="E-mail confirmado" value={dateTime(user.emailConfirmedAt)}/>
                <Info icon={<CalendarClock size={15}/>} label="Conta criada" value={dateTime(user.createdAt)}/>
              </Section>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <Section title="Segurança e aceite">
                <Info icon={<KeyRound size={15}/>} label="Troca de senha obrigatória" value={user.mustChangePassword ? "Sim" : "Não"}/>
                <Info icon={<CheckCircle2 size={15}/>} label="Termos aceitos" value={user.termsAccepted ? "Sim" : "Não"}/>
                <Info icon={<CheckCircle2 size={15}/>} label="Privacidade aceita" value={user.privacyAccepted ? "Sim" : "Não"}/>
                <Info icon={<AlertTriangle size={15}/>} label="Bloqueio" value={user.bannedUntil ? dateTime(user.bannedUntil) : "Sem bloqueio"}/>
              </Section>
            </div>

            {user.lastAction ? <div className="rounded-2xl border border-blue-100 bg-blue-50/65 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"><Activity size={18}/></span>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wide text-blue-500">Última atividade registrada</span>
                  <b className="mt-1 block text-sm text-[#07182d]">{user.lastAction.type || "Ação"} · {user.lastAction.module || "Sistema"}</b>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{user.lastAction.description || "Sem descrição."}</p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">{dateTime(user.lastActionAt)}</p>
                </div>
              </div>
            </div> : <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Nenhuma atividade registrada para este usuário.</div>}

            {user.notes && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Observações</span><p className="mt-2 text-sm leading-6 text-slate-600">{user.notes}</p></div>}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{title}</h4><div className="grid gap-2 sm:grid-cols-2">{children}</div></section>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 p-3"><span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">{icon}{label}</span><b className="mt-1 block break-words text-[13px] text-[#07182d]">{value}</b></div>;
}

function Summary({ label, value, icon, tone = "blue" }: { label: string; value: number; icon: React.ReactNode; tone?: "blue" | "green" | "gold" | "violet" }) {
  const cls = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "gold" ? "bg-amber-50 text-amber-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700";
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-10 place-items-center rounded-lg ${cls}`}>{icon}</span><div><span className="text-[11px] font-bold text-slate-500">{label}</span><b className="block text-2xl font-black text-[#07182d]">{value}</b></div></div>;
}
