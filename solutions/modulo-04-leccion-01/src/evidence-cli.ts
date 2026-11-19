import {verifyEvidence} from './evidence.js';
import {verifyAnchoredEvidence} from './evidence-anchor.js';
try{
  const args=process.argv.slice(2);
  if(args.length!==1&&!(args.length===3&&args[1]==='--expected-head'))throw new Error('Uso: evidence:verify -- <runId> [--expected-head SHA256]');
  const report=args.length===3?verifyAnchoredEvidence(process.cwd(),args[0],args[2]):verifyEvidence(process.cwd(),args[0]);
  console.log(JSON.stringify(report,null,2));
}catch{console.error('[evidence] Evidencia inválida, incompleta, inaccesible o distinta del ancla');process.exitCode=1;}
