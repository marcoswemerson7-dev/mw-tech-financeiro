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
    fields: ["data", "valor", "tipo", "conta_bancaria_id", "descricao", "observacoes"],
  },
  "contas-receber": {
    title: "Contas a Receber",
    table: "receitas",
    fields: [],
  },
} as const;
type K = keyof typeof defs;
export default function DataPage({ kind }: { kind: K }) {
  const def = defs[kind],
    [rows, setRows] = useState<Record<string, any>[]>([]),
    [search, setSearch] = useState(""),
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
    supabase.from("contas_bancarias").select("id,nome,banco,agencia,conta").eq("ativo",true).then(({data})=>setAccounts(data||[]));
  }, [kind]);
  const visible = useMemo(
    () =>
      rows.filter((r) =>
        JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
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
  const status = (r: any) =>
    r.status === "pendente" &&
    r.data_vencimento < new Date().toISOString().slice(0, 10)
      ? "atrasado"
      : r.status || "pendente";
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
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-4"
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
                      <Badge status={status(r)} />
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
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-5 flex justify-between">
              <h3 className="text-xl font-bold">
                {edit.id ? "Editar" : "Novo"} registro
              </h3>
              <button type="button" onClick={() => setEdit(null)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {def.fields.map((f) => (
                <label
                  key={f}
                  className={`text-sm font-medium capitalize ${f === "observacoes" ? "sm:col-span-2" : ""}`}
                >
                  {f.replaceAll("_", " ")}
                  {f === "conta_bancaria_id" ? (
                    <select name={f} defaultValue={edit[f] || ""} className="mt-1.5 w-full rounded-xl border p-3">
                      <option value="">Selecione a conta</option>
                      {accounts.map(a=><option key={a.id} value={a.id}>{a.banco} · Ag. {a.agencia||"—"} · Conta {a.conta||"—"}</option>)}
                    </select>
                  ) : f === "observacoes" ? (
                    <textarea
                      name={f}
                      defaultValue={edit[f] || ""}
                      className="mt-1.5 min-h-24 w-full rounded-xl border p-3"
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
                      className="mt-1.5 w-full rounded-xl border p-3"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
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
