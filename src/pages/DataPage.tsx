import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { getAccounts, getMovements, registerMovement, type Account, type Movement } from "../lib/finance";
import { getExpenses, payExpense } from "../services/expenses";
import { deactivateCounterparty, getCounterparties, saveCounterparty, type Counterparty } from "../services/counterparties";
import { Badge, Empty, formatDate, money } from "../components/UI";

type K = "clientes" | "receitas" | "contas-receber" | "retiradas";

const titles: Record<K, string> = {
  clientes: "Partes financeiras",
  receitas: "Receitas",
  "contas-receber": "Despesas pendentes",
  retiradas: "Retiradas",
};

export default function DataPage({ kind }: { kind: K }) {
  const [parties, setParties] = useState<Counterparty[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [editParty, setEditParty] = useState<Partial<Counterparty> | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [partyRows, movementRows, expenseRows, accountRows] = await Promise.all([
      getCounterparties().catch(() => []),
      getMovements(500).catch(() => []),
      getExpenses().catch(() => []),
      getAccounts().catch(() => []),
    ]);
    setParties(partyRows);
    setMovements(movementRows);
    setExpenses(expenseRows);
    setAccounts(accountRows);
  }

  useEffect(() => {
    void load();
  }, [kind]);

  const visibleParties = useMemo(
    () => parties.filter((x) => JSON.stringify(x).toLowerCase().includes(search.toLowerCase())),
    [parties, search],
  );
  const visibleMovements = useMemo(
    () =>
      movements.filter(
        (x) =>
          (kind === "receitas" ? x.tipo === "entrada" : x.tipo === "saida" && x.descricao.toLowerCase().includes("retirada")) &&
          JSON.stringify(x).toLowerCase().includes(search.toLowerCase()),
      ),
    [kind, movements, search],
  );
  const visibleExpenses = useMemo(
    () => expenses.filter((x) => x.status === "pendente" && JSON.stringify(x).toLowerCase().includes(search.toLowerCase())),
    [expenses, search],
  );

  async function saveParty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const values: any = Object.fromEntries(new FormData(e.currentTarget));
      await saveCounterparty({ ...values, id: editParty?.id });
      setEditParty(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function saveMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const values: any = Object.fromEntries(new FormData(e.currentTarget));
      const party = parties.find((x) => x.id === values.parte_id);
      const tipo = kind === "receitas" ? "entrada" : "saida";
      const prefix = kind === "receitas" ? "Recebido de" : "Retirada para";
      await registerMovement({
        tipo,
        data: values.data,
        conta_id: values.conta_id,
        valor: Number(values.valor),
        descricao: `${prefix} ${party?.nome || "parte financeira"} - ${values.descricao}`,
        observacao: values.observacao || "",
      });
      setMovementOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeParty(id: string) {
    if (!confirm("Inativar este cadastro financeiro?")) return;
    await deactivateCounterparty(id);
    await load();
  }

  async function markExpensePaid(expense: any) {
    const accountId = expense.conta_id || accounts[0]?.id;
    if (!accountId) return alert("Cadastre uma conta antes de pagar a despesa.");
    await payExpense({
      despesa_id: expense.id,
      conta_id: accountId,
      valor_pago: Number(expense.valor),
      data_pagamento: new Date().toISOString().slice(0, 10),
      observacao: "Pagamento registrado pela tela de pendências.",
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{titles[kind]}</h2>
          <p className="text-sm text-slate-500">Dados conectados ao Appwrite financeiro.</p>
        </div>
        {kind === "clientes" ? (
          <button onClick={() => setEditParty({ tipo: "cliente" })} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white">
            <Plus size={18} /> Novo cadastro
          </button>
        ) : kind !== "contas-receber" ? (
          <button onClick={() => setMovementOpen(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white">
            <Plus size={18} /> Novo registro
          </button>
        ) : null}
      </div>

      <div className="relative rounded-2xl border bg-white p-4 shadow-sm">
        <Search className="absolute left-7 top-7 text-slate-400" size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm" />
      </div>

      {kind === "clientes" ? (
        <PartyTable rows={visibleParties} edit={setEditParty} remove={removeParty} />
      ) : kind === "contas-receber" ? (
        <ExpenseTable rows={visibleExpenses} pay={markExpensePaid} />
      ) : (
        <MovementTable rows={visibleMovements} />
      )}

      {editParty && (
        <Modal title={editParty.id ? "Editar cadastro" : "Novo cadastro"} close={() => setEditParty(null)}>
          <form onSubmit={saveParty} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome / Razão social" wide><input name="nome" required defaultValue={editParty.nome || ""} className="input" /></Field>
            <Field label="Tipo">
              <select name="tipo" required defaultValue={editParty.tipo || "cliente"} className="input">
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="orgao_publico">Órgão público</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
            <Field label="CPF / CNPJ"><input name="documento" defaultValue={editParty.documento || ""} className="input" /></Field>
            <Field label="Observação" wide><textarea name="observacao" defaultValue={editParty.observacao || ""} className="input" /></Field>
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <Actions cancel={() => setEditParty(null)} text="Salvar" />
          </form>
        </Modal>
      )}

      {movementOpen && (
        <Modal title={kind === "receitas" ? "Nova receita" : "Nova retirada"} close={() => setMovementOpen(false)}>
          <form onSubmit={saveMovement} className="grid gap-4 sm:grid-cols-2">
            <Field label="Data"><input name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></Field>
            <Field label="Conta">
              <select name="conta_id" required className="input">
                <option value="">Selecione</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome} - {money(a.saldo_atual)}</option>)}
              </select>
            </Field>
            <Field label="Parte financeira">
              <select name="parte_id" className="input">
                <option value="">Selecione</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Field>
            <Field label="Valor"><input name="valor" type="number" min="0.01" step="0.01" required className="input" /></Field>
            <Field label="Descrição" wide><input name="descricao" required className="input" /></Field>
            <Field label="Observação" wide><textarea name="observacao" className="input" /></Field>
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <Actions cancel={() => setMovementOpen(false)} text="Salvar" />
          </form>
        </Modal>
      )}
    </div>
  );
}

function PartyTable({ rows, edit, remove }: { rows: Counterparty[]; edit: (x: Counterparty) => void; remove: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {rows.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Nome", "Tipo", "Documento", "Status", "Ações"].map((x) => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody>{rows.map((x) => <tr key={x.id} className="border-t"><td className="px-5 py-4 font-medium">{x.nome}</td><td>{x.tipo.replace("_", " ")}</td><td>{x.documento || "--"}</td><td><Badge status={x.ativo ? "ativo" : "inativo"} /></td><td className="px-5"><button onClick={() => edit(x)} className="p-2 text-blue-600"><Pencil size={18} /></button><button onClick={() => remove(x.id)} className="p-2 text-red-600"><Trash2 size={18} /></button></td></tr>)}</tbody></table> : <Empty />}
    </div>
  );
}

function MovementTable({ rows }: { rows: Movement[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {rows.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Data", "Descrição", "Tipo", "Valor", "Status"].map((x) => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody>{rows.map((x) => <tr key={x.id} className="border-t"><td className="px-5 py-4">{formatDate(x.data)}</td><td className="font-medium">{x.descricao}</td><td>{x.tipo}</td><td className="font-semibold">{money(x.valor)}</td><td><Badge status="pago" /></td></tr>)}</tbody></table> : <Empty />}
    </div>
  );
}

function ExpenseTable({ rows, pay }: { rows: any[]; pay: (x: any) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {rows.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Vencimento", "Descrição", "Valor", "Status", "Ações"].map((x) => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody>{rows.map((x) => <tr key={x.id} className="border-t"><td className="px-5 py-4">{formatDate(x.data_vencimento)}</td><td className="font-medium">{x.descricao}</td><td className="font-semibold">{money(x.valor)}</td><td><Badge status={x.status} /></td><td><button onClick={() => pay(x)} className="p-2 text-emerald-600"><CheckCircle2 size={18} /></button></td></tr>)}</tbody></table> : <Empty />}
    </div>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: any }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex justify-between border-b bg-white px-7 py-5"><h3 className="text-xl font-bold">{title}</h3><button type="button" onClick={close}><X /></button></div><div className="p-7">{children}</div></div></div>;
}

function Field({ label, children, wide }: { label: string; children: any; wide?: boolean }) {
  return <label className={`text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function Actions({ cancel, text }: { cancel: () => void; text: string }) {
  return <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={cancel} className="rounded-xl border px-4 py-2">Cancelar</button><button className="rounded-xl bg-blue-600 px-5 py-2 text-white">{text}</button></div>;
}
