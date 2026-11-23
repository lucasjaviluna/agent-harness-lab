import {parseArgs} from 'node:util';
import {readFileSync,statSync} from 'node:fs';
import {loadConfig} from './config.js';
import {resolveModelSelection} from './model-selection.js';
import {classify,parseStory,storyFromPrompt} from './story-classifier.js';
import {agentPlan,runTeam,rpcAgentExecutor,validateConcurrency,type AgentExecutor} from './multi-agent.js';
const json=(value:unknown)=>JSON.stringify(value,null,2).replace(/[\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
async function main(){
 const {values:v,positionals:p}=parseArgs({args:process.argv.slice(2),strict:true,allowPositionals:true,options:{story:{type:'string'},mode:{type:'string'},concurrency:{type:'string'},'timeout-ms':{type:'string'},config:{type:'string'},profile:{type:'string'},help:{type:'boolean'}}});
 if(v.help){console.log('team:run -- [--story archivo.json | "prompt"] [--mode plan|simulate|live] [--concurrency 1|2] [--timeout-ms N] [--config ruta] [--profile nombre]');return;}
 const mode=v.mode??'plan',concurrency=Number(v.concurrency??2),timeoutMs=Number(v['timeout-ms']??120000);validateConcurrency(concurrency);
 if(!['plan','simulate','live'].includes(mode)||(v.story?p.length!==0:p.length!==1)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>1800000)throw new Error('Argumentos inválidos');
 if(mode!=='live'&&(v.config!==undefined||v.profile!==undefined))throw new Error('config y profile sólo se admiten en live');
 let story;if(v.story){if(statSync(v.story).size>65536)throw new Error('Historia demasiado grande');story=parseStory(JSON.parse(readFileSync(v.story,'utf8')));}else story=storyFromPrompt(p[0]);
 if(mode==='plan'){console.log(json({mode,storyId:story.id,classification:classify(story),concurrency,agents:agentPlan(story),effectiveTools:[]}));return;}
 let execute:AgentExecutor=async(agent)=>({text:`[SIMULADO] ${agent.role}: ${agent.instruction}`,events:0,tools:0,toolErrors:0});
 if(mode==='live'){const {config}=loadConfig(process.cwd(),v.config);const sel=resolveModelSelection(config,{profile:v.profile});execute=rpcAgentExecutor({cwd:process.cwd(),executable:config.pi.executable,...sel},timeoutMs);}
 const controller=new AbortController();const interrupt=()=>controller.abort();process.once('SIGINT',interrupt);
 try{const result=await runTeam(story,{concurrency,execute,signal:controller.signal});console.log(json({mode,...result}));if(result.status!=='completed')process.exitCode=result.status==='cancelled'?130:1;}
 finally{process.removeListener('SIGINT',interrupt);}
}
main().catch(()=>{console.error('[team] Argumentos o ejecución inválidos; consulta --help');process.exitCode=1;});
