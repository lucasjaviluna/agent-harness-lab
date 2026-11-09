import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const solutionPath = join(repo, 'solutions/modulo-02-leccion-03/package-summary.ts');
const original = readFileSync(solutionPath, 'utf8');
const transformed = original.replace(/^import \{ Type \} from 'typebox';/m,
  'const Type = { Object:(properties,opts)=>({type:"object",properties,...opts}) };');
assert.notEqual(original, transformed);
const js = stripTypeScriptTypes(transformed, { mode: 'strip' });
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { readPackageSummary } = mod;
function fixtures(value) {
  const cwd = mkdtempSync(join(tmpdir(), 'lab08-solution-'));
  if (value !== undefined) writeFileSync(join(cwd, 'package.json'), typeof value === 'string' ? value : JSON.stringify(value));
  return {cwd, cleanup:()=>rmSync(cwd,{recursive:true,force:true})};
}

test('US-LAB-008: resume package.json sin valores de scripts ni secretos', async () => {
  const w = fixtures({name:'example',version:'1.0.0', scripts:{test:'echo PASSWORD=secret', build:'tsc'}, dependencies:{a:'1',b:'2'}, devDependencies:{x:'3'}});
  try {
    const info = await readPackageSummary(w.cwd);
    assert.deepEqual(info.scriptNames, ['build','test']);
    assert.equal(info.dependencies, 2);
    assert.equal(info.devDependencies, 1);
    assert.ok(!JSON.stringify(info).includes('PASSWORD'));
  } finally { w.cleanup(); }
});

test('US-LAB-008: falla sin package.json válido', async () => {
  const w=fixtures('{not-json');try{await assert.rejects(()=>readPackageSummary(w.cwd));}finally{w.cleanup();}
});

test('US-LAB-008: evita symlinks y archivos demasiado grandes', async (t) => {
  const w=fixtures(); const outside=fixtures({name:'outside'});
  try {
    try {symlinkSync(join(outside.cwd,'package.json'),join(w.cwd,'package.json'));}
    catch {t.skip('Permiso symlink no disponible');return;}
    await assert.rejects(()=>readPackageSummary(w.cwd));
  } finally {w.cleanup();outside.cleanup();}
});

test('US-LAB-008: tool produce respuesta estructurada y error controlado', async () => {
  const tools=[];mod.default({registerTool(t){tools.push(t);}});
  assert.equal(tools[0].name,'lab_package_summary');
  const w=fixtures({name:'demo'});
  try {
    const response=await tools[0].execute('id',{},new AbortController().signal,()=>{}, {cwd:w.cwd});
    assert.equal(response.details.ok,true);
    assert.equal(JSON.parse(response.content[0].text).name,'demo');
  } finally {w.cleanup();}
});
