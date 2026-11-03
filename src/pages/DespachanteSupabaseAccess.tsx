import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, LogOut, ShieldCheck, Users, RefreshCw } from "lucide-react";

const URL = (import.meta.env.VITE_MW_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = import.meta.env.VITE_MW_SUPABASE_PUBLISHABLE_KEY || "";
const STORAGE = "mw-control:supabase-despachante:session:v1";

type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string } };
type Client = { id: string; name: string; phone: string };
type Counts = { clients: number; checklists: number; processes: number };

function readSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem(STORAGE) || "null") as Session | null; }
  catch { return null; }
}
function saveSession(value: Session | null) {
  if (value) sessionStorage.setItem(STORAGE, JSON.stringify(value));
  else sessionStorage.removeItem(STORAGE);
}
async function authRequest(path: string, payload: Record<string, unknown>) {
  const response = await fetch(URL + "/auth/v1/" + path, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 400
    ? "E-mail ou senha incorretos, ou conta ainda não confirmada."
    : String(result.msg || result.error_description || result.message || "Falha ao autenticar."));
  return result as Record<string, any>;
}
function sessionFrom(result: Record<string, any>): Session {
  if (!result.access_token || !result.refresh_token || !result.user?.id) throw new Error("Resposta de autenticação incompleta.");
  return {
    access_token: String(result.access_token),
    refresh_token: String(result.refresh_token),
    expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600),
    user: { id: String(result.user.id), email: String(result.user.email || "") },
  };
}
async function authorizedRequest(session: Session, path: string, options?: RequestInit) {
  return fetch(URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: KEY,
      authorization: "Bearer " + session.access_token,
      ...(options?.headers || {}),
    },
  });
}

