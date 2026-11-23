import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTelemetryGate} from '../telemetry-gate.mjs';
const clean={schemaVersion:1,agentSettled:1,toolErrors:0,abortedRuns:0,failedMessages:0};

test('aprueba evidencia completa y sin errores',()=>{
  assert.equal(evaluateTelemetryGate(clean).status,'passed');
});
test('rechaza tool errors, aborto o mensaje fallido',()=>{
  for (const key of ['toolErrors','abortedRuns','failedMessages']) assert.equal(evaluateTelemetryGate({...clean,[key]:1}).status,'failed');
});
test('rechaza evidencia incompleta sin settled',()=>{
  assert.match(evaluateTelemetryGate({...clean,agentSettled:0}).reasons.join(' '),/incompleta/);
});
test('acepta umbrales explícitos y rechaza inválidos',()=>{
  assert.equal(evaluateTelemetryGate({...clean,toolErrors:1},{maxToolErrors:1}).status,'passed');
  assert.throws(()=>evaluateTelemetryGate(clean,{maxToolErrors:-1}),/inválido/);
  assert.throws(()=>evaluateTelemetryGate(clean,{maxToolErrors:'1'}),/inválido/);
  assert.throws(()=>evaluateTelemetryGate({...clean,abortedRuns:NaN}),/inválido/);
});
