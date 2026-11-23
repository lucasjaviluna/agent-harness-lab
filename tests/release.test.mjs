import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { subcommandTarget } from '../dist/subcommand.js';
import { meetsNodeRequirement, readiness } from '../dist/readiness.js';

const root=resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry=join(root,'dist','lab-cli.js');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const invoke=(...args)=>spawnSync(process.execPath,[entry,...args],{cwd:root,encoding:'utf8',timeout:30000});

test('la versión del CLI sale de package.json, no de un literal obsoleto',()=>{
  const result=invoke('--version');
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),pkg.version);
  assert.match(invoke('--help').stdout,new RegExp('v'+pkg.version.replaceAll('.','\\.')));
});

test('pack tiene allowlist, bin y publicación bloqueada por defecto',()=>{
  assert.equal(pkg.private,true);
  assert.equal(pkg.license,'UNLICENSED');
  assert.deepEqual(pkg.files,['dist/','README.md','docs/RELEASE_READINESS.md','docs/SECURITY.md']);
  assert.equal(pkg.bin['agent-lab'],'./dist/lab-cli.js');
});

test('rutas son estáticas, sin entrada del operador en la ruta del script',()=>{
  assert.deepEqual(subcommandTarget(['workflow','--mode','plan','Tarea']),{script:'workflow-cli.js',args:['--mode','plan','Tarea']});
  assert.deepEqual(subcommandTarget(['team','--','--help']),{script:'multi-agent-cli.js',args:['--help']});
  assert.deepEqual(subcommandTarget(['evidence','verify','run-1']),{script:'evidence-cli.js',args:['run-1']});
  assert.equal(subcommandTarget(['ruta-desconocida']),undefined);
  assert.throws(()=>subcommandTarget(['evidence','destroy','run-1']),/Uso:/);
});

test('ejecutable único delega workflow y team sin iniciar Pi',()=>{
  const w=invoke('workflow','--mode','plan','Corregir una etiqueta');
  assert.equal(w.status,0,w.stderr);
  assert.equal(JSON.parse(w.stdout).mode,'plan');
  const t=invoke('team','--mode','plan','Analizar el código');
  assert.equal(t.status,0,t.stderr);
  assert.equal(JSON.parse(t.stdout).mode,'plan');
});

test('readiness informa límites y estado de Node sin inventar un certificado',()=>{
  assert.equal(meetsNodeRequirement('v22.18.9'),false);
  assert.equal(meetsNodeRequirement('v22.19.0'),true);
  assert.equal(meetsNodeRequirement('v23.0.0'),true);
  assert.equal(meetsNodeRequirement('desconocido'),false);
  const r=readiness('v22.18.0',true);
  assert.equal(r.canRunLab,false);
  assert.equal(r.productionVerified,false);
  assert.ok(r.pending.some(s=>s.includes('sandbox')));
});

test('CLI readiness es JSON y enforce refleja compatibilidad real',()=>{
  const result=invoke('readiness');
  assert.equal(result.status,0,result.stderr);
  const data=JSON.parse(result.stdout);
  assert.equal(data.canRunLab,meetsNodeRequirement(process.version));
  assert.equal(data.productionVerified,false);
  const enforced=invoke('readiness','--enforce');
  assert.equal(enforced.status,data.canRunLab?0:2,enforced.stderr);
});

test('readiness rechaza flags desconocidos',()=>{
  const result=invoke('readiness','--approve-everything');
  assert.equal(result.status,1);
  assert.match(result.stderr,/Uso:/);
});

test('CLI no activa herramientas al delegar el modo plan',()=>{
  const result=invoke('workflow','--mode','plan','Revisar usuario');
  assert.equal(result.status,0,result.stderr);
  const info=JSON.parse(result.stdout);
  assert.deepEqual(info.effectiveTools,[]);
});
