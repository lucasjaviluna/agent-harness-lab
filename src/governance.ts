/** L17: políticas y contratos de autorización, independientes del modelo. */
import { createHash, randomUUID } from 'node:crypto';
export const sha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const POLICY=Object.freeze({version:1, profile:'proposal-only', tools:Object.freeze([] as string[]), extensions:false, mcp:false, finalReview:true, quality:'workflow-regression'});
export const POLICY_HASH=sha256(JSON.stringify(POLICY));
export type GovernedMode='simulate'|'live';
export interface ApprovalRequest { requestId:string; runId:string; gate:string; artifactStage:string; digest:string; policyHash:string; }
export interface ApprovalReceipt { requestId:string; digest:string; decision:'approve'|'deny'; }
export function approvalRequest(runId:string,gate:string,stage:string,text:string):ApprovalRequest {
  return {requestId:randomUUID(),runId,gate,artifactStage:stage,digest:sha256(text),policyHash:POLICY_HASH};
}
export function approvalAccepted(request:ApprovalRequest,receipt:unknown):boolean {
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return false;
  const r=receipt as Record<string,unknown>;
  return Object.keys(r).length===3&&r.requestId===request.requestId&&r.digest===request.digest&&r.decision==='approve';
}
export function validateExecution(mode:GovernedMode,runtime:string,tools:readonly string[]):void {
  if(!((mode==='simulate'&&runtime==='simulation')||(mode==='live'&&runtime==='rpc'))||!Array.isArray(tools)||tools.length!==0)throw new Error('Ejecución no admitida por la política gobernada');
}
export function operatorLabel(mode:GovernedMode,label?:string):string {
  if(mode==='simulate')return 'simulation';
  if(typeof label!=='string'||!/^[-A-Za-z0-9_.@]{1,64}$/.test(label))throw new Error('Modo live gobernado requiere --operator (etiqueta declarada, no identidad autenticada)');
  return label;
}
