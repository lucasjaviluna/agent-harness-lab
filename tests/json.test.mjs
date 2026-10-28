import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');

function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-l2-'));
  const fakePi = join(dir, 'fake-pi.mjs');
  writeFileSync(fakePi, `#!/usr/bin/env node
const args=process.argv.slice(2);
if (args.includes('--version')) { console.log('pi-mock 1.0'); process.exit(0); }
if (!args.includes('json')) { console.log('PRINT OK'); process.exit(0); }
const scenario=process.env.SCENARIO || 'ok';
const emit=(obj)=>process.stdout.write(JSON.stringify(obj)+'\\n');
if (scenario==='malformed') { process.stdout.write('{bad json}\\n'); process.exit(0); }
if (scenario==='silent') process.exit(0);
if (scenario==='partial') { process.stdout.write('{"type":"session"}'); process.exit(0); }
emit({type:'session', version:3, id:'fake-session', cwd:process.cwd()});
emit({type:'agent_start'});
emit({type:'turn_start'});
emit({type:'message_update', assistantMessageEvent:{type:'text_delta', contentIndex:0, delta:'stream'}});
emit({type:'tool_execution_start', toolName:'read', toolCallId:'call-1', args:{path:'README.md'}});
emit({type:'tool_execution_end', toolName:'read', toolCallId:'call-1', result:{}, isError:scenario==='toolerror'});
emit({type:'message_end', message:{role:'assistant',stopReason:['error','aborted','length'].includes(scenario)?scenario:'stop',content:[{type:'text',text:'línea 1\\u2028línea 2'}]}});
emit({type:'turn_end'});
emit({type:'agent_end', messages:[],willRetry:false});
if (scenario!=='unsettled') emit({type:'agent_settled',aborted:scenario==='aborted'});
process.exit(scenario==='processexit' ? 7 : 0);
`, { mode: 0o755 });
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'fake-pi-preload.cjs'), `
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const spawn = childProcess.spawn;
childProcess.spawn = (command, args, options) => command === process.env.FAKE_PI_SCRIPT
  ? spawn(process.execPath, [command, ...args], options)
  : spawn(command, args, options);
syncBuiltinESMExports();
`);
  }
  writeFileSync(join(dir,'harness.config.json'), JSON.stringify({pi:{executable:fakePi},execution:{timeoutMs:30000}}));
  writeFileSync(join(dir,'prompt.md'), '# Describe el proyecto');
  return {dir,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
function invoke(dir, args, scenario='ok') {
  const env = { ...process.env, SCENARIO: scenario };
  if (process.platform === 'win32') {
    const preload = join(dir, 'fake-pi-preload.cjs').replaceAll('\\', '/');
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require "${preload}"`.trim();
    env.FAKE_PI_SCRIPT = join(dir, 'fake-pi.mjs');
  }
  return spawnSync(process.execPath, [entry,...args], {cwd:dir, encoding:'utf8',env});
}

test('print sigue funcionando con v0.2.0', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola']);
    assert.equal(res.status,0,res.stderr);
    assert.match(res.stdout,/PRINT OK/);
  } finally {w.cleanup();}
});

test('json summary obtiene eventos y respuesta autoritativa', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json']);
    assert.equal(res.status,0,res.stderr);
    const obj=JSON.parse(res.stdout);
    assert.equal(obj.ok,true);
    assert.equal(obj.sessionId,'fake-session');
    assert.equal(obj.turns,1);
    assert.equal(obj.tools.read,1);
    assert.equal(obj.toolErrors,0);
    assert.equal(obj.settled,true);
    assert.equal(obj.lastAssistantText,'línea 1\u2028línea 2');
  } finally {w.cleanup();}
});

test('vista events mantiene stdout JSONL y separa sólo por LF', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json','--view','events']);
    assert.equal(res.status,0,res.stderr);
    const events=res.stdout.trimEnd().split('\n').map(s=>JSON.parse(s));
    assert.equal(events.length,10);
    assert.equal(events.at(-1).type,'agent_settled');
    assert.match(res.stdout,/línea 1\u2028línea 2/);
  } finally {w.cleanup();}
});

test('error del modelo con exit 0 se convierte en falla del harness', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json'],'error');
    assert.equal(res.status,1);
    assert.equal(JSON.parse(res.stdout).ok,false);
    assert.match(res.stderr,/fallida/);
  } finally {w.cleanup();}
});

test('aborted o length son fallos semánticos', ()=>{
  const w=createWorkspace();try {
    for (const scenario of ['aborted','length']) {
      const res=invoke(w.dir,['run','hola','--mode','json'],scenario);
      assert.equal(res.status,1);
      assert.equal(JSON.parse(res.stdout).ok,false);
    }
  } finally {w.cleanup();}
});

test('tool error no implica que la ejecución completa falló', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json'],'toolerror');
    assert.equal(res.status,0,res.stderr);
    assert.equal(JSON.parse(res.stdout).toolErrors,1);
  } finally {w.cleanup();}
});

test('sin agent_settled no se da la ejecución por completada', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json'],'unsettled');
    assert.equal(res.status,1);
    assert.equal(JSON.parse(res.stdout).settled,false);
  } finally {w.cleanup();}
});

test('JSONL malformado devuelve código 65', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json'],'malformed');
    assert.equal(res.status,65);
    assert.match(JSON.parse(res.stdout).error,/JSONL inválido/);
  } finally {w.cleanup();}
});

test('registro sin terminador LF devuelve código 65', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json'],'partial');
    assert.equal(res.status,65);
    assert.match(JSON.parse(res.stdout).error,/sin terminador LF/);
  } finally {w.cleanup();}
});

test('exit code de Pi no se pierde', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json'],'processexit');
    assert.equal(res.status,7);
    assert.equal(JSON.parse(res.stdout).ok,false);
  } finally {w.cleanup();}
});

test('dry-run no inicia Pi y refleja json', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run','hola','--mode','json','--dry-run']);
    assert.equal(res.status,0);
    assert.deepEqual(JSON.parse(res.stdout).args.slice(0,2),['--mode','json']);
  } finally {w.cleanup();}
});

test('run-file incorpora solución de ejercicio de Lección 1', ()=>{
  const w=createWorkspace();try {
    const res=invoke(w.dir,['run-file','prompt.md','--mode','json','--dry-run']);
    assert.equal(res.status,0,res.stderr);
    assert.equal(JSON.parse(res.stdout).args.at(-1),'# Describe el proyecto');
  } finally {w.cleanup();}
});

test('rechaza combinaciones inválidas', ()=>{
  const w=createWorkspace();try {
    for (const args of [
      ['run','hola','--view','summary'],
      ['run','hola','--mode','rpc'],
      ['run','hola','--mode','json','--view','bad'],
    ]) {
      const res=invoke(w.dir,args);
      assert.equal(res.status,1);
      assert.match(res.stderr,/\[agent-lab\]/);
    }
  } finally {w.cleanup();}
});
