import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');

test('--view tools emite sólo metadata de tools, sin argumentos/resultados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-tools-'));
  try {
    const fakePi = join(dir, 'fake-pi.mjs');
    writeFileSync(fakePi, `#!/usr/bin/env node
for (const obj of [
 {type:'session',id:'demo'},
 {type:'tool_execution_start',toolName:'read',args:{path:'SECRETO_PRIVADO'}},
 {type:'tool_execution_end',toolName:'read',result:{text:'OTRO_SECRETO'},isError:false},
 {type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'OK'}]}},
 {type:'agent_settled',aborted:false}
]) console.log(JSON.stringify(obj));
`, {mode: 0o755});
    writeFileSync(join(dir, 'harness.config.json'), JSON.stringify({pi:{executable:fakePi}}));
    const result = spawnSync(process.execPath,[entry,'run','demo','--mode','json','--view','tools'], {cwd:dir,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.doesNotMatch(result.stdout,/SECRETO_PRIVADO|OTRO_SECRETO/);
    const events = result.stdout.trim().split('\n').map(JSON.parse);
    assert.deepEqual(events,[
      {type:'tool_execution_start',toolName:'read'},
      {type:'tool_execution_end',toolName:'read',isError:false},
    ]);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
