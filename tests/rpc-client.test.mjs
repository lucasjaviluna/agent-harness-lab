import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LabRpcClient, RpcFramer, buildRpcArgs } from '../dist/rpc-client.js';
import { parseRpcArgs } from '../dist/rpc-runner.js';
const fixture = fileURLToPath(new URL('./fixtures/fake-rpc.mjs', import.meta.url));
function client(t){ const c=new LabRpcClient(spawn(process.execPath,[fixture],{stdio:'pipe',shell:false})); t.after(()=>c.close()); return c; }
test('perfil cerrado y consulta optativa',()=>{
 const args=buildRpcArgs({executable:'pi',cwd:process.cwd()});
 assert.ok(args.includes('--no-tools'));assert.ok(args.includes('--no-mcp'));assert.ok(args.includes('--no-extensions'));
 assert.deepEqual(buildRpcArgs({executable:'pi',cwd:'.',readOnly:true,provider:'test',model:'model'}).slice(-6),['--tools','read,grep,find,ls','--provider','test','--model','model']);
});
test('parser de múltiples prompts y opciones',()=>{const o=parseRpcArgs(['--stream','--timeout-ms','1500','hola','otro']);assert.equal(o.timeoutMs,1500);assert.deepEqual(o.prompts,['hola','otro']);assert.equal(o.stream,true);assert.throws(()=>parseRpcArgs(['--timeout-ms','0','hola']));assert.throws(()=>parseRpcArgs(['/cmd']));});
test('JSONL mantiene unicode y bytes fragmentados, CRLF y múltiples registros',()=>{
 const f=new RpcFramer(), records=[];const b=Buffer.from('{"type":"x","text":"á🙂\u2028\u2029"}\r\n{"type":"y"}\n');for(const byte of b)f.push(Buffer.from([byte]),r=>records.push(r));f.finish();assert.deepEqual(records,[{type:'x',text:'á🙂\u2028\u2029'},{type:'y'}]);
});
test('framer rechaza registros parciales y no objetos',()=>{let f=new RpcFramer();f.push(Buffer.from('{"type":'),()=>{});assert.throws(()=>f.finish(),/INCOMPLETE/);f=new RpcFramer();assert.throws(()=>f.push(Buffer.from('[]\n'),()=>{}),/INVALID/);});
test('correlaciona respuestas en orden inverso',async t=>{const c=client(t);let order=[];const [state,messages]=await Promise.all([c.getState().then(x=>{order.push('state');return x;}),c.getMessages().then(x=>{order.push('messages');return x;})]);assert.deepEqual(order,['messages','state']);assert.equal(state.messageCount,0);assert.deepEqual(messages.messages,[]);});
test('varios prompts comparten sesión',async t=>{const c=client(t);assert.equal((await c.prompt('hola')).text,'hola');assert.equal((await c.prompt('remember')).text,'hola|remember');});
test('new_session limpia historial',async t=>{const c=client(t);await c.prompt('hola');await c.newSession();assert.equal((await c.prompt('remember')).text,'remember');});
test('agente se asienta antes del ACK',async t=>{const c=client(t);assert.equal((await c.prompt('early')).text,'early');});
test('agent_end no termina el prompt: espera recuperación y settled',async t=>{const c=client(t);assert.equal((await c.prompt('retry')).text,'recovered');});
test('handled no espera un asentamiento inexistente',async t=>{const c=client(t);await assert.rejects(c.prompt('handled'),/NOT_STARTED/);await assert.rejects(c.prompt('hola'),/NOT_STARTED/);});
test('rechazo de comando no expone mensaje del proveedor',async t=>{const c=client(t);await assert.rejects(c.prompt('reject'),e=>/COMMAND_REJECTED/.test(e.message)&&!e.message.includes('secret'));});
test('resultado de proveedor fallido no se presenta como éxito',async t=>{const c=client(t);await assert.rejects(c.prompt('error'),/INCOMPLETE_RUN/);});
test('cancelación de diálogos sin aprobación automática',async t=>{const c=client(t);assert.equal((await c.prompt('dialog')).text,'denied');});
test('métricas de herramientas incluyen fallos',async t=>{const c=client(t);const r=await c.prompt('tools');assert.equal(r.tools,1);assert.equal(r.toolErrors,1);});
test('bloquea segundo prompt mientras otro está activo y permite abortar',async t=>{const c=client(t);const run=c.prompt('slow');const checked=assert.rejects(run,/INCOMPLETE_RUN/);await assert.rejects(c.prompt('otro'),/BUSY/);await c.abort();await checked;});
test('timeout de prompt solicita abort y no reutiliza sesión',async t=>{const c=client(t);await c.getState();await assert.rejects(c.prompt('hang',100),/PROMPT_TIMEOUT/);await assert.rejects(c.getState(),/PROMPT_TIMEOUT/);});
test('JSON inválido y salida de proceso rechazan al solicitante',async t=>{const c=client(t);await assert.rejects(c.prompt('bad-json'),/PROTOCOL_ERROR/);const d=client(t);await assert.rejects(d.prompt('exit'),/PROCESS_EXIT/);});
test('rechaza respuesta no correlacionada',async t=>{const c=client(t);await assert.rejects(c.prompt('wrong-id'),/UNEXPECTED_RESPONSE/);});
test('close idempotente cancela solicitudes y no permite nuevas',async t=>{const c=client(t);const p=c.getState();const checked=assert.rejects(p,/CLOSED/);await Promise.all([c.close(),c.close()]);await checked;await assert.rejects(c.getState(),/CLOSED/);});
test('timeout de comando invalida el cliente',async t=>{const c=client(t);await assert.rejects(c.getState(1),/COMMAND_TIMEOUT/);await assert.rejects(c.getMessages(),/COMMAND_TIMEOUT/);});
test('fallo de inicio del proceso no deja una solicitud pendiente',async t=>{const c=new LabRpcClient(spawn('agent-lab-rpc-executable-does-not-exist-92e1',[],{stdio:'pipe',shell:false}));t.after(()=>c.close());await assert.rejects(c.getState(),/PROCESS_ERROR/);});
test('framer limita tamaño de registro',()=>{const f=new RpcFramer();assert.throws(()=>f.push(Buffer.alloc(16*1024*1024+1,65),()=>{}),/TOO_LARGE/);});
