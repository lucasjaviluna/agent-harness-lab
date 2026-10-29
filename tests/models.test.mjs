import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');
const profiles = {
  review: { model: 'anthropic/claude-sonnet-*', provider: 'anthropic', thinking: 'low' },
  deep: { model: 'anthropic/claude-opus-*', provider: 'anthropic', thinking: 'high' },
  openai: { model: 'openai/gpt-*', provider: 'openai', thinking: 'medium' },
};
function workspace(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-models-'));
  const fakePi = join(dir, 'fake-pi.mjs');
  writeFileSync(fakePi, `#!/usr/bin/env node
if (process.argv.includes('--version')) { console.log('pi-test 1.0'); process.exit(0); }
console.log(JSON.stringify(process.argv.slice(2)));
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
  writeFileSync(join(dir, 'harness.config.json'), JSON.stringify({
    pi: { executable: fakePi, tools: ['read', 'grep', 'find', 'ls'] },
    execution: { timeoutMs: 2000 }, modelProfiles: profiles, defaultProfile: 'review', ...overrides,
  }));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
function invoke(dir, args) {
  const env = { ...process.env };
  if (process.platform === 'win32') {
    const preload = join(dir, 'fake-pi-preload.cjs').replaceAll('\\', '/');
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require "${preload}"`.trim();
    env.FAKE_PI_SCRIPT = join(dir, 'fake-pi.mjs');
  }
  return spawnSync(process.execPath, [entry, ...args], { cwd: dir, encoding: 'utf8', env });
}
function flags(output) { return JSON.parse(output.stdout).args; }
function valueAfter(args, flag) { return args[args.indexOf(flag) + 1]; }

test('v0.3: perfil por defecto afecta a run sin tocar herramientas ni modo', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    const a = flags(r);
    assert.equal(a[0], '--print');
    assert.equal(valueAfter(a, '--model'), profiles.review.model);
    assert.equal(valueAfter(a, '--provider'), 'anthropic');
    assert.equal(valueAfter(a, '--thinking'), 'low');
    assert.equal(valueAfter(a, '--tools'), 'read,grep,find,ls');
  } finally { w.cleanup(); }
});

test('perfil explícito gana al predeterminado y se aplica a JSON', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Evalúa', '--mode', 'json', '--profile', 'deep', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(flags(r).slice(0,2), ['--mode','json']);
    assert.equal(valueAfter(flags(r), '--thinking'), 'high');
    assert.equal(valueAfter(flags(r), '--model'), profiles.deep.model);
  } finally { w.cleanup(); }
});

test('CLI reemplaza modelo y thinking sin retener provider incompatible del perfil', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--model', 'openai/gpt-4o', '--thinking', 'off', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(valueAfter(flags(r), '--model'), 'openai/gpt-4o');
    assert.ok(!flags(r).includes('--provider'));
    assert.equal(valueAfter(flags(r), '--thinking'), 'off');
  } finally { w.cleanup(); }
});

test('CLI con provider/model coherentes es válido', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--model', 'openai/gpt-4o', '--provider', 'openai', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(valueAfter(flags(r), '--provider'), 'openai');
  } finally { w.cleanup(); }
});

test('rechaza provider incompatible con modelo explícito', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--model', 'openai/gpt-4o', '--provider', 'anthropic', '--dry-run']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Proveedor incompatible/);
  } finally { w.cleanup(); }
});

test('rechaza thinking no soportado sintácticamente', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--thinking', 'ultra', '--dry-run']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /off, minimal/);
  } finally { w.cleanup(); }
});

test('rechaza perfil inexistente, sin ejecutar Pi', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--profile', 'missing', '--dry-run']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Perfil de modelo desconocido/);
  } finally { w.cleanup(); }
});

test('profiles lista sólo los perfiles locales', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['profiles']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).defaultProfile, 'review');
    assert.deepEqual(JSON.parse(r.stdout).profiles.deep, profiles.deep);
  } finally { w.cleanup(); }
});

test('models delega --list-models a Pi sin parsear su formato', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['models', 'claude']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), ['--list-models', 'claude']);
  } finally { w.cleanup(); }
});

test('rechaza flags de modelo sobre doctor y models', () => {
  const w = workspace();
  try {
    const r = invoke(w.dir, ['models', '--thinking', 'high']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /sólo aplican/);
    const doctor = invoke(w.dir, ['doctor', '--profile', 'review']);
    assert.equal(doctor.status, 1);
  } finally { w.cleanup(); }
});

test('rechaza defaultProfile inexistente y perfiles sin model', () => {
  const w = workspace({ defaultProfile: 'missing' });
  try {
    const r = invoke(w.dir, ['config']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /defaultProfile desconocido/);
  } finally { w.cleanup(); }
  const w2 = workspace({ modelProfiles: { invalid: { thinking: 'high' } }, defaultProfile: undefined });
  try {
    const r = invoke(w2.dir, ['config']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /model es obligatorio/);
  } finally { w2.cleanup(); }
});

test('config antigua sin perfiles sigue en modo Pi nativo', () => {
  const w = workspace({ modelProfiles: {}, defaultProfile: undefined });
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!flags(r).includes('--model'));
    assert.ok(!flags(r).includes('--thinking'));
  } finally { w.cleanup(); }
});

test('run-file respeta selección de perfil', () => {
  const w = workspace();
  try {
    const prompt = join(w.dir, 'task.md');
    writeFileSync(prompt, 'Revisar arquitectura');
    const r = invoke(w.dir, ['run-file', prompt, '--profile', 'openai', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(valueAfter(flags(r), '--provider'), 'openai');
    assert.equal(flags(r).at(-1), 'Revisar arquitectura');
  } finally { w.cleanup(); }
});

test('un perfil reemplaza el provider heredado si cambia el modelo', () => {
  const w = workspace({
    pi: { executable: 'pi', model: 'openai/gpt-4o', provider: 'openai' },
    defaultProfile: 'review',
  });
  try {
    const r = invoke(w.dir, ['run', 'Hola', '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(valueAfter(flags(r), '--provider'), 'anthropic');
  } finally { w.cleanup(); }
});
