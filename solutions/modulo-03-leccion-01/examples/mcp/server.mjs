// Adaptador didáctico del handshake MCP clásico. No es un SDK completo.
import { createInterface } from 'node:readline';
import { getStory, storyTool, listStories, listTool } from './stories.mjs';
const versions = new Set(['2025-11-25','2025-06-18','2025-03-26']);
let state = 'new';
let version;
const send = value => process.stdout.write(JSON.stringify(value)+'\n');
const fail = (id,code,message) => send({jsonrpc:'2.0',id,error:{code,message}});
const ok = (id,result) => send({jsonrpc:'2.0',id,result});
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const rl = createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});
for await (const line of rl) {
  if (Buffer.byteLength(line)>65536) { fail(null,-32600,'Request too large'); continue; }
  let msg;
  try { msg=JSON.parse(line); } catch { fail(null,-32700,'Parse error'); continue; }
  if (!object(msg) || msg.jsonrpc!=='2.0' || typeof msg.method!=='string' || (Object.hasOwn(msg,'id') && !(typeof msg.id==='string'||Number.isSafeInteger(msg.id)))) { fail(null,-32600,'Invalid request'); continue; }
  const {id,method,params}=msg;
  if (!Object.hasOwn(msg,'id')) {
    if (method==='notifications/initialized' && state==='initializing') state='ready';
    continue; // Las notificaciones no tienen respuesta.
  }
  if (method==='ping') { ok(id,{}); continue; }
  if (method==='initialize') {
    if (state!=='new' || !object(params) || typeof params.protocolVersion!=='string' || !object(params.capabilities) || !object(params.clientInfo)) { fail(id,-32602,'Invalid initialize'); continue; }
    version=versions.has(params.protocolVersion)?params.protocolVersion:'2025-11-25';
    state='initializing';
    ok(id,{protocolVersion:version,capabilities:{tools:{}},serverInfo:{name:'lab-stories',version:'0.12.0'}}); continue;
  }
  if (state!=='ready') { fail(id,-32000,'Server not initialized'); continue; }
  if (method==='tools/list') { ok(id,{tools:[storyTool,listTool]}); continue; }
  if (method==='tools/call') {
    if (!object(params) || ![storyTool.name,listTool.name].includes(params.name)) { fail(id,-32602,'Unknown tool'); continue; }
    const result=params.name===listTool.name?listStories(params.arguments):getStory(params.arguments);
    if (version==='2025-03-26') delete result.structuredContent; // anterior a structuredContent
    ok(id,result); continue;
  }
  fail(id,-32601,'Method not found');
}
