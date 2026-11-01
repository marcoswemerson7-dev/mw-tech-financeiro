// Run with: TSX_TSCONFIG_PATH=tsconfig.app.json node --import tsx scripts/check-despachante-recovery.mjs
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Processos from '../src/components/despachante/Processos.tsx';

const source = fs.readFileSync(new URL('../src/pages/DespachanteOrganizado.tsx', import.meta.url), 'utf8');
const start = source.indexOf('function mergeMissing(');
const compiled = ts.transpileModule(source.slice(start, source.indexOf('function load()', start)), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const merge = new Function(compiled + ';return mergeMissing')();
const local = {
  clients: [{ id: 'man', name: 'Manoel Salvador', phone: '' }], models: [],
  jobs: [{ id: 'process', clientId: 'man', title: 'Escritura matrícula 161', modelId: '', created: '2026-11-01T12:00:00Z', docs: [], notes: 'Comentário do processo', history: [{ id: 'h', at: '2026-11-01T13:00:00Z', title: 'Comentário', text: 'Em análise' }] }],
};
const remote = {
  clients: [{ id: 'other', name: 'Outro cliente', phone: '' }, { id: 'man', name: 'Manoel Salvador', phone: '123' }], models: [],
  jobs: [{ id: 'check', clientId: 'man', title: 'Checklist Manoel Salvador', modelId: 'rural', created: '2026-10-20T12:00:00Z', docs: [{ name: 'Certidão', group: 'Imóvel', checked: true, detail: 'Matrícula 161' }], sellers: ['Vendedor cadastrado'], buyers: ['Comprador cadastrado'], notes: 'Observação antiga' }],
};
const loaded = merge(local, remote);
assert.equal(loaded.clients.length, 2);
assert.equal(loaded.jobs.length, 2);
assert.equal(loaded.jobs[0].notes, local.jobs[0].notes);
assert.equal(JSON.stringify(merge(loaded, remote)), JSON.stringify(loaded));
const props = { jobs: loaded.jobs, clients: loaded.clients, initialId: 'process', update() {}, create() { return ''; }, openChecklist() {}, printCover() {}, remove() {}, linkChecklist() {} };
const html = renderToStaticMarkup(React.createElement(Processos, props));
assert.ok(html.includes('Checklist Manoel Salvador'));
assert.ok(html.includes('value="check"'));
assert.ok(html.includes('Outro cliente'));
const linked = { ...props, jobs: loaded.jobs.map(j => j.id === 'process' ? { ...j, checklistJobId: 'check' } : j) };
const details = renderToStaticMarkup(React.createElement(Processos, linked));
for (const text of ['Vendedor cadastrado', 'Comprador cadastrado', 'Certidão', 'Matrícula 161', 'Observação antiga']) assert.ok(details.includes(text), text);
const repaired = merge({ ...local, jobs: [{ ...local.jobs[0], id: 'check' }] }, remote);
assert.equal(repaired.jobs[0].docs.length, 1);
assert.equal(repaired.jobs[0].notes, 'Comentário do processo');
const populated = { ...local, jobs: [{ ...local.jobs[0], id: 'check', docs: [{ name: 'Atual', group: 'Atual', checked: false }] }] };
assert.deepEqual(merge(populated, remote).jobs[0].docs, populated.jobs[0].docs);
console.log('PASS: recovery preserves current data, lists existing clients/checklists, and renders linked parties and documents.');
