import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X, CheckCircle2, Undo2, Paperclip, Pencil, Trash2, RefreshCw, Wallet, Clock3, Building2, Zap, Wifi, CreditCard, UsersRound, FileText, ReceiptText } from "lucide-react";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { getAccounts, uploadReceipt, type Account } from "../lib/finance";
import { createExpenseWithOptionalRecurrence, deleteExpenseDirect, findActivePayment, getExpenses, payExpense, reverseExpensePayment } from "../services/expenses";
import { updateExpense } from "../services/transactions";
import { generateRecurringExpenses, getRecurrences, setRecurrenceActive, type Recurrence } from "../services/recurrences";
import { money, Badge, Empty, dateOnly, formatDate, formatMonth, ActionButton, FilterBar, IconAction, PageHeader, StatCard, FinancialAmount, Toast } from "../components/UI";
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
  recorrencia_id?: string;
  contas_bancarias?: { nome: string; banco?: string; codigo_banco?: string } | null;
  recorrente: boolean;
};
const month = new Date().toISOString().slice(0, 7);
export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [recurrences, setRecurrences] = useState<Recurrence[]>([]),
    [form, setForm] = useState(false),
    [editExpense, setEditExpense] = useState<Expense | null>(null),
    [pay, setPay] = useState<Expense | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [filterMonth, setFilterMonth] = useState(month),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);
  async function load() {
    if (!isConfigured) return;
    const [data, a, recurrenceRows] = await Promise.all([getExpenses(), getAccounts(), getRecurrences().catch(() => [])]);
    const accountName = new Map(a.map((x) => [x.id, x]));
    setRows(data.map((x: any) => ({ ...x, contas_bancarias: x.conta_id && accountName.get(x.conta_id) ? { nome: accountName.get(x.conta_id)!.nome, banco: accountName.get(x.conta_id)!.banco, codigo_banco: accountName.get(x.conta_id)!.codigo_banco } : null })) as Expense[]);
    setAccounts(a);
    setRecurrences(recurrenceRows);
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
            dateOnly(x.competencia || x.data_vencimento).startsWith(filterMonth)),
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
    setBusy(true);
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.valor = Number(d.valor);
    d.recorrente = d.repetir === "on";
    delete d.repetir;
    const months = Number(d.quantidade_meses || 1);
    delete d.quantidade_meses;
    try {
      if (editExpense) {
        await updateExpense(editExpense.id, {
          descricao: d.descricao,
          categoria: d.categoria || "",
          categoria_id: d.categoria_id || "",
          fornecedor: d.fornecedor || "",
          competencia: d.competencia || `${d.data_vencimento.slice(0, 7)}-01`,
          vencimento: d.data_vencimento,
          valor: d.valor,
          conta_id: d.conta_bancaria_id || "",
          observacao: d.observacoes || "",
          recorrente: d.recorrente,
          recorrencia_id: editExpense.recorrencia_id || "",
        });
        const updated = {
          ...editExpense,
          descricao: d.descricao,
          categoria: d.categoria || "",
          fornecedor: d.fornecedor || "",
          competencia: d.competencia || `${d.data_vencimento.slice(0, 7)}-01`,
          data_vencimento: d.data_vencimento,
          valor: d.valor,
          conta_bancaria_id: d.conta_bancaria_id || "",
          recorrente: d.recorrente,
        } as Expense;
        setRows((current) => current.map((row) => (row.id === editExpense.id ? updated : row)));
        setToast("Alterações salvas com sucesso.");
      } else {
        const created = await createExpenseWithOptionalRecurrence(d, months);
        const normalized = created.map((row: any) => ({
          ...row,
          id: row.$id || row.id,
          data_vencimento: row.vencimento || row.data_vencimento,
          conta_bancaria_id: row.conta_id || row.conta_bancaria_id,
          comprovante_url: row.comprovante_id || "",
          contas_bancarias: null,
        })) as Expense[];
        setRows((current) => [...normalized, ...current]);
        setToast("Despesa salva com sucesso.");
      }
      setForm(false);
      setEditExpense(null);
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirmPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pay) return;
    setBusy(true);
    const f = e.currentTarget,
      d: any = Object.fromEntries(new FormData(f));
    try {
      const file = (f.elements.namedItem("arquivo") as HTMLInputElement)
        .files?.[0];
      if (file) d.comprovante_id = await uploadReceipt(file);
      await payExpense({ despesa_id: pay.id, conta_id: d.conta_id, valor_pago: Number(d.valor),
        data_pagamento: d.data_pagamento, comprovante_id: d.comprovante_id || "", observacao: d.observacao || "" });
      setRows((current) => current.map((row) => row.id === pay.id ? { ...row, status: "pago", conta_bancaria_id: d.conta_id, comprovante_url: d.comprovante_id || row.comprovante_url } : row));
      setPay(null);
      setToast("Despesa paga com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function reverse(x: Expense) {
    const data = await findActivePayment(x.id);
    if (!data) return alert("Pagamento ativo não encontrado.");
    if (!confirm("Estornar o pagamento e devolver o saldo à conta?")) return;
    setBusy(true);
    try { await reverseExpensePayment({ pagamento_id: data.id, observacao: "Estorno manual" }); setRows((current) => current.map((row) => row.id === x.id ? { ...row, status: "pendente" } : row)); setToast("Pagamento estornado com sucesso."); setTimeout(() => setToast(""), 2600); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }
  function openEditExpense(x: Expense) {
    setEditExpense(x);
    setForm(true);
  }
  async function removeExpense(x: Expense) {
    if (!confirm("Excluir esta despesa? Se ela estiver paga, o pagamento será estornado e a despesa ficará cancelada.")) return;
    setBusy(true);
    try {
      if (x.status === "pago") {
        alert("Estorne o pagamento antes de excluir uma despesa paga.");
        return;
      }
      await deleteExpenseDirect(x.id);
      setRows((current) => current.filter((row) => row.id !== x.id));
      setToast("Despesa excluída com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function runRecurrences() {
    try {
      const result = await generateRecurringExpenses();
      alert(result.created.length ? `${result.created.length} despesa(s) gerada(s).` : "Nenhuma despesa nova para a competência atual.");
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function toggleRecurrence(x: Recurrence) {
    await setRecurrenceActive(x.id, !x.ativo);
    await load();
  }
  function printPaymentReceipt(x: Expense) {
    setReceiptExpense(x);
    setTimeout(() => window.print(), 100);
  }
  return (
    <div className={`space-y-7 ${receiptExpense ? "print-receipt" : ""}`}>
      <Toast message={toast} />
      <PageHeader
        title="Despesas"
        subtitle="Acompanhe e gerencie todas as despesas da sua empresa."
        actions={
          <>
            <ActionButton onClick={runRecurrences} tone="outline" disabled={!isConfigured || busy}>
              <RefreshCw size={18} />
              Gerar recorrências do mês
            </ActionButton>
            <ActionButton onClick={() => { setEditExpense(null); setForm(true); }} disabled={busy}>
              <Plus size={18} />
              Cadastrar despesa
            </ActionButton>
          </>
        }
      />
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard title="Total no período" value={<FinancialAmount value={total} kind="despesa" />} icon={<Wallet size={27} />} tone="blue" hint={`${visible.length} despesa${visible.length === 1 ? "" : "s"}`} />
        <StatCard title="Pagas" value={money(paid)} icon={<CheckCircle2 size={27} />} tone="green" hint={`${visible.filter((x) => x.status === "pago").length} despesas · ${percent(paid, total)}% do total`} />
        <StatCard title="Pendentes" value={money(pending)} icon={<Clock3 size={27} />} tone="orange" hint={`${visible.filter((x) => x.status === "pendente").length} despesas · ${percent(pending, total)}% do total`} />
      </div>
      <FilterBar>
        <div className="relative min-w-[280px] flex-1">
          <Search
            className="absolute left-4 top-3.5 text-slate-400"
            size={20}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar despesa..."
            className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-[15px] outline-none focus:border-blue-500"
          />
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="min-h-[52px] min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-[#061426] outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-[52px] min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-[#061426] outline-none"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <ActionButton onClick={() => { setSearch(""); setStatus(""); setFilterMonth(month); }} tone="outline">
          Limpar filtros
        </ActionButton>
      </FilterBar>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,35,70,.055)]">
        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-[15px]">
              <thead className="bg-[#061426] text-[13px] font-black text-white">
                <tr>
                  {[
                    "Descrição",
                    "Categoria",
                    "Vencimento",
                    "Status",
                    "Valor",
                    "Ações",
                  ].map((x) => (
                    <th className="px-6 py-5" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((x) => (
                  <tr className="border-t border-slate-100 hover:bg-slate-50/60" key={x.id}>
                    <td className="px-6 py-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className={`grid size-12 shrink-0 place-items-center rounded-full ${categoryTone(x.categoria)}`}>
                          {categoryIcon(x.categoria)}
                        </span>
                        <div className="min-w-0">
                          <b className="block break-words text-[16px] font-black text-[#061426]">{x.descricao}</b>
                          <span className="text-[13px] text-slate-500">{x.recorrente ? "Recorrente mensal" : x.fornecedor || formatMonth(x.competencia)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-600">
                        {x.categoria || "Sem categoria"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 font-bold text-slate-700">{formatDate(x.data_vencimento)}</td>
                    <td className="px-6 py-5">
                      <Badge status={statusLabel(x)} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 text-right text-lg font-black">
                      <FinancialAmount value={x.valor} kind={x.status === "pago" ? "despesa" : "pendente"} />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        {x.comprovante_url ? (
                          <IconAction title="Comprovante" tone="slate"><Paperclip size={17} /></IconAction>
                        ) : null}
                        <IconAction onClick={() => openEditExpense(x)} title="Editar despesa" tone="blue">
                          <Pencil size={17} />
                        </IconAction>
                        {x.status !== "pago" ? (
                          <IconAction onClick={() => setPay(x)} title="Marcar como paga" tone="green">
                            <CheckCircle2 size={17} />
                          </IconAction>
                        ) : (
                          <IconAction onClick={() => reverse(x)} title="Estornar pagamento" tone="amber">
                            <Undo2 size={17} />
                          </IconAction>
                        )}
                        {x.status === "pago" ? (
                          <IconAction onClick={() => printPaymentReceipt(x)} title="Gerar recibo de pagamento" tone="slate">
                            <ReceiptText size={17} />
                          </IconAction>
                        ) : null}
                        <IconAction onClick={() => removeExpense(x)} title="Excluir/cancelar despesa" tone="red">
                          <Trash2 size={17} />
                        </IconAction>
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,35,70,.055)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0b1d3a]">Recorrências ativas</h3>
            <p className="text-sm text-slate-500">Modelos usados para gerar despesas mensais sem duplicar competências.</p>
          </div>
          <button onClick={runRecurrences} disabled={!isConfigured} className="rounded-xl border border-[#0b2b66] px-4 py-2 text-sm font-semibold text-[#0b2b66] disabled:opacity-50">
            Gerar mês atual
          </button>
        </div>
        {recurrences.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>{["Descrição", "Dia", "Valor", "Início", "Status", "Ações"].map((x) => <th key={x} className="px-4 py-3">{x}</th>)}</tr>
              </thead>
              <tbody>
                {recurrences.map((x) => (
                  <tr key={x.id} className={`border-t ${x.ativo ? "" : "recurrence-paused"}`}>
                    <td className="px-4 py-3 font-medium">{x.descricao}</td>
                    <td className="px-4">{x.dia_vencimento}</td>
                    <td className="px-4 font-semibold"><FinancialAmount value={x.valor} kind="despesa" /></td>
                    <td className="px-4">{formatDate(x.data_inicio)}</td>
                    <td className="px-4"><Badge status={x.ativo ? "ativo" : "inativo"} /></td>
                    <td className="px-4">
                      <button onClick={() => toggleRecurrence(x)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#0b2b66]">
                        {x.ativo ? "Pausar" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </section>
      {receiptExpense && (
        <section className="expense-receipt-sheet hidden bg-white print:block">
          <div className="expense-receipt-header">
            <div>
              <span className="expense-receipt-kicker">MW TECH FINANCEIRO</span>
              <h2>Recibo de pagamento</h2>
              <p>Comprovante de quitação de despesa</p>
            </div>
            <span className="expense-receipt-date">Emitido em {formatDate(new Date().toISOString())}</span>
          </div>
          <div className="expense-receipt-body">
            <p>Declaramos o pagamento da despesa abaixo:</p>
            <dl>
              <div><dt>Descrição</dt><dd>{receiptExpense.descricao}</dd></div>
              <div><dt>Categoria</dt><dd>{receiptExpense.categoria || "Sem categoria"}</dd></div>
              <div><dt>Vencimento</dt><dd>{formatDate(receiptExpense.data_vencimento)}</dd></div>
              <div><dt>Valor pago</dt><dd>{money(receiptExpense.valor)}</dd></div>
            </dl>
            <p className="expense-receipt-confirmation">Pagamento registrado no sistema MW TECH Financeiro.</p>
          </div>
          <div className="expense-receipt-signature">Documento gerado automaticamente</div>
        </section>
      )}
      {form && (
        <Modal title={editExpense ? "Editar despesa" : "Cadastrar despesa"} close={() => { setForm(false); setEditExpense(null); }}>
          <form onSubmit={create}>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Descrição">
                <input name="descricao" required defaultValue={editExpense?.descricao || ""} className="input" />
              </F>
              <F label="Categoria">
                <input name="categoria" required defaultValue={editExpense?.categoria || ""} className="input" />
              </F>
              <F label="Competência">
                <input
                  name="competencia"
                  type="date"
                  defaultValue={editExpense?.competencia?.slice(0, 10) || ""}
                  className="input"
                />
              </F>
              <F label="Vencimento">
                <input
                  name="data_vencimento"
                  type="date"
                  required
                  defaultValue={editExpense?.data_vencimento?.slice(0, 10) || ""}
                  className="input"
                />
              </F>
              <F label="Valor">
                <input
                  name="valor"
                  type="number"
                  step=".01"
                  required
                  defaultValue={editExpense?.valor || ""}
                  className="input"
                />
              </F>
              <F label="Conta prevista">
                <select name="conta_bancaria_id" defaultValue={editExpense?.conta_bancaria_id || ""} className="input">
                  <option value="">Selecione</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </F>
              <F label="Fornecedor">
                <input name="fornecedor" defaultValue={editExpense?.fornecedor || ""} className="input" />
              </F>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input name="repetir" type="checkbox" defaultChecked={editExpense?.recorrente || false} disabled={Boolean(editExpense)} />
                Repetir nos próximos meses
              </label>
              {!editExpense && <F label="Quantidade de meses">
                <input
                  name="quantidade_meses"
                  type="number"
                  min="1"
                  max="60"
                  defaultValue="1"
                  className="input"
                />
              </F>}
              <F label="Observação">
                <textarea name="observacoes" defaultValue={(editExpense as any)?.observacao || ""} className="input" />
              </F>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <Actions cancel={() => { setForm(false); setEditExpense(null); }} text={editExpense ? "Salvar alterações" : "Cadastrar despesas"} busy={busy} />
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
                    <option key={a.id} value={a.id}>
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
            <Actions cancel={() => setPay(null)} text="Confirmar pagamento" busy={busy} />
          </form>
        </Modal>
      )}
    </div>
  );
}
function statusLabel(x: Expense) {
  if (x.status === "pendente" && x.data_vencimento?.slice(0, 10) < new Date().toISOString().slice(0, 10)) return "vencido";
  return x.status;
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

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function categoryIcon(category?: string) {
  const value = String(category || "").toLowerCase();
  if (value.includes("aluguel")) return <Building2 size={20} />;
  if (value.includes("energia")) return <Zap size={20} />;
  if (value.includes("internet")) return <Wifi size={20} />;
  if (value.includes("escrit")) return <CreditCard size={20} />;
  if (value.includes("serv")) return <UsersRound size={20} />;
  return <FileText size={20} />;
}

function categoryTone(category?: string) {
  const value = String(category || "").toLowerCase();
  if (value.includes("aluguel")) return "bg-purple-50 text-purple-600";
  if (value.includes("energia")) return "bg-amber-50 text-amber-600";
  if (value.includes("internet")) return "bg-blue-50 text-blue-600";
  if (value.includes("escrit")) return "bg-rose-50 text-rose-600";
  if (value.includes("serv")) return "bg-teal-50 text-teal-600";
  return "bg-slate-100 text-slate-500";
}
function F({ label, children }: { label: string; children: any }) {
  return (
    <label className="text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
function Actions({ cancel, text, busy }: { cancel: () => void; text: string; busy: boolean }) {
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
        disabled={!isConfigured || busy}
        className="rounded-lg bg-[#0b2b66] px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Salvando..." : text}
      </button>
    </div>
  );
}
