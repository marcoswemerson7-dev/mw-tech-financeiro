import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, CheckCircle2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Badge, Empty, money } from "../components/UI";
const defs = {
  clientes: {
    title: "Clientes",
    table: "clientes",
    fields: [
      "razao_social",
      "nome_fantasia",
      "cpf_cnpj",
      "telefone",
      "email",
      "cidade",
      "estado",
      "produto_contratado",
      "valor_mensalidade",
      "valor_implantacao",
      "dia_vencimento",
      "data_inicio",
      "status",
      "observacoes",
    ],
  },
  receitas: {
    title: "Receitas",
    table: "receitas",
    fields: [
      "cliente_id",
      "descricao",
      "categoria",
      "tipo",
      "valor",
      "data_vencimento",
      "data_recebimento",
      "forma_pagamento",
      "conta_bancaria_id",
      "status",
      "observacoes",
      "comprovante_url",
    ],
  },
  despesas: {
    title: "Despesas",
    table: "despesas",
    fields: [
      "descricao",
      "categoria",
      "fornecedor",
      "valor",
      "data_vencimento",
      "data_pagamento",
      "forma_pagamento",
      "conta_bancaria_id",
      "status",
      "recorrente",
      "observacoes",
      "comprovante_url",
    ],
  },
  retiradas: {
    title: "Retiradas",
    table: "retiradas",
    fields: [
      "data",
      "valor",
      "tipo",
      "conta_bancaria_id",
      "descricao",
      "observacoes",
    ],
  },
  "contas-receber": {
    title: "Contas a Receber",
    table: "receitas",
    fields: [],
  },
} as const;
const selectOptions: Record<string, [string, string][]> = {
  status: [
    ["pendente", "Pendente"],
    ["pago", "Pago"],
    ["atrasado", "Atrasado"],
    ["cancelado", "Cancelado"],
    ["ativo", "Ativo"],
    ["inativo", "Inativo"],
    ["suspenso", "Suspenso"],
  ],
  tipo: [
    ["mensalidade", "Mensalidade"],
    ["implantacao", "Implantação"],
    ["servico", "Serviço"],
    ["venda", "Venda"],
    ["retirada_proprietario", "Retirada do proprietário"],
    ["pro_labore", "Pró-labore"],
    ["distribuicao", "Distribuição"],
    ["outro", "Outro"],
  ],
  forma_pagamento: [
    ["PIX", "PIX"],
    ["Transferência", "Transferência"],
    ["Boleto", "Boleto"],
    ["Dinheiro", "Dinheiro"],
    ["Cartão", "Cartão"],
    ["Outro", "Outro"],
  ],
  recorrente: [
    ["false", "Não"],
    ["true", "Sim"],
  ],
};
const labels: Record<string, string> = {
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  cpf_cnpj: "CPF / CNPJ",
  cliente_id: "Cliente (ID)",
  data_vencimento: "Data de vencimento",
  data_recebimento: "Data de recebimento",
  data_pagamento: "Data de pagamento",
  forma_pagamento: "Forma de pagamento",
  conta_bancaria_id: "Conta bancária",
  comprovante_url: "Comprovante",
  produto_contratado: "Produto contratado",
  valor_mensalidade: "Valor da mensalidade",
  valor_implantacao: "Valor da implantação",
  dia_vencimento: "Dia do vencimento",
  data_inicio: "Data de início",
};
const fieldLabel = (f: string) =>
  labels[f] || f.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
const fieldPlaceholder = (f: string) =>
  f.includes("valor")
    ? "0,00"
    : f === "descricao"
      ? "Descreva o lançamento"
      : f === "categoria"
        ? "Selecione ou informe a categoria"
        : "Informe o dado";
const getStatus = (r: any) =>
  r.status === "pendente" &&
  r.data_vencimento < new Date().toISOString().slice(0, 10)
    ? "atrasado"
    : r.status || "pendente";
