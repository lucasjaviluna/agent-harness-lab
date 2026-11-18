import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { parseToolList, effectiveTools } from '../dist/tool-selection.js';
import { DEFAULT_CONFIG } from '../dist/config.js';
import { readProjectFacts, listTestInventory } from '../.pi/tools/lab-catalog-core.mjs';
import { decideToolCall, parsePolicy } from '../.pi/policies/approval-policy.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');
const catalogPath = join(root, '.pi', 'extensions', 'tool-catalog.ts');
const example = join(root, 'examples', 'config', 'harness.codemode.example.json');

function run(args, cwd = root) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' });
}
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'agentlab11-'));
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'demo', version: '1.2.3',
    dependencies: { foo: '^1' }, devDependencies: { bar: '1', baz: '2' },
    scripts: { start: 'echo SENSITIVE_SECRET', test: 'node --test' },
  }));
  writeFileSync(join(dir, 'tests', 'alpha.test.mjs'), 'secret');
  writeFileSync(join(dir, 'tests', 'bravo.test.ts'), 'secret');
  writeFileSync(join(dir, 'tests', '.hidden.test.mjs'), 'secret');
  writeFileSync(join(dir, 'tests', 'note.txt'), 'secret');
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

async function loadExtension() {
  const source = readFileSync(catalogPath, 'utf8');
  const replacement = `const Type = { Object: (props, opts={}) => ({type:'object', properties:props, ...opts}) };`;
  const transformed = source.replace(/^import \{ Type \} from 'typebox';$/m, replacement)
    .replace("'../tools/lab-catalog-core.mjs'", JSON.stringify(pathToFileURL(join(root, '.pi', 'tools', 'lab-catalog-core.mjs')).href));
  assert.notEqual(source, transformed);
  const js = stripTypeScriptTypes(transformed, { mode: 'strip' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

test('--tools parsea allowlist explícita, sin duplicados', () => {
  assert.deepEqual(parseToolList('read, grep, codemode,tool_search'), ['read','grep','codemode','tool_search']);
  assert.deepEqual(effectiveTools(DEFAULT_CONFIG), ['read','grep','find','ls']);
  assert.deepEqual(effectiveTools(DEFAULT_CONFIG, { tools: ['codemode'] }), ['codemode']);
});

test('--tools rechaza inyecciones, modificadores y nombres vacíos', () => {
  for (const value of ['', ',read', 'read,', 'read,read', '+codemode', '-bash', 'read,*', 'read;echo hi', 'read\nwrite', 'read,foo/bar']) {
    assert.throws(() => parseToolList(value), /--tools/);
  }
  assert.throws(() => parseToolList(Array.from({length:33},(_,i)=>`tool${i}`).join(',')), /--tools/);
});

test('CLI --tools modifica sólo una ejecución y preserva -- y caracteres del prompt', () => {
  const prompt = 'Revisar & echo NO_EJECUTAR | símbolos';
  const r = run(['run', prompt, '--tools', 'read,codemode,tool_search', '--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  const { args } = JSON.parse(r.stdout);
  assert.equal(args[args.indexOf('--tools')+1], 'read,codemode,tool_search');
  assert.deepEqual(args.slice(-2), ['--', prompt]);
  const untouched = run(['run', prompt, '--dry-run']);
  assert.equal(JSON.parse(untouched.stdout).args.find((x,i,a)=>a[i-1] === '--tools'), 'read,grep,find,ls');
});

test('--tools se admite en run-file y modo JSON', () => {
  const w = fixture(); try {
    const r=run(['run-file', join(w.dir,'package.json'), '--mode','json','--tools','read,tool_search','--dry-run']);
    assert.equal(r.status,0,r.stderr);
    const args=JSON.parse(r.stdout).args;
    assert.ok(args.includes('json'));
    assert.equal(args[args.indexOf('--tools')+1], 'read,tool_search');
  } finally { w.cleanup(); }
});

test('--tools no se admite en commands no-run, no puede repetirse, no acepta flags sin valor', () => {
  for (const args of [ ['config','--tools','read'], ['run','hola','--tools','read','--tools','ls'], ['run','hola','--tools'] ]) {
    const r=run(args);
    assert.equal(r.status,1,`args=${args} stdout=${r.stdout}`);
    assert.match(r.stderr,/--tools/);
  }
});

test('ejemplo habilita las extensiones integradas sin modificar defaults del usuario', () => {
  const r = run(['--config', example, 'run','solo lectura', '--dry-run']);
  assert.equal(r.status,0,r.stderr);
  const args = JSON.parse(r.stdout).args;
  assert.equal(args[args.indexOf('--tools')+1], 'read,grep,find,ls,codemode,tool_search');
  assert.ok(!args.includes('--no-extensions'));
  assert.ok(args.includes('--no-mcp'));
});

test('función pura entrega resumen acotado sin comandos de scripts', async () => {
  const w=fixture();try {
    const result=await readProjectFacts(w.dir);
    assert.equal(result.name,'demo');
    assert.equal(result.dependencies,1);
    assert.equal(result.devDependencies,2);
    assert.deepEqual(result.scriptNames,['start','test']);
    assert.ok(!JSON.stringify(result).includes('SENSITIVE_SECRET'));
  } finally {w.cleanup();}
});

test('inventario solo lista tests y omite archivos ocultos',async()=>{
  const w=fixture();try{
    const result=await listTestInventory(w.dir);
    assert.deepEqual(result.files,['alpha.test.mjs','bravo.test.ts']);
    assert.equal(result.count,2);
  } finally{w.cleanup();}
});

test('resumen falla cerrado ante package malformado o enorme',async()=>{
  const w=fixture();try{
    writeFileSync(join(w.dir,'package.json'),'not-json');
    await assert.rejects(()=>readProjectFacts(w.dir));
    writeFileSync(join(w.dir,'package.json'),'A'.repeat(70*1024));
    await assert.rejects(()=>readProjectFacts(w.dir),/demasiado grande/);
  }finally{w.cleanup();}
});

test('AbortSignal detiene lectura antes de acceder al sistema de archivos',async()=>{
  const w=fixture();try{
    const c=new AbortController(); c.abort();
    await assert.rejects(()=>readProjectFacts(w.dir,c.signal),/abort/i);
    await assert.rejects(()=>listTestInventory(w.dir,c.signal),/abort/i);
  }finally{w.cleanup();}
});

test('extensión registra dos tools con exposición codemode y deferred',async()=>{
  const mod=await loadExtension();const registered=[];
  mod.default({registerTool:x=>registered.push(x)});
  assert.deepEqual(registered.map(x=>[x.name,x.exposure]),[
    ['lab_project_facts','codemode'],['lab_test_inventory','deferred']
  ]);
  assert.equal(registered[0].parameters.additionalProperties,false);
  assert.equal(registered[0].namespace.name,'agent-lab');
  const w=fixture();try{
    const r=await registered[0].execute('1',{},new AbortController().signal,()=>{}, {cwd:w.dir});
    assert.equal(r.isError,undefined);
    assert.equal(r.details.facts.name,'demo');
    const inv=await registered[1].execute('2',{},new AbortController().signal,()=>{}, {cwd:w.dir});
    assert.equal(inv.details.inventory.count,2);
  }finally{w.cleanup();}
});

test('herramientas devuelven errores sanitizados sin filtrar rutas locales',async()=>{
  const mod=await loadExtension();const registered=[];
  mod.default({registerTool:t=>registered.push(t)});
  const w=fixture();try{
    rmSync(join(w.dir,'package.json'));
    const r=await registered[0].execute('1',{},new AbortController().signal,()=>{}, {cwd:w.dir});
    assert.equal(r.isError,true);
    assert.ok(!r.content[0].text.includes(w.dir));
  }finally{w.cleanup();}
});

test('guard permite wrappers y herramientas de solo lectura pero no llamadas anidadas peligrosas',()=>{
  const policy=parsePolicy({version:1,bash:'deny',denyTools:[],askTools:[]});
  for(const name of ['codemode','tool_search','lab_project_facts','lab_test_inventory']) {
    assert.equal(decideToolCall(root,name,{},policy).action,'allow');
  }
  assert.equal(decideToolCall(root,'bash',{command:'echo hi'},policy).action,'deny');
  assert.equal(decideToolCall(root,'write',{path:'.pi/private'},policy).action,'deny');
  assert.equal(decideToolCall(root,'write',{path:'examples/new.md'},policy).action,'ask');
});
