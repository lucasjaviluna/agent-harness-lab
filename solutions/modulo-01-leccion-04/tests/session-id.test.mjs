import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const entry = join(resolve(fileURLToPath(new URL('..', import.meta.url))), 'dist', 'cli.js');
function check(args) {
  const dir = mkdtempSync(join(tmpdir(),'agent-l4-id-'));
  try {
    writeFileSync(join(dir,'harness.config.json'),'{}');
    return spawnSync(process.execPath,[entry,'run','hello',...args,'--dry-run'],{cwd:dir,encoding:'utf8'});
  } finally {rmSync(dir,{force:true,recursive:true});}
}
test('session-id estable implica persistencia',()=>{
  const r=check(['--session-id','story-123']);assert.equal(r.status,0,r.stderr);
  const a=JSON.parse(r.stdout).args;assert.deepEqual(a.slice(a.indexOf('--session-id'),a.indexOf('--session-id')+2),['--session-id','story-123']);
  assert.ok(!a.includes('--no-session'));
});
test('session-id admite fork, identificando la nueva sesión',()=>{
  const r=check(['--fork','origen','--session-id','rama-2']);assert.equal(r.status,0,r.stderr);
});
test('session-id rechaza identificadores inválidos',()=>{
  const r=check(['--session-id','../bad']);assert.equal(r.status,1);assert.match(r.stderr,/identificador válido/);
});
test('session-id rechaza continue y session',()=>{
  for (const flag of [['--continue'],['--session','otro']]) {
    const r=check(['--session-id','test-1',...flag]);assert.equal(r.status,1);assert.match(r.stderr,/no puede combinarse/);
  }
});