type K = keyof typeof defs;
export default function DataPage({ kind }: { kind: K }) {
  const def = defs[kind],
    [rows, setRows] = useState<Record<string, any>[]>([]),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [edit, setEdit] = useState<Record<string, any> | null>(null),
    [accounts, setAccounts] = useState<Record<string, any>[]>([]),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    let q = supabase
      .from(def.table)
      .select("*")
      .order("created_at", { ascending: false });
    if (kind === "contas-receber") q = q.eq("status", "pendente");
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    supabase
      .from("contas_bancarias")
      .select("id,nome,banco,agencia,conta")
      .eq("ativo", true)
      .then(({ data }) => setAccounts(data || []));
  }, [kind]);
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        const date = r.data_vencimento || r.data || r.data_inicio || "";
        return (
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase()) &&
          (!statusFilter || getStatus(r) === statusFilter) &&
          (!typeFilter || r.tipo === typeFilter) &&
          (!from || date >= from) &&
          (!to || date <= to)
        );
      }),
    [rows, search, statusFilter, typeFilter, from, to],
  );
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data: any = Object.fromEntries(new FormData(e.currentTarget));
    [
      "valor",
      "valor_mensalidade",
      "valor_implantacao",
      "dia_vencimento",
    ].forEach((k) => {
      if (k in data) data[k] = +data[k];
    });
    edit?.id
      ? await supabase.from(def.table).update(data).eq("id", edit.id)
      : await supabase.from(def.table).insert(data);
    setEdit(null);
    load();
  }
  async function del(id: any) {
    if (confirm("Excluir este registro?")) {
      await supabase.from(def.table).delete().eq("id", id);
      load();
    }
  }
  async function paid(r: any) {
    const date = kind === "despesas" ? "data_pagamento" : "data_recebimento";
    await supabase
      .from(def.table)
      .update({ status: "pago", [date]: new Date().toISOString().slice(0, 10) })
      .eq("id", r.id);
    load();
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{def.title}</h2>
          <p className="text-sm text-slate-500">
            Gerencie os registros da empresa.
          </p>
        </div>
        {kind !== "contas-receber" && (
          <button
            onClick={() => setEdit({})}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white"
          >
            <Plus size={18} />
            Novo registro
          </button>
        )}
      </div>
      <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição, cliente..."
            className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border px-3 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
          <option value="cancelado">Cancelado</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border px-3 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="mensalidade">Mensalidade</option>
          <option value="implantacao">Implantação</option>
          <option value="servico">Serviço</option>
          <option value="venda">Venda</option>
          <option value="pro_labore">Pró-labore</option>
          <option value="outro">Outro</option>
        </select>
        <input
          aria-label="Data inicial"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border px-3 text-sm"
        />
        <input
          aria-label="Data final"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border px-3 text-sm"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        {loading ? (
          <div className="py-14 text-center">Carregando...</div>
        ) : visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3">Descrição / Cliente</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th className="px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr className="border-t" key={r.id}>
                    <td className="px-5 py-4 font-medium">
                      {r.razao_social || r.nome_fantasia || r.descricao || "—"}
                    </td>
                    <td>{money(r.valor || r.valor_mensalidade)}</td>
                    <td>{r.data_vencimento || "—"}</td>
                    <td>
                      <Badge status={getStatus(r)} />
                    </td>
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        {["receitas", "despesas", "contas-receber"].includes(
                          kind,
                        ) &&
                          r.status === "pendente" && (
                            <button
                              onClick={() => paid(r)}
                              className="p-2 text-emerald-600"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                        {kind !== "contas-receber" && (
                          <button
                            onClick={() => setEdit(r)}
                            className="p-2 text-blue-600"
                          >
                            <Pencil size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => del(r.id)}
                          className="p-2 text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
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
      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <form
            onSubmit={save}
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 mb-5 flex justify-between border-b bg-white px-7 py-5">
              <h3 className="text-xl font-bold">
                {edit.id ? "Editar" : "Novo"} registro
              </h3>
              <button type="button" onClick={() => setEdit(null)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 px-7 sm:grid-cols-2">
              {def.fields.map((f) => (
                <label
                  key={f}
                  className={`text-sm font-medium capitalize ${f === "observacoes" ? "sm:col-span-2" : ""}`}
                >
                  {fieldLabel(f)}
                  {f === "conta_bancaria_id" ? (
                    <select
                      name={f}
                      defaultValue={edit[f] || ""}
                      className="mt-1.5 w-full rounded-xl border p-3"
                    >
                      <option value="">Selecione a conta</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.banco} · Ag. {a.agencia || "—"} · Conta{" "}
                          {a.conta || "—"}
                        </option>
                      ))}
                    </select>
                  ) : selectOptions[f] ? (
                    <select
                      name={f}
                      defaultValue={edit[f] ?? selectOptions[f][0][0]}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
                    >
                      {selectOptions[f].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : f === "observacoes" ? (
                    <textarea
                      name={f}
                      defaultValue={edit[f] || ""}
                      placeholder="Informações adicionais do lançamento..."
                      className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500"
                    />
                  ) : (
                    <input
                      name={f}
                      defaultValue={
                        edit[f] ?? (f === "status" ? "pendente" : "")
                      }
                      type={
                        f.includes("data")
                          ? "date"
                          : f.includes("valor") || f === "dia_vencimento"
                            ? "number"
                            : "text"
                      }
                      step={f.includes("valor") ? ".01" : undefined}
                      placeholder={fieldPlaceholder(f)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t bg-white px-7 py-4">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-xl border px-4 py-2"
              >
                Cancelar
              </button>
              <button className="rounded-xl bg-blue-600 px-5 py-2 text-white">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
