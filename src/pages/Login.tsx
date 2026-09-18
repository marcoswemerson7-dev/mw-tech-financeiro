import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, Fingerprint, LockKeyhole, MonitorPlay, ShieldCheck } from "lucide-react";
import { isAppwriteConfigured } from "../lib/appwrite";
import { useAuth } from "../lib/auth";
import { authService } from "../services/auth";

function formatIdentifier(value: string) {
  if (value.includes("@") || /[a-zA-Z]/.test(value)) return value;
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function Login() {
  const { session, enterDemo, refresh } = useAuth();
  const [identifier, setIdentifier] = useState("");
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
      await authService.login(identifier, password);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f4f7fb] p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-[#0b355d]/[.07] blur-3xl" />
        <div className="absolute -bottom-24 -right-20 size-96 rounded-full bg-[#d9a443]/[.08] blur-3xl" />
      </div>

      <section className="relative w-full max-w-[440px]">
        <div className="mb-5 flex justify-center">
          <div className="grid size-24 place-items-center overflow-hidden rounded-[24px] bg-[#06192d] shadow-[0_16px_45px_rgba(7,24,45,.18)] ring-1 ring-white">
            <img src="/mw-tech-logo.png" alt="MW TECH" className="h-[78px] w-[78px] object-contain" />
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[26px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,.12)] backdrop-blur sm:p-8"
        >
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#b78331]">MW TECH Control</p>
            <h1 className="mt-2 text-[30px] font-black tracking-[-.035em] text-[#06192d]">Acesse sua conta</h1>
            <p className="mx-auto mt-2 max-w-xs text-[13px] leading-5 text-slate-500">
              Entre usando seu CPF ou e-mail cadastrado.
            </p>
          </div>

          {!isAppwriteConfigured && (
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs leading-5 text-blue-900">O Appwrite ainda não está configurado neste ambiente.</p>
              <button
                type="button"
                onClick={enterDemo}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white"
              >
                <MonitorPlay size={17} /> Entrar no modo demonstração
              </button>
            </div>
          )}

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[12px] font-black text-slate-700">CPF ou e-mail</span>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(formatIdentifier(e.target.value))}
                  disabled={!isAppwriteConfigured}
                  placeholder="000.000.000-00 ou email@empresa.com"
                  className="h-[52px] w-full rounded-xl border border-slate-200 bg-[#f8fafc] pl-11 pr-4 text-[14px] font-semibold text-[#07182d] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#b78331] focus:bg-white focus:ring-4 focus:ring-amber-500/[.08] disabled:bg-slate-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[12px] font-black text-slate-700">Senha</span>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!isAppwriteConfigured}
                  placeholder="Digite sua senha"
                  className="h-[52px] w-full rounded-xl border border-slate-200 bg-[#f8fafc] pl-11 pr-12 text-[14px] font-semibold text-[#07182d] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#b78331] focus:bg-white focus:ring-4 focus:ring-amber-500/[.08] disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-semibold leading-5 text-rose-700">
              {error}
            </p>
          )}

          <button
            disabled={busy || !isAppwriteConfigured}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#082743] text-[14px] font-black text-white shadow-[0_10px_28px_rgba(8,39,67,.16)] transition hover:bg-[#0b355d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
            <ShieldCheck size={14} />
            Acesso seguro · MW TECH Sistemas e Soluções Digitais
          </div>
        </form>

        <p className="mt-5 text-center text-[10px] font-semibold text-slate-400">
          © 2026 MW TECH · Control
        </p>
      </section>
    </main>
  );
}
