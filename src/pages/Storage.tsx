import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, FolderOpen, RefreshCw } from "lucide-react";
import { getDriveStorageUsage, type DriveStorageUsage } from "../services/googleDrive";

export default function Storage() {
  const [data, setData] = useState<DriveStorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (force = false) => {
    setLoading(true);
    setError("");
    getDriveStorageUsage(force)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(false); }, []);

  const percent = Math.max(0, Math.min(100, data?.percent || 0));

  return (
    <div className="space-y-5 pb-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,35,70,.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><Cloud size={25} /></span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#d49d24]">MW TECH CONTROL</p>
              <h1 className="mt-1 text-[30px] font-black text-[#071d35]">Armazenamento Google Drive</h1>
              <p className="mt-1 text-sm text-slate-500">Acompanhe o uso total e o consumo das pastas de cada prefeitura ou órgão.</p>
            </div>
          </div>
          <button onClick={() => load(true)} disabled={loading} className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-[#071d35] transition hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </section>

      {loading && !data ? (
        <section className="grid min-h-[240px] place-items-center rounded-2xl border border-slate-200 bg-white">
          <div className="text-center text-slate-500"><RefreshCw className="mx-auto animate-spin text-blue-600" size={30}/><p className="mt-3 font-semibold">Consultando o Google Drive...</p></div>
        </section>
      ) : error && !data ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3"><AlertTriangle size={22} className="mt-0.5 shrink-0"/><div><b>Google Drive aguardando configuração</b><p className="mt-1 text-sm">{error}</p></div></div>
        </section>
      ) : data ? (
        <>
          {error && <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">Não foi possível atualizar agora. Exibindo os últimos dados carregados.</section>}
          <section className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
            <div className="rounded-2xl bg-[#071d35] p-6 text-white shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.18em] text-blue-200">Uso total</p>
              <strong className="mt-4 block text-[42px] font-black">{percent.toFixed(1)}%</strong>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-blue-500" style={{width:`${percent}%`}}/></div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Metric label="Usado" value={`${data.usedGb.toFixed(2)} GB`} />
                <Metric label="Disponível" value={`${data.availableGb.toFixed(2)} GB`} />
                <Metric label="Plano" value={`${data.totalGb.toFixed(0)} GB`} />
              </div>
              <p className="mt-5 text-xs text-blue-200">Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-[#071d35]">Pastas por órgão</h2><span className="text-xs font-semibold text-slate-500">{data.folders.length} monitorada(s)</span></div>
              {data.folders.length ? <div className="grid gap-3 sm:grid-cols-2">{data.folders.map(folder => (
                <article key={folder.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-white text-[#d49d24]"><FolderOpen size={20}/></span><div className="min-w-0"><b className="block truncate text-sm text-[#071d35]">{folder.name}</b><span className="text-xs text-slate-500">{folder.files.toLocaleString("pt-BR")} arquivos • {folder.folders.toLocaleString("pt-BR")} pastas</span></div></div><strong className="whitespace-nowrap text-sm font-black text-[#071d35]">{folder.usedGb.toFixed(2)} GB</strong></div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{width:`${Math.min(100,folder.percentOfTotal)}%`}}/></div>
                  <p className="mt-2 text-right text-[11px] font-bold text-slate-500">{folder.percentOfTotal.toFixed(1)}% do armazenamento total</p>
                </article>
              ))}</div> : <div className="grid min-h-[180px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500"><div><FolderOpen className="mx-auto mb-2 text-slate-400"/><b>Nenhuma pasta configurada</b></div></div>}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl bg-white/[.07] px-2 py-3"><span className="block text-[11px] font-bold text-blue-200">{label}</span><b className="mt-1 block text-sm">{value}</b></div>;
}
