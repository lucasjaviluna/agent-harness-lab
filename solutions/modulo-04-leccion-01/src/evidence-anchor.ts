import {verifyEvidence,type Verification} from './evidence.js';
/** El ancla debe venir de otro dominio de confianza, no del mismo diario. */
export function verifyAnchoredEvidence(cwd:string,runId:string,expectedHead:string):Verification & {anchorMatched:true}{
  if(typeof expectedHead!=='string'||!(/^[a-f0-9]{64}$/).test(expectedHead))throw new Error('Ancla SHA-256 inválida');
  const result=verifyEvidence(cwd,runId);
  if(result.head!==expectedHead)throw new Error('El diario no coincide con el ancla externa');
  return {...result,anchorMatched:true};
}
