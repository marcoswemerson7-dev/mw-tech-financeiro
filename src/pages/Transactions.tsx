import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Search,
  Paperclip,
} from "lucide-react";
import {
  getAccounts,
  getMovements,
  registerMovement,
  uploadReceipt,
  type Account,
  type Movement,
} from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty } from "../components/UI";
export default function Transactions() {
  const [rows, setRows] = useState<Movement[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    if (!isConfigured) return;
    try {
      setRows(await getMovements());
      setAccounts(await getAccounts());
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const visible = useMemo(
    () =>
      rows.filter(
        (x) =>
          (!type || x.tipo.includes(type)) &&
          JSON.stringify(x).toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search, type],
  );
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = e.currentTarget,
        d: any = Object.fromEntries(new FormData(form));
      const file = (form.elements.namedItem("arquivo") as HTMLInputElement)
        .files?.[0];
      if (file) d.comprovante_url = await uploadReceipt(file);
      await registerMovement(d);
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHead
        title="Entradas e saídas"
        text="Registre e acompanhe todas as movimentações financeiras."
        action={() => setOpen(true)}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Mini
          title="Entradas"
          value={rows
            .filter((x) => x.tipo.includes("entrada"))
            .reduce((a, x) => a + Number(x.valor), 0)}
          icon={<ArrowUpRight />}
          color="green"
        />
        <Mini
          title="Saídas"
          value={rows
            .filter((x) => x.tipo.includes("saida"))
            .reduce((a, x) => a + Number(x.valor), 0)}
          icon={<ArrowDownRight />}
          color="red"
        />
        <Mini
          title="Movimentações"
          value={rows.length}
          icon={<ArrowLeftRight />}
          count
        />
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <div className="relative min-w-64 flex-1">
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar movimentação..."
            className="w-full rounded-lg border py-2 pl-10 pr-3 text-sm"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border px-3 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
          <option value="transferencia">Transferências</option>
        </select>
      </div>
      <MovementTable rows={visible} />
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form
            onSubmit={save}
            className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white"
          >
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div>
                <h3 className="text-xl font-bold">Novo lançamento</h3>
                <p className="text-xs text-slate-500">
                  O saldo da conta será atualizado automaticamente.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Tipo">
                <select name="tipo" required className="input">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </Field>
              <Field label="Data">
                <input
                  name="data"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="input"
                />
              </Field>
              <Field label="Descrição" wide>
                <input
                  name="descricao"
                  required
                  className="input"
                  placeholder="Ex.: Recebimento de contrato"
                />
              </Field>
              <Field label="Conta de origem / destino">
                <select name="conta_id" required className="input">
                  <option value="">Selecione</option>
                  {accounts.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Conta de destino (transferência)">
                <select name="conta_destino_id" className="input">
                  <option value="">Não se aplica</option>
                  {accounts.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor">
                <input
                  name="valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="input"
                />
              </Field>
              <Field label="Comprovante">
                <label className="input flex cursor-pointer items-center gap-2">
                  <Paperclip size={16} />
                  Selecionar arquivo
                  <input
                    name="arquivo"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                  />
                </label>
              </Field>
              <Field label="Observação" wide>
                <textarea name="observacao" className="input min-h-24" />
              </Field>
              {error && (
                <p className="text-sm text-red-600 sm:col-span-2">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border px-4 py-2"
              >
                Cancelar
              </button>
              <button
                disabled={busy || !isConfigured}
                className="rounded-lg bg-[#0b2b66] px-5 py-2 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Salvando..." : "Salvar lançamento"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
export function PageHead({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1d3a]">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
      <button
        onClick={action}
        className="flex items-center gap-2 rounded-xl bg-[#0b2b66] px-5 py-3 text-sm font-semibold text-white"
      >
        <Plus size={18} />
        Novo lançamento
      </button>
    </div>
  );
}
function Mini({
  title,
  value,
  icon,
  color,
  count,
}: {
  title: string;
  value: number;
  icon: any;
  color?: string;
  count?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <b className="mt-2 block text-2xl">{count ? value : money(value)}</b>
        </div>
        <span
          className={`grid size-12 place-items-center rounded-xl ${color === "green" ? "bg-emerald-50 text-emerald-600" : color === "red" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: any;
  wide?: boolean;
}) {
  return (
    <label className={`text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
function MovementTable({ rows }: { rows: Movement[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "Data",
                  "Descrição",
                  "Categoria",
                  "Tipo",
                  "Conta",
                  "Valor",
                ].map((x) => (
                  <th key={x} className="px-5 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-5 py-4">
                    {new Date(x.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 font-medium">{x.descricao}</td>
                  <td className="px-5">
                    {x.categorias_financeiras?.nome || "—"}
                  </td>
                  <td className="px-5 capitalize">
                    {x.tipo.replace("_", " ")}
                  </td>
                  <td className="px-5">{x.contas_bancarias?.nome || "—"}</td>
                  <td
                    className={`px-5 font-semibold ${x.tipo.includes("entrada") ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {money(x.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </div>
  );
}
