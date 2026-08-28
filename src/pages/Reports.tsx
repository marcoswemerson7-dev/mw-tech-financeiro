import { useEffect, useMemo, useState } from "react";
import { Printer, ReceiptText } from "lucide-react";
import { supabase } from "../lib/supabase";
import { money, Badge, Empty } from "../components/UI";
type Mov = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "Receita" | "Despesa" | "Retirada";
  status: string;
  conta?: string;
  cliente?: string;
};
const today = new Date().toISOString().slice(0, 10);
export default function Reports() {
  const [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [mov, setMov] = useState<Mov[]>([]),
    [company, setCompany] = useState<any>({}),
    [receipt, setReceipt] = useState<Mov | null>(null);
  useEffect(() => {
    Promise.all([
      supabase
        .from("receitas")
        .select(
          "id,descricao,valor,status,data_recebimento,data_vencimento,clientes(nome_fantasia,razao_social),contas_bancarias(nome,banco,agencia,conta)",
        ),
      supabase
        .from("despesas")
        .select(
          "id,descricao,valor,status,data_pagamento,data_vencimento,contas_bancarias(nome,banco,agencia,conta)",
        ),
      supabase
        .from("retiradas")
        .select(
          "id,descricao,valor,data,contas_bancarias(nome,banco,agencia,conta)",
        ),
      supabase.from("configuracoes_empresa").select("*").limit(1).maybeSingle(),
    ]).then(([r, d, t, c]) => {
      const account = (x: any) =>
        x?.contas_bancarias
          ? `${x.contas_bancarias.banco} · Ag. ${x.contas_bancarias.agencia || "—"} · Conta ${x.contas_bancarias.conta || "—"}`
          : "Conta não informada";
      setMov([
        ...(r.data || []).map((x: any) => ({
          id: x.id,
          data: x.data_recebimento || x.data_vencimento,
          descricao: x.descricao,
          valor: +x.valor,
          tipo: "Receita",
          status: x.status,
          conta: account(x),
          cliente: x.clientes?.nome_fantasia || x.clientes?.razao_social,
        })),
        ...(d.data || []).map((x: any) => ({
          id: x.id,
          data: x.data_pagamento || x.data_vencimento,
          descricao: x.descricao,
          valor: +x.valor,
          tipo: "Despesa",
          status: x.status,
          conta: account(x),
        })),
        ...(t.data || []).map((x: any) => ({
          id: x.id,
          data: x.data,
          descricao: x.descricao,
          valor: +x.valor,
          tipo: "Retirada",
          status: "pago",
          conta: account(x),
        })),
      ] as Mov[]);
      setCompany(c.data || {});
    });
  }, []);
  const filtered = useMemo(
    () =>
      mov
        .filter((x) => x.data >= from && x.data <= to)
        .sort((a, b) => b.data.localeCompare(a.data)),
    [mov, from, to],
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Receitas recebidas", sums.r],
            ["Despesas pagas", sums.d],
            ["Resultado operacional", sums.r - sums.d],
            ["Retiradas", sums.t],
            ["Saldo do período", sums.r - sums.d - sums.t],
            ["Total pendente", sums.a],
          ].map(([n, v]) => (
            <div key={String(n)} className="rounded-xl bg-slate-50 p-4">
              <span className="text-xs text-slate-500">{n}</span>
              <strong className="mt-2 block text-lg">{money(v)}</strong>
            </div>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto">
          {filtered.length ? (
            <table className="w-full text-left text-xs">
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
            <Empty />
          )}
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
