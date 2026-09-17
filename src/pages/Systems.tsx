import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  ImagePlus,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Server,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ActionButton, Badge, Empty, PageHeader, Toast } from "../components/UI";
import {
  deleteManagedSystem,
  getManagedSystems,
  saveManagedSystem,
  uploadSystemLogo,
  type ManagedSystem,
} from "../services/managedSystems";

export default function Systems() {
  const [rows, setRows] = useState<ManagedSystem[]>([]);
  const [edit, setEdit] = useState<Partial<ManagedSystem> | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getManagedSystems().then(setRows).catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(
    () => rows.filter((x) => JSON.stringify(x).toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  function startCreate() {
    setError("");
    setEdit({
      tipo_orgao: "Prefeitura",
      sistema: "Gestão Licita",
      ambiente: "Produção",
      status: "ativo",
    });
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const payload: Partial<ManagedSystem> = {
        ...edit,
        ...values,
        logo_url: edit?.logo_url || autoLogo(values.acesso_url || values.dominio_url),
      };
      const saved = await saveManagedSystem(payload);
      setRows((current) =>
        edit?.id ? current.map((x) => (x.id === edit.id ? saved : x)) : [...current, saved],
      );
      setEdit(null);
      setToast("Sistema salvo com sucesso.");
      setTimeout(() => setToast(""), 2500);
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar o sistema.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este sistema da central?")) return;
    try {
      await deleteManagedSystem(id);
      setRows((x) => x.filter((row) => row.id !== id));
      setToast("Sistema excluído.");
      setTimeout(() => setToast(""), 2200);
    } catch (err: any) {
      setError(err?.message || "Não foi possível excluir.");
    }
  }

  async function handleLogo(file?: File) {
    if (!file || !edit) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadSystemLogo(file);
      setEdit((current) => (current ? { ...current, logo_url: url } : current));
      setToast("Logomarca carregada.");
      setTimeout(() => setToast(""), 1800);
    } catch (err: any) {
      setError(err?.message || "Não foi possível enviar a logomarca.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-7">
      <Toast message={toast} />
      <PageHeader
        title="Sistemas e órgãos"
        subtitle="Central de domínios, projetos, ambientes e acessos dos clientes da MW TECH."
        actions={
          <ActionButton onClick={startCreate}>
            <Plus size={18} /> Adicionar sistema
          </ActionButton>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar prefeitura, Câmara, domínio ou sistema..."
          className="input !mt-0"
        />
      </div>

      {!edit && error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>
      )}

      {visible.length ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((item) => {
            const logo = item.logo_url || autoLogo(item.acesso_url || item.dominio_url);
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,35,70,.055)]"
              >
                <div className="border-b border-slate-200 bg-[#061426] p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <SystemLogo src={logo} name={item.sistema} />
                    <Badge status={item.status} />
                  </div>
                  <h3 className="mt-4 text-[20px] font-black">{item.orgao}</h3>
                  <p className="mt-1 text-[13px] text-blue-100">
                    {item.tipo_orgao} · {item.ambiente}
                  </p>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Sistema</span>
                    <b className="mt-1 block text-[#061426]">{item.sistema}</b>
                  </div>
                  <LinkRow icon={<Globe2 size={17} />} label="Domínio" url={item.dominio_url} />
                  <LinkRow icon={<Server size={17} />} label="Vercel" url={item.vercel_url} />
                  <LinkRow icon={<Link2 size={17} />} label="Supabase" url={item.supabase_url} />
                  <div className="flex gap-3 pt-2">
                    {item.acesso_url && (
                      <a
                        href={safeUrl(item.acesso_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[14px] font-black text-white"
                      >
                        Entrar no sistema <ExternalLink size={16} />
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setError("");
                        setEdit(item);
                      }}
                      className="grid size-11 place-items-center rounded-xl border border-slate-200 text-blue-700"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="grid size-11 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty />
      )}

      {edit && (
        <Modal title={edit.id ? "Editar sistema" : "Adicionar sistema"} close={() => setEdit(null)}>
          <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-r from-[#061426] to-[#0b2b50] p-5 text-white">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <SystemLogo
                src={edit.logo_url || autoLogo(edit.acesso_url || edit.dominio_url)}
                name={edit.sistema || "Sistema"}
                large
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase tracking-[.18em] text-[#f5c75b]">Identidade do sistema</p>
                <h4 className="mt-1 text-[20px] font-black">Logomarca automática ou personalizada</h4>
                <p className="mt-1 text-[13px] leading-5 text-blue-100">
                  Ao informar o domínio ou link de acesso, o MW TECH Control tenta usar automaticamente o ícone do sistema. Você também pode enviar uma imagem própria.
                </p>
              </div>
              <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-[13px] font-black transition hover:bg-white/15">
                {uploading ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />}
                {uploading ? "Enviando..." : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleLogo(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-bold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Órgão" wide>
              <input name="orgao" required defaultValue={edit.orgao || ""} className="input" />
            </Field>
            <Field label="Tipo de órgão">
              <select name="tipo_orgao" defaultValue={edit.tipo_orgao || "Prefeitura"} className="input">
                <option>Prefeitura</option>
                <option>Câmara</option>
                <option>Empresa</option>
                <option>Outro órgão</option>
              </select>
            </Field>
            <Field label="Sistema">
              <input name="sistema" required defaultValue={edit.sistema || "Gestão Licita"} className="input" />
            </Field>

            <Field label="Domínio">
              <div className="relative">
                <Globe2 className="pointer-events-none absolute left-3 top-[22px] text-slate-400" size={17} />
                <input
                  name="dominio_url"
                  placeholder="https://gestaolicitarg.com.br"
                  defaultValue={edit.dominio_url || ""}
                  className="input !pl-10"
                  onChange={(e) => setEdit((x) => (x ? { ...x, dominio_url: e.target.value } : x))}
                />
              </div>
            </Field>
            <Field label="Vercel">
              <div className="relative">
                <Server className="pointer-events-none absolute left-3 top-[22px] text-slate-400" size={17} />
                <input
                  name="vercel_url"
                  placeholder="https://projeto.vercel.app"
                  defaultValue={edit.vercel_url || ""}
                  className="input !pl-10"
                />
              </div>
            </Field>
            <Field label="Supabase">
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-[22px] text-slate-400" size={17} />
                <input
                  name="supabase_url"
                  placeholder="https://supabase.com/dashboard/project/..."
                  defaultValue={edit.supabase_url || ""}
                  className="input !pl-10"
                />
              </div>
            </Field>
            <Field label="Link para entrar">
              <div className="relative">
                <ExternalLink className="pointer-events-none absolute left-3 top-[22px] text-slate-400" size={17} />
                <input
                  name="acesso_url"
                  placeholder="https://..."
                  defaultValue={edit.acesso_url || ""}
                  className="input !pl-10"
                  onChange={(e) => setEdit((x) => (x ? { ...x, acesso_url: e.target.value } : x))}
                />
              </div>
            </Field>
            <Field label="Ambiente">
              <select name="ambiente" defaultValue={edit.ambiente || "Produção"} className="input">
                <option>Produção</option>
                <option>Homologação</option>
                <option>Teste</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={edit.status || "ativo"} className="input">
                <option value="ativo">Ativo</option>
                <option value="implantacao">Em implantação</option>
                <option value="suspenso">Suspenso</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>
            <Field label="Observações" wide>
              <textarea name="observacao" defaultValue={edit.observacao || ""} className="input min-h-[105px]" />
            </Field>

            <div className="mt-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:col-span-2 sm:flex-row sm:justify-end">
              <ActionButton tone="outline" onClick={() => setEdit(null)} disabled={saving}>
                Cancelar
              </ActionButton>
              <ActionButton type="submit" disabled={saving || uploading}>
                {saving ? <LoaderCircle size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {saving ? "Salvando..." : "Salvar sistema"}
              </ActionButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

function autoLogo(url?: string) {
  if (!url) return "";
  try {
    const host = new URL(safeUrl(url)).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return "";
  }
}

function SystemLogo({ src, name, large = false }: { src?: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = large ? "size-20" : "size-14";
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white shadow-sm`}>
      {src && !failed ? (
        <img src={src} alt={name} className="h-full w-full object-contain p-2" onError={() => setFailed(true)} />
      ) : (
        <ImagePlus size={large ? 30 : 24} className="text-[#d59b27]" />
      )}
    </span>
  );
}

function LinkRow({ icon, label, url }: { icon: any; label: string; url?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-[13px]">
      <span className="text-blue-700">{icon}</span>
      <div className="min-w-0">
        <span className="block font-bold text-slate-500">{label}</span>
        {url ? (
          <a
            href={safeUrl(url)}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-bold text-[#061426] hover:text-blue-700"
          >
            {url}
          </a>
        ) : (
          <span className="text-slate-400">Não informado</span>
        )}
      </div>
    </div>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: any }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-[2px]">
      <div className="max-h-[94vh] w-full max-w-4xl overflow-auto rounded-[22px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(2,12,27,.35)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#d59b27]">MW TECH Control</p>
            <h3 className="mt-1 text-[22px] font-black text-[#061426]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: any; wide?: boolean }) {
  return (
    <label className={`text-[13px] font-black text-slate-600 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
