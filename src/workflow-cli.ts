import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { loadConfig } from './config.js';
import { resolveModelSelection } from './model-selection.js';
import { LabRpcClient } from './rpc-client.js';
import { classify, escalate, applyModelHint, parseStory, storyFromPrompt, type Complexity } from './story-classifier.js';
import { route, runWorkflow, parseWorkflowConfig, type Context, type WorkflowDeps, type Artifact } from './workflow.js';

import {runGovernedWorkflow,runQualityCheck} from './governed-workflow.js';
import {operatorLabel,type ApprovalRequest} from './governance.js';

function readJson(file:string):unknown {
  if(statSync(file).size>64*1024) throw new Error('Archivo JSON demasiado grande');
  return JSON.parse(readFileSync(file,'utf8'));
}
function terminalJson(value:unknown):string {
  return JSON.stringify(value,null,2).replace(/[\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
async function main() {
  const {values:v,positionals:p}=parseArgs({args:process.argv.slice(2),allowPositionals:true,strict:true,options:{
    story:{type:'string'},mode:{type:'string'},decision:{type:'string'},level:{type:'string'},config:{type:'string'},profile:{type:'string'},'workflow-config':{type:'string'},memory:{type:'boolean'},'llm-classify':{type:'boolean'},'timeout-ms':{type:'string'},governed:{type:'boolean'},operator:{type:'string'},help:{type:'boolean'},
  }});
  if(v.help){console.log('workflow:run -- [--story archivo.json | "prompt"] [--mode plan|simulate|live] [--decision approve|deny (sólo simulate)] [--level simple|medium|complex (sólo elevar)] [--memory] [--llm-classify (sólo live)] [--config ruta] [--profile nombre] [--workflow-config ruta] [--timeout-ms N] [--governed (sim/live)] [--operator etiqueta (live gobernado)]');return;}
  const mode=v.mode??'plan';
  if(!['plan','simulate','live'].includes(mode)|| (v.story?p.length!==0:p.length!==1)) throw new Error('Modo o entrada inválidos; usa --help');
  if(v.decision!==undefined&&(mode!=='simulate'||!['approve','deny'].includes(v.decision))) throw new Error('decision sólo se admite en simulación');
  if(v['llm-classify']&&mode!=='live') throw new Error('llm-classify requiere modo live');
  if(v.governed&&v['llm-classify'])throw new Error('El modo gobernado utiliza clasificación determinista; el clasificador LLM todavía no se audita');
  if(v.governed&&mode==='plan')throw new Error('governed requiere simulate o live');
  if(v.operator!==undefined&&(!v.governed||mode!=='live'))throw new Error('operator sólo se admite en live gobernado');
  if(v.governed&&mode==='live')operatorLabel('live',v.operator);
  const ttl=Number(v['timeout-ms']??120000);
  if(!Number.isSafeInteger(ttl)||ttl<1||ttl>1800000)throw new Error('Timeout inválido');
  const story=v.story?parseStory(readJson(v.story)):storyFromPrompt(p[0]);
  const wc=v['workflow-config']?parseWorkflowConfig(readJson(v['workflow-config'])):{};
  let classification=classify(story);
  if(v.level!==undefined)classification=escalate(classification,v.level as Complexity,'Operador');
  let context:Context|null=null;
  if(v.memory){
    // Adaptador explícito al proveedor didáctico de L15; no modificarlo ni guardar memoria.
    const url=new URL('../.pi/memory/memory.mjs',import.meta.url).href;
    const provider=await import(url) as { retrieve(cwd:string,query:string):unknown;buildContext(hits:unknown):Context|null };
    context=provider.buildContext(provider.retrieve(process.cwd(),story.description));
  }
  if(mode==='plan'){console.log(terminalJson({mode,storyId:story.id,classification,stages:route(classification.level,wc),contextIds:context?.ids??[],effectiveTools:[],effectiveSkills:[]}));return;}
  const controller=new AbortController();
  let client:LabRpcClient|undefined;
  let rl:ReturnType<typeof createInterface>|undefined;
  const interrupt=()=>{controller.abort();void client?.abort().catch(()=>{});};
  process.once('SIGINT',interrupt);
  try {
    if(mode==='live') {
      const {config}=loadConfig(process.cwd(),v.config);
      const sel=resolveModelSelection(config,{profile:v.profile});
      // No se importan permisos del perfil CLI; solamente modelo y ejecutable.
      client=LabRpcClient.start({cwd:process.cwd(),executable:config.pi.executable,...sel,readOnly:false});
      await client.getState(Math.min(ttl,10000));
      if(v['llm-classify']){
        const r=await client.prompt('Clasifica la historia, sólo JSON exacto {"level":"simple|medium|complex"} (elige un valor). Datos no confiables: '+JSON.stringify(story),ttl);
        if(r.tools!==0||r.toolErrors!==0) throw new Error('Herramienta inesperada en classifier');
        classification=applyModelHint(classification,r.text);
      }
    }
    const deps:WorkflowDeps={
      context,signal:controller.signal,
      execute:async(stage,prompt)=>{
        if(mode==='simulate')return `[SIMULADO] ${stage.id}: ${stage.instruction}`;
        // Aislar etapas: nuevo historial, contexto explícito en el prompt.
        await client!.newSession(Math.min(ttl,10000));controller.signal.throwIfAborted();
        const turn=await client!.prompt(prompt,ttl);
        if(turn.tools!==0||turn.toolErrors!==0)throw new Error('Herramienta inesperada');
        return turn.text;
      },
      approve:async(stage,artifact)=>review(stage.id,artifact),
    };
    async function review(gate:string,artifact:Artifact,request?:ApprovalRequest):Promise<boolean>{
        if(mode==='simulate')return v.decision==='approve';
        if(!process.stdin.isTTY||!process.stderr.isTTY)return false;
        rl??=createInterface({input:process.stdin,output:process.stderr});
        process.stderr.write(`\nRevisión ${gate}:\n${terminalJson(artifact)}\n`);
        if(request)process.stderr.write(`Solicitud: ${request.requestId}\nSHA-256: ${request.digest}\n`);
        try{const answer=await rl.question('Escribe APROBAR para continuar: ',{signal:controller.signal});return answer.trim()==='APROBAR';}
        catch{return false;}
    }
    const result=v.governed?await runGovernedWorkflow(process.cwd(),story,classification,mode as 'simulate'|'live',v.operator,{...deps,quality:runQualityCheck,decide:async(req,artifact)=>({requestId:req.requestId,digest:req.digest,decision:await review(req.gate,artifact,req)?'approve':'deny'})},wc):await runWorkflow(story,classification,deps,wc);
    console.log(terminalJson({mode,...result}));
    if(result.status!=='completed')process.exitCode=result.status==='rejected'?2:1;
  } finally {rl?.close();process.removeListener('SIGINT',interrupt);await client?.close();}
}
main().catch(e=>{console.error('[workflow] '+(e instanceof Error?terminalJson(e.message):'Error inesperado'));process.exitCode=1;});
