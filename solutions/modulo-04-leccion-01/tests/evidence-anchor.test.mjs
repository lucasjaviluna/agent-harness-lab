import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyAnchoredEvidence} from '../dist/evidence-anchor.js';
import {verifyEvidence} from '../dist/evidence.js';
import {runGovernedWorkflow} from '../dist/governed-workflow.js';
import {classify,parseStory} from '../dist/story-classifier.js';
import {sha256} from '../dist/governance.js';
const story=parseStory(JSON.parse(readFileSync(new URL('../examples/workflows/simple.json',import.meta.url),'utf8')));
async function setup(t){const cwd=mkdtempSync(join(tmpdir(),'lab-anchor-'));t.after(()=>rmSync(cwd,{force:true,recursive:true}));const r=await runGovernedWorkflow(cwd,story,classify(story),'simulate',undefined,{execute:async s=>s.id,decide:async q=>({requestId:q.requestId,digest:q.digest,decision:'approve'}),quality:()=>({check:'workflow-regression',status:'passed',exitCode:0,elapsedMs:1,outputHash:sha256('fake')})});return {cwd,runId:r.runId,head:verifyEvidence(cwd,r.runId).head};}
test('ancla correcta verifica la cadena y marca coincidencia',async t=>{const {cwd,runId,head}=await setup(t);assert.equal(verifyAnchoredEvidence(cwd,runId,head).anchorMatched,true);});
test('rechaza ancla inválida y válida pero diferente',async t=>{const {cwd,runId}=await setup(t);for(const h of ['not-a-hash','0'.repeat(64),null])assert.throws(()=>verifyAnchoredEvidence(cwd,runId,h));});
test('una cadena recalculada puede pasar verificación local pero no un ancla confiable',async t=>{const {cwd,runId,head}=await setup(t);const p=join(cwd,'.lab-evidence',runId,'events.jsonl');const records=readFileSync(p,'utf8').trimEnd().split('\n').map(JSON.parse);records[0].data.operator='changed';let previous='0'.repeat(64);const lines=records.map(r=>{const {hash,...body}=r;body.previous=previous;const h=sha256(JSON.stringify(body));previous=h;return JSON.stringify({...body,hash:h});});writeFileSync(p,lines.join('\n')+'\n');assert.notEqual(verifyEvidence(cwd,runId).head,head);assert.throws(()=>verifyAnchoredEvidence(cwd,runId,head),/ancla externa/);});
