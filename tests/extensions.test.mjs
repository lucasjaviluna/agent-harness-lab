import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { buildExtensionArgs } from '../dist/extension-options.js';
import { listProjectExtensions } from '../dist/extensions-report.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');
const observerPath = join(root, '.pi', 'extensions', 'lifecycle-observer.ts');
async function loadObserver() {
  const js = stripTypeScriptTypes(readFileSync(observerPath, 'utf8'), { mode: 'strip' });
  return await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-lab-extensions-'));
  const fakePi = join(cwd, 'fake-pi.mjs');
  writeFileSync(fakePi, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version')) console.log('pi-test 1.0');
else if (args.includes('json')) {
  console.log(JSON.stringify({type:'session',version:3,id:'extensions-session',cwd:process.cwd()}));
  console.log(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'ok'}]}}));
  console.log(JSON.stringify({type:'agent_settled',aborted:false}));
} else console.log(JSON.stringify(args));
`, { mode: 0o755 });
  writeFileSync(join(cwd, 'harness.config.json'), JSON.stringify({ pi: { executable: fakePi } }));
  writeFileSync(join(cwd, 'preload.cjs'), `
const cp = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const orig = cp.spawn;
cp.spawn = (command,args,options) => command === process.env.FAKE_PI_SCRIPT
  ? orig(process.execPath,[command,...args],options) : orig(command,args,options);
syncBuiltinESMExports();`);
  return { cwd, fakePi, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}
function invoke(w, args) {
  const env = { ...process.env };
  if (process.platform === 'win32') {
    env.FAKE_PI_SCRIPT = w.fakePi;
    const preload = join(w.cwd, 'preload.cjs').replaceAll('\\', '/');
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require "${preload}"`.trim();
  }
  return spawnSync(process.execPath, [entry, ...args], { cwd: w.cwd, env, encoding: 'utf8' });
}
function installExtension(w, name='audit', dir='.pi/extensions') {
  const folder = join(w.cwd, dir); mkdirSync(folder, { recursive: true });
  const path = join(folder, `${name}.ts`);
  writeFileSync(path, 'export default function (pi) { pi.on("agent_start", () => {}); }');
  return path;
}
function argsFrom(w, args) {
  const r = invoke(w,args);
  assert.equal(r.status,0,r.stderr);
  return JSON.parse(r.stdout).args;
}

test('extensions list descubre extensiones locales y advierte que no es el catálogo cargado',()=>{
  const w=workspace();try{
    const file=installExtension(w,'audit');
    const r=invoke(w,['extensions','list']);assert.equal(r.status,0,r.stderr);
    const report=JSON.parse(r.stdout);
    assert.equal(report.scope,'project-directories-only');
    assert.deepEqual(report.extensions,[{name:'audit',path:file,kind:'file'}]);
    assert.match(report.limitations.join(' '),/no confirma carga/);
  }finally{w.cleanup();}
});

test('extensions list funciona sin .pi/extensions',()=>{
  const w=workspace();try{assert.deepEqual(JSON.parse(invoke(w,['extensions','list']).stdout).extensions,[]);}finally{w.cleanup();}
});

test('extensions list soporta directorio con index.ts y omite archivos extra',()=>{
  const w=workspace();try{
    const dir=join(w.cwd,'.pi/extensions/package');mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'index.ts'),'export default () => {}');
    writeFileSync(join(w.cwd,'.pi/extensions/README.md'),'not code');
    const report=listProjectExtensions(w.cwd);
    assert.equal(report.extensions.length,1);
    assert.equal(report.extensions[0].kind,'directory');
  }finally{w.cleanup();}
});

test('extensions list no sigue enlaces simbólicos',()=>{
  const w=workspace();try{
    const target=installExtension(w);
    try{symlinkSync(target,join(w.cwd,'.pi/extensions/external.ts'));}catch{return;}
    assert.equal(listProjectExtensions(w.cwd).extensions.length,1);
  }finally{w.cleanup();}
});

test('buildExtensionArgs valida archivos, directorios y deduplicación canónica',()=>{
  const w=workspace();try{
    const p=installExtension(w);
    const dir=join(w.cwd,'nested');mkdirSync(dir);
    writeFileSync(join(dir,'index.ts'),'export default () => {}');
    const args=buildExtensionArgs(w.cwd,{paths:[p,join('.pi/extensions/audit.ts'),dir]});
    assert.deepEqual(args,['--extension',p,'--extension',dir]);
  }finally{w.cleanup();}
});

