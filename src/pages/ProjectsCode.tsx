import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FolderOpen,
  Github,
  GitBranch,
  LockKeyhole,
  Save,
  Monitor,
} from "lucide-react";

const REPOSITORY_NAME = "gestao-licitacoes-mwtech";
const REPOSITORY_FULL_NAME = "marcoswemerson7-dev/gestao-licitacoes-mwtech";
const REPOSITORY_URL = "https://github.com/marcoswemerson7-dev/gestao-licitacoes-mwtech";
const CLONE_URL = "https://github.com/marcoswemerson7-dev/gestao-licitacoes-mwtech.git";
const LOCAL_PATH_KEY = "mw-tech:projects:gestao-licitacoes-mwtech:local-path";

function toVsCodeFileUri(path: string) {
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return `vscode://file/${normalized}`;
}

function cloneInVsCodeUri() {
  return `vscode://vscode.git/clone?url=${encodeURIComponent(CLONE_URL)}`;
}

export default function ProjectsCode() {
  const [localPath, setLocalPath] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const value = localStorage.getItem(LOCAL_PATH_KEY) || "";
    setLocalPath(value);
    setSavedPath(value);
  }, []);

  const vscodeUrl = useMemo(
    () => (savedPath.trim() ? toVsCodeFileUri(savedPath) : cloneInVsCodeUri()),
    [savedPath],
  );

  const saveLocalPath = () => {
    const value = localPath.trim();
    if (value) localStorage.setItem(LOCAL_PATH_KEY, value);
    else localStorage.removeItem(LOCAL_PATH_KEY);
    setSavedPath(value);
  };

  const copyCloneUrl = async () => {
    await navigator.clipboard.writeText(CLONE_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#071d35] via-[#0a3155] to-[#082743] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-[#f5c75b] shadow-inner">
                <Code2 size={28} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f5c75b]">MW TECH Control</p>
                <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Projetos / Código</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                  Centralize os repositórios da MW TECH e abra o código diretamente nas suas ferramentas de desenvolvimento.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <span className="size-2 rounded-full bg-emerald-300" />
              Repositório conectado
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-[#fbfcfe] shadow-sm">
            <div className="flex flex-col gap-5 border-b border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#07182d] text-[#f0b83f]">
                  <Github size={24} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-[#07182d]">Gestão Licitações MW TECH</h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      <LockKeyhole size={12} /> Privado
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-500">{REPOSITORY_FULL_NAME}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <GitBranch size={15} />
                main
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px] sm:p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Repositório principal</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{REPOSITORY_NAME}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#07182d]">
                    <FolderOpen size={17} className="text-[#c99125]" />
                    Pasta local do projeto
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Configure a pasta uma vez neste computador. Depois, “Abrir no VS Code” abre diretamente o projeto local.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={localPath}
                      onChange={(event) => setLocalPath(event.target.value)}
                      placeholder="Ex.: C:\Users\marco\Documentos\GitHub\gestao-licitacoes-mwtech"
                      className="input mt-0 min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={saveLocalPath}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      <Save size={17} /> Salvar pasta
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-400">
                    {savedPath ? `Pasta configurada: ${savedPath}` : "Sem pasta configurada: o botão iniciará o clone pelo VS Code."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href={vscodeUrl}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#082743] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b355d]"
                >
                  <Monitor size={18} />
                  Abrir no VS Code
                </a>

                <a
                  href={REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Github size={18} />
                  Abrir no GitHub
                  <ExternalLink size={15} />
                </a>

                <button
                  type="button"
                  onClick={copyCloneUrl}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                  {copied ? "URL copiada" : "Copiar URL Git"}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
