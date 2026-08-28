import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileSpreadsheet, Filter, Printer, ReceiptText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getReportData } from "../services/reports";
import { getExpenses } from "../services/expenses";
import { money, Badge, dateOnly, formatDate, FilterBar, PageHeader, FinancialAmount } from "../components/UI";
type Mov = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "Receita" | "Despesa" | "Retirada";
  status: string;
  conta?: string;
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
    [expenses, setExpenses] = useState<any[]>([]),
    [company, setCompany] = useState<Company>({}),
    [receipt, setReceipt] = useState<Mov | null>(null),
    [typeFilter, setTypeFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  useEffect(() => {
    Promise.all([getReportData(), getExpenses().catch(() => [])]).then(([{ movements, accounts, company }, expenses]) => {
      const names = new Map(accounts.map((x) => [x.id, `${x.nome} · ${x.banco || "Conta"} · Ag. ${x.agencia || "—"} · Conta ${x.conta || "—"}`]));
      setMov(movements.map((x: any) => ({ id: x.id, data: x.data, descricao: x.descricao,
        valor: Number(x.valor), tipo: x.tipo === "entrada" ? "Receita" : x.tipo === "retirada" ? "Retirada" : "Despesa",
        status: "pago", conta: names.get(x.conta_id) || "Conta não informada", categoria: x.categorias_financeiras?.nome })) as Mov[]);
      setCompany(company);
      setExpenses(expenses);
    }).catch(() => { setMov([]); setCompany({}); });
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
  const sums = {
    r: filtered
      .filter((x) => x.tipo === "Receita" && x.status === "pago")
      .reduce((a, x) => a + x.valor, 0),
    d: filtered
      .filter((x) => x.tipo === "Despesa" && x.status === "pago")
      .reduce((a, x) => a + x.valor, 0),
    t: filtered
      .filter((x) => x.tipo === "Retirada")
      .reduce((a, x) => a + x.valor, 0),
    a: filtered
      .filter((x) => x.status === "pendente")
      .reduce((a, x) => a + Number(x.valor), 0),
  };
  const chartData = [{ nome: "Entradas", valor: sums.r }, { nome: "Saídas", valor: sums.d }];
  const expenseByStatus = ["pendente", "pago", "cancelado"].map((status) => ({ status, valor: expenses.filter((x) => x.status === status).reduce((a, x) => a + Number(x.valor), 0) })).filter((x) => x.valor > 0);
  function print(r?: Mov) {
    setReceipt(r || null);
    setTimeout(() => window.print(), 100);
  }
  function exportExcel() {
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
          subtitle="Emita relatórios financeiros, acompanhe períodos e gere recibos com visual profissional."
        />
      </div>
      <FilterBar dark>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-[56px] min-w-[220px] rounded-xl border border-white/15 bg-white/[.07] px-4 text-[15px] font-semibold text-white outline-none"
          >
            <option value="">Todos os tipos</option>
            <option value="Receita">Entradas</option>
            <option value="Despesa">Saídas</option>
            <option value="Retirada">Retiradas</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[56px] min-w-[220px] rounded-xl border border-white/15 bg-white/[.07] px-4 text-[15px] font-semibold text-white outline-none"
          >
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <label className="min-w-[190px] rounded-xl border border-white/15 bg-white/[.07] px-4 py-2 text-xs font-bold text-blue-100">
            <span className="flex items-center gap-2"><CalendarDays size={15} /> Data inicial</span>
            <input aria-label="Data inicial" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full bg-transparent text-[15px] font-semibold text-white outline-none" />
          </label>
          <label className="min-w-[190px] rounded-xl border border-white/15 bg-white/[.07] px-4 py-2 text-xs font-bold text-blue-100">
            <span className="flex items-center gap-2"><CalendarDays size={15} /> Data final</span>
            <input aria-label="Data final" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full bg-transparent text-[15px] font-semibold text-white outline-none" />
          </label>
          <button
            onClick={() => print()}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-xl border border-[#e8ac35]/70 px-5 text-[14px] font-black text-white transition hover:bg-white/[.07]"
          >
            <Printer size={16} />
            Imprimir relatório
          </button>
          <button
            onClick={exportExcel}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-xl border border-emerald-500 px-5 text-[14px] font-black text-emerald-300 transition hover:bg-emerald-500/10"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <span className="ml-auto hidden items-center gap-2 text-[13px] font-bold text-blue-100 xl:inline-flex">
            <Filter size={16} />
            {filtered.length} registro{filtered.length === 1 ? "" : "s"}
          </span>
      </FilterBar>
      <section
        className={`report-sheet mx-auto max-w-[1400px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm ${receipt ? "print:hidden" : ""}`}
      >
        <PrintHeader company={company} title="Relatório Financeiro" subtitle={`Período selecionado: ${format(from)} a ${format(to)}`} />
        <div className="report-summary grid overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Receitas recebidas", sums.r, "positive", "receita"],
            ["Despesas pagas", sums.d, "expense", "despesa"],
            ["Resultado operacional", sums.r - sums.d, "result", "resultado"],
            ["Retiradas", sums.t, "expense", "retirada"],
            ["Saldo do período", sums.r - sums.d - sums.t, "result", "saldo"],
            ["Total pendente", sums.a, "pending", "pendente"],
          ].map(([n, v, tone, kind]) => (
            <div
              key={String(n)}
              className={`report-summary-card report-summary-card--${tone} border-b border-r border-slate-200 p-4`}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {n}
              </span>
              <strong className="mt-1 block text-xl font-black tracking-tight">
                <FinancialAmount value={v} kind={String(kind)} />
              </strong>
            </div>
          ))}
        </div>
        <div className="report-charts no-break mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="text-xs font-black uppercase text-slate-500">Entradas x Saídas</h4>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={62} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  <Cell fill="#16a34a" />
                  <Cell fill="#dc2626" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="text-xs font-black uppercase text-slate-500">Despesas por status</h4>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={expenseByStatus.length ? expenseByStatus : [{ status: "sem dados", valor: 1 }]} dataKey="valor" nameKey="status" innerRadius={36} outerRadius={58}>
                  {(expenseByStatus.length ? expenseByStatus : [{ status: "sem dados" }]).map((x, i) => <Cell key={x.status} fill={["#f59e0b", "#16a34a", "#dc2626", "#94a3b8"][i]} />)}
                </Pie>
                <Tooltip formatter={(v) => expenseByStatus.length ? money(v) : "Sem dados"} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="report-table-wrapper mt-6 overflow-x-auto">
          {filtered.length ? (
            <table className="report-table w-full border-collapse text-left text-xs">
              <thead className="bg-[#061426] text-[10px] uppercase tracking-[0.12em] text-white">
                <tr>
                  {[
                    "Data",
                    "Descrição",
                    "Conta",
                    "Tipo",
                    "Valor",
                    "Status",
                    "Recibo",
                  ].map((x) => (
                    <th key={x} className="px-3 py-3.5">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr key={x.tipo + x.id} className="border-b">
                    <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">{formatDate(x.data)}</td>
                    <td className="max-w-[260px] whitespace-normal break-words px-3 py-3.5 font-semibold text-slate-800">{x.descricao}</td>
                    <td className="max-w-[250px] whitespace-normal break-words px-3 py-3.5 text-slate-500">{x.conta}</td>
                    <td className="whitespace-nowrap px-3 py-3.5">{x.tipo}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right font-black">
                      <FinancialAmount value={x.valor} kind={x.tipo} />
                    </td>
                    <td className="px-3">
                      <Badge status={x.status} />
                    </td>
                    <td className="no-print px-3 py-3.5">
                      <button onClick={() => print(x)} title="Imprimir recibo">
                        <ReceiptText size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="report-table w-full border-collapse text-left text-xs">
              <thead className="bg-[#061426] text-white">
                <tr>
                  {[
                    "Data",
                    "Descrição",
                    "Conta bancária",
                    "Tipo",
                    "Valor",
                    "Status",
                  ].map((x) => (
                    <th
                      key={x}
                      className="border border-slate-300 bg-[#0b2b66] px-3 py-3 text-[10px] uppercase text-white"
                    >
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={7}
                    className="border border-slate-300 py-12 text-center text-slate-400"
                  >
                    Nenhuma movimentação encontrada no período selecionado.
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <ReportFooter company={company} />
      </section>
      {receipt && (
        <section className="receipt-sheet hidden bg-white p-10 print:block">
          <PrintHeader
            company={company}
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
}: {
  company: Company;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="report-header mb-6 flex items-start justify-between gap-8 border-b-0 pb-5">
      <div className="report-company-block flex min-w-0 items-start gap-4">
        <img
          src={company.logo_url || "/mw-tech-logo-horizontal.png"}
          alt="Logo MW TECH"
          className="report-logo h-[68px] w-[156px] shrink-0 object-contain object-left"
        />
        <div className="report-company-details min-w-0 pt-0.5">
          <p className="report-company-name mt-1 max-w-[500px] text-[11px] font-semibold leading-snug text-slate-700">{company.razao_social || "MARCOS WEMERSON DOS SANTOS GONÇALVES"}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">CNPJ: {company.cnpj || "62.308.511/0001-12"}</p>
          <p className="mt-0.5 max-w-[520px] text-[10px] leading-snug text-slate-500">Endereço: {[company.endereco || "R. Antônio Pinto de Mesquita, 345", company.cidade ? `${company.cidade}${company.estado ? `/${company.estado}` : ""}` : "Bela Vista/PI", company.cep].filter(Boolean).join(" · ")}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{[company.telefone, company.email || "marcoswemerson7@gmail.com"].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="report-meta shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7791f]">Documento</p>
        <h2 className="mt-1 text-xl font-black text-[#0b1d3a]">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-600">{subtitle}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Emitido em {new Date().toLocaleString("pt-BR")}</p>
      </div>
    </div>
  );
}
function ReportFooter({ company }: { company: Company }) {
  return <footer className="report-footer mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
    <span>Documento gerado pelo sistema <strong className="text-[#0b2b66]">MW TECH Financeiro</strong></span>
    <span>{company.razao_social || "MARCOS WEMERSON DOS SANTOS GONÇALVES"} · CNPJ: {company.cnpj || "62.308.511/0001-12"}</span>
    <span>Emissão: {new Date().toLocaleString("pt-BR")}</span>
    <span className="report-page-number" aria-label="Número da página">Página </span>
  </footer>;
}
const format = formatDate;
