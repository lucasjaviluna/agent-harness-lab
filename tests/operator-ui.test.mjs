import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import {
  createOperatorState, recordOperatorEvent, operatorStatus,
  operatorWidget, fitAscii,
} from '../.pi/ui/operator-state.mjs';

const entry = resolve('.pi/extensions/operator-ui.ts');
const helperUrl = pathToFileURL(resolve('.pi/ui/operator-state.mjs')).href;

async function loadExtension() {
  const source = readFileSync(entry, 'utf8');
  const stripped = stripTypeScriptTypes(source, { mode: 'strip' });
  const replaced = stripped.replace("'../ui/operator-state.mjs'", JSON.stringify(helperUrl));
  return (await import(`data:text/javascript;base64,${Buffer.from(replaced).toString('base64')}`)).default;
}

function createMock(mode = 'tui') {
  const callbacks = new Map(); const commands = new Map(); const calls = [];
  const pi = {
    on(name, fn) { callbacks.set(name, fn); },
    registerCommand(name, command) { commands.set(name, command.handler); },
  };
  const ui = {
    setStatus(...a) { calls.push(['setStatus', ...a]); },
    setWidget(...a) { calls.push(['setWidget', ...a]); },
    setHeader(...a) { calls.push(['setHeader', ...a]); },
    setFooter(...a) { calls.push(['setFooter', ...a]); },
    setTitle(...a) { calls.push(['setTitle', ...a]); },
    notify(...a) { calls.push(['notify', ...a]); },
    select: async () => undefined,
    custom: async () => undefined,
  };
  return { callbacks, commands, calls, pi, ui, ctx: { mode, hasUI: mode !== 'print' && mode !== 'json', ui } };
}

async function fixture(mode = 'tui') {
  const m = createMock(mode); (await loadExtension())(m.pi);
  const emit = async (name, event = {}) => m.callbacks.get(name)?.(event, m.ctx);
  const command = async (name, args='') => m.commands.get(name)?.(args, m.ctx);
  return { ...m, emit, command };
}

test('estado: eventos contabilizan turnos, tools, errores y reset de sesión', () => {
  const s = createOperatorState();
  recordOperatorEvent(s, { type: 'agent_start' });
  recordOperatorEvent(s, { type: 'tool_execution_end', isError: true });
  assert.equal(s.working, true);
  assert.deepEqual([s.runs,s.toolCalls,s.failures], [1,1,1]);
  recordOperatorEvent(s, { type: 'agent_settled' });
  assert.equal(s.working, false);
  recordOperatorEvent(s, { type: 'session_start' });
  assert.deepEqual([s.runs,s.toolCalls,s.failures], [0,0,0]);
});

test('estado: widget y status no contienen prompts, argumentos ni salidas', () => {
  const s = createOperatorState();
  recordOperatorEvent(s, { type: 'tool_execution_end', isError: false, input: 'SECRETO' });
  assert.doesNotMatch(operatorStatus(s) + operatorWidget(s).join(' '), /SECRETO/);
  assert.equal(fitAscii('abcdef',3),'abc');
  assert.equal(fitAscii('abc',-3),'');
});

test('extensión registra comandos y listeners sin intervenir runtime', async () => {
  const m = await fixture();
  for (const name of ['lab-ui','lab-widget','lab-footer','lab-panel']) assert.ok(m.commands.has(name));
  for (const name of ['session_start','agent_start','tool_execution_end','agent_settled','session_shutdown']) assert.ok(m.callbacks.has(name));
  await m.emit('session_start');
  assert.equal(m.calls.length,0, 'no personaliza UI antes de opt-in');
});

