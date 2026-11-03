type Row = Record<string, unknown>;
const record = (x: unknown): Row | null =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? x as Row : null;
const rows = (x: unknown): Row[] =>
  Array.isArray(x) ? x.map(record).filter((x): x is Row => x !== null) : [];
const identifier = (x: unknown) => String(x ?? "").trim();
const dataset = (source: unknown, name: string) => rows(record(source)?.[name]);

/** Decimal-currency validation without converting monetary amounts to floating point. */
function cents(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  const m = normalized.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const amount = BigInt(m[2]) * 100n + BigInt((m[3] || "").padEnd(2, "0"));
  return m[1] ? -amount : amount;
}

export function auditMigrationBackup(
  despachanteCloud: unknown,
  financeiro: unknown,
  status: Array<{ module: string; status: string }>,
  local: Record<string, unknown> = {},
) {
  const findings: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const cloud = record(despachanteCloud);
  const localDoc = record(local["mw-despachante-organizado-v2"]);
  const snapshots = [
    ...(cloud ? [{ source: "appwrite", data: cloud }] : []),
    ...(localDoc ? [{ source: "navegador", data: localDoc }] : []),
  ];
  if (!snapshots.length) warnings.push("Sem snapshot do Despachante acessível neste dispositivo ou Appwrite.");
  for (const { source, data } of snapshots) {
    const clients = rows(data.clients), jobs = rows(data.jobs), processes = rows(data.processes);
    counts[`${source}:clientes`] = clients.length;
    counts[`${source}:checklists`] = jobs.length;
    counts[`${source}:processos`] = processes.length;
    const clientIds = new Set(clients.map(x => identifier(x.id)).filter(Boolean));
    const checklistIds = new Set(jobs.map(x => identifier(x.id)).filter(Boolean));
    for (const [kind, list] of [["checklist", jobs], ["processo", processes]] as const) {
      for (const item of list) {
        const clientId = identifier(item.clientId);
        if (clientId && !clientIds.has(clientId)) findings.push(`${source}: cliente ausente para ${kind} ${identifier(item.id)}`);
        if (kind === "processo" && item.checklistJobId && !checklistIds.has(identifier(item.checklistJobId)))
          findings.push(`${source}: checklist associado ausente no processo ${identifier(item.id)}`);
      }
    }
    for (const [kind,list] of [["cliente",clients],["checklist",jobs],["processo",processes]] as const) {
      const seen = new Set<string>();
      for (const item of list) {
        const key = identifier(item.id);
        if (!key) findings.push(`${source}: ${kind} sem ID`);
        else if (seen.has(key)) findings.push(`${source}: ID duplicado de ${kind}: ${key}`);
        seen.add(key);
      }
    }
  }
  if (cloud && localDoc) {
    for (const key of ["clients","jobs","processes"] as const) {
      const serverIds = new Set(rows(cloud[key]).map(x => identifier(x.id)));
      const onlyLocal = rows(localDoc[key]).filter(x => !serverIds.has(identifier(x.id))).length;
      if (onlyLocal) warnings.push(`${onlyLocal} registros de ${key} estão apenas no navegador; reconciliar antes do corte.`);
    }
  }

  const accounts = dataset(financeiro,"accounts"), movements = dataset(financeiro,"transactions");
  const expenses = dataset(financeiro,"expenses"), payments = dataset(financeiro,"payments");
  counts.contas = accounts.length; counts.movimentacoes = movements.length;
  counts.despesas = expenses.length; counts.pagamentos = payments.length;
  const accountIds = new Set(accounts.map(x => identifier(x.$id)).filter(Boolean));
  const expenseIds = new Set(expenses.map(x => identifier(x.$id)).filter(Boolean));
  const effects = new Map<string,bigint>(accounts.map(x=>[identifier(x.$id),0n]));
  const apply = (accountId: string, delta: bigint) =>
    effects.set(accountId,(effects.get(accountId)||0n)+delta);
  for (const move of movements) {
    const source = identifier(move.conta_id), dest = identifier(move.conta_destino_id);
    if (!source || !accountIds.has(source)) findings.push(`Movimentação sem conta de origem: ${identifier(move.$id)}`);
    if (dest && !accountIds.has(dest)) findings.push(`Movimentação sem conta destino: ${identifier(move.$id)}`);
    if (move.despesa_id && !expenseIds.has(identifier(move.despesa_id)))
      findings.push(`Movimentação sem despesa: ${identifier(move.$id)}`);
    const value = cents(move.valor);
    if (value === null || value <= 0n) {
      findings.push(`Movimentação com valor inválido: ${identifier(move.$id)}`); continue;
    }
    if (move.tipo === "transferencia") {
      if (!dest || dest === source) findings.push(`Transferência sem destino válido: ${identifier(move.$id)}`);
      if (source) apply(source,-value);
      if (dest) apply(dest,value);
    } else if (move.tipo === "saida") {
      if (source) apply(source,-value);
    } else if (move.tipo === "entrada") {
      if (source) apply(source,value);
    } else findings.push(`Tipo de movimentação não reconhecido: ${identifier(move.$id)}`);
  }
  for (const pay of payments) {
    if (!accountIds.has(identifier(pay.conta_id))) findings.push(`Pagamento sem conta: ${identifier(pay.$id)}`);
    if (!expenseIds.has(identifier(pay.despesa_id))) findings.push(`Pagamento sem despesa: ${identifier(pay.$id)}`);
  }
  const failed = status.filter(x => x.status === "error");
  if (failed.length) findings.push(`${failed.length} fonte(s) falharam na exportação; totais e saldos podem estar incompletos.`);
  const financialComplete = ["financeiro:accounts","financeiro:transactions"].every(name =>
    status.some(x => x.module === name && x.status !== "error"));
  if (!financialComplete) warnings.push("Não foi possível confirmar todas as contas e movimentações.");
  if (financialComplete) {
    for (const acc of accounts) {
      const key = identifier(acc.$id), initial = cents(acc.saldo_inicial), stored = cents(acc.saldo_atual);
      if (initial === null || stored === null) {
        warnings.push(`Saldo monetário não numérico na conta ${key}`); continue;
      }
      const expected = initial + (effects.get(key)||0n);
      if (expected !== stored) warnings.push(`Saldo divergente na conta ${key}: verificar histórico de lançamentos e estornos.`);
    }
  }
  return {
    basicChecksPassed: findings.length === 0,
    requiresManualReview: warnings.length > 0 || failed.length > 0,
    counts, findings, warnings,
    note: "Auditoria preliminar; não certifica exportação completa, saldos históricos ou aptidão para corte.",
  };
}
