import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LabRpcClient } from '../dist/rpc-client.js';
const fixture = fileURLToPath(new URL('./fixtures/fake-rpc.mjs', import.meta.url));
function make(t) { const c=new LabRpcClient(spawn(process.execPath,[fixture],{stdio:'pipe',shell:false}));t.after(()=>c.close());return c; }
test('stats agrega uso acumulado y omite ruta e ID',async t=>{const c=make(t);await c.prompt('a');await c.prompt('b');assert.deepEqual(await c.getSessionStats(),{userMessages:2,totalTokens:20,cost:0.02});});
test('stats vuelve a cero luego de new_session',async t=>{const c=make(t);await c.prompt('a');await c.newSession();assert.deepEqual(await c.getSessionStats(),{userMessages:0,totalTokens:0,cost:0});});
test('stats no consulta sesión durante prompt activo',async t=>{const c=make(t);const p=c.prompt('slow');const checked=assert.rejects(p,/INCOMPLETE_RUN/);await assert.rejects(c.getSessionStats(),/BUSY/);await c.abort();await checked;});
