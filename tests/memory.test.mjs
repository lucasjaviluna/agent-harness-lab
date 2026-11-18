import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import { buildContext, candidate, rank, readLocal, remember, retrieve, MAX_CONTEXT_BYTES, MAX_RECORDS } from '../.pi/memory/memory.mjs';
import { decideToolCall, parsePolicy } from '../.pi/policies/approval-policy.mjs';
const root = fileURLToPath(new URL('..',import.meta.url));
function workspace(t){const cwd=mkdtempSync(join(tmpdir(),'agent-lab-memory-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));return cwd;}
const rec=(id,text)=>({id,source:'lab:test',text});
const fixtureText='En Atlas usamos CQRS para separar consultas y comandos.';
const ext=readFileSync(join(root,'.pi/extensions/memory-context.ts'),'utf8').replace("from '../memory/memory.mjs'",`from '${pathToFileURL(join(root,'.pi/memory/memory.mjs')).href}'`);
const {default:factory}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(ext,{mode:'strip'})).toString('base64'));
function hooks({read=true,write=false}={}){
  const old=[process.env.AGENT_LAB_MEMORY,process.env.AGENT_LAB_MEMORY_WRITE];
  process.env.AGENT_LAB_MEMORY=read?'1':'0';process.env.AGENT_LAB_MEMORY_WRITE=write?'1':'0';
  const h=new Map();try{factory({on(name,fn){h.set(name,fn);}});}finally{for(const [i,key] of ['AGENT_LAB_MEMORY','AGENT_LAB_MEMORY_WRITE'].entries()){if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}}
  return h;
}
function start(h,cwd,prompt,extra={}){return h.get('before_agent_start')({messageType:'user',prompt,...extra},{cwd});}
function settle(h,cwd,{outcome='completed',aborted=false}={}){h.get('agent_before_settle')({outcome},{cwd});h.get('agent_settled')({aborted},{cwd});}
test('rank lexical: normaliza acentos, deduplica términos y desempata por id',()=>{
  const rows=[rec('b','MCP conexiones'),rec('a','MCP conexiones'),rec('c','MCP')];
  assert.deepEqual(rank('¿MCP conexiónes MCP?',rows).map(x=>[x.id,x.score]),[['a',1],['b',1],['c',0.5]]);
});
test('rank omite irrelevantes y restringe top-k',()=>{
  assert.equal(rank('MCP',[rec('other','CQRS'),{id:42,source:'lab:test',text:'MCP'}]).length,0);
  assert.deepEqual(rank('que la de', [rec('a','que')]),[]);
  assert.equal(rank('MCP',Array.from({length:7},(_,i)=>rec(`r-${i}`,'MCP'))).length,3);
});
test('contexto tiene fuentes, advertencia y presupuesto UTF-8',()=>{
  const hits=[rec('a','🧠'.repeat(200)),rec('b','á'.repeat(400)),rec('c','MCP')];
  const c=buildContext(hits,400);
  assert.deepEqual(c.ids,['c']);assert.match(c.content,/datos no confiables/);assert.match(c.content,/lab:test/);assert.ok(Buffer.byteLength(c.content)<=400);
  assert.equal(buildContext(hits,10),null);assert.throws(()=>buildContext(hits,MAX_CONTEXT_BYTES+1));
});
test('búsqueda consulta semilla sin crear estado',t=>{
  const cwd=workspace(t);assert.equal(retrieve(cwd,'CQRS')[0].id,'doc-cqrs');assert.equal(existsSync(join(cwd,'.lab-memory')),false);
});
test('marcador explícito y filtros conservadores',()=>{
  assert.equal(candidate('RECORDAR: '+fixtureText),fixtureText);
  for(const x of [fixtureText,'RECORDAR: breve','RECORDAR: contraseña supersecreta','RECORDAR: token abcdefgh','RECORDAR: primera línea\nsegunda línea','RECORDAR: '+fixtureText+'\n','RECORDAR: contacto user@example.com','RECORDAR: '+ 'a'.repeat(401)])assert.equal(candidate(x),null,x);
});
test('persistencia local, deduplicación y aislamiento entre workspaces',t=>{
  const a=workspace(t),b=workspace(t);const result=remember(a,fixtureText);assert.equal(result.status,'stored');
  assert.equal(remember(a,fixtureText.toUpperCase()).status,'duplicate');assert.equal(readLocal(a).length,1);assert.deepEqual(readLocal(b),[]);
  assert.ok(retrieve(a,'Atlas').some(x=>x.id===result.id));assert.equal(retrieve(b,'Atlas').length,0);
});
test('rechaza candidatos sensibles y corrupción sin sobrescribir datos',t=>{
  const cwd=workspace(t);assert.throws(()=>remember(cwd,'password de la app abc123'));
  mkdirSync(join(cwd,'.lab-memory'));const file=join(cwd,'.lab-memory','records.json');writeFileSync(file,'{corrupt');
  assert.throws(()=>readLocal(cwd));assert.throws(()=>remember(cwd,fixtureText));assert.equal(readFileSync(file,'utf8'),'{corrupt');
});
test('capacidad máxima no descarta entradas sin autorización',t=>{
  const cwd=workspace(t);mkdirSync(join(cwd,'.lab-memory'));const records=Array.from({length:MAX_RECORDS},(_,i)=>rec('mem-'+i,'Decisión ficticia '+i));
  writeFileSync(join(cwd,'.lab-memory','records.json'),JSON.stringify(records));assert.throws(()=>remember(cwd,fixtureText),/Capacidad/);assert.equal(readLocal(cwd).length,MAX_RECORDS);
});
test('rechaza un destino que no es archivo regular',t=>{
  const cwd=workspace(t);mkdirSync(join(cwd,'.lab-memory','records.json'),{recursive:true});assert.throws(()=>remember(cwd,fixtureText));
});
test('rechaza directorio de memoria enlazado',t=>{
  const cwd=workspace(t),target=workspace(t);symlinkSync(target,join(cwd,'.lab-memory'),process.platform==='win32'?'junction':'dir');assert.throws(()=>remember(cwd,fixtureText));assert.deepEqual(readLocal(target),[]);
});
test('extensión desactivada salvo opt-in explícito',()=>{assert.equal(hooks({read:false,write:true}).size,0);});
test('recuperación automática entrega mensaje con procedencia y no crea registros',t=>{
  const cwd=workspace(t),h=hooks();const x=start(h,cwd,'Explícame CQRS');assert.equal(x.message.customType,'lab-memory-context');assert.equal(x.message.display,true);assert.deepEqual(x.message.details.ids,['doc-cqrs']);assert.equal(existsSync(join(cwd,'.lab-memory')),false);
});
test('modo lectura no persiste ni siquiera con marcador',t=>{const cwd=workspace(t),h=hooks();start(h,cwd,'RECORDAR: '+fixtureText);settle(h,cwd);assert.deepEqual(readLocal(cwd),[]);});
test('escritura opt-in ocurre tras asentamiento completado una sola vez',t=>{const cwd=workspace(t),h=hooks({write:true});start(h,cwd,'RECORDAR: '+fixtureText);h.get('agent_before_settle')({outcome:'completed'},{cwd});assert.deepEqual(readLocal(cwd),[]);h.get('agent_settled')({aborted:false},{cwd});assert.equal(readLocal(cwd).length,1);h.get('agent_settled')({aborted:false},{cwd});assert.equal(readLocal(cwd).length,1);});
test('aborto, error, cambio de sesión e imágenes no guardan',t=>{
  const cwd=workspace(t),h=hooks({write:true});for(const end of [{outcome:'error'},{aborted:true}]){start(h,cwd,'RECORDAR: '+fixtureText);settle(h,cwd,end);}start(h,cwd,'RECORDAR: '+fixtureText);h.get('session_start')({}, {cwd});settle(h,cwd);start(h,cwd,'RECORDAR: '+fixtureText,{images:[{}]});settle(h,cwd);assert.deepEqual(readLocal(cwd),[]);
});
test('un nuevo agent_start invalida resultado anterior; prompts custom no capturan',t=>{const cwd=workspace(t),h=hooks({write:true});start(h,cwd,'RECORDAR: '+fixtureText);h.get('agent_before_settle')({outcome:'completed'},{cwd});h.get('agent_start')({}, {cwd});h.get('agent_settled')({aborted:false},{cwd});start(h,cwd,'RECORDAR: '+fixtureText,{messageType:'custom'});settle(h,cwd);assert.deepEqual(readLocal(cwd),[]);});
test('falla de memoria no impide la tarea ni expone contenido corrupto',t=>{const cwd=workspace(t),h=hooks();mkdirSync(join(cwd,'.lab-memory'));writeFileSync(join(cwd,'.lab-memory','records.json'),'bad');assert.equal(start(h,cwd,'CQRS'),undefined);});
test('guard bloquea modificaciones directas a la memoria',t=>{const cwd=workspace(t),p=parsePolicy({version:1,bash:'deny',denyTools:[],askTools:[]});for(const name of ['edit','write'])assert.equal(decideToolCall(cwd,name,{path:'.lab-memory/records.json'},p).action,'deny');});
test('CLI dry-run: extensión explícita, MCP y descubrimiento apagados',()=>{
 const r=spawnSync(process.execPath,[join(root,'dist/cli.js'),'run','CQRS','--config','examples/config/harness.memory.example.json','--extension','.pi/extensions/memory-context.ts','--extension','.pi/extensions/approval-guard.ts','--dry-run'],{cwd:root,encoding:'utf-8'});
 assert.equal(r.status,0,r.stderr);const {args}=JSON.parse(r.stdout);for(const flag of ['--no-mcp','--no-extensions','--no-session'])assert.ok(args.includes(flag),flag);assert.ok(args.some(x=>x.endsWith('memory-context.ts')));assert.equal(args[args.indexOf('--tools')+1],'read,ls,find,grep');
});
