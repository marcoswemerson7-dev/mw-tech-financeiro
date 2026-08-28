import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, MonitorPlay, ShieldCheck } from "lucide-react";
import { isAppwriteConfigured } from "../lib/appwrite";
import { useAuth } from "../lib/auth";
import { authService } from "../services/auth";

export default function Login() {
  const { session, enterDemo, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authService.login(email, password);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef2f7] lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#07182d] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 size-[430px] rounded-full border border-white/5 bg-[#0b2b66]/60" />
        <div className="absolute -bottom-36 left-24 size-[420px] rounded-full border border-[#d9a443]/10 bg-[#0a2342]" />
        <div className="relative z-10">
          <img src="/mw-tech-logo.png" alt="MW TECH" className="h-28 w-48 object-contain object-left mix-blend-screen" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="mb-7 h-1.5 w-20 rounded-full bg-[#d9a443]" />
          <p className="text-[13px] font-bold uppercase tracking-[.28em] text-[#efc46c]">MW TECH Financeiro</p>
          <h1 className="mt-5 max-w-xl text-[54px] font-extrabold leading-[1.08] tracking-[-.035em]">
            Controle financeiro simples, seguro e organizado.
          </h1>
          <p className="mt-6 max-w-lg text-[18px] leading-8 text-slate-300">
            Acompanhe entradas, saídas, contas, despesas e resultados com uma visão clara do seu negócio.
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm font-semibold text-slate-300">
            <span className="grid size-10 place-items-center rounded-lg bg-white/10 text-[#efc46c]"><ShieldCheck size={21} /></span>
            Ambiente administrativo MW TECH
          </div>
        </div>
        <p className="relative z-10 text-[13px] text-slate-500">© 2026 MW TECH · Sistemas e Soluções Digitais</p>
      </section>

      <section className="grid min-h-screen place-items-center bg-[#f7f9fc] p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-[500px] rounded-[22px] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,.12)] sm:p-11">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-[.18em] text-[#b97f2e]">Acesso ao sistema</p>
              <h2 className="mt-2 text-[34px] font-extrabold tracking-[-.03em] text-[#071a38]">Bem-vindo</h2>
              <p className="mt-2 text-[15px] text-slate-500">Entre com sua conta administrativa.</p>
            </div>
            <div className="grid size-14 place-items-center rounded-xl bg-[#07182d] text-[#e5b557] shadow-sm"><LockKeyhole size={24} /></div>
          </div>

          {!isAppwriteConfigured && (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">Você pode conhecer o sistema antes de configurar o Appwrite.</p>
              <button type="button" onClick={enterDemo} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white">
                <MonitorPlay size={18} /> Entrar no modo demonstração
              </button>
            </div>
          )}

          <label className="block text-[14px] font-bold text-slate-700">
            E-mail
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isAppwriteConfigured}
                placeholder="seuemail@empresa.com.br"
                className="h-[54px] w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-[16px] outline-none transition focus:border-[#245aa2] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100"
              />
            </div>
          </label>

          <label className="mt-5 block text-[14px] font-bold text-slate-700">
            Senha
            <div className="relative mt-2">
              <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!isAppwriteConfigured}
                placeholder="Digite sua senha"
                className="h-[54px] w-full rounded-xl border border-slate-300 bg-white pl-12 pr-12 text-[16px] outline-none transition focus:border-[#245aa2] focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Mostrar ou ocultar senha">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>

          {error && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

          <button disabled={busy || !isAppwriteConfigured} className="mt-7 h-[54px] w-full rounded-xl bg-[#0b2b66] text-[16px] font-bold text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#082454] disabled:opacity-40">
            {busy ? "Entrando..." : "Entrar"}
          </button>

          <p className="mt-6 text-center text-[12px] text-slate-400">Acesso restrito · MW TECH Financeiro</p>
        </form>
      </section>
    </div>
  );
}
