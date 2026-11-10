import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Building2, ExternalLink, FileCheck2, Landmark,
  LayoutGrid, LogOut, RefreshCw, ShieldCheck, Truck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getManagedSystems, type ManagedSystem } from "../services/managedSystems";

const categories = [
  { name: "Gestão Licita", description: "Licitações, contratos e processos", icon: FileCheck2, terms: ["licita"] },
  { name: "MW TECH Patrimônio", description: "Bens patrimoniais e tombamentos", icon: Landmark, terms: ["patrimonio", "tombamento"] },
  { name: "Gestão Frota", description: "Veículos, motoristas e abastecimentos", icon: Truck, terms: ["frota", "veiculo"] },
  { name: "Controladoria", description: "Controle interno e pareceres", icon: ShieldCheck, terms: ["controladoria", "controle interno"] },
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
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

export default function CentralSistemas() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [systems, setSystems] = useState<ManagedSystem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const onCentralHost = window.location.hostname === "central.mwtechsistemas.com.br";

  async function exit() {
    await logout();
    navigate("/central-login", { replace: true });
  }
  function load() {
    setLoading(true);
    setError("");
    getManagedSystems(true)
      .then(setSystems)
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar os órgãos."))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    let active = true;
    getManagedSystems()
      .then((data) => { if (active) setSystems(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar os órgãos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const category = categories.find((item) => item.name === selected);
  const organs = useMemo(() => systems.filter((item) =>
    normalize(item.status || "ativo") !== "inativo" && !!category && matches(item, category.terms)
  ).sort((a, b) => a.orgao.localeCompare(b.orgao, "pt-BR")), [systems, category]);

  return <main className="min-h-screen bg-[#f2f5f9] text-[#102a43]">
    <header className="relative z-10 bg-[#0c2945] text-white shadow-sm">
      <div className="mx-auto flex min-h-[88px] max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-[#163956]">
            <img src="/mw-tech-logo.png" alt="MW TECH" className="size-12 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[.19em] text-[#dcb878]">MW TECH Sistemas</div>
            <h1 className="mt-0.5 text-lg font-bold leading-tight sm:text-xl">Central de Sistemas</h1>
            <p className="mt-1 text-xs text-slate-300">Gestão integrada. Acesso simplificado.</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="mr-1 max-w-[200px] truncate text-xs font-medium text-slate-200">{session?.name || session?.email}</span>
          {!onCentralHost && <Link to="/" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">MW TECH Control</Link>}
          <button type="button" onClick={() => void exit()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><LogOut size={15} /> Sair</button>
        </div>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-9 sm:px-8 sm:pt-12">
      <div className="mb-8 rounded-3xl border border-[#dbe4ed] bg-white px-6 py-7 shadow-[0_8px_30px_rgba(16,42,67,.04)] sm:px-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#b48742]"><LayoutGrid size={16} /> Portal de acesso</div>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            {selected && <button type="button" onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"><ArrowLeft size={16}/> Todos os sistemas</button>}
            <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-[29px]">{selected || "Qual sistema deseja acessar?"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selected ? "Selecione o órgão para abrir o ambiente correspondente." : "Selecione uma solução abaixo e, em seguida, escolha a prefeitura ou câmara."}</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={16}/> Atualizar</button>
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs font-semibold">
          <span className={selected ? "text-blue-700" : "text-[#0c2945]"}>01 · Escolher sistema</span>
          <ArrowRight size={14} className="text-slate-400"/>
          <span className={selected ? "text-[#0c2945]" : "text-slate-400"}>02 · Escolher órgão</span>
        </div>
      </div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!selected ? <div className="grid gap-4 sm:grid-cols-2">
        {categories.map(({name,description,icon:Icon}) => {
          const available = systems.filter((item) => normalize(item.status || "ativo") !== "inativo" && matches(item, categories.find((c) => c.name === name)!.terms)).length;
          return <button type="button" key={name} onClick={() => setSelected(name)} className="group flex min-h-[150px] items-center gap-5 rounded-2xl border border-[#dce5ee] bg-white p-5 text-left shadow-[0_4px_18px_rgba(16,42,67,.045)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg sm:p-7">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#e9f1fb] text-[#1257a5] transition group-hover:bg-[#dceafd]"><Icon size={29} strokeWidth={1.8}/></span>
            <span className="min-w-0 flex-1"><span className="block text-lg font-bold">{name}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span><span className="mt-3 block text-xs font-semibold text-[#54718f]">{loading ? "Carregando órgãos..." : available === 1 ? "1 órgão cadastrado" : available + " órgãos cadastrados"}</span></span>
            <ArrowRight size={20} className="shrink-0 text-slate-400 group-hover:text-blue-700"/>
          </button>;
        })}
      </div> : loading ? <div className="rounded-2xl bg-white p-7 text-sm text-slate-600">Carregando órgãos...</div> : organs.length ? <div className="grid gap-4 sm:grid-cols-2">{organs.map((item) => {
        const url = safeUrl(item);
        return <article key={item.id} className="flex min-h-[130px] flex-wrap items-center gap-4 rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-sm sm:p-6">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e9f1fb] text-[#1257a5]"><Building2 size={23}/></div>
          <div className="min-w-0 flex-1"><h3 className="font-bold leading-5">{item.orgao}</h3><p className="mt-1 text-xs text-slate-500">{item.tipo_orgao || "Órgão"} · {item.ambiente || "Produção"}</p></div>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#105897] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0d497d]">Acessar <ExternalLink size={15}/></a> : <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Link não cadastrado</span>}
        </article>;
      })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
        Nenhum órgão ativo encontrado para este sistema. Cadastre o órgão e seu endereço em <Link className="font-bold text-blue-700 underline" to="/sistemas">Sistemas e órgãos</Link>.
      </div>}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#dde5ee] bg-[#eaf0f7]/70 px-5 py-4 text-xs leading-5 text-slate-600">
        <ShieldCheck size={18} className="shrink-0 text-[#235b88]"/>
        <p>A Central reúne os links cadastrados. As permissões e o login de cada sistema continuam independentes.</p>
      </div>
    </section>
  </main>;
}