export default function DespachanteSupabaseAccess() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [counts, setCounts] = useState<Counts>({ clients: 0, checklists: 0, processes: 0 });
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      const saved = readSession();
      if (!saved || !URL || !KEY) { if (mounted) setLoading(false); return; }
      try {
        const current = saved.expires_at > Date.now() / 1000 + 60
          ? saved
          : sessionFrom(await authRequest("token?grant_type=refresh_token", { refresh_token: saved.refresh_token }));
        const check = await fetch(URL + "/auth/v1/user", {
          headers: { apikey: KEY, authorization: "Bearer " + current.access_token },
        });
        if (!check.ok) throw new Error("Sessão expirada.");
        saveSession(current);
        if (mounted) setSession(current);
      } catch {
        saveSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void restore();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const load = async () => {
      try {
        const tables = [
          ["mw_clients", "clients"],
          ["mw_checklists", "checklists"],
          ["mw_processes", "processes"],
        ] as const;
        const responses = await Promise.all(tables.map(async ([table]) => {
          const response = await authorizedRequest(session, table + "?select=id", {
            method: "HEAD",
            headers: { Prefer: "count=exact" },
          });
          if (!response.ok) throw new Error("Sem acesso à tabela " + table + " (" + response.status + ").");
          return Number((response.headers.get("content-range") || "0/0").split("/")[1] || 0);
        }));
        const result = await authorizedRequest(session, "mw_clients?select=id,name,phone&order=name.asc&limit=100");
        if (!result.ok) throw new Error("Não foi possível consultar os clientes: " + result.status);
        const list = await result.json() as Client[];
        if (mounted) {
          setCounts({ clients: responses[0], checklists: responses[1], processes: responses[2] });
          setClients(list);
          setMessage("");
        }
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : "Falha na consulta.");
      }
    };
    void load();
    return () => { mounted = false; };
  }, [session]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!URL || !KEY) { setMessage("Supabase não configurado neste ambiente."); return; }
    setBusy(true); setMessage("");
    try {
      const next = sessionFrom(await authRequest("token?grant_type=password", { email: email.trim(), password }));
      saveSession(next); setSession(next); setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally { setBusy(false); }
  }

  async function logout() {
    const existing = session;
    saveSession(null); setSession(null); setClients([]); setCounts({ clients: 0, checklists: 0, processes: 0 });
    if (existing) await fetch(URL + "/auth/v1/logout", {
      method: "POST", headers: { apikey: KEY, authorization: "Bearer " + existing.access_token },
    }).catch(() => undefined);
  }

  async function addClient(event: FormEvent) {
    event.preventDefault();
    if (!session || !clientName.trim()) return;
    setBusy(true); setMessage("");
    try {
      const response = await authorizedRequest(session, "mw_clients?select=id,name,phone", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ owner_id: session.user.id, name: clientName.trim(), phone: clientPhone.trim() }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar cliente (" + response.status + ").");
      const created = await response.json() as Client[];
      setClients(current => [...current, ...created].sort((a,b)=>a.name.localeCompare(b.name)));
      setCounts(current => ({...current,clients:current.clients+created.length}));
      setClientName(""); setClientPhone("");
      setMessage("Cliente cadastrado no novo Supabase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao cadastrar.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-10 text-[#082743]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/mw-tech-logo.png" alt="MW TECH" className="h-16 w-16 rounded-2xl bg-[#06192d] object-contain p-2" />
            <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b78331]">MW TECH Control</p><h1 className="text-2xl font-bold">Acesso Supabase · MW Despachante</h1></div>
          </div>
          {session && <button onClick={() => void logout()} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><LogOut size={16} /> Sair</button>}
        </div>
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ambiente de validação isolado. O Monitoramento, Financeiro e login principal continuam sem alterações.
        </div>
        {!URL || !KEY ? (
          <div className="rounded-xl bg-white p-6">Configure as variáveis públicas do Supabase neste ambiente de testes.</div>
        ) : loading ? (
          <div className="flex items-center gap-2 p-6"><RefreshCw size={18} className="animate-spin" /> Verificando acesso...</div>
        ) : !session ? (
          <form onSubmit={login} className="mx-auto max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-center"><LockKeyhole className="mx-auto mb-3 text-[#b78331]" /><h2 className="text-2xl font-bold">Acesse sua conta</h2><p className="mt-2 text-sm text-slate-500">Utilize o e-mail e a senha cadastrados no novo Supabase.</p></div>
            <label className="block text-sm font-semibold">E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
            {message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-[#082743] p-3 font-semibold text-white disabled:opacity-60">{busy ? "Entrando..." : "Entrar com Supabase"}</button>
            <p className="flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> Acesso independente do Appwrite</p>
          </form>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">Conectado como <strong>{session.user.email}</strong>.</p>
            <div className="grid gap-4 sm:grid-cols-3">{[
              ["Clientes", counts.clients],["Checklists", counts.checklists],["Processos", counts.processes]
            ].map(([label,count])=><div key={String(label)} className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold">{count}</div></div>)}</div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Users size={20}/> Clientes no novo banco</h2>
              <form onSubmit={addClient} className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nome do cliente" aria-label="Nome do cliente" required className="rounded-xl border p-3" />
                <input value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="Telefone" aria-label="Telefone" className="rounded-xl border p-3" />
                <button disabled={busy} className="rounded-xl bg-[#082743] px-4 py-3 font-semibold text-white disabled:opacity-60">Cadastrar</button>
              </form>
              {message && <p role="status" className="mb-3 text-sm">{message}</p>}
              {clients.length ? <div className="divide-y">{clients.map(c=><div key={c.id} className="flex justify-between gap-3 py-3 text-sm"><span>{c.name}</span><span className="text-slate-500">{c.phone}</span></div>)}</div> : <p className="text-sm text-slate-500">Nenhum cliente cadastrado neste banco.</p>}
              <p className="mt-4 text-xs text-slate-500">Esta tela serve para validar login, permissões e cadastro. A interface completa do MW Despachante ainda não foi transferida.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
