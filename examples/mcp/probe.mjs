// Prueba de conversación JSON-RPC sin modelo. Sólo para el servidor didáctico local.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const messages = [
  {id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'lab-probe',version:'1.0.0'}}},
  {method:'notifications/initialized'},
  {id:2,method:'tools/list'},
  {id:3,method:'tools/call',params:{name:'get_story',arguments:{id:'US-101'}}},
];
const input=messages.map(m=>JSON.stringify({jsonrpc:'2.0',...m})).join('\n')+'\n';
const result=spawnSync(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{input,encoding:'utf8',timeout:5000,shell:false});
if(result.error || result.status!==0) { console.error('Falló el servidor de ejemplo'); process.exitCode=1; }
else {
  const responses=result.stdout.trim().split('\n').map(JSON.parse);
  if(responses.length!==3 || responses.some(r=>r.error) || responses[2].result?.isError || responses[2].result?.structuredContent?.id!=='US-101') {console.error('Respuesta inesperada');process.exitCode=1;}
  else console.log(JSON.stringify(responses,null,2));
}
