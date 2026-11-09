import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parsePolicy, decideToolCall, loadPolicy } from '../.pi/policies/approval-policy.mjs';

function fixture() {
  const cwd=mkdtempSync(join(tmpdir(),'lab09-solution-'));
  mkdirSync(join(cwd,'src')); return {cwd,close:()=>rmSync(cwd,{recursive:true,force:true})};
}
const policy=()=>parsePolicy({version:1,bash:'deny',denyTools:[],askTools:[],denyWriteExtensions:['.pem','.key','.p12']});

test('US-LAB-009: rechaza nuevas escrituras de .pem .key .p12',()=>{
  const w=fixture();try{for(const suffix of ['.pem','.key','.p12']){
    assert.equal(decideToolCall(w.cwd,'write',{path:'src/key'+suffix},policy()).action,'deny');
  }}finally{w.close();}
});
test('US-LAB-009: no importa si la extensión está en mayúscula',()=>{
  const w=fixture();try{
    assert.equal(decideToolCall(w.cwd,'edit',{path:'src/CERT.PEM'},policy()).action,'deny');
  }finally{w.close();}
});
test('US-LAB-009: .ts sigue pidiendo aprobación y no se autoriza automáticamente',()=>{
  const w=fixture();try{
    assert.equal(decideToolCall(w.cwd,'write',{path:'src/code.ts'},policy()).action,'ask');
  }finally{w.close();}
});
test('US-LAB-009: rechaza extensiones mal formadas',()=>{
  for (const extension of ['pem','..key','.','.*','.EXE']){
    assert.throws(()=>parsePolicy({version:1,bash:'deny',denyTools:[],askTools:[],denyWriteExtensions:[extension]}));
  }
});
