type Entry = Record<string, unknown>;
const asRecord = (x: unknown): Entry | null => x !== null && typeof x === "object" && !Array.isArray(x) ? x as Entry : null;
const asRows = (x: unknown): Entry[] => Array.isArray(x) ? x.map(asRecord).filter((v): v is Entry => !!v) : [];
const id = (value: unknown) => String(value ?? "");
const dataSet = (data: unknown, name: string): Entry[] => asRows(asRecord(data)?.[name]);

export function auditMigrationBackup(
  despachante: unknown,
  financeiro: unknown,
  status: Array<{ module: string; status: string }>
) {
  const findings: string[] = [];
  const checks: Record<string, number> = {};
  const doc = asRecord(despachante) || {};
  const clients = asRows(doc.clients);
  const jobs = asRows(doc.jobs);
  const processes = asRows(doc.processes);
  const clientIds = new Set(clients.map(x => id(x.id)).filter(Boolean));
  const checkIds = new Set(jobs.map(x => id(x.id)).filter(Boolean));
  checks.clientes = clients.length;
  checks.checklists = jobs.length;
  checks.processos = processes.length;
  for (const [label, rows] of [["checklist", jobs], ["processo", processes]] as const) {
    for (const row of rows) {
      if (row.clientId && !clientIds.has(id(row.clientId))) {
        findings.push(`Vínculo de cliente ausente em ${label} ${id(row.id)}: ${id(row.clientId)}`);
      }
      if (label === "processo" && row.checklistJobId && !checkIds.has(id(row.checklistJobId))) {
        findings.push(`Checklist associado não encontrado em processo ${id(row.id)}`);
      }
    }
  }
  const accounts = dataSet(financeiro, "accounts");
  const moves = dataSet(financeiro, "transactions");
  const expenses = dataSet(financeiro, "expenses");
  const payments = dataSet(financeiro, "payments");
  checks.contas = accounts.length;
  checks.movimentacoes = moves.length;
  checks.despesas = expenses.length;
  checks.pagamentos = payments.length;
  const accountIds = new Set(accounts.map(x => id(x.$id)).filter(Boolean));
  const expenseIds = new Set(expenses.map(x => id(x.$id)).filter(Boolean));
  for (const row of moves) {
    if (row.conta_id && !accountIds.has(id(row.conta_id))) findings.push(`Movimentação sem conta original: ${id(row.$id)}`);
    if (row.conta_destino_id && !accountIds.has(id(row.conta_destino_id))) findings.push(`Movimentação sem conta destino: ${id(row.$id)}`);
    if (row.despesa_id && !expenseIds.has(id(row.despesa_id))) findings.push(`Movimentação vinculada a despesa ausente: ${id(row.$id)}`);
  }
  for (const row of payments) {
    if (row.conta_id && !accountIds.has(id(row.conta_id))) findings.push(`Pagamento sem conta: ${id(row.$id)}`);
    if (row.despesa_id && !expenseIds.has(id(row.despesa_id))) findings.push(`Pagamento sem despesa: ${id(row.$id)}`);
  }
  const errors = status.filter(x => x.status === "error");
  if (errors.length) findings.push(`${errors.length} fonte(s) falharam durante a exportação. Os vínculos podem parecer ausentes apenas por exportação incompleta.`);
  const duplicateIds = (rows: Entry[], key: string, name: string) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const current = id(row[key]);
      if (!current) continue;
      if (seen.has(current)) findings.push(`ID duplicado em ${name}: ${current}`);
      seen.add(current);
    }
  };
  duplicateIds(clients, "id", "clientes");
  duplicateIds(jobs, "id", "checklists");
  duplicateIds(processes, "id", "processos");
  duplicateIds(accounts, "$id", "contas");
  duplicateIds(moves, "$id", "movimentacoes");
  return { readyForImport: findings.length === 0 && errors.length === 0, counts: checks, findings };
}
