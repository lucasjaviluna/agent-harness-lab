import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify,storyFromPrompt} from '../dist/story-classifier.js';
import {route,parseWorkflowConfig,runWorkflow} from '../dist/workflow.js';
test('agrega un gate al final sin eliminar los obligatorios',()=>{
  for(const level of ['simple','medium','complex'])assert.deepEqual(route(level,{finalReviewGate:true}).map(s=>s.id),[...route(level).map(s=>s.id),'approve-review']);
});
test('false y omisión son compatibles; rechaza valores no booleanos',()=>{
  assert.deepEqual(route('medium',{finalReviewGate:false}),route('medium'));
  assert.throws(()=>parseWorkflowConfig({finalReviewGate:'true'}));
});
test('gate final sólo puede aprobar la revisión y su rechazo bloquea completion',async()=>{
  const s=storyFromPrompt('Agregar filtro');
  const r=await runWorkflow(s,classify(s),{execute:async(stage)=>`Artifact ${stage.id}`,approve:async(stage,a)=>{if(stage.id==='approve-review'){assert.equal(a.stage,'review');return false;}return true;}},{finalReviewGate:true});
  assert.equal(r.status,'rejected');assert.deepEqual(r.steps.at(-1),{stage:'approve-review',status:'rejected'});
});
test('si una aprobación anterior falla, nunca se llega al gate final',async()=>{
  const s=storyFromPrompt('Agregar filtro');let seen=[];
  const r=await runWorkflow(s,classify(s),{execute:async()=> 'Artifact',approve:async(stage)=>{seen.push(stage.id);return false;}},{finalReviewGate:true});
  assert.deepEqual(seen,['approve-plan']);assert.equal(r.steps.at(-1).status,'skipped');
});
