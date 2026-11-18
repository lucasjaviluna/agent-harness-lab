import { buildContext, retrieve } from '../../.pi/memory/memory.mjs';
const query=process.argv.slice(2).join(' ').trim();
if(!query){console.error('Uso: npm run memory:search -- "consulta"');process.exitCode=1;}
else {try{const hits=retrieve(process.cwd(),query);const ctx=buildContext(hits);console.log(JSON.stringify({hits: hits.map(({id,source,score})=>({id,source,score})),context:ctx},null,2));}catch{console.error('Memoria local no disponible');process.exitCode=1;}}
