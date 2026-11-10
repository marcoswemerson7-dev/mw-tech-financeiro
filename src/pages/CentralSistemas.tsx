import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, FileCheck2, Landmark, LogOut, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getManagedSystems, type ManagedSystem } from "../services/managedSystems";

const categories = [
  { name: "Gestão Licita", icon: FileCheck2, terms: ["licita", "licitacoes", "licitacoes"] },
  { name: "MW TECH Patrimônio", icon: Landmark, terms: ["patrimonio", "tombamento"] },
  { name: "Gestão Frota", icon: Truck, terms: ["frota", "veiculo"] },
  { name: "Controladoria", icon: ShieldCheck, terms: ["controladoria", "controle interno"] },
] as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function matches(item: ManagedSystem, terms: readonly string[]) {
  return terms.some((term) => normalize(item.sistema || "").includes(term));
}
function safeUrl(item: ManagedSystem) {
  const raw = (item.acesso_url || item.dominio_url || item.vercel_url || "").trim();
  try {
    const url = new URL(raw.startsWith("http") ? raw : "https://" + raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}

export default function CentralSistemas() {
  const { session, logout } = useAuth();
  const [systems, setSystems] = useState<ManagedSystem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    getManagedSystems(true).then(setSystems).catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar os órgãos.")).finally(() => setLoading(false));
  };
  useEffect(() => {
    let active = true;
    getManagedSystems().then((data) => { if (active) setSystems(data); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar os órgãos."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const category = categories.find((c) => c.name === selected);
  const organs = useMemo(() => systems.filter((item) =>
    normalize(item.status || "ativo") !== "inativo" && category && matches(item, category.terms)
  ).sort((a, b) => a.orgao.localeCompare(b.orgao, "pt-BR")), [systems, category]);

  return <main className="min-h-screen bg-[#f3f6fb] text-[#102a43]">
    <header className="border-b border-slate-200 bg-[#102a43] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3"><img src="/mw-tech-logo.png" alt="MW TECH" className="size-14 rounded-xl bg-white/10 object-contain p-1" /><div><h1 className="text-xl font-bold">MW TECH · Central de Sistemas</h1><p className="text-xs text-slate-300">Acesso organizado por sistema e órgão</p></div></div>
        <div className="flex items-center gap-3 text-sm"><span className="hidden text-slate-200 sm:block">{session?.name || session?.email}</span><Link to="/" className="rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10">MW TECH Control</Link><button onClick={() => void logout()} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10"><LogOut size={16} /> Sair</button></div>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>{selected && <button onClick={() => setSelected(null)} className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16}/> Voltar aos sistemas</button>}<h2 className="text-2xl font-bold">{selected || "Escolha o sistema que deseja acessar"}</h2><p className="mt-2 text-sm text-slate-600">{selected ? "Agora selecione o órgão responsável pelo sistema." : "Escolha uma das soluções disponíveis na central MW TECH."}</p></div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16}/> Atualizar</button>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!selected ? <div className="grid gap-4 sm:grid-cols-2">
        {categories.map(({name,icon:Icon}) => <button key={name} onClick={() => setSelected(name)} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"><span className="rounded-2xl bg-[#eaf2fc] p-4 text-blue-700"><Icon size={28}/></span><span className="flex-1 text-lg font-bold">{name}</span><ArrowUpRight size={20} className="text-slate-400"/></button>)}
      </div> : loading ? <div className="rounded-xl bg-white p-6 text-sm text-slate-600">Carregando órgãos...</div> : organs.length ? <div className="grid gap-3 sm:grid-cols-2">{organs.map(item => {
        const url = safeUrl(item);
        return <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="rounded-xl bg-slate-100 p-3"><Building2 size={22}/></div><div className="min-w-0 flex-1"><h3 className="font-bold">{item.orgao}</h3><p className="text-xs text-slate-500">{item.tipo_orgao || "Órgão"} · {item.ambiente || "Produção"}</p></div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Acessar <span aria-hidden="true">↗</span></a> : <span className="text-xs text-amber-700">Link não cadastrado</span>}</article>;
      })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Nenhum órgão ativo cadastrado para este sistema. Cadastre o órgão e seu link em <Link className="font-semibold text-blue-700 underline" to="/sistemas">Sistemas e órgãos</Link>.</div>}
      <p className="mt-8 text-xs text-slate-500">A Central organiza os links existentes. Cada sistema mantém suas próprias permissões e autenticação.</p>
    </section>
  </main>;
}
