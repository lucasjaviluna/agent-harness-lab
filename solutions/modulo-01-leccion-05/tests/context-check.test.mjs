// Test de referencia para ejecutar una vez aplicada la solución a src/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist/cli.js');
test('context check detecta templates sin description', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'l5-check-'));
  try {
    writeFileSync(join(cwd, 'harness.config.json'), '{}');
    mkdirSync(join(cwd, '.pi/prompts'), { recursive: true });
    writeFileSync(join(cwd, '.pi/prompts/bad.md'), '---\nargument-hint: "[foco]"\n---\nHola');
    let r = spawnSync(process.execPath, [entry, 'context', 'check'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stdout, /falta description/);
    writeFileSync(join(cwd, '.pi/prompts/bad.md'), '---\ndescription: Evaluar código\n---\nHola');
    r = spawnSync(process.execPath, [entry, 'context', 'check'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).checked, 1);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
