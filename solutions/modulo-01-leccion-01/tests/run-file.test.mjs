import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');

function setup() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-lab-runfile-'));
  const pi = join(cwd, 'fake-pi.mjs');
  writeFileSync(pi, `#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
  writeFileSync(join(cwd, 'harness.config.json'), JSON.stringify({ pi: { executable: pi } }));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test('run-file consume un prompt de archivo', () => {
  const w = setup();
  try {
    writeFileSync(join(w.cwd, 'prompt.md'), 'Analiza el proyecto\n');
    const result = spawnSync(process.execPath, [entry, 'run-file', 'prompt.md'], { cwd: w.cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).at(-1), 'Analiza el proyecto');
  } finally { w.cleanup(); }
});

test('run-file rechaza un archivo que no existe', () => {
  const w = setup();
  try {
    const result = spawnSync(process.execPath, [entry, 'run-file', 'falta.md'], { cwd: w.cwd, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No se pudo leer el prompt/);
  } finally { w.cleanup(); }
});
