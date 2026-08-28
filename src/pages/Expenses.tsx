import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X, CheckCircle2, Undo2, Paperclip } from "lucide-react";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { getAccounts, uploadReceipt, type Account } from "../lib/finance";
import { createExpenses, findActivePayment, getExpenses, payExpense, reverseExpensePayment } from "../services/expenses";
import { money, Badge, Empty } from "../components/UI";
type Expense = {
  id: string;
  descricao: string;
  categoria?: string;
  competencia?: string;
  data_vencimento: string;
  valor: number;
  status: string;
  fornecedor?: string;
  comprovante_url?: string;
  conta_bancaria_id?: string;
  contas_bancarias?: { nome: string } | null;
  recorrente: boolean;
};
const month = new Date().toISOString().slice(0, 7);
export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [form, setForm] = useState(false),
    [pay, setPay] = useState<Expense | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [filterMonth, setFilterMonth] = useState(month),
    [error, setError] = useState("");
  async function load() {
    if (!isConfigured) return;
    const [data, a] = await Promise.all([getExpenses(), getAccounts()]);
    const accountName = new Map(a.map((x) => [x.id, x.nome]));
    setRows(data.map((x: any) => ({ ...x, contas_bancarias: x.conta_id ? { nome: accountName.get(x.conta_id) || "—" } : null })) as Expense[]);
    setAccounts(a);
  }
  useEffect(() => {
    load();
  }, []);
  const visible = useMemo(
    () =>
      rows.filter(
        (x) =>
          (!search ||
            JSON.stringify(x).toLowerCase().includes(search.toLowerCase())) &&
          (!status || x.status === status) &&
          (!filterMonth ||
            String(x.competencia || x.data_vencimento).startsWith(filterMonth)),
      ),
    [rows, search, status, filterMonth],
  );
  const total = visible.reduce((a, x) => a + Number(x.valor), 0),
    paid = visible
      .filter((x) => x.status === "pago")
      .reduce((a, x) => a + Number(x.valor), 0),
    pending = visible
      .filter((x) => x.status === "pendente")
      .reduce((a, x) => a + Number(x.valor), 0);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.valor = Number(d.valor);
    d.recorrente = d.repetir === "on";
    delete d.repetir;
    const months = Number(d.quantidade_meses || 1);
    delete d.quantidade_meses;
    try {
      const records = [];
      for (let i = 0; i < (d.recorrente ? months : 1); i++) {
        const due = new Date(d.data_vencimento + "T12:00:00");
        due.setMonth(due.getMonth() + i);
        records.push({
          ...d,
          descricao: d.recorrente
            ? `${d.descricao} - ${due.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
            : d.descricao,
          data_vencimento: due.toISOString().slice(0, 10),
          competencia: new Date(due.getFullYear(), due.getMonth(), 1, 12)
            .toISOString()
            .slice(0, 10),
          status: "pendente",
        });
      }
      await createExpenses(records);
      setForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function confirmPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pay) return;
    const f = e.currentTarget,
      d: any = Object.fromEntries(new FormData(f));
    try {
      const file = (f.elements.namedItem("arquivo") as HTMLInputElement)
        .files?.[0];
      if (file) d.comprovante_id = await uploadReceipt(file);
      await payExpense({ despesa_id: pay.id, conta_id: d.conta_id, valor_pago: Number(d.valor),
        data_pagamento: d.data_pagamento, comprovante_id: d.comprovante_id || "", observacao: d.observacao || "" });
      setPay(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function reverse(x: Expense) {
    const data = await findActivePayment(x.id);
    if (!data) return alert("Pagamento ativo não encontrado.");
    if (!confirm("Estornar o pagamento e devolver o saldo à conta?")) return;
    try { await reverseExpensePayment({ pagamento_id: data.id, observacao: "Estorno manual" }); await load(); }
    catch (e: any) { alert(e.message); }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Despesas</h2>
          <p className="text-sm text-slate-500">
            Cadastre, programe e pague as despesas com segurança.
          </p>
        </div>
        <button
          onClick={() => setForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[#0b2b66] px-5 py-3 text-sm font-semibold text-white"
        >
          <Plus size={18} />
          Cadastrar despesa
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Summary title="Total do mês" value={total} />
        <Summary title="Pagas" value={paid} green />
        <Summary title="Pendentes" value={pending} amber />
      </div>
      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar despesa..."
            className="w-full rounded-lg border py-2 pl-10 pr-3"
          />
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-lg border px-3"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border px-3"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Descrição",
                    "Categoria",
                    "Competência",
                    "Vencimento",
                    "Valor",
                    "Conta",
                    "Comprovante",
                    "Status",
                    "Ações",
                  ].map((x) => (
                    <th className="px-4 py-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((x) => (
                  <tr className="border-t" key={x.id}>
                    <td className="px-4 py-4 font-medium">{x.descricao}</td>
                    <td className="px-4">{x.categoria || "—"}</td>
                    <td className="px-4">
                      {x.competencia
                        ? new Date(
                            x.competencia + "T12:00:00",
                          ).toLocaleDateString("pt-BR", {
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4">
                      {new Date(
                        x.data_vencimento + "T12:00:00",
                      ).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 font-semibold">{money(x.valor)}</td>
                    <td className="px-4">{x.contas_bancarias?.nome || "—"}</td>
                    <td className="px-4">
                      {x.comprovante_url ? (
                        <Paperclip size={17} className="text-blue-600" />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4">
                      <Badge status={x.status} />
                    </td>
                    <td className="px-4">
                      <div className="flex gap-2">
                        {x.status !== "pago" ? (
                          <button
                            onClick={() => setPay(x)}
                            title="Marcar como paga"
                            className="rounded-lg bg-emerald-50 p-2 text-emerald-600"
                          >
                            <CheckCircle2 size={17} />
                          </button>
                        ) : (
                          <button
                            onClick={() => reverse(x)}
                            title="Estornar pagamento"
                            className="rounded-lg bg-amber-50 p-2 text-amber-600"
                          >
                            <Undo2 size={17} />
                          </button>
                        )}
                      </div>
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
      {form && (
        <Modal title="Cadastrar despesa" close={() => setForm(false)}>
          <form onSubmit={create}>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Descrição">
                <input name="descricao" required className="input" />
              </F>
              <F label="Categoria">
                <input name="categoria" required className="input" />
              </F>
              <F label="Vencimento">
                <input
                  name="data_vencimento"
                  type="date"
                  required
                  className="input"
                />
              </F>
              <F label="Valor">
                <input
                  name="valor"
                  type="number"
                  step=".01"
                  required
                  className="input"
                />
              </F>
              <F label="Conta prevista">
                <select name="conta_bancaria_id" className="input">
                  <option value="">Selecione</option>
                  {accounts.map((a) => (
                    <option value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </F>
              <F label="Fornecedor">
                <input name="fornecedor" className="input" />
              </F>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input name="repetir" type="checkbox" />
                Repetir nos próximos meses
              </label>
              <F label="Quantidade de meses">
                <input
                  name="quantidade_meses"
                  type="number"
                  min="1"
                  max="60"
                  defaultValue="1"
                  className="input"
                />
              </F>
              <F label="Observação">
                <textarea name="observacoes" className="input" />
              </F>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <Actions cancel={() => setForm(false)} text="Cadastrar despesas" />
          </form>
        </Modal>
      )}
      {pay && (
        <Modal title="Confirmar pagamento" close={() => setPay(null)}>
          <form onSubmit={confirmPayment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Data do pagamento">
                <input
                  name="data_pagamento"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="input"
                />
              </F>
              <F label="Conta utilizada">
                <select name="conta_id" required className="input">
                  <option value="">Selecione</option>
                  {accounts.map((a) => (
                    <option value={a.id}>
                      {a.nome} · {money(a.saldo_atual)}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Valor pago">
                <input
                  name="valor"
                  type="number"
                  step=".01"
                  required
                  defaultValue={pay.valor}
                  className="input"
                />
              </F>
              <F label="Comprovante">
                <input
                  name="arquivo"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="input"
                />
              </F>
              <F label="Observação">
                <textarea name="observacao" className="input" />
              </F>
            </div>
            {error && <p className="mt-3 text-red-600">{error}</p>}
            <Actions cancel={() => setPay(null)} text="Confirmar pagamento" />
          </form>
        </Modal>
      )}
    </div>
  );
}
function Summary({
  title,
  value,
  green,
  amber,
}: {
  title: string;
  value: number;
  green?: boolean;
  amber?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <p className="text-sm text-slate-500">{title}</p>
      <b
        className={`mt-2 block text-2xl ${green ? "text-emerald-600" : amber ? "text-amber-600" : ""}`}
      >
        {money(value)}
      </b>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: any;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white">
        <div className="flex justify-between border-b px-6 py-5">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
function F({ label, children }: { label: string; children: any }) {
  return (
    <label className="text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
function Actions({ cancel, text }: { cancel: () => void; text: string }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={cancel}
        className="rounded-lg border px-4 py-2"
      >
        Cancelar
      </button>
      <button
        disabled={!isConfigured}
        className="rounded-lg bg-[#0b2b66] px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        {text}
      </button>
    </div>
  );
}
