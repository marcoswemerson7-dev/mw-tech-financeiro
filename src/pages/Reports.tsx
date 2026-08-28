import { useEffect, useMemo, useState } from "react";
import { Printer, ReceiptText, FileSpreadsheet } from "lucide-react";
import { getReportData } from "../services/reports";
import { money, Badge } from "../components/UI";
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
const today = new Date().toISOString().slice(0, 10);
export default function Reports() {
  const [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [mov, setMov] = useState<Mov[]>([]),
    [company, setCompany] = useState<any>({}),
    [receipt, setReceipt] = useState<Mov | null>(null),
    [typeFilter, setTypeFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  useEffect(() => {
    getReportData().then(({ movements, accounts, company }) => {
      const names = new Map(accounts.map((x) => [x.id, `${x.nome} · ${x.banco || "Conta"} · Ag. ${x.agencia || "—"} · Conta ${x.conta || "—"}`]));
      setMov(movements.map((x: any) => ({ id: x.id, data: x.data, descricao: x.descricao,
        valor: Number(x.valor), tipo: x.tipo === "entrada" ? "Receita" : x.tipo === "retirada" ? "Retirada" : "Despesa",
        status: "pago", conta: names.get(x.conta_id) || "Conta não informada", categoria: x.categorias_financeiras?.nome })) as Mov[]);
      setCompany(company);
    }).catch(() => { setMov([]); setCompany({}); });
  }, []);
  const filtered = useMemo(
    () =>
      mov
        .filter(
          (x) =>
            x.data >= from &&
            x.data <= to &&
            (!typeFilter || x.tipo === typeFilter) &&
            (!statusFilter || x.status === statusFilter),
        )
        .sort((a, b) => b.data.localeCompare(a.data)),
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
      .filter((x) => x.tipo === "Receita" && x.status === "pendente")
      .reduce((a, x) => a + x.valor, 0),
  };
  function print(r?: Mov) {
    setReceipt(r || null);
    setTimeout(() => window.print(), 100);
  }
  function exportExcel() {
    const lines = [
      ["Data", "Descrição", "Categoria", "Conta", "Tipo", "Valor", "Status"],
      ...filtered.map((x) => [
        format(x.data),
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
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0b1d3a]">
            Relatórios e recibos
          </h2>
          <p className="text-sm text-slate-500">
            Emita relatórios diários, mensais e recibos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs"
          >
            <option value="">Todos os tipos</option>
            <option value="Receita">Entradas</option>
            <option value="Despesa">Saídas</option>
            <option value="Retirada">Retiradas</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs"
          >
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <input
            aria-label="Data inicial"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs"
          />
          <input
            aria-label="Data final"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs"
          />
          <button
            onClick={() => print()}
            className="flex items-center gap-2 rounded-lg bg-[#0b2b66] px-4 py-2 text-xs font-semibold text-white"
          >
            <Printer size={16} />
            Imprimir relatório
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-xs font-semibold text-emerald-700"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
        </div>
      </div>
      <section
        className={`report-sheet rounded-2xl border bg-white p-6 shadow-sm ${receipt ? "print:hidden" : ""}`}
      >
        <PrintHeader
          company={company}
          title="Relatório financeiro"
          subtitle={`${format(from)} a ${format(to)}`}
        />
        <div className="report-summary grid overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Receitas recebidas", sums.r],
            ["Despesas pagas", sums.d],
            ["Resultado operacional", sums.r - sums.d],
            ["Retiradas", sums.t],
            ["Saldo do período", sums.r - sums.d - sums.t],
            ["Total pendente", sums.a],
          ].map(([n, v]) => (
            <div
              key={String(n)}
              className="border-b border-r border-slate-200 bg-slate-50/70 p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {n}
              </span>
              <strong className="mt-1 block text-lg text-[#0b2b66]">
                {money(v)}
              </strong>
            </div>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto">
          {filtered.length ? (
            <table className="report-table w-full border-collapse text-left text-xs">
              <thead className="border-y bg-slate-50 text-[10px] uppercase text-slate-500">
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
                    <th key={x} className="px-3 py-3">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr key={x.tipo + x.id} className="border-b">
                    <td className="px-3 py-3">{format(x.data)}</td>
                    <td className="px-3 font-medium">{x.descricao}</td>
                    <td className="px-3 text-slate-500">{x.conta}</td>
                    <td className="px-3">{x.tipo}</td>
                    <td className="px-3 font-semibold">{money(x.valor)}</td>
                    <td className="px-3">
                      <Badge status={x.status} />
                    </td>
                    <td className="no-print px-3">
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
              <thead>
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
                      className="border border-slate-300 bg-[#0b2b66] px-3 py-2 text-[10px] uppercase text-white"
                    >
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={6}
                    className="border border-slate-300 py-12 text-center text-slate-400"
                  >
                    Nenhuma movimentação encontrada no período selecionado.
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-6 flex justify-between border-t pt-3 text-[10px] text-slate-400">
          <span>Documento gerado pelo MW TECH Financeiro</span>
          <span>Emitido em {new Date().toLocaleString("pt-BR")}</span>
        </div>
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
            <b>{format(receipt.data)}</b>, pela conta <b>{receipt.conta}</b>.
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
  company: any;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 flex items-center justify-between border-b-2 border-[#0b2b66] pb-5">
      <div className="flex items-center gap-4">
        <img
          src="/mw-tech-logo-horizontal.png"
          className="h-14 w-40 object-contain"
        />
        <div>
          <h3 className="font-bold text-[#0b2b66]">
            {company.nome_empresa || "MW TECH"}
          </h3>
          <p className="text-[10px] text-slate-500">
            {company.cnpj && `CNPJ: ${company.cnpj} · `}
            {company.telefone} {company.email}
          </p>
          <p className="text-[10px] text-slate-500">
            {company.endereco} {company.cidade} {company.estado}
          </p>
        </div>
      </div>
      <div className="text-right">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
const format = (d: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
