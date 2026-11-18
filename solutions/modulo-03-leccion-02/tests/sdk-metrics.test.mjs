import test from 'node:test';
import assert from 'node:assert/strict';
import { runSdkSession } from '../dist/sdk-runner.js';
function makeSession() {
  let listener; let n=0;
  return {subscribe(l){listener=l;return ()=>{listener=undefined;}},async prompt(){n++; for(let i=0;i<n;i++)listener({type:'turn_end'});listener({type:'message_end',message:{role:'assistant',stopReason:'stop'}});listener({type:'agent_settled',aborted:false});},async abort(){},getLastAssistantText(){return 'ok'},dispose(){}};
}
test('internal turns count independently per prompt',async()=>{const s=makeSession();const r=await runSdkSession(async()=>s,{prompts:['a','b'],timeoutMs:1000,readOnly:false,stream:false});assert.deepEqual(r.turns.map(t=>t.internalTurns),[1,2]);});
test('elapsed time is finite nonnegative integer',async()=>{const s=makeSession();const r=await runSdkSession(async()=>s,{prompts:['a'],timeoutMs:1000,readOnly:false,stream:false});assert.ok(Number.isSafeInteger(r.turns[0].elapsedMs));assert.ok(r.turns[0].elapsedMs>=0);});
