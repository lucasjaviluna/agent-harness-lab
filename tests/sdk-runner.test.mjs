import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSdkArgs, runSdkSession } from '../dist/sdk-runner.js';

function fake({ behavior = 'ok' } = {}) {
  const listeners = new Set(); const calls = []; let last; let finish;
  let disposed = 0, unsubscribed = 0, aborted = 0;
  const emit = event => { for (const l of listeners) l(event); };
  const session = {
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); unsubscribed++; }; },
    async prompt(text) {
      calls.push(text);
      if (behavior === 'reject') throw new Error('provider failure');
      if (behavior === 'hang') { await new Promise(resolve => { finish = resolve; }); return; }
      emit({ type: 'agent_start' });
      emit({ type: 'tool_execution_start' }); emit({ type: 'tool_execution_end', isError: true });
      last = `answer ${text}`;
      emit({ type: 'message_update', assistantMessageEvent: { type: 'thinking_delta', delta: 'secret' } });
      emit({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: last } });
      emit({ type: 'message_end', message: { role: 'assistant', stopReason: behavior === 'error' ? 'error' : 'stop' } });
      emit({ type: 'agent_end' });
      if (behavior !== 'unsettled') emit({ type: 'agent_settled', aborted: behavior === 'aborted' });
    },
    async abort() { aborted++; finish?.(); },
    getLastAssistantText() { return last; },
    dispose() { disposed++; }
  };
  return { session, calls, state: () => ({ disposed, unsubscribed, aborted, listeners: listeners.size }) };
}
const opts = (...prompts) => ({ prompts, readOnly: false, stream: false, timeoutMs: 500 });
test('SDK args conservative defaults', () => { const a = parseSdkArgs(['hola']); assert.equal(a.readOnly,false); assert.equal(a.timeoutMs,120000); assert.deepEqual(a.prompts,['hola']); });
test('SDK args explicit opts, multiple prompts and exact model', () => { const a = parseSdkArgs(['--read-only','--stream','--timeout-ms','15','--model','openai/gpt-4o','--thinking','low','a','b']); assert.equal(a.readOnly,true); assert.equal(a.stream,true); assert.equal(a.timeoutMs,15); assert.equal(a.model,'openai/gpt-4o'); assert.equal(a.thinking,'low'); assert.deepEqual(a.prompts,['a','b']); });
test('SDK args reject invalid input', () => { for (const a of [[],[' '],['--oops','x'],['--timeout-ms','0','x'],['--timeout-ms','3.5','x'],['--model','wild*','x'],['--thinking','bad','x']]) assert.throws(()=>parseSdkArgs(a)); });
test('one session for sequential prompts, independent metrics, cleanup', async () => { const f=fake(); let creates=0; const result=await runSdkSession(async()=>{creates++;return f.session;},opts('a','b')); assert.equal(creates,1); assert.deepEqual(f.calls,['a','b']); assert.deepEqual(result.turns.map(t=>[t.text,t.tools,t.toolErrors]),[['answer a',1,1],['answer b',1,1]]); assert.deepEqual(f.state(),{disposed:1,unsubscribed:2,aborted:0,listeners:0}); });
test('streams only text, never thinking', async()=>{const f=fake(); const deltas=[]; await runSdkSession(async()=>f.session,{...opts('a'),stream:true},d=>deltas.push(d));assert.deepEqual(deltas,['answer a']);});
test('no stream by default',async()=>{const f=fake();await runSdkSession(async()=>f.session,opts('a'),()=>assert.fail('unexpected delta'));});
for (const behavior of ['error','unsettled','aborted','reject']) test(`rejects ${behavior}, no second prompt and cleanup`,async()=>{const f=fake({behavior});await assert.rejects(runSdkSession(async()=>f.session,opts('a','b')));assert.deepEqual(f.calls,['a']);assert.deepEqual(f.state(),{disposed:1,unsubscribed:1,aborted:0,listeners:0});});
test('cooperative timeout aborts and cleans up',async()=>{const f=fake({behavior:'hang'});await assert.rejects(runSdkSession(async()=>f.session,{...opts('a'),timeoutMs:10}),/SDK_TIMEOUT/);assert.deepEqual(f.state(),{disposed:1,unsubscribed:1,aborted:1,listeners:0});});
test('invalid options do not create SDK',async()=>{await assert.rejects(runSdkSession(async()=>assert.fail('unexpected create'),opts()),/Prompts/);});