test('/lab-ui on activa header, status, widget y título; off restaura', async () => {
  const m = await fixture();
  await m.command('lab-ui','on');
  assert.ok(m.calls.some(c=>c[0]==='setHeader' && typeof c[1] === 'function'));
  assert.ok(m.calls.some(c=>c[0]==='setStatus' && c[1]==='agent-lab'));
  assert.ok(m.calls.some(c=>c[0]==='setWidget' && c[1]==='agent-lab-dashboard'));
  const factory = m.calls.find(c=>c[0]==='setHeader')[1];
  const header = factory({}, { fg(_kind, text){ return text; } });
  assert.ok(header.render(15)[0].length <= 15);
  await m.command('lab-ui','off');
  assert.ok(m.calls.some(c=>c[0]==='setHeader' && c[1]===undefined));
  assert.ok(m.calls.some(c=>c[0]==='setStatus' && c[2]===undefined));
  assert.ok(m.calls.some(c=>c[0]==='setWidget' && c[2]===undefined));
});

test('eventos actualizan contadores visibles sólo con panel activo', async () => {
  const m=await fixture();
  await m.command('lab-ui','on');
  await m.emit('agent_start');
  await m.emit('tool_execution_end', {isError:true});
  await m.emit('agent_settled');
  const widgets=m.calls.filter(c=>c[0]==='setWidget' && Array.isArray(c[2]));
  assert.match(widgets.at(-1)[2].join(' '),/Herramientas: 1 \| Fallos: 1/);
  assert.match(widgets.at(-1)[2].join(' '),/Turnos: 1/);
});

test('modos print, JSON y RPC no inician UI exclusiva de terminal', async () => {
  for(const mode of ['print','json','rpc']) {
    const m=await fixture(mode);
    await m.command('lab-ui','on'); await m.command('lab-panel');
    await m.emit('agent_start');
    assert.deepEqual(m.calls, [], `${mode} no debe llamar APIs TUI`);
  }
});

test('widget admite ubicación superior e inferior y opciones incorrectas no cambian estado', async () => {
  const m=await fixture();await m.command('lab-ui','on');
  await m.command('lab-widget','below');
  assert.ok(m.calls.some(c=>c[0]==='setWidget' && c[3]?.placement==='belowEditor'));
  const n=m.calls.filter(c=>c[0]==='setWidget').length;
  await m.command('lab-widget','neither');
  assert.equal(m.calls.filter(c=>c[0]==='setWidget').length,n);
  assert.ok(m.calls.some(c=>c[0]==='notify'&&c[2]==='warning'));
});

test('footer es optativo y restaurable; render adapta ancho', async () => {
  const m=await fixture();
  await m.command('lab-footer','on');
  const footerFactory=m.calls.find(c=>c[0]==='setFooter' && typeof c[1]==='function')[1];
  const footer=footerFactory({}, {}, {getGitBranch:()=> 'develop'});
  const row=footer.render(18)[0];
  assert.ok(row.length<=18);
  await m.command('lab-footer','off');
  assert.ok(m.calls.some(c=>c[0]==='setFooter'&&c[1]===undefined));
});

test('/lab-panel acepta cancelación sin abrir custom', async () => {
  const m=await fixture();
  m.ui.select=async()=>undefined;
  let opened=false;m.ui.custom=async()=>{opened=true;};
  await m.command('lab-panel');
  assert.equal(opened,false);
});

test('/lab-panel muestra pantalla custom y respeta confirmación y cancelación', async () => {
  const m=await fixture();
  m.ui.select=async()=> 'Ver resumen';
  const done=[];
  m.ui.custom=async factory=>{
    const component=factory({}, {}, {matches:(data,key)=>data===key}, value=>done.push(value));
    assert.ok(component.render(12).every(line=>line.length<=12));
    component.handleInput('tui.select.confirm');
    component.handleInput('tui.select.cancel');
  };
  await m.command('lab-panel');
  assert.deepEqual(done,[true,false]);
});

test('al cerrar sesión restaura la UI original y limpia estados', async () => {
  const m=await fixture();await m.command('lab-ui','on');await m.emit('session_shutdown');
  assert.ok(m.calls.some(c=>c[0]==='setHeader'&&c[1]===undefined));
});
