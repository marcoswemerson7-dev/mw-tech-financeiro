import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Grid2X2, Landmark, List, Plus, Search, TrendingUp, WalletCards, X, Pencil, Trash2, UserRound } from "lucide-react";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { deleteAccount, getAccounts, saveAccount } from "../services/accounts";
import { money, Empty, ActionButton, FilterBar, IconAction, PageHeader, StatCard, Badge, Toast } from "../components/UI";
import { BankLogo } from "../components/BankLogo";
type Account = {
  id: string;
  nome: string;
  banco: string;
  codigo_banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta: string;
  saldo_inicial: number;
  saldo_atual: number;
  cor: string;
  observacao?: string;
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
  saldo_atual: 0,
  cor: "#f7c600",
  observacao: "",
  ativo: true,
};
export default function Accounts() {
  const [rows, setRows] = useState<Account[]>([]),
    [edit, setEdit] = useState<Partial<Account> | null>(null),
    [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  async function load() {
    if (!isConfigured) {
      setRows(
        JSON.parse(
          localStorage.getItem("mw-accounts") || JSON.stringify([demo]),
        ),
      );
      return;
    }
    setRows((await getAccounts()) as Account[]);
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.saldo_inicial = Number(d.saldo_inicial || 0);
    if (!edit?.id) d.saldo_atual = d.saldo_inicial;
    d.ativo = true;
    d.cor = edit?.cor || "#0b2b66";
    try {
      let saved: Account;
      if (!isConfigured) {
        saved = { ...edit, ...d, id: edit?.id || crypto.randomUUID() } as Account;
        const next = edit?.id
          ? rows.map((x) => (x.id === edit.id ? saved : x))
          : [...rows, saved];
        localStorage.setItem("mw-accounts", JSON.stringify(next));
        setRows(next);
      } else {
        const row: any = await saveAccount({ ...edit, ...d }, edit?.id);
        saved = {
          ...edit,
          ...d,
          id: row.$id || edit?.id,
          tipo_conta: row.tipo || d.tipo_conta || "corrente",
          conta: row.numero_conta || d.conta || "",
          saldo_atual: Number(row.saldo_atual ?? d.saldo_atual ?? d.saldo_inicial ?? 0),
          ativo: row.ativo ?? true,
        } as Account;
        setRows((current) =>
          edit?.id
            ? current.map((x) => (x.id === edit.id ? saved : x))
            : [...current, saved],
        );
      }
      setEdit(null);
      setToast(edit?.id ? "Alterações salvas com sucesso." : "Conta salva com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta conta? Se houver histórico vinculado, ela será inativada para preservar os registros financeiros.")) return;
    setBusy(true);
    if (!isConfigured) {
      const n = rows.filter((x) => x.id !== id);
      localStorage.setItem("mw-accounts", JSON.stringify(n));
      setRows(n);
      setToast("Conta excluída com sucesso.");
      setTimeout(() => setToast(""), 2600);
      setBusy(false);
    } else {
      try {
        await deleteAccount(id);
        setRows((current) => current.filter((x) => x.id !== id));
        setToast("Conta excluída com sucesso.");
        setTimeout(() => setToast(""), 2600);
      } finally {
        setBusy(false);
      }
    }
  }
  const visible = rows.filter(
    (a) =>
      (!type || a.tipo_conta === type) &&
      JSON.stringify(a).toLowerCase().includes(search.toLowerCase()),
  );
  const total = rows.reduce((s, a) => s + Number(a.saldo_atual ?? a.saldo_inicial), 0);
  const average = rows.length ? total / rows.length : 0;

  return (
    <div className="space-y-7">
      <Toast message={toast} />
      <PageHeader
        title="Contas bancárias e caixa"
        subtitle="Visualize suas contas, dados bancários e saldos de forma rápida e segura."
        actions={
          <ActionButton onClick={() => setEdit({})} disabled={busy}>
            <Plus size={18} />
            Cadastrar conta
          </ActionButton>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard title="Saldo total em contas" value={money(total)} icon={<Landmark size={27} />} tone="blue" hint="↑ 100% vs mês anterior" />
        <StatCard title="Quantidade de contas" value={rows.length} icon={<WalletCards size={27} />} tone="green" hint="— 0% vs mês anterior" />
        <StatCard title="Saldo médio por conta" value={money(average)} icon={<TrendingUp size={27} />} tone="gold" hint="↑ 100% vs mês anterior" />
      </div>

      <FilterBar>
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por banco, agência, conta ou titular..." className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-[15px] outline-none focus:border-blue-500" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="min-h-[52px] min-w-[190px] rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-[#061426] outline-none">
          <option value="">Todos os tipos</option>
          {[...new Set(rows.map((a) => a.tipo_conta).filter(Boolean))].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <div className="ml-auto flex rounded-xl bg-slate-100 p-1">
          <button className="grid size-11 place-items-center rounded-lg bg-white text-[#061426] shadow-sm" aria-label="Visualização em lista"><List size={20} /></button>
          <button className="grid size-11 place-items-center rounded-lg text-slate-500" aria-label="Visualização em cards"><Grid2X2 size={20} /></button>
        </div>
      </FilterBar>

      <div className="space-y-5">
        {visible.map((a) => (
          <div
            key={a.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,35,70,.055)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,35,70,.09)]"
          >
            <div className="h-1.5 bg-[#0b2b66]" style={{ background: a.cor || "#0b2b66" }} />
            <div className="p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 gap-5">
                  <BankLogo code={a.codigo_banco} name={a.banco} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <b className="block text-[24px] font-black leading-tight text-[#061426]">{a.banco || a.nome}</b>
                      <Badge status={a.tipo_conta || "conta"} />
                    </div>
                    <span className="mt-1 block text-[15px] text-slate-500">
                      {a.codigo_banco || "—"} - {a.banco || a.nome}
                    </span>
                    <p className="mt-2"><Badge status={a.ativo ? "ativo" : "inativo"} /></p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ActionButton onClick={() => setEdit(a)} tone="outline" disabled={busy}>
                    <Pencil size={16} />
                    Editar
                  </ActionButton>
                  <ActionButton onClick={() => remove(a.id)} tone="danger" disabled={busy}>
                    <Trash2 size={16} />
                    Excluir
                  </ActionButton>
                </div>
              </div>
              <div className="mt-7 grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_1.35fr_1.4fr]">
                <Info icon={<Landmark size={20} />} label="Agência" value={a.agencia || "Não informada"} />
                <Info icon={<WalletCards size={20} />} label="Conta" value={a.conta || "Não informada"} />
                <Info icon={<Grid2X2 size={20} />} label="Tipo de conta" value={a.tipo_conta || "Não informado"} />
                <Info icon={<UserRound size={20} />} label="Titular" value={a.nome || "Não informado"} />
                <div className="rounded-xl bg-slate-50 p-4">
                  <span className="text-[14px] font-bold text-slate-500">Saldo atual</span>
                  <strong className="mt-1 block text-[29px] font-black tracking-[-0.02em] text-[#061426]">{money(a.saldo_atual ?? a.saldo_inicial)}</strong>
                </div>
              </div>
              {a.observacao && <p className="mt-4 rounded-xl border border-slate-100 p-3 text-sm text-slate-500">{a.observacao}</p>}
            </div>
          </div>
        ))}
      </div>
      {!visible.length && <Empty />}
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
              <IconAction title="Fechar" onClick={() => setEdit(null)} tone="slate">
                <X />
              </IconAction>
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
              <label className="text-sm font-medium sm:col-span-2">
                Observação
                <textarea
                  name="observacao"
                  defaultValue={String((edit as any).observacao || "")}
                  className="mt-1.5 w-full rounded-xl border p-3"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="rounded-xl border px-4 py-2">
                Cancelar
              </button>
              <button disabled={busy} className="rounded-xl bg-[#0b2b66] px-5 py-2 text-white disabled:opacity-50">
                {busy ? "Salvando..." : "Salvar conta"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 border-slate-200 px-2 py-3 xl:border-r">
      <div className="flex items-center gap-3 text-slate-500">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[14px] font-bold">{label}</span>
      </div>
      <b className="mt-2 block break-words text-[18px] font-black text-[#061426]">{value}</b>
    </div>
  );
}
