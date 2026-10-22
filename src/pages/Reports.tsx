import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileSpreadsheet, Filter, Printer, ReceiptText } from "lucide-react";
import { getReportData } from "../services/reports";
import "./reports.css";
import { money, Badge, dateOnly, formatDate, PageHeader, FinancialAmount } from "../components/UI";
type Mov = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "Receita" | "Despesa" | "Retirada";
  status: string;
  conta?: string;
  conta_resumo?: string;
  cliente?: string;
  categoria?: string;
};
type Company = {
  nome_empresa?: string;
  nome_fantasia?: string;
  razao_social?: string;
  cnpj?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  logo_url?: string;
};
const today = new Date().toISOString().slice(0, 10);
export default function Reports() {
  const [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [mov, setMov] = useState<Mov[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [issuedAt, setIssuedAt] = useState(() => new Date().toLocaleString("pt-BR")),
    [company, setCompany] = useState<Company>({}),
    [receipt, setReceipt] = useState<Mov | null>(null),
    [typeFilter, setTypeFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  useEffect(() => {
    getReportData().then(({ movements, accounts, company }) => {
      const names = new Map(accounts.map((x) => [x.id, `${x.nome} · ${x.banco || "Conta"} · Ag. ${x.agencia || "—"} · Conta ${x.conta || "—"}`]));
      const shortNames = new Map(accounts.map((x) => [x.id, `${x.banco || x.nome || "Conta"} · Ag. ${x.agencia || "—"} · Conta ${x.conta || "—"}`]));
      setMov(movements.filter((x) => x.tipo !== "transferencia").map((x: any) => ({ id: x.id, data: x.data, descricao: x.descricao,
        valor: Number(x.valor), tipo: x.tipo === "entrada" ? "Receita" : x.tipo === "retirada" ? "Retirada" : "Despesa",
        status: "pago", conta_resumo: shortNames.get(x.conta_id || ""), conta: names.get(x.conta_id) || "Conta não informada", categoria: x.categorias_financeiras?.nome })) as Mov[]);
      setCompany(company);

    }).catch(() => { setLoadError("Não foi possível carregar os dados do relatório. Atualize a página para tentar novamente."); }).finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(
    () =>
      mov
        .filter(
          (x) =>
            dateOnly(x.data) >= from &&
            dateOnly(x.data) <= to &&
            (!typeFilter || x.tipo === typeFilter) &&
            (!statusFilter || x.status === statusFilter),
        )
        .sort((a, b) => dateOnly(b.data).localeCompare(dateOnly(a.data))),
    [mov, from, to, typeFilter, statusFilter],
  );
  const invalidPeriod = !from || !to || from > to;
  const canExport = !loading && !loadError && !invalidPeriod;
  async function print(r?: Mov) {
    if (!canExport) return;
    setReceipt(r || null);
    setIssuedAt(new Date().toLocaleString("pt-BR"));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await document.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".report-screen-logo")).map((img) => img.decode().catch(() => undefined)));
    window.print();
  }
  function exportExcel() {
    if (!canExport) return;
    const lines = [
      ["Data", "Descrição", "Categoria", "Conta", "Tipo", "Valor", "Status"],
      ...filtered.map((x) => [
        formatDate(x.data),
        x.descricao,
        x.categoria || "",
        x.conta || "",
        x.tipo,
        String(x.valor),
        x.status,
      ]),
    ];
    const blob = new Blob(
      [
        "\ufeff" +
          lines
            .map((r) =>
              r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"),
            )
            .join("\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mw-tech-relatorio-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Relatórios e recibos"
          subtitle="Consulte as movimentações realizadas e emita o demonstrativo financeiro do período."
        />
      </div>
      <div className="no-print rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm lg:px-5"><div className="flex flex-wrap items-end gap-3">
          <select
            aria-label="Tipo de movimentação"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-11 min-w-[170px] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Todos os tipos</option>
            <option value="Receita">Entradas</option>
            <option value="Despesa">Saídas</option>
            <option value="Retirada">Retiradas</option>
          </select>
          <select
            aria-label="Situação da movimentação"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 min-w-[170px] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Movimentações realizadas</option>
            <option value="pago">Liquidado</option>
          </select>
          <label className="min-w-[165px] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2"><CalendarDays size={15} /> Data inicial</span>
            <input aria-label="Data inicial" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none" />
          </label>
          <label className="min-w-[165px] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2"><CalendarDays size={15} /> Data final</span>
            <input aria-label="Data final" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none" />
          </label>
          <button
            disabled={!canExport}
            onClick={() => print()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0b2b66] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#143e82]"
          >
            <Printer size={16} />
            Imprimir relatório
          </button>
          <button
            disabled={!canExport}
            onClick={exportExcel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <span className="ml-auto inline-flex items-center gap-2 self-center text-xs font-semibold text-slate-600">
            <Filter size={16} />
            {filtered.length} registro{filtered.length === 1 ? "" : "s"}
          </span>
        </div></div>
      {loading && <p role="status" className="no-print">Carregando dados do relatório...</p>}
      {loadError && <p role="alert" className="no-print text-red-700">{loadError}</p>}
      {invalidPeriod && <p role="alert" className="no-print text-red-700">Informe um período válido: a data inicial deve ser anterior ou igual à data final.</p>}
      {canExport && <section
        className={`report-sheet mx-auto max-w-[1400px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${receipt ? "print:hidden" : ""}`}
      >
        <PrintHeader company={company} issuedAt={issuedAt} title="Relatório financeiro" subtitle={`${format(from)} a ${format(to)}`} />
        <div className="report-scope"><span><b>Tipo:</b> {typeFilter || "Todas as movimentações"}</span><span><b>Situação:</b> {statusFilter ? "Liquidado" : "Movimentações realizadas"}</span><span><b>Registros:</b> {filtered.length}</span><span><b>Moeda:</b> Real (BRL)</span></div>
        <div className="report-table-wrapper mt-4 overflow-x-auto rounded-lg border border-slate-200">
          {filtered.length ? (
            <table className="report-table w-full border-collapse text-left text-xs">
              <thead className="bg-[#061426] text-[10px] uppercase tracking-[0.12em] text-white">
                <tr>
                  {[
                    "Data",
                    "Descrição / Categoria",
                    "Conta bancária",
                    "Tipo",
                    "Valor",
                    "Status",
                    "Recibo",
                  ].map((x) => (
                    <th key={x} className={`px-3 py-2.5 ${x === "Recibo" ? "no-print" : ""}`}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr key={x.tipo + x.id} className="border-b">
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(x.data)}</td>
                    <td className="max-w-[260px] whitespace-normal break-words px-3 py-2.5 font-semibold text-slate-800">{x.descricao}{x.categoria && <span className="report-category">{x.categoria}</span>}</td>
                    <td className="max-w-[250px] whitespace-normal break-words px-3 py-2.5 text-slate-500">{x.conta_resumo || x.conta}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{x.tipo}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                      <FinancialAmount value={x.valor} kind={x.tipo} />
                    </td>
                    <td className="px-3">
                      <Badge status={x.status} />
                    </td>
                    <td className="no-print px-3 py-2.5">
                      <button disabled={!canExport} onClick={() => print(x)} title="Imprimir recibo">
                        <ReceiptText size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          ) : <div className="report-empty-state rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0b2b66]">Sem movimentações no período</p>
            <p className="mt-2 text-sm text-slate-500">Não foram encontrados lançamentos entre {format(from)} e {format(to)} para os filtros selecionados.</p>
          </div>}
        </div>
        <ReportFooter company={company} issuedAt={issuedAt} />
      </section>}
      {receipt && (
        <section className="receipt-sheet hidden bg-white p-10 print:block">
          <PrintHeader
            company={company}
            issuedAt={issuedAt}
            title="RECIBO"
            subtitle={`Nº ${receipt.id.slice(0, 8).toUpperCase()}`}
          />
          <div className="my-10 rounded-xl border-2 border-[#0b2b66] p-6 text-center">
            <p className="text-sm uppercase tracking-widest text-slate-500">
              Valor recebido
            </p>
            <strong className="text-3xl text-[#0b2b66]">
              {money(receipt.valor)}
            </strong>
          </div>
          <p className="leading-8">
            Recebemos de{" "}
            <b>{receipt.cliente || "________________________________"}</b> o
            valor acima referente a <b>{receipt.descricao}</b>, em{" "}
            <b>{formatDate(receipt.data)}</b>, pela conta <b>{receipt.conta}</b>.
          </p>
          <div className="mt-20 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="border-t pt-2">Assinatura do responsável</div>
            <div className="border-t pt-2">
              {company.cidade || "Cidade"}, {format(today)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
function PrintHeader({
  company,
  title,
  subtitle,
  issuedAt,
}: {
  issuedAt: string;
  company: Company;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="report-header mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div className="report-company-block flex min-w-0 items-start gap-4">
        <img
          src="/mw-tech-logo-horizontal.png"
          alt="MW TECH — Sistemas e Soluções Digitais"
          className="report-screen-logo"
        />
        <div className="report-company-details min-w-0 pt-0.5">
          <p className="report-company-name mt-1 max-w-[500px] text-[11px] font-semibold leading-snug text-slate-700">{company.razao_social || "MARCOS WEMERSON DOS SANTOS GONÇALVES"}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">CNPJ: {company.cnpj || "62.308.511/0001-12"}</p>
          <p className="mt-0.5 max-w-[520px] text-[10px] leading-snug text-slate-500">Endereço: {[company.endereco || "R. Antônio Pinto de Mesquita, 345", company.cidade ? `${company.cidade}${company.estado ? `/${company.estado}` : ""}` : "Bela Vista/PI", company.cep].filter(Boolean).join(" · ")}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{[company.telefone, company.email || "marcoswemerson7@gmail.com"].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="report-meta rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7791f]">MW TECH Control</p>
        <h2 className="mt-1 text-xl font-semibold text-[#0b1d3a]">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-600">{subtitle}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Emitido em {issuedAt}</p>
      </div>
    </div>
  );
}
function ReportFooter({ company, issuedAt }: { company: Company; issuedAt: string }) {
  return <footer className="report-footer mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
    <span>Documento gerado pelo sistema <strong className="text-[#0b2b66]">MW TECH Control</strong></span>
    <span>{company.razao_social || "MARCOS WEMERSON DOS SANTOS GONÇALVES"} · CNPJ: {company.cnpj || "62.308.511/0001-12"}</span>
    <span>Emissão: {issuedAt}</span>
    <span className="report-page-number" aria-label="Número da página">Página </span>
  </footer>;
}
const format = formatDate;
