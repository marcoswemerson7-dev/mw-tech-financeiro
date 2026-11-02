// Run with: TSX_TSCONFIG_PATH=tsconfig.app.json node --import tsx scripts/check-despachante-sync.mjs
import assert from 'node:assert/strict';
import {reconcileSnapshots,sameSnapshot} from '../src/services/despachanteReconcile.ts';
const base={clients:[{id:'c',name:'Cliente'}],models:[],jobs:[{id:'check',title:'Checklist',docs:[{checked:false}]}],processes:[]};
const tablet={...base,processes:[{id:'p',title:'Processo do tablet',status:'preparacao',location:'Escritório',history:[]}]};
let cloud=reconcileSnapshots(null,tablet,base);assert.equal(cloud.conflicts.length,0);assert.equal(cloud.data.processes[0].id,'p');
const phone=reconcileSnapshots(base,base,cloud.data);assert.equal(phone.data.processes[0].title,'Processo do tablet');assert.equal(phone.data.jobs.length,1);
const localBoth={...tablet,processes:[...tablet.processes,{id:'tablet-new',title:'Novo tablet'}]};
const remoteBoth={...tablet,processes:[...tablet.processes,{id:'phone-new',title:'Novo celular'}]};
const union=reconcileSnapshots(tablet,localBoth,remoteBoth);assert.equal(union.conflicts.length,0);assert.equal(union.data.processes.length,3);
const a={...tablet,processes:[{...tablet.processes[0],status:'protocolado',history:[{id:'a',at:'2026-11-02T12:00:00Z',text:'Protocolo'}]}]};
const b={...tablet,processes:[{...tablet.processes[0],location:'ONR',history:[{id:'b',at:'2026-11-02T13:00:00Z',text:'Local'}]}]};
const merged=reconcileSnapshots(tablet,a,b);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.processes[0].status,'protocolado');assert.equal(merged.data.processes[0].location,'ONR');assert.equal(merged.data.processes[0].history.length,2);
const conflicting={...tablet,processes:[{...tablet.processes[0],status:'finalizado'}]};
const conflict=reconcileSnapshots(tablet,a,conflicting);assert.ok(conflict.conflicts.includes('processes.p.status'));
const resolved=reconcileSnapshots(tablet,a,conflicting,{'processes.p':'remote'});assert.equal(resolved.conflicts.length,0);assert.equal(resolved.data.processes[0].status,'finalizado');assert.equal(resolved.data.processes[0].history.length,1);
const removed=reconcileSnapshots(tablet,{...tablet,processes:[]},tablet);assert.equal(removed.data.processes.length,0);assert.equal(removed.data.jobs.length,1);
const order={...union.data,processes:[...union.data.processes].reverse()};assert.ok(sameSnapshot(union.data,order));
assert.deepEqual(tablet.processes[0].history,[]);console.log('PASS: tablet → cloud → phone, independent creations, disjoint edits, history union, reviewed conflicts, deletion propagation, and stable ordering.');
