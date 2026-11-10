import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { authService } from "../services/auth";
import { isAppwriteConfigured } from "../lib/appwrite";

export default function CentralLogin() {
  const { session, refresh } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (session && session.$id !== "demo") return <Navigate to="/central-sistemas" replace />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await authService.login(identifier.trim(), password); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Falha na autenticação."); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#edf2f8] px-4 py-10">
    <div className="w-full max-w-md">
      <div className="mb-6 text-center"><img src="/mw-tech-logo.png" alt="MW TECH" className="mx-auto size-24 rounded-2xl bg-[#102a43] object-contain p-2"/><h1 className="mt-5 text-2xl font-bold text-[#102a43]">Central de Sistemas</h1><p className="mt-2 text-sm text-slate-600">Entre para acessar os sistemas e órgãos da MW TECH.</p></div>
      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">CPF ou e-mail<input required autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Informe seu acesso" className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-blue-600"/></label>
        <label className="block text-sm font-semibold text-slate-700">Senha<div className="relative mt-2"><LockKeyhole size={17} className="absolute left-3 top-4 text-slate-400"/><input required autoComplete="current-password" type={visible ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-12 outline-none focus:border-blue-600"/><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-3 text-slate-500">{visible ? <EyeOff size={20}/> : <Eye size={20}/>}</button></div></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!isAppwriteConfigured && <p className="text-sm text-amber-700">A autenticação precisa ser configurada neste ambiente.</p>}
        <button disabled={busy || !isAppwriteConfigured} className="h-12 w-full rounded-xl bg-[#102a43] font-semibold text-white hover:bg-[#173d63] disabled:opacity-50">{busy ? "Entrando..." : "Entrar na Central"}</button>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck size={15}/> Acesso seguro MW TECH</p>
      </form>
    </div>
  </main>;
}