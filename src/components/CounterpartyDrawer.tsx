import { useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  createCounterparty,
  deactivateCounterparty,
  getCounterparties,
  updateCounterparty,
  type Counterparty,
} from "../services/counterparties";

const TYPE_LABELS: Record<Counterparty["tipo"], string> = {
  orgao_publico: "Órgão público",
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  outro: "Outro",
};

type FormState = {
  nome: string;
  tipo: Counterparty["tipo"];
  documento: string;
  observacao: string;
};

const EMPTY_FORM: FormState = {
  nome: "",
  tipo: "orgao_publico",
  documento: "",
  observacao: "",
};

export default function CounterpartyDrawer({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Counterparty[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<Counterparty | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    getCounterparties(false, true)
      .then(setRows)
      .catch((e: any) => setError(e.message || "Não foi possível carregar os cadastros."))
      .finally(() => setLoading(false));
  }, [open]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.nome, row.documento || "", TYPE_LABELS[row.tipo], row.observacao || ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function startEdit(row: Counterparty) {
    setEditing(row);
    setForm({
      nome: row.nome,
      tipo: row.tipo,
      documento: row.documento || "",
      observacao: row.observacao || "",
    });
    setError("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim()) return;
    setBusy(true);
    setError("");
    try {
      const saved = editing
        ? await updateCounterparty(editing.id, form)
        : await createCounterparty(form);
      setRows((current) =>
        (editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved]
        ).sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      resetForm();
      onChanged?.();
    } catch (e: any) {
      setError(e.message || "Não foi possível salvar o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Counterparty) {
    if (!confirm(`Excluir o cadastro “${row.nome}”?\n\nAs movimentações antigas serão preservadas no histórico.`)) return;
    setBusy(true);
    setError("");
    try {
      await deactivateCounterparty(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      if (editing?.id === row.id) resetForm();
      onChanged?.();
    } catch (e: any) {
      setError(e.message || "Não foi possível excluir o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/45" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="ml-auto flex h-full w-full max-w-[620px] flex-col bg-[#f7f9fc] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 bg-white px-7 py-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-[#0b2b66]"><Building2 size={22} /></span>
              <div>
                <h2 className="text-2xl font-black text-[#0b1d3a]">Cadastros financeiros</h2>
                <p className="mt-1 text-sm text-slate-500">Quem paga a MW TECH ou quem recebe pagamentos.</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[#0b1d3a]">{editing ? "Editar cadastro" : "Novo cadastro"}</h3>
                <p className="text-sm text-slate-500">Preencha os dados abaixo e salve.</p>
              </div>
              {editing ? (
                <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar edição</button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                Nome / Razão social
                <input
                  value={form.nome}
                  onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))}
                  required
                  className="input"
                  placeholder="Ex.: Prefeitura Municipal de ..."
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Tipo
                <select value={form.tipo} onChange={(e) => setForm((current) => ({ ...current, tipo: e.target.value as Counterparty["tipo"] }))} className="input">
                  <option value="orgao_publico">Órgão público</option>
                  <option value="cliente">Cliente</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                CPF / CNPJ
                <input value={form.documento} onChange={(e) => setForm((current) => ({ ...current, documento: e.target.value }))} className="input" placeholder="Opcional" />
              </label>
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                Observação
                <textarea value={form.observacao} onChange={(e) => setForm((current) => ({ ...current, observacao: e.target.value }))} className="input min-h-20" placeholder="Opcional" />
              </label>
            </div>

            {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

            <div className="mt-5 flex justify-end">
              <button disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0b2b66] px-5 py-3 font-bold text-white shadow-sm hover:bg-[#082352] disabled:opacity-50">
                {editing ? <Pencil size={17} /> : <Plus size={18} />}
                {busy ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
              </button>
            </div>
          </form>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#0b1d3a]">Cadastros realizados</h3>
                  <p className="text-sm text-slate-500">{rows.length} cadastro{rows.length === 1 ? "" : "s"} ativo{rows.length === 1 ? "" : "s"}</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-400" placeholder="Buscar cadastro..." />
                </div>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3">
              {loading ? (
                <p className="p-6 text-center text-sm text-slate-500">Carregando cadastros...</p>
              ) : visible.length ? (
                <div className="space-y-2">
                  {visible.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-4 hover:bg-slate-50">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Building2 size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-[#0b1d3a]">{row.nome}</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{TYPE_LABELS[row.tipo]}{row.documento ? ` · ${row.documento}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => startEdit(row)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-blue-700 hover:bg-blue-50" title="Editar cadastro"><Pencil size={17} /></button>
                        <button type="button" disabled={busy} onClick={() => remove(row)} className="grid size-10 place-items-center rounded-xl border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Excluir cadastro"><Trash2 size={17} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-slate-500">Nenhum cadastro encontrado.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
