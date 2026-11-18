import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { getStory } from '../examples/mcp/stories.mjs';
import { parsePolicy, decideToolCall } from '../.pi/policies/approval-policy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=fileURLToPath(new URL('../examples/mcp/server.mjs',import.meta.url));
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const name='mcp__lab_stories__get_story';
const req=(id,method,params)=>({jsonrpc:'2.0',id,method,...(params?{params}:{})});
const init=(v='2025-11-25')=>req(1,'initialize',{protocolVersion:v,capabilities:{},clientInfo:{name:'lab-test',version:'1'}});
const ready={jsonrpc:'2.0',method:'notifications/initialized'};
const call=(id,args)=>req(id,'tools/call',{name:'get_story',arguments:args});
function run(input){
  const r=spawnSync(process.execPath,[server],{cwd:root,input:input.map(i=>typeof i==='string'?i:JSON.stringify(i)).join('\n')+'\n',encoding:'utf8',timeout:5000,shell:false});
  assert.ifError(r.error);assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');
  return r.stdout.trim().split('\n').filter(Boolean).map(JSON.parse);
}
const base={version:1,bash:'deny',denyTools:[],askTools:[]};
const action=(p,n)=>decideToolCall(root,n,{},parsePolicy(p)).action;
test('MCP: handshake, notification sin respuesta, discovery, call y cierre por EOF',()=>{
  const result=run([init(),ready,req(2,'tools/list'),call(3,{id:'US-101'})]);
  assert.deepEqual(result.map(r=>r.id),[1,2,3]);assert.equal(result[0].result.protocolVersion,'2025-11-25');
  assert.equal(result[1].result.tools[0].name,'get_story');assert.equal(result[2].result.structuredContent.id,'US-101');
  assert.equal(JSON.parse(result[2].result.content[0].text).state,'Ready');
});
test('MCP: herramientas requieren inicialización',()=>assert.equal(run([req(2,'tools/list')])[0].error.code,-32000));
test('MCP: negociación clásica y resultado compatible con 2025-03-26',()=>{
  const r=run([init('2025-03-26'),ready,call(2,{id:'US-101'})]);assert.equal(r[0].result.protocolVersion,'2025-03-26');assert.equal(r[1].result.structuredContent,undefined);assert.equal(JSON.parse(r[1].result.content[0].text).id,'US-101');
});
test('MCP: revisión desconocida negocia la versión soportada',()=>assert.equal(run([init('2099-01-01')])[0].result.protocolVersion,'2025-11-25'));
test('MCP: JSON malformado, método desconocido y herramienta desconocida',()=>{
  const r=run(['{bad',init(),ready,req(2,'bogus'),req(3,'tools/call',{name:'delete_story'})]);assert.equal(r[0].error.code,-32700);assert.equal(r[2].error.code,-32601);assert.equal(r[3].error.code,-32602);
});
test('MCP: error de dominio no es error JSON-RPC',()=>{
  const r=run([init(),ready,call(2,{id:'US-999'})])[1];assert.equal(r.error,undefined);assert.equal(r.result.isError,true);
});
test('MCP: valida argumentos y no acepta datos adicionales',()=>{
  for(const input of [null,[],{}, {id:'../../.env'}, {id:'US-101',path:'.env'},{id:101}])assert.equal(getStory(input).isError,true);
  assert.equal(getStory({id:'US-102'}).structuredContent.priority,1);
});
test('MCP: guard por defecto bloquea y opt-in sólo permite nombre exacto',()=>{
  assert.equal(action(base,name),'deny');const opts={...base,allowMcpTools:[name]};assert.equal(action(opts,name),'allow');assert.equal(action(opts,'mcp__other__get_story'),'deny');assert.equal(action(opts,'bash'),'deny');
});
test('MCP: deny y ask tienen precedencia sobre opt-in',()=>{
  const opts={...base,allowMcpTools:[name]};assert.equal(action({...opts,denyTools:[name]},name),'deny');assert.equal(action({...opts,askTools:[name]},name),'ask');
});
test('MCP: política rechaza comodines y herramientas no MCP',()=>{
  for(const n of ['mcp__lab_stories__*','bash','mcp__foo'])assert.throws(()=>parsePolicy({...base,allowMcpTools:[n]}));
});
test('MCP: configuración de prueba no activa MCP en defaults, restringe nombres exactos',()=>{
  const dry=(extra)=>{const r=spawnSync(process.execPath,[cli,'run','demo','--dry-run',...extra],{cwd:root,encoding:'utf8',timeout:5000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout).args;};
  assert.ok(dry([]).includes('--no-mcp'));
  const args=dry(['--config','examples/config/harness.mcp.example.json','--extension','.pi/extensions/approval-guard.ts']);assert.ok(!args.includes('--no-mcp'));assert.ok(!args.includes('--no-extensions'));assert.equal(args[args.indexOf('--tools')+1],name);assert.ok(args.includes('--extension'));
  const file=JSON.parse(readFileSync(new URL('../examples/mcp/mcp.example.json',import.meta.url)));assert.equal(file.mcpServers.lab_stories.command,'node');assert.equal(file.mcpServers.lab_stories.exposure,'direct');
});
