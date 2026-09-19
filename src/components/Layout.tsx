import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  House,
  Wallet,
  Landmark,
  FileChartColumn,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  CircleDollarSign,
  PanelsTopLeft,
  UsersRound,
  Search,
  Cloud,
  Headphones,
  Building2,
  Camera,
  UserRound,
  Phone,
  KeyRound,
  Monitor,
  Activity,
  Siren,} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { supportService, type SupportTicket } from "../services/support";
import { changeUserPassword, updateUserProfile } from "../services/userProfile";

const topItems = [
  ["/", "Visão geral", House],
  ["/caixa", "Caixa", Wallet],
] as const;

const financeItems = [
  ["/movimentacoes", "Entradas e saídas", CircleDollarSign],
  ["/contas", "Contas bancárias", Landmark],
  ["/despesas", "Contas a pagar", Wallet],
  ["/relatorios", "Relatórios", FileChartColumn],
] as const;

const managementItems = [
  ["/sistemas", "Sistemas e órgãos", PanelsTopLeft],
  ["/monitoramento", "Monitoramento", Activity],
  ["/monitoramento/incidentes", "Central de Incidentes", Siren],  ["/acesso-remoto", "Acesso remoto (AnyDesk)", Monitor],
  ["/usuarios", "Usuários e acessos", UsersRound],
] as const;

const bottomItems = [
  ["/suporte", "Central de Suporte", Headphones],
  ["/configuracoes", "Configurações", Settings],
] as const;

const supportStamp = (ticket: SupportTicket) => new Date(ticket.last_message_at || ticket.updated_at || ticket.created_at).getTime();

