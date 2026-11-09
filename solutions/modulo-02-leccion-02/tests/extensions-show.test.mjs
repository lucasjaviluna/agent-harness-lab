import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cli = join(root, 'dist', 'cli.js');
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-lab-extension-show-'));
  const dir = join(cwd, '.pi', 'extensions'); mkdirSync(dir, { recursive: true });
  const path = join(dir, 'observer.ts'); writeFileSync(path, 'export default () => {}');
  return { cwd, path, cleanup: () => rmSync(cwd, { force: true, recursive: true }) };
}
test('extensions show presenta metadatos sin ejecutar Pi', () => {
  const w = fixture();
  try {
    const result = spawnSync(process.execPath, [cli, 'extensions', 'show', 'observer'], {cwd:w.cwd, encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{name:'observer',path:w.path,kind:'file'});
  } finally {w.cleanup();}
});
test('extensions show rechaza nombres inexistentes y argumentos extra', () => {
  const w = fixture();
  try {
    for(const args of [['extensions','show','otro'],['extensions','show','observer','extra']]) {
      const result = spawnSync(process.execPath, [cli, ...args], {cwd:w.cwd, encoding:'utf8'});
      assert.equal(result.status,1);
    }
  } finally {w.cleanup();}
});
