import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  FileCheck2,
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  certificateDaysRemaining,
  deleteCertificate,
  listCertificates,
  saveCertificate,
  type CompanyCertificate,
} from "../services/certificates";

const ISSUERS = [
  { nome: "CNPJ — Comprovante de Inscrição", orgao: "Receita Federal", categoria: "Cadastral", url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" },
  { nome: "Certidão Federal RFB/PGFN", orgao: "Receita Federal / PGFN", categoria: "Fiscal", url: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir" },
  { nome: "CRF do FGTS", orgao: "Caixa Econômica Federal", categoria: "Trabalhista", url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf" },
  { nome: "CNDT", orgao: "Tribunal Superior do Trabalho", categoria: "Trabalhista", url: "https://cndt-certidao.tst.jus.br/" },
  { nome: "Certidão Estadual", orgao: "SEFAZ-PI", categoria: "Fiscal", url: "https://portal.sefaz.pi.gov.br/" },
  { nome: "Certidão Municipal", orgao: "Prefeitura de Ribeiro Gonçalves", categoria: "Fiscal", url: "https://ribeirogoncalves.pi.gov.br/" },
  { nome: "Falência e Recuperação Judicial", orgao: "TJPI", categoria: "Jurídica", url: "https://www.tjpi.jus.br/themisconsulta/certidao" },
  { nome: "Certidão Correcional", orgao: "CGU", categoria: "Integridade", url: "https://certidoes.cgu.gov.br/" },
  { nome: "Consulta Consolidada de Pessoa Jurídica", orgao: "TCU", categoria: "Integridade", url: "https://certidoes-apf.apps.tcu.gov.br/" },
  { nome: "Certidão de Inidoneidade", orgao: "TCE-PI", categoria: "Integridade", url: "https://www.tcepi.tc.br/" },
  { nome: "SICAF", orgao: "Compras.gov.br", categoria: "Cadastro", url: "https://www3.comprasnet.gov.br/sicaf-web/index.jsf" },
] as const;

const fmt = (date?: string) => {
  if (!date) return "Sem data";
  const value = new Date(date + "T12:00:00");
  return Number.isNaN(value.getTime()) ? "Sem data" : value.toLocaleDateString("pt-BR");
};

function statusMeta(item: CompanyCertificate) {
  const days = certificateDaysRemaining(item.validade);
  if (item.status === "vencida") return { label: "Vencida", detail: days === null ? "" : `${Math.abs(days)} dia(s) vencida`, cls: "bg-rose-50 text-rose-700 border-rose-200" };
  if (item.status === "atencao") return { label: "Atenção", detail: days === null ? "" : `vence em ${days} dia(s)`, cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (item.status === "sem_validade") return { label: "Sem validade", detail: "controle manual", cls: "bg-slate-50 text-slate-600 border-slate-200" };
  return { label: "Válida", detail: days === null ? "" : `vence em ${days} dia(s)`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function Certificates() {
  const [items, setItems] = useState<CompanyCertificate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CompanyCertificate | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await listCertificates());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as certidões.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [item.nome, item.orgao, item.categoria].join(" ").toLowerCase().includes(term));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    validas: items.filter((item) => item.status === "valida").length,
    atencao: items.filter((item) => item.status === "atencao").length,
    vencidas: items.filter((item) => item.status === "vencida").length,
  }), [items]);

  const openNew = () => {
    setEditing(null);
    setFile(null);
    setModal(true);
  };

  const openEdit = (item: CompanyCertificate) => {
    setEditing(item);
    setFile(null);
    setModal(true);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
      await saveCertificate({
        id: editing?.id,
        nome: values.nome,
        orgao: values.orgao,
        categoria: values.categoria,
        emissao: values.emissao,
        validade: values.validade,
        url_emissao: values.url_emissao,
        observacao: values.observacao,
        arquivo_id: editing?.arquivo_id,
        arquivo_url: editing?.arquivo_url,
      }, file);
      setModal(false);
      setEditing(null);
      setFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a certidão.");
    } finally {
      setFormBusy(false);
    }
  };

  const remove = async (item: CompanyCertificate) => {
    if (!window.confirm(`Excluir "${item.nome}" do controle de certidões?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteCertificate(item);
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir a certidão.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">MW TECH — Empresa</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#07182d]">Certidões e Regularidade</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Controle a habilitação da MW TECH, acompanhe vencimentos, guarde os PDFs e acesse os emissores oficiais sem procurar cada portal novamente.</p>
        </div>
        <button onClick={openNew} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102a43] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#173b5e]"><Plus size={18}/>Nova certidão</button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total controlado", stats.total, FileCheck2, "text-slate-700 bg-slate-50"],
          ["Válidas", stats.validas, BadgeCheck, "text-emerald-700 bg-emerald-50"],
          ["Vencendo em 30 dias", stats.atencao, CalendarClock, "text-amber-700 bg-amber-50"],
          ["Vencidas", stats.vencidas, AlertTriangle, "text-rose-700 bg-rose-50"],
        ] as const).map(([label, value, Icon, cls]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-500">{label}</span><span className={`grid size-10 place-items-center rounded-xl ${cls}`}><Icon size={20}/></span></div>
            <strong className="mt-4 block text-3xl font-black text-[#07182d]">{value as number}</strong>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-[#07182d]"><ShieldCheck size={20} className="text-[#c99125]"/>Emissores oficiais</h2>
            <p className="mt-1 text-xs text-slate-500">Atalhos para renovar a pasta de habilitação da empresa.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[70%]">
            {ISSUERS.map((item) => <a key={item.nome} href={item.url} target="_blank" rel="noopener noreferrer" title={item.nome} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[#d8a338] hover:bg-amber-50"><ExternalLink size={14}/>{item.orgao}</a>)}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#07182d]">Pasta de certidões</h2>
            <p className="mt-1 text-xs text-slate-500">Alertas automáticos com 30 dias de antecedência.</p>
          </div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar certidão..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#d8a338]"/>
            </label>
            <button onClick={() => void load()} disabled={busy} title="Atualizar" className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={17} className={busy ? "animate-spin" : ""}/></button>
          </div>
        </div>

        {error && <p role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

        {filtered.length ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const meta = statusMeta(item);
              return (
                <div key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(140px,.7fr)_minmax(180px,.8fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-[#102a43]"><FileText size={21}/></span>
                    <div className="min-w-0">
                      <button onClick={() => openEdit(item)} className="block max-w-full truncate text-left text-sm font-black text-[#07182d] hover:text-blue-700">{item.nome}</button>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.orgao || "Órgão não informado"} · {item.categoria}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500"><span className="block font-bold text-slate-700">Validade</span>{fmt(item.validade)}</div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${meta.cls}`}>{meta.label}</span><p className="mt-1 text-[11px] text-slate-500">{meta.detail}</p></div>
                  <div className="flex items-center justify-end gap-2">
                    {item.arquivo_url && <a href={item.arquivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><FileText size={14}/>PDF</a>}
                    {item.url_emissao && <a href={item.url_emissao} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50" title="Emitir novamente"><ExternalLink size={15}/></a>}
                    <button onClick={() => void remove(item)} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50" title="Excluir"><Trash2 size={15}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="px-5 py-14 text-center text-sm text-slate-500">{busy ? "Carregando certidões..." : "Nenhuma certidão cadastrada. Use “Nova certidão” para montar sua pasta de habilitação."}</div>}
      </section>

      {modal && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/65 p-4">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
              <div><h3 className="text-xl font-black text-[#07182d]">{editing ? "Editar certidão" : "Nova certidão"}</h3><p className="mt-1 text-xs text-slate-500">Cadastre validade, PDF e acesso rápido ao emissor.</p></div>
              <button onClick={() => setModal(false)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="grid gap-4 p-6 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-600 md:col-span-2">Certidão
                <input name="nome" defaultValue={editing?.nome || ""} required list="mw-certificates-list" className="input mt-2" placeholder="Ex.: Certidão Federal RFB/PGFN"/>
                <datalist id="mw-certificates-list">{ISSUERS.map((item) => <option key={item.nome} value={item.nome}/>)}</datalist>
              </label>
              <label className="text-sm font-bold text-slate-600">Órgão
                <input name="orgao" defaultValue={editing?.orgao || ""} className="input mt-2" placeholder="Receita Federal / PGFN"/>
              </label>
              <label className="text-sm font-bold text-slate-600">Categoria
                <select name="categoria" defaultValue={editing?.categoria || "Fiscal"} className="input mt-2"><option>Fiscal</option><option>Trabalhista</option><option>Jurídica</option><option>Integridade</option><option>Cadastral</option><option>Cadastro</option><option>Outras</option></select>
              </label>
              <label className="text-sm font-bold text-slate-600">Data de emissão
                <input name="emissao" type="date" defaultValue={editing?.emissao || ""} className="input mt-2"/>
              </label>
              <label className="text-sm font-bold text-slate-600">Validade
                <input name="validade" type="date" defaultValue={editing?.validade || ""} className="input mt-2"/>
              </label>
              <label className="text-sm font-bold text-slate-600 md:col-span-2">Link oficial para emissão
                <input name="url_emissao" type="url" defaultValue={editing?.url_emissao || ""} className="input mt-2" placeholder="https://..."/>
              </label>
              <label className="text-sm font-bold text-slate-600 md:col-span-2">PDF da certidão
                <span className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <UploadCloud size={20} className="text-[#c99125]"/>
                  <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} className="min-w-0 flex-1 text-xs"/>
                </span>
                {editing?.arquivo_url && !file && <span className="mt-1 block text-xs font-semibold text-emerald-600">PDF atual será mantido.</span>}
              </label>
              <label className="text-sm font-bold text-slate-600 md:col-span-2">Observações
                <textarea name="observacao" defaultValue={editing?.observacao || ""} rows={3} className="input mt-2 min-h-24 resize-y" placeholder="Ex.: exigida em licitações municipais; renovar antes do vencimento."/>
              </label>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 md:col-span-2">
                <button type="button" onClick={() => setModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
                <button type="submit" disabled={formBusy} className="rounded-xl bg-[#102a43] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{formBusy ? "Salvando..." : "Salvar certidão"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
