/** L17: composición del motor L16, política, aprobaciones y calidad. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {runWorkflow,type WorkflowDeps,type WorkflowConfig,type Artifact,type WorkflowResult} from './workflow.js';
import {parseStory,type Story,type Classification} from './story-classifier.js';
import {EvidenceJournal} from './evidence.js';
import {approvalRequest,approvalAccepted,operatorLabel,validateExecution,sha256,POLICY,POLICY_HASH,type GovernedMode,type ApprovalRequest} from './governance.js';
export interface QualityResult {check:'workflow-regression';status:'passed'|'failed';exitCode:number|null;elapsedMs:number;outputHash:string;}
/** Ejecuta únicamente la suite fija de L16 del checkout confiable. No es un test del código propuesto. */
export function runQualityCheck():QualityResult {
  const cwd=fileURLToPath(new URL('../',import.meta.url));const test=fileURLToPath(new URL('../tests/workflow.test.mjs',import.meta.url));
  const start=performance.now();const r=spawnSync(process.execPath,['--test',test],{cwd,shell:false,timeout:20000,maxBuffer:1024*1024,windowsHide:true});
  return {check:'workflow-regression',status:!r.error&&r.status===0?'passed':'failed',exitCode:r.status,elapsedMs:Math.round(performance.now()-start),outputHash:sha256(JSON.stringify({stdout:r.stdout?.toString('base64')??'',stderr:r.stderr?.toString('base64')??''}))};
}
export interface GovernedDeps extends Omit<WorkflowDeps,'approve'> {
  decide(request:ApprovalRequest,artifact:Artifact):Promise<unknown>;
  quality():QualityResult;
}
export interface GovernedResult {runId:string;status:'completed'|'rejected'|'failed';workflow:WorkflowResult;quality:QualityResult|null;finalReview:'approved'|'rejected'|'skipped'|'failed';}
function validQuality(q:QualityResult):boolean{return !!q&&q.check==='workflow-regression'&&['passed','failed'].includes(q.status)&&Number.isSafeInteger(q.elapsedMs)&&q.elapsedMs>=0&&/^[a-f0-9]{64}$/.test(q.outputHash)&&(q.exitCode===null||Number.isInteger(q.exitCode))&&(q.status!=='passed'||q.exitCode===0);}
export async function runGovernedWorkflow(cwd:string,story:Story,classification:Classification,mode:GovernedMode,label:string|undefined,deps:GovernedDeps,config:WorkflowConfig={}):Promise<GovernedResult>{
  validateExecution(mode,mode==='live'?'rpc':'simulation',POLICY.tools);const operator=operatorLabel(mode,label);const s=parseStory(story);
  const journal=new EvidenceJournal(cwd);
  journal.append('run-started',{runId:journal.runId,mode,operator,identity:'declared-not-authenticated',storyId:s.id,storyHash:sha256(JSON.stringify(s)),policyHash:POLICY_HASH,policy:POLICY});
  async function ask(gate:string,artifact:Artifact):Promise<boolean>{
    const req=approvalRequest(journal.runId,gate,artifact.stage,artifact.text);
    journal.append('approval-requested',{...req});
    let yes=false;let decision='cancelled';
    try{deps.signal?.throwIfAborted();const receipt=await deps.decide({...req},{...artifact});deps.signal?.throwIfAborted();yes=approvalAccepted(req,receipt);decision=yes?'approved':'rejected';}
    finally{journal.append('approval-decided',{requestId:req.requestId,gate:req.gate,digest:req.digest,decision,operator,source:mode==='simulate'?'simulation':'operator'});}
    return yes;
  }
  const workflow=await runWorkflow(s,classification,{context:deps.context,signal:deps.signal,
    execute:async(stage,prompt)=>{journal.append('stage-started',{stage:stage.id});const text=await deps.execute(stage,prompt);deps.signal?.throwIfAborted();journal.artifact(stage.id,text);return text;},
    approve:(gate,artifact)=>ask(gate.id,artifact)
  },config);
  journal.append('workflow-result',{status:workflow.status,classification:workflow.classification.level,steps:workflow.steps,contextIds:workflow.contextIds});
  let status=workflow.status;let quality:QualityResult|null=null;let finalReview:GovernedResult['finalReview']='skipped';
  if(status==='completed'){
    try{
      deps.signal?.throwIfAborted();journal.append('quality-started',{check:POLICY.quality});
      const q=deps.quality();if(!validQuality(q))throw new Error('Evidencia de calidad inválida');quality=q;
      journal.append('quality-result',{...q,scope:'lab-workflow-regression-not-proposed-code'});
      if(q.status!=='passed') status='failed';
      else{const artifact=workflow.artifacts.find(x=>x.stage==='review');if(!artifact)throw new Error('Falta revisión');const yes=await ask('approve-review',artifact);finalReview=yes?'approved':'rejected';if(!yes)status='rejected';}
      deps.signal?.throwIfAborted();
    }catch{status='failed';if(finalReview==='skipped'&&quality?.status==='passed')finalReview='failed';journal.append('governance-failed',{reason:deps.signal?.aborted?'cancelled':'gate_or_quality_failed'});}
  }
  journal.append('run-finished',{status,finalReview,quality:quality?.status??'not-run'});
  return {runId:journal.runId,status,workflow,quality,finalReview};
}
