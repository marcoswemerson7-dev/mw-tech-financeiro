import { useEffect, useState } from "react";
import { Plus, X, Landmark, Pencil, Trash2 } from "lucide-react";
import { supabase, isConfigured } from "../lib/supabase";
import { money, Empty } from "../components/UI";
type Account = {
  id: string;
  nome: string;
  banco: string;
  codigo_banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta: string;
  saldo_inicial: number;
  cor: string;
  ativo: boolean;
};
const demo: Account = {
  id: "demo-bb",
  nome: "Conta principal",
  banco: "Banco do Brasil",
  codigo_banco: "001",
  agencia: "Informe a agência",
  conta: "Informe a conta",
  tipo_conta: "corrente",
  saldo_inicial: 0,
  cor: "#f7c600",
  ativo: true,
};
export default function Accounts() {
  const [rows, setRows] = useState<Account[]>([]),
    [edit, setEdit] = useState<Partial<Account> | null>(null);
  async function load() {
    if (!isConfigured) {
      setRows(
        JSON.parse(
          localStorage.getItem("mw-accounts") || JSON.stringify([demo]),
        ),
      );
      return;
    }
    const { data } = await supabase
      .from("contas_bancarias")
      .select("*")
      .order("created_at");
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.saldo_inicial = Number(d.saldo_inicial || 0);
    d.ativo = true;
    d.cor = edit?.cor || "#0b2b66";
    if (!isConfigured) {
      const next = edit?.id
        ? rows.map((x) => (x.id === edit.id ? { ...x, ...d } : x))
        : [...rows, { ...d, id: crypto.randomUUID() }];
      localStorage.setItem("mw-accounts", JSON.stringify(next));
      setRows(next);
    } else
      edit?.id
        ? await supabase.from("contas_bancarias").update(d).eq("id", edit.id)
        : await supabase.from("contas_bancarias").insert(d);
    setEdit(null);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta conta bancária?")) return;
    if (!isConfigured) {
      const n = rows.filter((x) => x.id !== id);
      localStorage.setItem("mw-accounts", JSON.stringify(n));
      setRows(n);
    } else {
      await supabase.from("contas_bancarias").delete().eq("id", id);
      load();
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#0b1d3a]">
            Contas bancárias e caixa
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Identifique de onde cada valor entra e sai.
          </p>
        </div>
        <button
          onClick={() => setEdit({})}
          className="flex items-center gap-2 rounded-xl bg-[#0b2b66] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={18} />
          Cadastrar conta
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => (
          <div
            key={a.id}
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          >
            <div className="h-2" style={{ background: a.cor }} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <span
                    className={`grid size-12 place-items-center rounded-xl ${a.codigo_banco === "001" ? "bg-[#f7c600] text-[#153c8a]" : "bg-slate-100 text-slate-600"}`}
                  >
                    {a.codigo_banco === "001" ? (
                      <b className="text-xs">BB</b>
                    ) : (
                      <Landmark />
                    )}
                  </span>
                  <div>
                    <b className="block text-sm">{a.nome}</b>
                    <span className="text-xs text-slate-500">
                      {a.banco} · {a.codigo_banco || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex">
                  <button
                    onClick={() => setEdit(a)}
                    className="p-2 text-blue-600"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    className="p-2 text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-400">Agência</span>
                  <b className="mt-1 block">{a.agencia || "Não informada"}</b>
                </div>
                <div>
                  <span className="text-slate-400">Conta</span>
                  <b className="mt-1 block">{a.conta || "Não informada"}</b>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">Saldo inicial</span>
                <strong>{money(a.saldo_inicial)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <Empty />}
      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-xl rounded-2xl bg-white p-6"
          >
            <div className="flex justify-between">
              <h3 className="text-lg font-bold">
                {edit.id ? "Editar" : "Nova"} conta
              </h3>
              <button type="button" onClick={() => setEdit(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["nome", "Nome da conta"],
                ["banco", "Banco"],
                ["codigo_banco", "Código do banco"],
                ["agencia", "Agência"],
                ["conta", "Número da conta"],
                ["tipo_conta", "Tipo da conta"],
                ["saldo_inicial", "Saldo inicial"],
              ].map(([n, l]) => (
                <label key={n} className="text-sm font-medium">
                  {l}
                  <input
                    required={["nome", "banco"].includes(n)}
                    name={n}
                    type={n === "saldo_inicial" ? "number" : "text"}
                    step="0.01"
                    defaultValue={String((edit as any)[n] || "")}
                    className="mt-1.5 w-full rounded-xl border p-3"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-xl border px-4 py-2"
              >
                Cancelar
              </button>
              <button className="rounded-xl bg-[#0b2b66] px-5 py-2 text-white">
                Salvar conta
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
