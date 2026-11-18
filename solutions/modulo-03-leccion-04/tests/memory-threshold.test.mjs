import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rank,retrieve } from '../.pi/memory/memory.mjs';
const fixtures=[{id:'a',source:'lab:test',text:'CQRS MCP'},{id:'b',source:'lab:test',text:'CQRS'},{id:'c',source:'lab:test',text:'RAG'}];
test('minScore excluye coincidencias débiles y conserva igualdad',()=>{
 assert.deepEqual(rank('CQRS MCP',fixtures,{minScore:0.75}).map(x=>x.id),['a']);
 assert.deepEqual(rank('CQRS MCP',fixtures,{minScore:0.5}).map(x=>x.id),['a','b']);
});
test('minScore por defecto es compatible, jamás incluye score cero',()=>{
 assert.deepEqual(rank('CQRS MCP',fixtures),rank('CQRS MCP',fixtures,{minScore:0}));
 assert.deepEqual(rank('CQRS MCP',fixtures).map(x=>x.id),['a','b']);
});
test('minScore inválido falla incluso sin coincidencias',()=>{
 for(const minScore of [-0.1,1.1,NaN,Infinity,'0.5',null])assert.throws(()=>rank('',fixtures,{minScore}),/minScore/);
});
test('retrieve transmite el umbral a rank',t=>{const cwd=mkdtempSync(join(tmpdir(),'lab-minscore-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));assert.equal(retrieve(cwd,'CQRS desconocido',{minScore:0.75}).length,0);assert.equal(retrieve(cwd,'CQRS desconocido',{minScore:0.5})[0].id,'doc-cqrs');});