function playNotificationTone() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    window.setTimeout(() => void ctx.close(), 450);
  } catch {
    // Browsers podem bloquear áudio até a primeira interação do usuário.
  }
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const lastSupportStamp = useRef(0);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const loc = useLocation();
  const navigate = useNavigate();
  const { session, logout, refresh } = useAuth();
  const financeActive = financeItems.some(([path]) => loc.pathname.startsWith(path));

  const prefs = ((session as { prefs?: Record<string, unknown> } | null)?.prefs || {}) as Record<string, unknown>;
  const userName = String(session?.name || session?.email?.split("@")[0] || "Usuário");
  const userRole = String(prefs.cargo || (session?.$id === "demo" ? "Demonstração" : "Administrador"));
  const userPhone = String(prefs.telefone || "");
  const avatarUrl = String(prefs.avatar_url || "");
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "MW";

  const unreadTickets = useMemo(() => {
    const seenAt = Number(localStorage.getItem("mw-support-seen-at") || 0);
    return tickets
      .filter((ticket) => !["resolvido", "fechado"].includes(ticket.status) && supportStamp(ticket) > seenAt)
      .sort((a, b) => supportStamp(b) - supportStamp(a));
  }, [tickets]);

  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      try {
        const data = await supportService.list("todos");
        if (disposed) return;
        const active = data.tickets.filter((ticket) => !["resolvido", "fechado"].includes(ticket.status));
        const newest = active.reduce((max, ticket) => Math.max(max, supportStamp(ticket)), 0);
        if (lastSupportStamp.current > 0 && newest > lastSupportStamp.current) playNotificationTone();
        lastSupportStamp.current = Math.max(lastSupportStamp.current, newest);
        setTickets(data.tickets);
      } catch {
        // Notificações de suporte não podem bloquear o restante do sistema.
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 15000);
    return () => { disposed = true; window.clearInterval(id); };
  }, []);

  useEffect(() => () => {
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const openSupportTicket = (ticket?: SupportTicket) => {
    localStorage.setItem("mw-support-seen-at", String(Date.now()));
    setNotificationOpen(false);
    setTickets((current) => [...current]);
    navigate(ticket ? `/suporte?ticket=${encodeURIComponent(ticket.id)}` : "/suporte");
  };

  const openProfileModal = () => {
    setProfileError("");
    setPasswordError("");
    setPasswordSuccess("");
    setAvatarPreview(avatarUrl);
    setAvatarName("");
    setProfileModal(true);
    setProfileOpen(false);
  };

  const chooseAvatar = () => avatarInputRef.current?.click();

  const onAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError("");
    if (!file.type.startsWith("image/")) {
      setProfileError("Selecione uma imagem válida para o perfil.");
      event.target.value = "";
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setProfileError("A foto de perfil deve ter no máximo 4 MB.");
      event.target.value = "";
      return;
    }
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarName(file.name);
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (session?.$id === "demo") { setProfileError("O perfil de demonstração não pode ser alterado."); return; }
    setProfileBusy(true);
    setProfileError("");
    try {
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
      const avatarFile = avatarInputRef.current?.files?.[0] || null;
      await updateUserProfile({
        name: values.name || "",
        cargo: values.cargo || "",
        telefone: values.telefone || "",
        avatarFile,
      });
      await refresh();
      setProfileModal(false);
      setProfileOpen(false);
      setAvatarName("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (session?.$id === "demo") { setPasswordError("A senha da demonstração não pode ser alterada."); return; }
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
      await changeUserPassword(values.current_password || "", values.new_password || "", values.confirm_password || "");
      form.reset();
      setPasswordSuccess("Senha alterada com sucesso.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[48px] items-center gap-3 rounded-xl border-l-[4px] px-4 text-[14px] font-bold transition-all ${
      isActive
        ? "border-[#f0b83f] bg-white/[.085] text-[#f5c75b] shadow-[inset_0_0_0_1px_rgba(255,255,255,.025)]"
        : "border-transparent text-slate-100 hover:bg-white/[.05] hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[254px] flex-col overflow-y-auto bg-gradient-to-b from-[#08223d] via-[#071d35] to-[#06192d] text-white shadow-[12px_0_35px_rgba(6,20,38,.12)] transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="relative flex min-h-[183px] items-center justify-center border-b border-white/[.055] px-5 py-4">
          <img src="/mw-tech-logo.png" className="h-[148px] w-[215px] object-contain mix-blend-screen" alt="MW TECH" />
          <button className="absolute right-3 top-3 rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={22} /></button>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {topItems.map(([to, label, I]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={navClass}><I size={21} strokeWidth={2} /><span>{label}</span></NavLink>)}
          <div className="pt-1">
            <div className={`flex min-h-[48px] items-center gap-3 rounded-xl border-l-[4px] px-4 text-[14px] font-bold ${financeActive ? "border-[#f0b83f] bg-white/[.085] text-[#f5c75b]" : "border-transparent text-slate-100"}`}>
              <CircleDollarSign size={21} strokeWidth={2} /><span>Financeiro</span><ChevronDown size={15} className="ml-auto" />
            </div>
            <div className="mt-1 space-y-1 pl-6">
              {financeItems.map(([to, label, I]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-[36px] items-center gap-2.5 rounded-lg px-3 text-[12px] font-semibold transition ${isActive ? "bg-white/[.07] text-[#f5c75b]" : "text-slate-300 hover:bg-white/[.05] hover:text-white"}`}><I size={15} />{label}</NavLink>)}
            </div>
          </div>
          {managementItems.map(([to, label, I]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={navClass}><I size={21} strokeWidth={2} /><span>{label}</span></NavLink>)}
          <NavLink to="/armazenamento" onClick={() => setOpen(false)} className={navClass}><Cloud size={21} strokeWidth={2} /><span>Armazenamento (Drive)</span></NavLink>
          {bottomItems.map(([to, label, I]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={navClass}><I size={21} strokeWidth={2} /><span>{label}</span></NavLink>)}
        </nav>

        <div className="relative mx-4 mb-3 overflow-hidden rounded-2xl border border-[#c99a38]/35 bg-white/[.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d7a63a]/70 to-transparent" />
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0b83f]/10 text-[#f0b83f]"><Building2 size={21} /></span><div><b className="text-sm">MW TECH</b><p className="mt-1 text-xs leading-5 text-slate-300">Gestão hoje.<br />Resultados amanhã.</p></div></div>
        </div>
        <button onClick={logout} className="mx-4 mb-4 flex min-h-[42px] items-center gap-3 rounded-xl px-4 text-sm font-semibold text-slate-400 transition hover:bg-white/[.05] hover:text-white"><LogOut size={18} />Sair</button>
      </aside>

      {open && <button onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-black/50 lg:hidden" aria-label="Fechar menu" />}

      <div className="lg:pl-[254px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#082743] via-[#0a3155] to-[#082743] px-4 text-white shadow-[0_7px_24px_rgba(6,20,38,.16)] sm:px-7 lg:px-6">
          <div className="flex items-center gap-5">
            <button className="grid size-9 place-items-center rounded-lg text-white/90 transition hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={24} /></button>
            <div className="hidden h-11 w-[500px] max-w-[40vw] items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:flex">
              <Search size={18} className="text-slate-300" /><input aria-label="Buscar no sistema" placeholder="Buscar no sistema..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400" /><span className="rounded-md bg-white/[.07] px-2 py-1 text-[11px] text-slate-300">Ctrl + K</span>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="relative">
              <button onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); }} className="relative grid size-10 place-items-center rounded-xl text-white transition hover:bg-white/10" aria-label="Notificações">
                <Bell size={20} />
                {unreadTickets.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#f5c75b] px-1.5 text-[10px] font-black text-[#061426]">{unreadTickets.length > 9 ? "9+" : unreadTickets.length}</span>}
              </button>
              {notificationOpen && <div className="absolute right-0 top-12 z-50 w-[350px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_60px_rgba(6,20,38,.25)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><b className="text-sm">Notificações</b><p className="text-[11px] text-slate-500">Chamados e novas mensagens de suporte</p></div><Headphones size={18} className="text-[#c99125]" /></div>
                <div className="max-h-[360px] overflow-y-auto p-2">
                  {unreadTickets.length ? unreadTickets.slice(0, 6).map((ticket) => <button key={ticket.id} onClick={() => openSupportTicket(ticket)} className="mb-1 w-full rounded-xl p-3 text-left transition hover:bg-slate-50"><div className="flex items-start gap-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" /><div className="min-w-0"><b className="block truncate text-[13px]">Chamado #{ticket.ticket_number} · {ticket.subject}</b><p className="mt-1 truncate text-[11px] text-slate-500">{ticket.requester_name || ticket.tenant_key || "Solicitante"}</p><span className="mt-1 block text-[10px] font-semibold text-[#b47d16]">Abrir conversa</span></div></div></button>) : <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma nova notificação.</div>}
                </div>
                <button onClick={() => openSupportTicket()} className="w-full border-t border-slate-100 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-slate-50">Abrir Central de Suporte</button>
              </div>}
            </div>
            <div className="h-7 w-px bg-white/15" />
            <div className="relative">
              <button onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false); }} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.025] px-2 py-1.5 transition hover:bg-white/[.06]">
                {avatarUrl ? <img src={avatarUrl} alt={userName} className="size-9 rounded-full border border-white/15 object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-[#061426] text-xs font-black text-[#e5b557]">{initials}</span>}
                <span className="hidden max-w-[150px] text-left leading-tight sm:block"><b className="block truncate text-[13px]">{userName}</b><small className="block truncate text-[11px] text-blue-100">{userRole}</small></span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_60px_rgba(6,20,38,.25)]">
                <div className="flex items-center gap-3 border-b border-slate-100 p-4">{avatarUrl ? <img src={avatarUrl} alt={userName} className="size-11 rounded-full object-cover" /> : <span className="grid size-11 place-items-center rounded-full bg-[#07182d] text-sm font-black text-[#e5b557]">{initials}</span>}<div className="min-w-0"><b className="block truncate text-sm">{userName}</b><p className="truncate text-xs text-slate-500">{userRole}</p></div></div>
                <div className="p-2"><button onClick={openProfileModal} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"><UserRound size={17} /> Meu perfil</button><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={17} /> Sair</button></div>
              </div>}
            </div>
          </div>
        </header>

        <main className="w-full p-4 sm:p-6 lg:p-7 xl:px-8 xl:py-6"><Outlet /></main>
      </div>

      {profileModal && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/65 p-4">
        <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><div><h3 className="text-xl font-black text-[#07182d]">Meu perfil</h3><p className="text-xs text-slate-500">Atualize seus dados, foto e segurança.</p></div><button onClick={() => setProfileModal(false)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={20} /></button></div>

          <div className="p-6">
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarPreview ? <img src={avatarPreview} alt={userName} className="size-20 rounded-2xl border border-slate-200 object-cover" /> : <span className="grid size-20 place-items-center rounded-2xl bg-[#07182d] text-xl font-black text-[#e5b557]">{initials}</span>}
                  <button type="button" onClick={chooseAvatar} className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full border-2 border-white bg-[#d8a338] text-[#07182d] shadow-sm" aria-label="Escolher foto"><Camera size={15} /></button>
                </div>
                <div><b className="block text-sm text-[#07182d]">Foto do perfil</b><p className="mt-1 text-xs text-slate-500">PNG, JPG ou WEBP, até 4 MB.</p></div>
              </div>

              <input ref={avatarInputRef} type="file" name="avatar" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} className="hidden" />
              <button type="button" onClick={chooseAvatar} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-[#d8a338] hover:bg-amber-50/40"><Camera size={17} />{avatarName ? "Trocar foto selecionada" : "Escolher foto do perfil"}</button>
              {avatarName && <p className="-mt-3 truncate text-center text-xs font-semibold text-emerald-600">Selecionada: {avatarName}</p>}

              <label className="block text-sm font-bold text-slate-600">Nome<input name="name" defaultValue={userName} required className="input mt-2" /></label>
              <label className="block text-sm font-bold text-slate-600">Cargo<input name="cargo" defaultValue={userRole} placeholder="Ex.: Administrador, Financeiro, Suporte" className="input mt-2" /></label>
              <label className="block text-sm font-bold text-slate-600">Telefone<div className="relative mt-2"><Phone size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="telefone" defaultValue={userPhone} placeholder="(89) 99999-9999" className="input !mt-0 pl-10" /></div></label>
              <div><span className="text-xs font-semibold text-slate-400">E-mail</span><p className="mt-1 text-sm font-semibold text-slate-600">{session?.email || "—"}</p></div>

              {profileError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{profileError}</p>}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setProfileModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button><button type="submit" disabled={profileBusy} className="rounded-xl bg-[#082743] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{profileBusy ? "Salvando..." : "Salvar perfil"}</button></div>
            </form>

            <div className="my-6 border-t border-slate-100" />

            <form onSubmit={changePassword} className="space-y-4">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#b47d16]"><KeyRound size={19} /></span><div><h4 className="text-sm font-black text-[#07182d]">Alterar senha</h4><p className="text-xs text-slate-500">Use sua senha atual para definir uma nova.</p></div></div>
              <label className="block text-sm font-bold text-slate-600">Senha atual<input name="current_password" type="password" autoComplete="current-password" className="input mt-2" /></label>
              <label className="block text-sm font-bold text-slate-600">Nova senha<input name="new_password" type="password" minLength={8} autoComplete="new-password" className="input mt-2" /></label>
              <label className="block text-sm font-bold text-slate-600">Confirmar nova senha<input name="confirm_password" type="password" minLength={8} autoComplete="new-password" className="input mt-2" /></label>
              {passwordError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{passwordError}</p>}
              {passwordSuccess && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{passwordSuccess}</p>}
              <button type="submit" disabled={passwordBusy} className="w-full rounded-xl border border-[#082743] bg-[#082743] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0b355d] disabled:opacity-60">{passwordBusy ? "Alterando senha..." : "Alterar senha"}</button>
            </form>
          </div>
        </div>
      </div>}
    </div>
  );
}
