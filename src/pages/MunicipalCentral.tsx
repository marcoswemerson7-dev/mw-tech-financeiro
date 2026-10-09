import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink, FolderKanban, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/UI";
import { getManagedSystems, getManagedSystemsCached, type ManagedSystem } from "../services/managedSystems";

function validWebUrl(value?: string) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const statusNames: Record<string, string> = { ativo: "Ativo", implantacao: "Em implantação", suspenso: "Suspenso", inativo: "Inativo" };

export default function MunicipalCentral() {
  const [systems, setSystems] = useState<ManagedSystem[]>(() => getManagedSystemsCached() || []);
  const [loading, setLoading] = useState(!getManagedSystemsCached());
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    getManagedSystems(true).then(rows => { if (active) setSystems(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar os sistemas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const municipalities = useMemo(() => {
    const unique = new Map<string, string>();
    systems.filter(item => normalized(item.tipo_orgao || "").includes("prefeitura")).forEach(item => {
      const label = item.orgao?.trim();
      if (label && !unique.has(normalized(label))) unique.set(normalized(label), label);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [systems]);

  const selectedMunicipality = municipalities.find(name => normalized(name) === normalized(selected)) || "";
  const visible = useMemo(() => systems.filter(item =>
    Boolean(selectedMunicipality) &&
    normalized(item.orgao || "") === normalized(selectedMunicipality) &&
    normalized(`${item.sistema} ${item.ambiente} ${item.status}`).includes(normalized(query))
  ), [systems, selectedMunicipality, query]);
  const activeCount = visible.filter(item => item.status === "ativo").length;

  return <div className="space-y-6">
    <PageHeader title="Central Municipal" subtitle="Ambiente interno da MW TECH para consultar os sistemas cadastrados por prefeitura."/>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <label className="text-sm font-semibold text-slate-700">Prefeitura
          <select className="input mt-2" value={selectedMunicipality} onChange={event => { setSelected(event.target.value); setQuery(""); }}>
            <option value="">Selecione uma prefeitura</option>
            {municipalities.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Pesquisar módulos
          <div className="relative mt-2"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input className="input !mt-0 !pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="Sistema, ambiente ou status..." disabled={!selectedMunicipality}/>
          </div>
        </label>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-slate-600"/>
        Esta central organiza atalhos. A autenticação e as permissões continuam sendo controladas individualmente por cada sistema.
      </div>
    </section>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {loading ? <p className="text-sm text-slate-500">Carregando sistemas cadastrados...</p> : !selectedMunicipality ?
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><Building2 className="mx-auto mb-3 text-slate-400" size={32}/><h2 className="font-semibold text-slate-800">Selecione uma prefeitura</h2><p className="mt-2 text-sm text-slate-500">Os módulos são apresentados separadamente para cada órgão.</p></div>
      : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#102a43]">{selectedMunicipality}</h2><p className="text-sm text-slate-500">{visible.length} módulo(s) encontrado(s) · {activeCount} ativo(s)</p></div>
        {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(item => {
            const link = validWebUrl(item.acesso_url || item.dominio_url);
            const enabled = item.status === "ativo";
            return <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{item.logo_url ? <img src={item.logo_url} alt="" className="h-full w-full object-contain p-1"/> : <FolderKanban size={23} className="text-[#173b61]"/>}</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{statusNames[item.status] || "Não informado"}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#102a43]">{item.sistema}</h3>
              <p className="mt-1 text-sm text-slate-500">Ambiente: {item.ambiente || "Não informado"}</p>
              <div className="mt-auto pt-5">{enabled && link ?
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#102a43] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173b61]">Abrir sistema <ExternalLink size={16}/></a>
                : <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-500">{!enabled ? "Acesso indisponível pelo status" : "Endereço de acesso não cadastrado"}</div>}
              </div>
            </article>;
          })}
        </div> : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhum módulo encontrado para esta seleção. Cadastre-o primeiro em “Sistemas e órgãos”.</div>}
      </>}
  </div>;
}
