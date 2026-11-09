import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root=resolve('solutions/modulo-02-leccion-05');
const source=stripTypeScriptTypes(readFileSync(resolve(root,'.pi/extensions/operator-ui.ts'),'utf8'),{mode:'strip'});
const url=pathToFileURL(resolve(root,'.pi/ui/operator-state.mjs')).href;
const ext=(await import(`data:text/javascript;base64,${Buffer.from(source.replace("'../ui/operator-state.mjs'",JSON.stringify(url))).toString('base64')}`)).default;
function fixture(){
  const commands=new Map(),events=new Map(),calls=[];
  ext({registerCommand:(id,x)=>commands.set(id,x.handler),on:(id,fn)=>events.set(id,fn)});
  const ui={setHeader:()=>{},setFooter:()=>{},setTitle:()=>{},setStatus:(...a)=>calls.push(['status',...a]),setWidget:(...a)=>calls.push(['widget',...a]),notify:(...a)=>calls.push(['notify',...a])};
  const ctx={mode:'tui',hasUI:true,ui};
  return {commands,events,calls,ctx};
}

test('US-LAB-010: /lab-ui reset borra contadores y conserva widget activado',async()=>{
  const f=fixture();
  await f.commands.get('lab-ui')('on',f.ctx);
  await f.commands.get('lab-widget')('below',f.ctx);
  f.events.get('agent_start')({},f.ctx);
  f.events.get('tool_execution_end')({isError:true},f.ctx);
  await f.commands.get('lab-ui')('reset',f.ctx);
  const last=f.calls.filter(c=>c[0]==='widget'&&Array.isArray(c[2])).at(-1);
  assert.match(last[2].join(' '),/Turnos: 0/);
  assert.match(last[2].join(' '),/Herramientas: 0 \| Fallos: 0/);
  assert.equal(last[3]?.placement,'belowEditor');
  assert.ok(f.calls.some(c=>c[0]==='notify'&&/reiniciados/.test(c[1])));
});

test('US-LAB-010: reset no intenta usar interfaz sin TUI',async()=>{
  const f=fixture();f.ctx.mode='json';
  await f.commands.get('lab-ui')('reset',f.ctx);
  assert.deepEqual(f.calls,[]);
});
