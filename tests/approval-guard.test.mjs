import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import { decideToolCall, loadPolicy, parsePolicy, validateWritePath } from '../.pi/policies/approval-policy.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist/cli.js');
const extension = join(root, '.pi/extensions/approval-guard.ts');
const config = join(root, 'examples/config/harness.approvals.example.json');
const policyPath = '.pi/policies/tool-approvals.json';
const DEFAULT = parsePolicy({version:1, bash:'deny', askTools:[], denyTools:[]});

function sandbox(policy = {version:1,bash:'deny',askTools:[],denyTools:[]}) {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-lab-guard-'));
  mkdirSync(join(cwd, '.pi/policies'), {recursive:true});
  mkdirSync(join(cwd, 'src'), {recursive:true});
  writeFileSync(join(cwd,policyPath), JSON.stringify(policy));
  writeFileSync(join(cwd, 'src', 'example.ts'), 'export {};');
  return {cwd,close:()=>rmSync(cwd,{recursive:true,force:true})};
}
async function loadExtension() {
  const raw = readFileSync(extension, 'utf8');
  const target = pathToFileURL(join(root,'.pi/policies/approval-policy.mjs')).href;
  const fixed = raw.replace("from '../policies/approval-policy.mjs'", `from '${target}'`);
  assert.notEqual(raw, fixed);
  const js = stripTypeScriptTypes(fixed, {mode:'strip'});
  return await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {default: factory} = await loadExtension();
function handler() {
  const hooks = new Map();
  factory({on(event,callback){hooks.set(event,callback);}});
  assert.deepEqual([...hooks.keys()], ['tool_call']);
  return hooks.get('tool_call');
}
const event = (toolName, input = {})=>({toolName,input,toolCallId:'call-001'});

// Pruebas unitarias del contrato y precedencia.
test('política válida fija reglas mínimas y listas aditivas',()=>{
  const p = parsePolicy({version:1,bash:'deny',denyTools:['read'],askTools:['extra_tool']});
  assert.equal(decideToolCall('.', 'read',{path:'foo'},p).action,'deny');
  assert.equal(decideToolCall('.', 'extra_tool',{},p).action,'ask');
  assert.equal(decideToolCall('.', 'unknown',{},p).action,'deny');
});
test('políticas incompletas, débiles o desconocidas fallan',()=>{
  for (const value of [null,{}, {version:2,bash:'deny',denyTools:[],askTools:[]},
    {version:1,bash:'allow',denyTools:[],askTools:[]},
    {version:1,bash:'deny',denyTools:[],askTools:['write']},
    {version:1,bash:'deny',denyTools:[],askTools:[],unknown:'yes'}]) {
    assert.throws(()=>parsePolicy(value));
  }
});
test('herramientas conocidas de lectura permitidas, unknown negada y bash denegado',()=>{
  const w=sandbox();try{
    for(const name of ['read','ls','find','grep','lab_workspace_report']){
      assert.equal(decideToolCall(w.cwd,name,{},DEFAULT).action,'allow');
    }
    assert.equal(decideToolCall(w.cwd,'git_push',{},DEFAULT).action,'deny');
    assert.equal(decideToolCall(w.cwd,'bash',{command:'echo hola'},DEFAULT).action,'deny');
  }finally{w.close();}
});
test('write/edit exigen aprobación para rutas permitidas',()=>{
  const w=sandbox();try{
    for(const name of ['write','edit']){
      const result=decideToolCall(w.cwd,name,{path:'src/example.ts'},DEFAULT);
      assert.equal(result.action,'ask');assert.equal(result.target,'src/example.ts');
    }
  }finally{w.close();}
});
test('write/edit rechazan rutas fuera del workspace y rutas protegidas',()=>{
  const w=sandbox();try{
    for(const path of ['../evil.txt','/etc/passwd','.git/config','.pi/extensions/approval-guard.ts','.agents/a','node_modules/pkg/x','dist/file.js','.env','.env.local','src/.env.secret','']){
      assert.equal(decideToolCall(w.cwd,'write',{path},DEFAULT).action,'deny',path);
    }
    assert.equal(decideToolCall(w.cwd,'edit',{},DEFAULT).action,'deny');
    assert.equal(validateWritePath(w.cwd,'C:\\Windows\\System32\\drivers\\etc\\hosts').ok,false);
  }finally{w.close();}
});
test('bloquea enlaces simbólicos en el destino y en carpetas intermedias',()=>{
  const w=sandbox();try{
    const elsewhere=mkdtempSync(join(tmpdir(),'labguard-other-'));
    try {
      try {symlinkSync(elsewhere,join(w.cwd,'link'),'dir');symlinkSync(join(w.cwd,'src/example.ts'),join(w.cwd,'src/link.ts'));}
      catch {return; /* Windows puede requerir privilegios */}
      assert.equal(validateWritePath(w.cwd,'link/new.txt').ok,false);
      assert.equal(validateWritePath(w.cwd,'src/link.ts').ok,false);
    }finally{rmSync(elsewhere,{recursive:true,force:true});}
  }finally{w.close();}
});
test('política ausente mantiene defaults restrictivos; inválida hace fallar carga',()=>{
  const w=sandbox();try{
    rmSync(join(w.cwd,policyPath));
    assert.equal(loadPolicy(w.cwd).bash,'deny');
    writeFileSync(join(w.cwd,policyPath),'not-json');
    assert.throws(()=>loadPolicy(w.cwd),/Política inválida/);
  }finally{w.close();}
});
test('guard aprueba lectura sin consultar UI',async()=>{
  const w=sandbox();try{
    let dialogs=0;
    const result=await handler()(event('read',{path:'src/example.ts'}),{cwd:w.cwd,hasUI:true,ui:{confirm(){dialogs++;return true;}}});
    assert.equal(result,undefined);assert.equal(dialogs,0);
  }finally{w.close();}
});
test('guard bloquea cambios sin UI en print/JSON',async()=>{
  const w=sandbox();try{
    const result=await handler()(event('write',{path:'src/example.ts'}),{cwd:w.cwd,hasUI:false});
    assert.equal(result.block,true);assert.equal(result.terminate,true);
    assert.match(result.reason,/aprobación humana/);
  }finally{w.close();}
});
test('guard permite un cambio sólo cuando confirm devuelve true',async()=>{
  const w=sandbox();try{
    let question;
    const result=await handler()(event('edit',{path:'src/example.ts'}),{cwd:w.cwd,hasUI:true,ui:{confirm:async (...args)=>{question=args;return true;}}});
    assert.equal(result,undefined);assert.match(question[0],/edit/);assert.match(question[1],/src\/example.ts/);
  }finally{w.close();}
});
test('guard bloquea cuando usuario rechaza o no responde',async()=>{
  const w=sandbox();try{
    for(const answer of [false,undefined,null]){
      const result=await handler()(event('write',{path:'src/example.ts'}),{cwd:w.cwd,hasUI:true,ui:{confirm:async()=>answer}});
      assert.equal(result.block,true);
    }
  }finally{w.close();}
});
test('guard falla cerrado si hay error de diálogo',async()=>{
  const w=sandbox();try{
    const result=await handler()(event('write',{path:'src/example.ts'}),{cwd:w.cwd,hasUI:true,ui:{confirm:async()=>{throw new Error('rpc timeout');}}});
    assert.equal(result.block,true);
  }finally{w.close();}
});
test('guard nunca muestra aprobación de rutas protegidas',async()=>{
  const w=sandbox();try{
    let called=false;
    const result=await handler()(event('write',{path:'.pi/policies/tool-approvals.json'}),{cwd:w.cwd,hasUI:true,ui:{confirm:()=>{called=true;return true;}}});
    assert.equal(result.block,true);assert.equal(called,false);
  }finally{w.close();}
});
test('guard con configuración inválida bloquea incluso una lectura',async()=>{
  const w=sandbox();try{
    writeFileSync(join(w.cwd,policyPath),'{}');
    const result=await handler()(event('read',{path:'src/example.ts'}),{cwd:w.cwd,hasUI:true,ui:{confirm:()=>true}});
    assert.equal(result.block,true);assert.match(result.reason,/Política/);
  }finally{w.close();}
});
test('bash optativo requiere confirmación y muestra comando completo',async()=>{
  const w=sandbox({version:1,bash:'ask',denyTools:[],askTools:[]});try{
    let shown='';
    const result=await handler()(event('bash',{command:'npm test && echo done'}),{cwd:w.cwd,hasUI:true,ui:{confirm:(_a,b)=>{shown=b;return true;}}});
    assert.equal(result,undefined);assert.match(shown,/npm test && echo done/);
    assert.equal((await handler()(event('bash',{command:'npm test'}),{cwd:w.cwd,hasUI:false})).block,true);
  }finally{w.close();}
});
test('bash demasiado largo es rechazado aun con confirmador',async()=>{
  const w=sandbox({version:1,bash:'ask',denyTools:[],askTools:[]});try{
    let called=false;
    const result=await handler()(event('bash',{command:'x'.repeat(1201)}),{cwd:w.cwd,hasUI:true,ui:{confirm:()=>{called=true;return true;}}});
    assert.equal(result.block,true);assert.equal(called,false);
  }finally{w.close();}
});
test('dry-run integra extensión y herramientas de cambio sin tocar runtime de Windows',()=>{
  const prompt='Crea un archivo & echo NO_EJECUTAR | más';
  const r=spawnSync(process.execPath,[entry,'run',prompt,'--config',config,'--extension',extension,'--dry-run'],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const parsed=JSON.parse(r.stdout);const args=parsed.args;
  assert.ok(args.includes('--no-extensions'));
  assert.equal(args[args.indexOf('--extension')+1],extension);
  assert.deepEqual(args.slice(args.indexOf('--tools')+1,args.indexOf('--tools')+2),['read,ls,find,grep,write,edit']);
  assert.equal(args.at(-1),prompt);
});
