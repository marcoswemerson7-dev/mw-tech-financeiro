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
  Pencil,
  Trash2,
  Undo2,
  CalendarDays,
  Filter,
  Eye,
} from "lucide-react";
import {
  getAccounts,
  getMovements,
  registerMovement,
  updateMovement,
  deleteMovement,
  reverseExpensePayment,
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
import { money, Empty, formatDate, ActionButton, FilterBar, IconAction, PageHeader, StatCard, Badge, FinancialAmount, Toast } from "../components/UI";

export default function Transactions() {
  const [rows, setRows] = useState<Movement[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [counterparties, setCounterparties] = useState<Counterparty[]>([]),
    [open, setOpen] = useState(false),
    [partyOpen, setPartyOpen] = useState(false),
    [edit, setEdit] = useState<Movement | null>(null),
    [view, setView] = useState<Movement | null>(null),
    [launchType, setLaunchType] = useState("entrada"),
    [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");

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
        if (!party && !edit) throw new Error(d.tipo === "entrada" ? "Informe de quem o valor foi recebido." : "Informe para quem o valor foi pago.");
        const originalDescription = String(d.descricao || "").trim();
        const fallbackParty = edit ? parseDescription(edit.descricao).party : "";
        const partyName = party?.nome || fallbackParty || "parte financeira";
        const prefix = d.tipo === "entrada" ? `Recebido de ${partyName}` : `Pago para ${partyName}`;
        d.descricao = originalDescription ? `${prefix} — ${originalDescription}` : prefix;
        const note = String(d.observacao || "").trim();
        d.observacao = `Parte financeira: ${partyName}${party?.documento ? ` (${party.documento})` : ""}${note ? `\n${note}` : ""}`;
      }
      delete d.parte_id;

      const result = edit
        ? await updateMovement(edit.id, d)
        : await registerMovement(d);
      const savedId = String((result as any)?.id || edit?.id || crypto.randomUUID());
      const account = accounts.find((a) => a.id === d.conta_id);
      const nextRow = {
        ...(edit || {}),
        id: savedId,
        tipo: String(d.tipo),
        data: String(d.data),
        descricao: String(d.descricao),
        valor: Number(d.valor),
        observacao: String(d.observacao || ""),
        conta_id: String(d.conta_id || ""),
        conta_destino_id: String(d.conta_destino_id || ""),
        comprovante_id: String(d.comprovante_id || ""),
        status: "ativo",
        created_at: edit?.created_at || new Date().toISOString(),
        contas_bancarias: account ? { nome: account.nome } : null,
        categorias_financeiras: edit?.categorias_financeiras || null,
      } as Movement;
      setRows((current) =>
        edit
          ? current.map((row) => (row.id === edit.id ? nextRow : row))
          : [nextRow, ...current],
      );
      setOpen(false);
      setEdit(null);
      setLaunchType("entrada");
      setToast(edit ? "Alterações salvas com sucesso." : "Lançamento salvo com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMovement(row: Movement) {
    if (!confirm("Excluir esta movimentação? O sistema só permite remover pagamento vinculado depois do estorno.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteMovement(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      setToast("Movimentação excluída com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      const message = e.message || "Não foi possível excluir esta movimentação.";
      setError(message);
      setToast(message);
      setTimeout(() => setToast(""), 4200);
    } finally {
      setBusy(false);
    }
  }

  async function reverseMovement(row: Movement) {
    if (!row.pagamento_id) return;
    if (!confirm("Estornar este pagamento? O saldo volta para a conta e a despesa ficará pendente.")) return;
    setBusy(true);
    setError("");
    try {
      await reverseExpensePayment({ pagamento_id: row.pagamento_id, observacao: "Estorno pela tela de entradas e saídas." });
      await load();
      setToast("Pagamento estornado com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      const message = e.message || "Não foi possível estornar este pagamento.";
      setError(message);
      setToast(message);
      setTimeout(() => setToast(""), 4200);
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: Movement) {
    setEdit(row);
    setLaunchType(row.tipo);
    setOpen(true);
  }

  async function saveCounterparty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d: any = Object.fromEntries(new FormData(e.currentTarget));
      const created = await createCounterparty(d);
      setPartyOpen(false);
      setCounterparties((current) => [...current, created].sort((a, b) => a.nome.localeCompare(b.nome)));
      setToast("Cadastro financeiro salvo com sucesso.");
      setTimeout(() => setToast(""), 2600);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <Toast message={toast} tone={error && toast === error ? "error" : "success"} />
      <PageHeader
        title="Entradas e saídas"
        subtitle="Consulte por período e mantenha as movimentações organizadas."
        actions={
          <>
            <ActionButton onClick={() => setPartyOpen(true)} tone="outline">
              <UserRoundPlus size={18} /> Cadastros
            </ActionButton>
            <ActionButton onClick={() => { setEdit(null); setLaunchType("entrada"); setOpen(true); }}>
              <Plus size={18} /> Novo lançamento
            </ActionButton>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard title="Entradas no período" value={money(rows.filter((x) => x.tipo.includes("entrada")).reduce((a, x) => a + Number(x.valor), 0))} icon={<ArrowUpRight size={27} />} tone="green" hint="↑ 100% vs mês anterior" />
        <StatCard title="Saídas no período" value={<FinancialAmount value={rows.filter((x) => x.tipo.includes("saida")).reduce((a, x) => a + Number(x.valor), 0)} kind="saida" />} icon={<ArrowDownRight size={27} />} tone="red" hint="— 0% vs mês anterior" />
        <StatCard title="Movimentações" value={rows.length} icon={<ArrowLeftRight size={27} />} tone="blue" hint="Total de lançamentos no período" />
      </div>

      <FilterBar>
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição, prefeitura, fornecedor..." className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-[15px] outline-none focus:border-blue-500" />
        </div>
        <label className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500">
          Data inicial
          <input type="date" className="mt-1 w-full bg-transparent text-[15px] font-semibold text-[#061426] outline-none" defaultValue={new Date().toISOString().slice(0, 8) + "01"} />
        </label>
        <label className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500">
          Data final
          <input type="date" className="mt-1 w-full bg-transparent text-[15px] font-semibold text-[#061426] outline-none" defaultValue={new Date().toISOString().slice(0, 10)} />
        </label>
        <div className="relative min-w-[220px]">
          <CalendarDays className="pointer-events-none absolute left-4 top-4 text-slate-400" size={18} />
          <select value={type} onChange={(e) => setType(e.target.value)} className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[15px] font-semibold text-[#061426] outline-none">
            <option value="">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
            <option value="transferencia">Transferências</option>
          </select>
        </div>
        <ActionButton>
          <Filter size={18} /> Filtrar
        </ActionButton>
      </FilterBar>

      <MovementTable rows={visible} edit={openEdit} remove={removeMovement} reverse={reverseMovement} view={setView} />

      {view && <MovementDetails movement={view} close={() => setView(null)} />}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={save} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-7 py-6">
              <div>
                <h3 className="text-2xl font-bold text-[#0b1d3a]">{edit ? "Editar lançamento" : "Novo lançamento"}</h3>
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
                <input name="data" type="date" required defaultValue={edit?.data?.slice(0, 10) || new Date().toISOString().slice(0, 10)} className="input" />
              </Field>

              {launchType !== "transferencia" && (
                <Field label={launchType === "entrada" ? "Recebido de" : "Pago para"} wide>
                  <div className="flex gap-2">
                    <select name="parte_id" required={!edit} className="input">
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
                <input name="descricao" required defaultValue={edit ? parseDescription(edit.descricao).description : ""} className="input" placeholder={launchType === "entrada" ? "Ex.: Mensalidade do sistema - agosto/2026" : "Ex.: Pagamento de serviço / compra"} />
              </Field>

              <Field label={launchType === "entrada" ? "Entrar na conta" : launchType === "saida" ? "Sair da conta" : "Conta de origem"}>
                <select name="conta_id" required defaultValue={edit?.conta_id || ""} className="input">
                  <option value="">Selecione</option>
                  {accounts.map((a) => <option value={a.id} key={a.id}>{a.nome} · {money(a.saldo_atual)}</option>)}
                </select>
              </Field>

              {launchType === "transferencia" && (
                <Field label="Conta de destino">
                  <select name="conta_destino_id" required defaultValue={edit?.conta_destino_id || ""} className="input">
                    <option value="">Selecione</option>
                    {accounts.map((a) => <option value={a.id} key={a.id}>{a.nome} · {money(a.saldo_atual)}</option>)}
                  </select>
                </Field>
              )}

              <Field label="Valor">
                <input name="valor" type="number" min="0.01" step="0.01" required defaultValue={edit?.valor || ""} className="input" placeholder="0,00" />
              </Field>
              <Field label="Comprovante">
                <label className="input flex cursor-pointer items-center gap-2"><Paperclip size={17} /> Selecionar arquivo<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" /></label>
              </Field>
              <Field label="Observação" wide><textarea name="observacao" defaultValue={edit?.observacao || ""} className="input min-h-24" /></Field>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t px-7 py-5">
              <button type="button" onClick={() => { setOpen(false); setEdit(null); }} className="rounded-xl border px-5 py-3">Cancelar</button>
              <button disabled={busy || !isConfigured} className="rounded-xl bg-[#0b2b66] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : edit ? "Salvar alterações" : "Salvar lançamento"}</button>
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

function Field({ label, children, wide }: { label: string; children: any; wide?: boolean }) {
  return <label className={`text-[15px] font-semibold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function MovementTable({ rows, edit, remove, reverse, view }: { rows: Movement[]; edit: (row: Movement) => void; remove: (row: Movement) => void; reverse: (row: Movement) => void; view: (row: Movement) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-[15px]">
            <thead className="bg-[#061426] text-[13px] font-black text-white">
              <tr>{["Data", "Origem / Destino", "Descrição", "Tipo", "Conta", "Valor", "Ações"].map((x) => <th key={x} className="px-6 py-5">{x}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const parsed = parseDescription(x.descricao);
                return (
                  <tr key={x.id} className={`border-t border-slate-100 hover:bg-slate-50/60 ${x.tipo.includes("entrada") ? "border-l-4 border-l-emerald-500" : x.tipo.includes("saida") ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-blue-500"}`}>
                    <td className="whitespace-nowrap px-6 py-6 font-semibold text-slate-700">{formatDate(x.data)}</td>
                    <td className="px-6 py-5"><div className="flex items-center gap-3 font-black text-[#0b1d3a]"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600"><Building2 size={18} /></span><span className="max-w-[210px] break-words">{parsed.party}</span></div></td>
                    <td className="max-w-[260px] px-6 py-5 font-bold text-[#061426]">{parsed.description}</td>
                    <td className="px-6 py-5"><Badge status={x.tipo.includes("entrada") ? "entrada" : x.tipo.includes("saida") ? "saída" : "transferência"} /></td>
                    <td className="max-w-[220px] px-6 py-5 text-slate-600">{x.contas_bancarias?.nome || "—"}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-right text-lg font-black">
                      <FinancialAmount value={x.valor} kind={x.tipo} />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        <IconAction onClick={() => view(x)} title="Visualizar movimentação" tone="slate"><Eye size={18} /></IconAction>
                        <IconAction onClick={() => edit(x)} title="Editar" tone="blue"><Pencil size={18} /></IconAction>
                        {x.pagamento_id && x.tipo !== "estorno" ? (
                          <IconAction onClick={() => reverse(x)} title="Estornar pagamento" tone="amber"><Undo2 size={18} /></IconAction>
                        ) : null}
                        <IconAction onClick={() => remove(x)} title="Excluir" tone="red"><Trash2 size={18} /></IconAction>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 text-[14px] text-slate-500">
        <span>Exibindo {rows.length} lançamento{rows.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <button className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-400">‹</button>
          <button className="grid size-10 place-items-center rounded-lg bg-[#061426] font-black text-white">1</button>
          <button className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-400">›</button>
        </div>
      </div>
    </div>
  );
}

function MovementDetails({ movement, close }: { movement: Movement; close: () => void }) {
  const parsed = parseDescription(movement.descricao);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="movement-details-title">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-7 py-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#c78b35]">Detalhes da movimentação</p>
            <h3 id="movement-details-title" className="mt-1 text-2xl font-bold text-[#0b1d3a]">{parsed.description}</h3>
          </div>
          <button type="button" onClick={close} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Fechar detalhes"><X /></button>
        </div>
        <dl className="grid gap-4 p-7 sm:grid-cols-2">
          <Detail label="Data" value={formatDate(movement.data)} />
          <Detail label="Tipo" value={movement.tipo === "entrada" ? "Entrada" : movement.tipo === "saida" ? "Saída" : "Transferência"} />
          <Detail label="Origem / Destino" value={parsed.party} />
          <Detail label="Conta" value={movement.contas_bancarias?.nome || "Não informada"} />
          <Detail label="Valor" value={money(movement.valor)} accent />
          <Detail label="Status" value="Ativo" />
          {movement.observacao ? <div className="sm:col-span-2"><Detail label="Observação" value={movement.observacao} /></div> : null}
        </dl>
        <div className="flex justify-end border-t px-7 py-5">
          <button type="button" onClick={close} className="rounded-xl bg-[#0b2b66] px-5 py-3 font-semibold text-white">Fechar</button>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className={`mt-1 whitespace-pre-line font-semibold ${accent ? "text-lg text-[#0b2b66]" : "text-slate-700"}`}>{value}</dd></div>;
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
