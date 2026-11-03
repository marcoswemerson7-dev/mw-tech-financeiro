import test from "node:test";
import assert from "node:assert/strict";
import { auditMigrationBackup } from "../src/services/migrationAudit";

const status = [
  { module: "financeiro:accounts", status: "ok" },
  { module: "financeiro:transactions", status: "ok" },
];

test("finds local-only clients that were not synced to Appwrite", () => {
  const cloud = { clients: [{ id: "a" }], jobs: [], processes: [] };
  const local = { "mw-despachante-organizado-v2": {
    clients: [{ id: "a" }, { id: "b" }], jobs: [], processes: [],
  }};
  const result = auditMigrationBackup(cloud, {}, status, local);
  assert.equal(result.requiresManualReview, true);
  assert.ok(result.warnings.some(text => text.includes("apenas no navegador")));
});

test("validates account balances in exact cents", () => {
  const finance = {
    accounts: [{ $id: "c1", saldo_inicial: "20.10", saldo_atual: "21.30" }],
    transactions: [
      { $id: "m1", conta_id: "c1", tipo: "entrada", valor: "1.20" },
    ],
    expenses: [], payments: [],
  };
  const result = auditMigrationBackup(null,finance,status);
  assert.equal(result.warnings.some(text => text.includes("Saldo divergente")),false);
});

test("flags divergent balances instead of treating export as reconciled", () => {
  const finance = {
    accounts: [{ $id: "c1", saldo_inicial: "20.10", saldo_atual: "21.31" }],
    transactions: [{ $id: "m1", conta_id: "c1", tipo: "entrada", valor: "1.20" }],
    expenses: [], payments: [],
  };
  const result = auditMigrationBackup(null,finance,status);
  assert.ok(result.warnings.some(text=>text.includes("Saldo divergente")));
});

test("detects missing client and checklist relations", () => {
  const doc = {
    clients: [{ id: "a" }],
    jobs: [{ id: "j1", clientId: "missing" }],
    processes: [{ id: "p1", clientId: "a", checklistJobId: "absent" }],
  };
  const result = auditMigrationBackup(doc,{},status);
  assert.equal(result.basicChecksPassed,false);
  assert.equal(result.findings.length,2);
});

test("never certifies failed source export as complete", () => {
  const report = auditMigrationBackup(null,{},[{ module:"financeiro:accounts",status:"error" }]);
  assert.equal(report.basicChecksPassed,false);
  assert.equal(report.requiresManualReview,true);
});
