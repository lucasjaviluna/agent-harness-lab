import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listStories } from '../examples/mcp/stories.mjs';
test('listStories filtra y devuelve solamente resumen',()=>{const r=listStories({state:'Ready'});assert.deepEqual(r.structuredContent.stories,[{id:'US-101',title:'Agregar perfil de ejecución',state:'Ready'}]);});
test('listStories valida parámetros',()=>{for (const args of [{},{state:'Unknown'},{state:'Ready',extra:true},null])assert.equal(listStories(args).isError,true);});
test('discovery y call de las dos herramientas con protocolo real por stdio',()=>{
 const requests=[{id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}},{method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'list_stories',arguments:{state:'Active'}}}];
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../examples/mcp/server.mjs',import.meta.url))],{input:requests.map(i=>JSON.stringify({jsonrpc:'2.0',...i})).join('\n')+'\n',encoding:'utf8',timeout:5000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);const data=r.stdout.trim().split('\n').map(JSON.parse);assert.deepEqual(data[1].result.tools.map(t=>t.name),['get_story','list_stories']);assert.equal(data[2].result.structuredContent.stories[0].id,'US-102');
});
