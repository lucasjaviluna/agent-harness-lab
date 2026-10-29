import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist/cli.js');
function work() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-show-'));
  writeFileSync(join(cwd, 'harness.config.json'), JSON.stringify({
    modelProfiles: { fast: { model: 'openai/gpt-*', thinking: 'low' } },
    defaultProfile: 'fast',
  }));
  return cwd;
}
test('profiles show resuelve un perfil sin consultar Pi', () => {
  const cwd = work();
  try {
    const r = spawnSync(process.execPath, [entry, 'profiles', 'show', 'fast'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { name: 'fast', selection: { model: 'openai/gpt-*', thinking: 'low' } });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('profiles show no acepta nombres desconocidos', () => {
  const cwd = work();
  try {
    const r = spawnSync(process.execPath, [entry, 'profiles', 'show', 'missing'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Perfil de modelo desconocido/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
