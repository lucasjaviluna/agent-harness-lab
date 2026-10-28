import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');

function workspace(config = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-test-'));
  const fakePi = join(dir, 'fake-pi.mjs');
  writeFileSync(fakePi, `#!/usr/bin/env node
if (process.argv.includes('--version')) { console.log('pi-test 1.0'); process.exit(0); }
console.log(JSON.stringify(process.argv.slice(2)));
process.exit(process.env.FAKE_EXIT ? Number(process.env.FAKE_EXIT) : 0);
`, { mode: 0o755 });
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'fake-pi-preload.cjs'), `
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const spawn = childProcess.spawn;
childProcess.spawn = (command, args, options) => command === process.env.FAKE_PI_SCRIPT
  ? spawn(process.execPath, [command, ...args], options)
  : spawn(command, args, options);
syncBuiltinESMExports();
`);
  }
  writeFileSync(join(dir, 'harness.config.json'), JSON.stringify({ pi: { executable: fakePi }, ...config }));
  return { dir, fakePi, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function invoke(dir, args, env = {}) {
  const testEnv = { ...process.env, ...env };
  if (process.platform === 'win32' && dir !== root) {
    const preload = join(dir, 'fake-pi-preload.cjs').replaceAll('\\', '/');
    testEnv.NODE_OPTIONS = `${testEnv.NODE_OPTIONS || ''} --require "${preload}"`.trim();
    testEnv.FAKE_PI_SCRIPT = join(dir, 'fake-pi.mjs');
  }
  return spawnSync(process.execPath, [entry, ...args], { cwd: dir, env: testEnv, encoding: 'utf8' });
}

test('ayuda disponible sin configuración', () => {
  const result = invoke(root, ['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Agent Harness Lab/);
});

test('doctor lee la versión del ejecutable configurado', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, ['doctor']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pi-test 1\.0/);
  } finally { w.cleanup(); }
});

test('config muestra configuración efectiva y defaults', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, ['config']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.config.pi.tools, ['read','grep','find','ls']);
    assert.equal(parsed.config.pi.disableMcp, true);
  } finally { w.cleanup(); }
});

test('dry-run prepara flags sin invocar Pi', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, ['run', 'Inspecciona', '--dry-run']);
    assert.equal(result.status, 0);
    const args = JSON.parse(result.stdout).args;
    assert.deepEqual(args.slice(0, 5), ['--print', '--no-session', '--no-mcp', '--no-extensions', '--tools']);
    assert.ok(args.includes('read,grep,find,ls'));
    assert.deepEqual(args.slice(-2), ['--', 'Inspecciona']);
  } finally { w.cleanup(); }
});

test('run invoca Pi y propaga salida exitosa', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, ['run', 'Revisa este proyecto']);
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(result.stdout.trim());
    assert.equal(args.at(-1), 'Revisa este proyecto');
    assert.ok(args.includes('--no-mcp'));
  } finally { w.cleanup(); }
});

test('run propaga el código de salida de Pi', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, ['run', 'Fallá'], { FAKE_EXIT: '7' });
    assert.equal(result.status, 7);
  } finally { w.cleanup(); }
});

test('rechaza una configuración con tools vacío', () => {
  const w = workspace({ pi: { tools: [] } });
  try {
    const result = invoke(w.dir, ['config']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /lista no vacía/);
  } finally { w.cleanup(); }
});

test('rechaza un prompt vacío', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, ['run']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requiere un prompt/);
  } finally { w.cleanup(); }
});

test('admite rutas alternativas de configuración', () => {
  const w = workspace();
  try {
    writeFileSync(join(w.dir, 'custom.json'), JSON.stringify({ pi: { executable: w.fakePi, model: 'openai/gpt-4o', provider: 'openai' } }));
    const result = invoke(w.dir, ['--config', 'custom.json', 'run', 'Hola', '--dry-run']);
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(result.stdout).args;
    assert.deepEqual(args.slice(-6), ['--model', 'openai/gpt-4o', '--provider', 'openai', '--', 'Hola']);
  } finally { w.cleanup(); }
});


test('Windows ejecuta el lanzador administrado de Pi para doctor y run', { skip: process.platform !== 'win32' }, () => {
  const w = workspace();
  try {
    writeFileSync(join(w.dir, 'pi.cmd'), '@exit /b 99\r\n');
    writeFileSync(join(w.dir, 'pi-launcher.js'), `
if (process.argv.includes('--version')) console.log('pi-win 1.0');
else { console.log(JSON.stringify(process.argv.slice(2))); process.exit(7); }
`);
    writeFileSync(join(w.dir, 'harness.config.json'), JSON.stringify({ pi: { executable: 'pi' } }));
    const env = { PATH: w.dir + ';' + process.env.PATH };
    const doctor = invoke(w.dir, ['doctor'], env);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /pi-win 1\.0/);
    const prompt = 'Hola & echo NO_EJECUTAR';
    const run = invoke(w.dir, ['run', prompt], env);
    assert.equal(run.status, 7, run.stderr);
    assert.equal(JSON.parse(run.stdout.trim()).at(-1), prompt);
  } finally { w.cleanup(); }
});