test('buildExtensionArgs rechaza rutas inválidas sin ejecutar código',()=>{
  const w=workspace();try{
    assert.throws(()=>buildExtensionArgs(w.cwd,{paths:['non-existent.ts']}),/Extensión inválida/);
    const p=join(w.cwd,'evil.md');writeFileSync(p,'no');
    assert.throws(()=>buildExtensionArgs(w.cwd,{paths:[p]}),/Extensión inválida/);
    assert.throws(()=>buildExtensionArgs(w.cwd,{paths:['  ']}),/ruta no vacía/);
  }finally{w.cleanup();}
});

test('run --extension añade flag repetible y preserva texto especial sin shell',()=>{
  const w=workspace();try{
    const p=installExtension(w);
    const prompt='Verificar & echo NO_EJECUTAR | x';
    const args=argsFrom(w,['run',prompt,'--extension',p,'--extension',p,'--dry-run']);
    assert.equal(args.filter(x=>x==='--extension').length,1);
    assert.equal(args[args.indexOf('--extension')+1],p);
    assert.equal(args.at(-1),prompt);
    assert.ok(args.includes('--no-extensions'));
  }finally{w.cleanup();}
});

test('--no-extensions admite --extension explícita igual que Pi',()=>{
  const w=workspace();try{
    const p=installExtension(w);
    const args=argsFrom(w,['run','hola','--no-extensions','--extension',p,'--dry-run']);
    assert.equal(args.filter(x=>x==='--no-extensions').length,1);
    assert.ok(args.includes('--extension'));
  }finally{w.cleanup();}
});

test('run-file y modo JSON propagan extensión a Pi simulado',()=>{
  const w=workspace();try{
    const p=installExtension(w);
    writeFileSync(join(w.cwd,'prompt.md'),'Descripción de proyecto');
    const args=argsFrom(w,['run-file','prompt.md','--mode','json','--extension',p,'--dry-run']);
    assert.deepEqual(args.slice(0,2),['--mode','json']);
    assert.equal(args.at(-1),'Descripción de proyecto');
    const r=invoke(w,['run-file','prompt.md','--mode','json','--extension',p]);
    assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(r.stdout).ok,true);
  }finally{w.cleanup();}
});

test('opciones de extensiones son sólo de run y run-file',()=>{
  const w=workspace();try{
    const p=installExtension(w);
    for(const args of [['doctor','--extension',p],['extensions','list','--no-extensions']]){
      const result=invoke(w,args);assert.equal(result.status,1);assert.match(result.stderr,/sólo aplican/);
    }
  }finally{w.cleanup();}
});

test('extensión de ciclo de vida: registra hooks y comando, cuenta ejecuciones sin UI',async()=>{
  const {default:factory}=await loadObserver();
  const hooks=new Map();const commands=new Map();
  factory({on(type,cb){hooks.set(type,cb);},registerCommand(name,definition){commands.set(name,definition);}});
  for(const name of ['session_start','agent_start','tool_execution_end','agent_settled','session_shutdown']){
    assert.equal(typeof hooks.get(name),'function');
  }
  assert.ok(commands.has('lab-stats'));
  const events=[];
  const ctx={hasUI:true,ui:{setStatus(...a){events.push(a);},notify(...a){events.push(a);}}};
  hooks.get('session_start')({},ctx);
  hooks.get('agent_start')({},ctx);
  hooks.get('tool_execution_end')({},ctx);
  hooks.get('tool_execution_end')({},ctx);
  hooks.get('agent_settled')({aborted:false},ctx);
  assert.match(events.at(-1)[1],/Runs: 1.*Tools: 2/);
  await commands.get('lab-stats').handler('',ctx);
  assert.match(events.at(-1)[0],/Runs: 1, herramientas terminadas: 2/);
  hooks.get('session_shutdown')({},ctx);
  assert.deepEqual(events.at(-1),['agent-lab',undefined]);
  hooks.get('session_start')({},ctx);
  hooks.get('agent_start')({},ctx);
  hooks.get('agent_settled')({aborted:true},ctx);
  assert.match(events.at(-1)[1],/abortado/);
});

test('extensión de ciclo de vida no requiere UI en modo print o JSON',async()=>{
  const {default:factory}=await loadObserver();
  const hooks=new Map();const commands=new Map();
  factory({on(type,cb){hooks.set(type,cb);},registerCommand(name,def){commands.set(name,def);}});
  const ctx={hasUI:false};
  hooks.get('session_start')({},ctx);
  hooks.get('agent_start')({},ctx);
  hooks.get('tool_execution_end')({},ctx);
  hooks.get('agent_settled')({aborted:true},ctx);
  hooks.get('session_shutdown')({},ctx);
  await commands.get('lab-stats').handler('',ctx);
});
