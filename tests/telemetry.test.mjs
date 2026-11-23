import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeTelemetryJsonl } from '../dist/telemetry.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cli = join(root, 'dist', 'lab-cli.js');
const asLines = (...items) => items.map(x=>JSON.stringify(x)).join('\r\n')+'\r\n';

test('telemetry resume eventos válidos y cuenta herramientas y abortos', () => {
  const raw=asLines(
    { type:'agent_start' },
    { type:'tool_execution_start', toolName:'supersecreto' },
    { type:'tool_execution_end', isError:true },
    { type:'agent_settled', aborted:true },
  );
  const summary=summarizeTelemetryJsonl(raw);
  assert.equal(summary.records,4);
  assert.equal(summary.agentStarts,1);
  assert.equal(summary.toolCalls,1);
  assert.equal(summary.toolErrors,1);
  assert.equal(summary.abortedRuns,1);
  assert.ok(!JSON.stringify(summary).includes('supersecreto'));
});

test('agrega usage y costos cuando están presentes',()=>{
  const s=summarizeTelemetryJsonl(asLines(
    {type:'message_end',message:{role:'assistant',stopReason:'stop',usage:{input:11,output:7,cacheRead:3,cacheWrite:2,totalTokens:23,cost:{total:0.1}}}},
    {type:'message_end',message:{role:'assistant',stopReason:'error',usage:{input:5,output:0,cacheRead:0,cacheWrite:0,totalTokens:5,cost:{total:0.05}}}},
  ));
  assert.equal(s.usageSamples,2);
  assert.deepEqual(s.tokens,{input:16,output:7,cacheRead:3,cacheWrite:2,total:28});
  assert.equal(s.assistantMessages,2);
  assert.equal(s.failedMessages,1);
  assert.ok(Math.abs(s.costUsd-0.15)<1e-9);
});

test('costUsd es null cuando no existe uso válido',()=>{
  const s=summarizeTelemetryJsonl(asLines({type:'agent_start'}));
  assert.equal(s.costUsd,null);
  assert.equal(s.usageSamples,0);
});

test('ignora métricas numéricas negativas, infinita y strings',()=>{
  const s=summarizeTelemetryJsonl(asLines({type:'message_end',message:{role:'assistant',usage:{input:-2,output:'2',cacheRead:1e15,cacheWrite:3,totalTokens:4,cost:{total:-10}}}}));
  assert.deepEqual(s.tokens,{input:0,output:0,cacheRead:0,cacheWrite:3,total:4});
  assert.equal(s.costUsd,null);
});

test('JSONL inválido produce error sin volcar contenido',()=>{
  assert.throws(()=>summarizeTelemetryJsonl('{"type":\n'),/JSONL inválido/);
  assert.throws(()=>summarizeTelemetryJsonl('[]\n'),/Evento inválido/);
  assert.throws(()=>summarizeTelemetryJsonl('{"type":7}\n'),/Evento inválido/);
});

test('limita tamaño a cuatro MiB',()=>{
  assert.throws(()=>summarizeTelemetryJsonl('a'.repeat(4*1024*1024+1)),/demasiado grande/);
});

test('no revela mensajes, prompts, rutas o nombres de herramientas',()=>{
  const secret='SEC-VALOR-CREDENCIAL';
  const out=JSON.stringify(summarizeTelemetryJsonl(asLines({type:'tool_execution_end',toolName:secret,isError:false,path:'/private/'+secret},{type:'message_end',message:{role:'assistant',content:[{type:'text',text:secret}]}})));
  assert.ok(!out.includes(secret));
  assert.ok(!out.includes('/private/'));
});

test('CLI telemetry entrega sólo agregados y rechaza symlinks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'telemetry-lab-'));
 try {
  const f=join(dir,'events.jsonl');writeFileSync(f,asLines({type:'agent_settled',aborted:false,prompt:'NO-IMPRIMIR'}));
  const p=spawnSync(process.execPath,[cli,'telemetry',f],{cwd:dir,encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  assert.equal(JSON.parse(p.stdout).agentSettled,1);
  assert.ok(!p.stdout.includes('NO-IMPRIMIR'));
  const symlink=join(dir,'symlink.jsonl');
  try {symlinkSync(f,symlink);}catch(e){if(process.platform==='win32'&&e.code==='EPERM')return;throw e;}
  const q=spawnSync(process.execPath,[cli,'telemetry',symlink],{cwd:dir,encoding:'utf8'});
  assert.equal(q.status,1);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
