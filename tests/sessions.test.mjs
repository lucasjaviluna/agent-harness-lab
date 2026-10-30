import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');
function workspace(overrides={}) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-sessions-'));
  const script = join(dir, 'fake-pi.mjs');
  writeFileSync(script, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('pi-test 1.0'); process.exit(0); }
if (args.includes('json')) {
  const emit = event => console.log(JSON.stringify(event));
  emit({type:'session',version:3,id:'session-test',cwd:process.cwd()});
  emit({type:'message_end', message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:JSON.stringify(args)}]}});
  emit({type:'agent_settled',aborted:false});
} else console.log(JSON.stringify(args));
`, {mode:0o755});
  // Es el mismo mecanismo de los tests ya corregidos para Windows: una función
  // de preload ejecuta el script de prueba con node, sin shell ni .cmd.
  writeFileSync(join(dir, 'fake-pi-preload.cjs'), `
const cp = require('node:child_process');
const {syncBuiltinESMExports} = require('node:module');
const original = cp.spawn;
cp.spawn=(cmd,args,opts) => cmd === process.env.FAKE_PI_SCRIPT
  ? original(process.execPath,[cmd,...args],opts) : original(cmd,args,opts);
syncBuiltinESMExports();
`);
  writeFileSync(join(dir,'harness.config.json'),JSON.stringify({pi:{executable:script},...overrides}));
  return {dir,script,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
function invoke(w,args) {
  const env={...process.env};
  if (process.platform === 'win32') {
    const preload=join(w.dir,'fake-pi-preload.cjs').replaceAll('\\','/');
    env.NODE_OPTIONS = `${env.NODE_OPTIONS||''} --require "${preload}"`.trim();
    env.FAKE_PI_SCRIPT = w.script;
  }
  return spawnSync(process.execPath,[entry,...args],{cwd:w.dir,env,encoding:'utf8'});
}
function argsOf(result) { assert.equal(result.status,0,result.stderr); return JSON.parse(result.stdout).args; }
function val(args,flag) { return args[args.indexOf(flag)+1]; }

const cases = [
  ['por defecto efímero', ['run','hola','--dry-run'], a=>assert.ok(a.includes('--no-session'))],
  ['persist optativo', ['run','hola','--persist','--dry-run'], a=>assert.ok(!a.includes('--no-session'))],
  ['continuar implica persistencia', ['run','hola','--continue','--dry-run'], a=>{assert.ok(a.includes('--continue'));assert.ok(!a.includes('--no-session'));}],
  ['sesión explícita', ['run','hola','--session','ejemplo123','--dry-run'], a=>assert.equal(val(a,'--session'),'ejemplo123')],
  ['fork a una sesión nueva', ['run','hola','--fork','origen123','--dry-run'], a=>{assert.equal(val(a,'--fork'),'origen123');assert.ok(!a.includes('--no-session'));}],
  ['directorio aislado y nombre', ['run','hola','--persist','--session-dir','./sesiones','--name','experimento','--dry-run'], a=>{assert.equal(val(a,'--session-dir'),'./sesiones');assert.equal(val(a,'--name'),'experimento');}],
  ['ephemeral explicito', ['run','hola','--ephemeral','--dry-run'], a=>assert.ok(a.includes('--no-session'))],
  ['json con persistencia', ['run','hola','--mode','json','--persist','--dry-run'], a=>{assert.deepEqual(a.slice(0,2),['--mode','json']);assert.ok(!a.includes('--no-session'));}],
  ['run-file usa mismas opciones', ['run-file','prompt.md','--continue','--dry-run'], a=>assert.ok(a.includes('--continue'))],
];
for (const [name,argv,check] of cases) {
  test(name,()=>{const w=workspace();try {writeFileSync(join(w.dir,'prompt.md'),'revisá el proyecto');check(argsOf(invoke(w,argv)));}finally{w.cleanup();}});
}
const invalid = [
  [['run','hola','--continue','--fork','origen','--dry-run'],/mutuamente excluyentes/],
  [['run','hola','--continue','--session','s1','--dry-run'],/mutuamente excluyentes/],
  [['run','hola','--persist','--ephemeral','--dry-run'],/no pueden combinarse/],
  [['run','hola','--ephemeral','--fork','origen','--dry-run'],/incompatible/],
  [['run','hola','--session-dir','tmp','--dry-run'],/necesitan una sesión persistente/],
  [['run','hola','--name','prueba','--dry-run'],/necesitan una sesión persistente/],
  [['models','--persist'],/sólo aplican a run y run-file/],
];
for (const [argv,message] of invalid) {
  test(`rechaza ${argv.join(' ')}`,()=>{const w=workspace();try {const res=invoke(w,argv);assert.equal(res.status,1);assert.match(res.stderr,message);}finally{w.cleanup();}});
}
test('config persistente habilita sesiones, pero --ephemeral puede deshabilitarlas',()=>{
  const w=workspace({pi:{noSession:false}});try {
    assert.ok(!argsOf(invoke(w,['run','hola','--dry-run'])).includes('--no-session'));
    assert.ok(argsOf(invoke(w,['run','hola','--ephemeral','--dry-run'])).includes('--no-session'));
  }finally{w.cleanup();}
});
test('prompt especial no se interpreta con shell (print)',()=>{
  const w=workspace();try {
    const prompt='Hola & echo NO_EJECUTAR';
    const res=invoke(w,['run',prompt,'--persist']);assert.equal(res.status,0,res.stderr);
    const args=JSON.parse(res.stdout.trim());assert.equal(args.at(-1),prompt);
    assert.ok(!args.includes('--no-session'));
  }finally{w.cleanup();}
});
test('JSON preserva sesión y expone resumen, no parsea internamente el almacenamiento',()=>{
  const w=workspace();try {
    const res=invoke(w,['run','Hola','--mode','json','--persist']);
    assert.equal(res.status,0,res.stderr);const summary=JSON.parse(res.stdout);
    assert.equal(summary.sessionId,'session-test');assert.equal(summary.ok,true);
  }finally{w.cleanup();}
});
