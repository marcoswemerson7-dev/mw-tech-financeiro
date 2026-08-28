import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Search,
  Paperclip,
  Building2,
  UserRoundPlus,
} from "lucide-react";
import {
  getAccounts,
  getMovements,
  registerMovement,
  uploadReceipt,
  type Account,
  type Movement,
} from "../lib/finance";
import {
  createCounterparty,
  getCounterparties,
  type Counterparty,
} from "../services/counterparties";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { money, Empty, formatDate } from "../components/UI";

export default function Transactions() {
  const [rows, setRows] = useState<Movement[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [counterparties, setCounterparties] = useState<Counterparty[]>([]),
    [open, setOpen] = useState(false),
    [partyOpen, setPartyOpen] = useState(false),
    [launchType, setLaunchType] = useState("entrada"),
    [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  async function load() {
    if (!isConfigured) return;
    try {
      const [movements, accountRows, partyRows] = await Promise.all([
        getMovements(),
        getAccounts(),
        getCounterparties().catch(() => []),
      ]);
      setRows(movements);
      setAccounts(accountRows);
      setCounterparties(partyRows);
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
      const form = e.currentTarget;
      const d: any = Object.fromEntries(new FormData(form));
      const file = (form.elements.namedItem("arquivo") as HTMLInputElement).files?.[0];
      if (file) d.comprovante_id = await uploadReceipt(file);

      if (d.tipo !== "transferencia") {
        const party = counterparties.find((x) => x.id === d.parte_id);
        if (!party) throw new Error(d.tipo === "entrada" ? "Informe de quem o valor foi recebido." : "Informe para quem o valor foi pago.");
        const originalDescription = String(d.descricao || "").trim();
        const prefix = d.tipo === "entrada" ? `Recebido de ${party.nome}` : `Pago para ${party.nome}`;
        d.descricao = originalDescription ? `${prefix} — ${originalDescription}` : prefix;
        const note = String(d.observacao || "").trim();
        d.observacao = `Parte financeira: ${party.nome}${party.documento ? ` (${party.documento})` : ""}${note ? `\n${note}` : ""}`;
      }
      delete d.parte_id;

      await registerMovement(d);
      setOpen(false);
      setLaunchType("entrada");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCounterparty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d: any = Object.fromEntries(new FormData(e.currentTarget));
      await createCounterparty(d);
      setPartyOpen(false);
      setCounterparties(await getCounterparties());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#0b1d3a]">Entradas e saídas</h2>
          <p className="mt-1 text-[15px] text-slate-500">Registre de onde o dinheiro veio, para onde foi e em qual conta entrou ou saiu.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setPartyOpen(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-[#0b2b66] shadow-sm">
            <UserRoundPlus size={18} /> Cadastros
          </button>
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#0b2b66] px-5 py-3.5 text-sm font-semibold text-white shadow-sm">
            <Plus size={18} /> Novo lançamento
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Mini title="Entradas" value={rows.filter((x) => x.tipo.includes("entrada")).reduce((a, x) => a + Number(x.valor), 0)} icon={<ArrowUpRight />} color="green" />
        <Mini title="Saídas" value={rows.filter((x) => x.tipo.includes("saida")).reduce((a, x) => a + Number(x.valor), 0)} icon={<ArrowDownRight />} color="red" />
        <Mini title="Movimentações" value={rows.length} icon={<ArrowLeftRight />} count />
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={19} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição, prefeitura, fornecedor..." className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-[15px] outline-none focus:border-blue-400" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-200 px-4 text-[15px]">
          <option value="">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
          <option value="transferencia">Transferências</option>
        </select>
      </div>

      <MovementTable rows={visible} />

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={save} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-7 py-6">
              <div>
                <h3 className="text-2xl font-bold text-[#0b1d3a]">Novo lançamento</h3>
                <p className="mt-1 text-sm text-slate-500">Informe a origem/destino do dinheiro e a conta utilizada.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-slate-100"><X /></button>
            </div>
            <div className="grid gap-5 p-7 sm:grid-cols-2">
              <Field label="Tipo">
                <select name="tipo" required className="input" value={launchType} onChange={(e) => setLaunchType(e.target.value)}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="transferencia">Transferência entre contas</option>
                </select>
              </Field>
              <Field label="Data">
                <input name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
              </Field>

              {launchType !== "transferencia" && (
                <Field label={launchType === "entrada" ? "Recebido de" : "Pago para"} wide>
                  <div className="flex gap-2">
                    <select name="parte_id" required className="input">
                      <option value="">Selecione um cadastro</option>
                      {counterparties.map((party) => (
                        <option value={party.id} key={party.id}>{party.nome}{party.documento ? ` · ${party.documento}` : ""}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setPartyOpen(true)} className="mt-1.5 grid min-w-12 place-items-center rounded-xl border border-slate-200 text-[#0b2b66]" title="Novo cadastro"><Plus size={20} /></button>
                  </div>
                  <span className="mt-1 block text-xs font-normal text-slate-400">Ex.: Prefeitura Municipal de Ribeiro Gonçalves, cliente, fornecedor ou pessoa.</span>
                </Field>
              )}

              <Field label="Descrição" wide>
                <input name="descricao" required className="input" placeholder={launchType === "entrada" ? "Ex.: Mensalidade do sistema - agosto/2026" : "Ex.: Pagamento de serviço / compra"} />
              </Field>

              <Field label={launchType === "entrada" ? "Entrar na conta" : launchType === "saida" ? "Sair da conta" : "Conta de origem"}>
                <select name="conta_id" required className="input">
                  <option value="">Selecione</option>
                  {accounts.map((a) => <option value={a.id} key={a.id}>{a.nome} · {money(a.saldo_atual)}</option>)}
                </select>
              </Field>

              {launchType === "transferencia" && (
                <Field label="Conta de destino">
                  <select name="conta_destino_id" required className="input">
                    <option value="">Selecione</option>
                    {accounts.map((a) => <option value={a.id} key={a.id}>{a.nome} · {money(a.saldo_atual)}</option>)}
                  </select>
                </Field>
              )}

              <Field label="Valor">
                <input name="valor" type="number" min="0.01" step="0.01" required className="input" placeholder="0,00" />
              </Field>
              <Field label="Comprovante">
                <label className="input flex cursor-pointer items-center gap-2"><Paperclip size={17} /> Selecionar arquivo<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" /></label>
              </Field>
              <Field label="Observação" wide><textarea name="observacao" className="input min-h-24" /></Field>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t px-7 py-5">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-5 py-3">Cancelar</button>
              <button disabled={busy || !isConfigured} className="rounded-xl bg-[#0b2b66] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : "Salvar lançamento"}</button>
            </div>
          </form>
        </div>
      )}

      {partyOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={saveCounterparty} className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-7 py-6">
              <div>
                <h3 className="text-2xl font-bold text-[#0b1d3a]">Novo cadastro</h3>
                <p className="mt-1 text-sm text-slate-500">Cadastre quem paga a MW TECH ou quem recebe pagamentos.</p>
              </div>
              <button type="button" onClick={() => setPartyOpen(false)} className="rounded-xl p-2 hover:bg-slate-100"><X /></button>
            </div>
            <div className="grid gap-5 p-7 sm:grid-cols-2">
              <Field label="Nome / Razão social" wide><input name="nome" required className="input" placeholder="Ex.: Prefeitura Municipal de ..." /></Field>
              <Field label="Tipo">
                <select name="tipo" required className="input">
                  <option value="orgao_publico">Órgão público</option>
                  <option value="cliente">Cliente</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="outro">Outro</option>
                </select>
              </Field>
              <Field label="CPF / CNPJ"><input name="documento" className="input" placeholder="Opcional" /></Field>
              <Field label="Observação" wide><textarea name="observacao" className="input min-h-20" placeholder="Opcional" /></Field>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t px-7 py-5">
              <button type="button" onClick={() => setPartyOpen(false)} className="rounded-xl border px-5 py-3">Cancelar</button>
              <button disabled={busy} className="rounded-xl bg-[#0b2b66] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : "Cadastrar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Mini({ title, value, icon, color, count }: { title: string; value: number; icon: any; color?: string; count?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex justify-between gap-4">
        <div><p className="text-[15px] font-medium text-slate-500">{title}</p><b className="mt-3 block text-[30px] tracking-tight text-[#0b1d3a]">{count ? value : money(value)}</b></div>
        <span className={`grid size-13 place-items-center rounded-2xl ${color === "green" ? "bg-emerald-50 text-emerald-600" : color === "red" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}>{icon}</span>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: any; wide?: boolean }) {
  return <label className={`text-[15px] font-semibold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function MovementTable({ rows }: { rows: Movement[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[15px]">
            <thead className="bg-slate-50 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>{["Data", "Origem / Destino", "Descrição", "Tipo", "Conta", "Valor"].map((x) => <th key={x} className="px-6 py-4">{x}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const parsed = parseDescription(x.descricao);
                return (
                  <tr key={x.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-6 py-5">{formatDate(x.data)}</td>
                    <td className="px-6 py-5"><div className="flex items-center gap-2 font-semibold text-[#0b1d3a]"><Building2 size={17} className="text-slate-400" />{parsed.party}</div></td>
                    <td className="px-6 py-5 font-medium">{parsed.description}</td>
                    <td className="px-6 py-5 capitalize">{x.tipo.replace("_", " ")}</td>
                    <td className="px-6 py-5">{x.contas_bancarias?.nome || "—"}</td>
                    <td className={`px-6 py-5 text-base font-bold ${x.tipo.includes("entrada") ? "text-emerald-600" : x.tipo.includes("saida") ? "text-rose-600" : "text-blue-600"}`}>{money(x.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty />}
    </div>
  );
}

function parseDescription(value: string) {
  const entry = value.match(/^Recebido de (.+?) — (.+)$/);
  if (entry) return { party: entry[1], description: entry[2] };
  const output = value.match(/^Pago para (.+?) — (.+)$/);
  if (output) return { party: output[1], description: output[2] };
  if (value.startsWith("Recebido de ")) return { party: value.replace("Recebido de ", ""), description: "Recebimento" };
  if (value.startsWith("Pago para ")) return { party: value.replace("Pago para ", ""), description: "Pagamento" };
  return { party: "—", description: value };
}
