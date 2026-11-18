import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExcludedTools } from '../dist/tool-selection.js';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
function invoke(args) { return spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], {cwd:root,encoding:'utf8'}); }
test('parseo de patrones de exclusión válidos', () => {
  assert.deepEqual(parseExcludedTools('mcp__*,bash'), ['mcp__*','bash']);
});
test('rechaza inyección, duplicados y vacío', () => {
  for (const v of ['', 'bash,bash', 'bash;', 'bash,', 'bash,+write', 'bash\nwrite']) assert.throws(() => parseExcludedTools(v), /--exclude-tools/);
});
test('dry-run compone allowlist y exclusiones sin shell', () => {
  const r=invoke(['run', 'Hola & echo NO_EJECUTAR', '--tools', 'read,codemode', '--exclude-tools', 'mcp__*,bash', '--dry-run']);
  assert.equal(r.status,0,r.stderr);
  const args=JSON.parse(r.stdout).args;
  assert.equal(args[args.indexOf('--exclude-tools')+1], 'mcp__*,bash');
  assert.equal(args[args.indexOf('--tools')+1], 'read,codemode');
  assert.equal(args.at(-1),'Hola & echo NO_EJECUTAR');
});
test('exclusiones no válidas para doctor, ni duplicadas para run', () => {
  for (const args of [ ['doctor','--exclude-tools','bash'], ['run','hola','--exclude-tools','read','--exclude-tools','bash'] ]) {
    const r=invoke(args);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/--exclude-tools/);
  }
});
