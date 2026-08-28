import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  deleteMovement,
  getAccounts,
  getMovements,
  peekMovements,
  registerMovement,
  updateMovement,
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
import { dateOnly, Empty, formatDate, money } from "../components/UI";

const now = new Date();
const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  .toISOString()
  .slice(0, 10);

export default function Transactions() {
  const [rows, setRows] = useState<Movement[]>(peekMovements(200) ?? []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Movement | null>(null);
  const [details, setDetails] = useState<Movement | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [launchType, setLaunchType] = useState("entrada");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    if (!isConfigured) return;
    try {
      const [movementRows, accountRows, partyRows] = await Promise.all([
        getMovements(200, force),
        getAccounts(),
        getCounterparties().catch(() => [] as Counterparty[]),
      ]);
      setRows(movementRows);
      setAccounts(accountRows);
      setCounterparties(partyRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as movimentações.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((movement) => {
      const movementDate = dateOnly(movement.data);
      const matchesPeriod = (!from || movementDate >= from) && (!to || movementDate <= to);
      const matchesType = !type || movement.tipo.includes(type);
      const matchesSearch = !term || JSON.stringify(movement).toLowerCase().includes(term);
      return matchesPeriod && matchesType && matchesSearch;
    });
  }, [rows, search, type, from, to]);

  const entries = visible
    .filter((movement) => movement.tipo.includes("entrada"))
    .reduce((sum, movement) => sum + Number(movement.valor), 0);
  const outputs = visible
    .filter((movement) => movement.tipo.includes("saida"))
    .reduce((sum, movement) => sum + Number(movement.valor), 0);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = e.currentTarget;
      const data = Object.fromEntries(new FormData(form)) as Record<string, unknown>;
      const fileInput = form.elements.namedItem("arquivo") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      if (file) data.comprovante_id = await uploadReceipt(file);

      if (edit) {
        await updateMovement(edit.id, data);
        setEdit(null);
      } else {
        if (data.tipo !== "transferencia") {
          const partyId = String(data.parte_id || "");
          const party = counterparties.find((item) => item.id === partyId);
          if (!party) {
            throw new Error(
              data.tipo === "entrada"
                ? "Informe de quem o valor foi recebido."
                : "Informe para quem o valor foi pago.",
            );
          }
          const originalDescription = String(data.descricao || "").trim();
          const prefix = data.tipo === "entrada" ? `Recebido de ${party.nome}` : `Pago para ${party.nome}`;
          data.descricao = originalDescription ? `${prefix} — ${originalDescription}` : prefix;
          const originalNote = String(data.observacao || "").trim();
          data.observacao = `Parte financeira: ${party.nome}${party.documento ? ` (${party.documento})` : ""}${originalNote ? `\n${originalNote}` : ""}`;
        }
        delete data.parte_id;
        await registerMovement(data);
        setOpen(false);
        setLaunchType("entrada");
      }
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a movimentação.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(movement: Movement) {
    if (!confirm(`Excluir esta movimentação de ${money(movement.valor)}? O efeito no saldo será estornado automaticamente.`)) return;
    setBusy(true);
    try {
      await deleteMovement(movement.id);
      await load(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir a movimentação.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCounterparty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>;
      await createCounterparty(data);
      setPartyOpen(false);
      setCounterparties(await getCounterparties());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(movement: Movement) {
    setEdit(movement);
    setLaunchType(movement.tipo);
    setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-extrabold text-[#0b1d3a]">Entradas e saídas</h2>
          <p className="mt-1 text-[15px] text-slate-500">Consulte por período e mantenha as movimentações dentro de um quadro compacto.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setPartyOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 font-bold text-[#0b2b66]">
            <UserRoundPlus size={18} /> Cadastros
          </button>
          <button type="button" onClick={() => { setEdit(null); setLaunchType("entrada"); setError(""); setOpen(true); }} className="flex items-center gap-2 rounded-lg bg-[#0b2b66] px-5 py-3 font-bold text-white">
            <Plus size={18} /> Novo lançamento
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Entradas no período" value={money(entries)} icon={<ArrowUpRight size={24} />} tone="green" />
        <SummaryCard title="Saídas no período" value={money(outputs)} icon={<ArrowDownRight size={24} />} tone="red" />
        <SummaryCard title="Movimentações" value={String(visible.length)} icon={<ArrowLeftRight size={24} />} tone="blue" />
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_185px_185px_190px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição, prefeitura, fornecedor..." className="h-13 w-full rounded-lg border border-slate-200 pl-11 pr-4 outline-none focus:border-blue-400" />
        </div>
        <label className="relative">
          <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-13 w-full rounded-lg border border-slate-200 pl-10 pr-2" title="Data inicial" />
        </label>
        <label className="relative">
          <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-13 w-full rounded-lg border border-slate-200 pl-10 pr-2" title="Data final" />
        </label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-13 rounded-lg border border-slate-200 px-4">
          <option value="">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
          <option value="transferencia">Transferências</option>
          <option value="estorno">Estornos</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#cad5e3] bg-white shadow-sm">
        {visible.length ? (
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full min-w-[1120px] table-fixed text-left text-[14px]">
              <thead className="sticky top-0 z-20 bg-[#10365f] text-white">
                <tr>
                  <th className="w-[105px] px-4 py-4">Data</th>
                  <th className="w-[245px] px-4 py-4">Origem / Destino</th>
                  <th className="px-4 py-4">Descrição</th>
                  <th className="w-[115px] px-4 py-4">Tipo</th>
                  <th className="w-[245px] px-4 py-4">Conta</th>
                  <th className="w-[120px] px-4 py-4">Valor</th>
                  <th className="sticky right-0 w-[145px] bg-[#10365f] px-4 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((movement) => {
                  const parsed = parseDescription(movement.descricao);
                  const protectedMovement = Boolean(movement.despesa_id || movement.pagamento_id);
                  return (
                    <tr key={movement.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(movement.data)}</td>
                      <td className="px-4 py-4 font-bold text-slate-800"><div className="flex items-start gap-2"><Building2 size={16} className="mt-0.5 shrink-0 text-slate-400" /><span>{parsed.party}</span></div></td>
                      <td className="px-4 py-4 font-semibold text-slate-800">{parsed.description}</td>
                      <td className="px-4 py-4"><TypeBadge type={movement.tipo} /></td>
                      <td className="px-4 py-4 text-slate-700">{movement.contas_bancarias?.nome || "—"}</td>
                      <td className={`px-4 py-4 whitespace-nowrap font-extrabold ${movement.tipo.includes("entrada") ? "text-emerald-700" : movement.tipo.includes("saida") ? "text-rose-700" : "text-blue-700"}`}>{money(movement.valor)}</td>
                      <td className="sticky right-0 bg-white px-3 py-4 even:bg-slate-50">
                        <div className="flex justify-center gap-1.5">
                          <ActionButton title="Ver detalhes" onClick={() => setDetails(movement)}><Eye size={17} /></ActionButton>
                          <ActionButton title={protectedMovement ? "Gerenciada pela tela de Despesas" : "Editar"} onClick={() => startEdit(movement)} disabled={protectedMovement}><Pencil size={17} /></ActionButton>
                          <ActionButton title={protectedMovement ? "Gerenciada pela tela de Despesas" : "Excluir"} onClick={() => void remove(movement)} disabled={protectedMovement} danger><Trash2 size={17} /></ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </div>

      {(open || edit) && (
        <MovementDialog edit={edit} accounts={accounts} counterparties={counterparties} launchType={launchType} setLaunchType={setLaunchType} busy={busy} error={error} onSubmit={save} onClose={() => { setOpen(false); setEdit(null); setError(""); }} onAddParty={() => setPartyOpen(true)} />
      )}
      {details && <DetailsDialog movement={details} onClose={() => setDetails(null)} />}
      {partyOpen && <PartyDialog busy={busy} error={error} onSubmit={saveCounterparty} onClose={() => { setPartyOpen(false); setError(""); }} />}
    </div>
  );
}

function MovementDialog({ edit, accounts, counterparties, launchType, setLaunchType, busy, error, onSubmit, onClose, onAddParty }: { edit: Movement | null; accounts: Account[]; counterparties: Counterparty[]; launchType: string; setLaunchType: (value: string) => void; busy: boolean; error: string; onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>; onClose: () => void; onAddParty: () => void; }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-7 py-5">
          <div><h3 className="text-2xl font-extrabold text-[#0b1d3a]">{edit ? "Editar movimentação" : "Novo lançamento"}</h3><p className="mt-1 text-sm text-slate-500">{edit ? "O saldo será recalculado automaticamente ao salvar." : "Informe a origem/destino e a conta utilizada."}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X /></button>
        </div>
        <div className="grid gap-5 p-7 sm:grid-cols-2">
          <Field label="Tipo"><select name="tipo" required className="input" value={launchType} onChange={(e) => setLaunchType(e.target.value)}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="transferencia">Transferência</option>{edit?.tipo === "estorno" && <option value="estorno">Estorno</option>}</select></Field>
          <Field label="Data"><input name="data" type="date" required defaultValue={edit ? dateOnly(edit.data) : new Date().toISOString().slice(0, 10)} className="input" /></Field>
          {!edit && launchType !== "transferencia" && <Field label={launchType === "entrada" ? "Recebido de" : "Pago para"} wide><div className="flex gap-2"><select name="parte_id" required className="input"><option value="">Selecione um cadastro</option>{counterparties.map((party) => <option key={party.id} value={party.id}>{party.nome}{party.documento ? ` · ${party.documento}` : ""}</option>)}</select><button type="button" onClick={onAddParty} className="mt-2 min-w-12 rounded-lg border border-slate-200 text-[#0b2b66]" title="Novo cadastro"><Plus size={20} className="mx-auto" /></button></div></Field>}
          <Field label="Descrição" wide><input name="descricao" required className="input" defaultValue={edit?.descricao || ""} /></Field>
          <Field label={launchType === "entrada" ? "Entrar na conta" : launchType === "saida" ? "Sair da conta" : "Conta de origem"}><select name="conta_id" required className="input" defaultValue={edit?.conta_id || ""}><option value="">Selecione</option>{accounts.map((accountRow) => <option key={accountRow.id} value={accountRow.id}>{accountRow.nome} · {money(accountRow.saldo_atual)}</option>)}</select></Field>
          {launchType === "transferencia" && <Field label="Conta de destino"><select name="conta_destino_id" required className="input" defaultValue={edit?.conta_destino_id || ""}><option value="">Selecione</option>{accounts.map((accountRow) => <option key={accountRow.id} value={accountRow.id}>{accountRow.nome}</option>)}</select></Field>}
          <Field label="Valor"><input name="valor" type="number" min="0.01" step="0.01" required className="input" defaultValue={edit?.valor ?? ""} /></Field>
          <Field label="Comprovante"><label className="input flex cursor-pointer items-center gap-2"><Paperclip size={17} /> Selecionar arquivo<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" /></label></Field>
          <Field label="Observação" wide><textarea name="observacao" className="input min-h-24" defaultValue={edit?.observacao || ""} /></Field>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t px-7 py-5"><button type="button" onClick={onClose} className="rounded-lg border px-5 py-3">Cancelar</button><button disabled={busy || !isConfigured} className="rounded-lg bg-[#0b2b66] px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "Salvando..." : edit ? "Salvar alterações" : "Salvar lançamento"}</button></div>
      </form>
    </div>
  );
}

function DetailsDialog({ movement, onClose }: { movement: Movement; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-6"><h3 className="text-xl font-extrabold text-[#0b1d3a]">Detalhes da movimentação</h3><button type="button" onClick={onClose}><X /></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><Info label="Data" value={formatDate(movement.data)} /><Info label="Tipo" value={movement.tipo} /><Info label="Descrição" value={movement.descricao} wide /><Info label="Conta" value={movement.contas_bancarias?.nome || "—"} /><Info label="Valor" value={money(movement.valor)} /><Info label="Observação" value={movement.observacao || "—"} wide /></div></div></div>;
}

function PartyDialog({ busy, error, onSubmit, onClose }: { busy: boolean; error: string; onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>; onClose: () => void; }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4"><form onSubmit={onSubmit} className="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-7 py-5"><div><h3 className="text-2xl font-extrabold text-[#0b1d3a]">Novo cadastro</h3><p className="mt-1 text-sm text-slate-500">Cadastre clientes, órgãos e fornecedores.</p></div><button type="button" onClick={onClose}><X /></button></div><div className="grid gap-5 p-7 sm:grid-cols-2"><Field label="Nome / Razão social" wide><input name="nome" required className="input" /></Field><Field label="Tipo"><select name="tipo" required className="input"><option value="orgao_publico">Órgão público</option><option value="cliente">Cliente</option><option value="fornecedor">Fornecedor</option><option value="outro">Outro</option></select></Field><Field label="CPF / CNPJ"><input name="documento" className="input" /></Field><Field label="Observação" wide><textarea name="observacao" className="input min-h-20" /></Field>{error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}</div><div className="flex justify-end gap-3 border-t px-7 py-5"><button type="button" onClick={onClose} className="rounded-lg border px-5 py-3">Cancelar</button><button disabled={busy} className="rounded-lg bg-[#0b2b66] px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "Salvando..." : "Cadastrar"}</button></div></form></div>;
}

function SummaryCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: "green" | "red" | "blue"; }) {
  const toneClass = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700";
  return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{title}</p><strong className="mt-3 block text-[29px] text-[#0b1d3a]">{value}</strong></div><span className={`grid size-12 place-items-center rounded-xl ${toneClass}`}>{icon}</span></div></div>;
}

function TypeBadge({ type }: { type: string }) {
  const className = type.includes("entrada") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : type.includes("saida") ? "border-rose-200 bg-rose-50 text-rose-700" : type.includes("estorno") ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${className}`}>{type.replace("_", " ")}</span>;
}

function ActionButton({ children, onClick, title, danger = false, disabled = false }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean; disabled?: boolean; }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={title} className={`grid size-9 place-items-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-30 ${danger ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-[#0b2b66] hover:bg-slate-50"}`}>{children}</button>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean; }) {
  return <label className={`text-sm font-semibold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block">{label}</span>{children}</label>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean; }) {
  return <div className={`rounded-lg border border-slate-200 bg-slate-50 p-4 ${wide ? "sm:col-span-2" : ""}`}><small className="font-bold uppercase tracking-wide text-slate-400">{label}</small><p className="mt-1 font-semibold text-slate-800">{value}</p></div>;
}

function parseDescription(description: string) {
  const separator = description.indexOf(" — ");
  if (separator === -1) return { party: "—", description };
  const prefix = description.slice(0, separator);
  const cleanDescription = description.slice(separator + 3);
  const party = prefix.replace(/^Recebido de /, "").replace(/^Pago para /, "");
  return { party, description: cleanDescription || description };
}
