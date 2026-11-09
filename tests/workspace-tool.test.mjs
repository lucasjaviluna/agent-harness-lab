import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourcePath = join(root, '.pi', 'extensions', 'workspace-inspector.ts');
const entry = join(root, 'dist', 'cli.js');

/** Pi's TypeBox import is replaced by a minimal schema fake in tests only.
 * Tool runtime behavior is exercised; schema validation by real Pi is a manual check.
 */
async function loadToolExtension() {
  const source = readFileSync(sourcePath, 'utf8');
  const replacement = `const Type = {
    String: (options = {}) => ({type:'string', ...options}),
    Integer: (options = {}) => ({type:'integer', ...options}),
    Optional: (schema) => ({...schema, optional:true}),
    Object: (properties, options = {}) => ({type:'object', properties, ...options}),
  };`;
  const transformed = source.replace(/^import \{ Type \} from 'typebox';/m, replacement);
  assert.notEqual(transformed, source, 'Esperábamos la importación oficial de TypeBox');
  const js = stripTypeScriptTypes(transformed, { mode: 'strip' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const mod = await loadToolExtension();
const toolFactory = mod.default;
const { inspectWorkspace } = mod;

function fixtures() {
  const cwd = mkdtempSync(join(tmpdir(), 'lab08-tool-'));
  mkdirSync(join(cwd, 'src'));
  writeFileSync(join(cwd, 'src', 'alpha.ts'), 'export const alpha = 1;');
  writeFileSync(join(cwd, 'src', 'bravo.ts'), 'export const bravo = 2;');
  writeFileSync(join(cwd, 'src', '.secret'), 'TOP SECRET');
  mkdirSync(join(cwd, 'src', '.git'));
  mkdirSync(join(cwd, 'src', 'components'));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function registeredTool() {
  const tools = [];
  toolFactory({ registerTool(tool) { tools.push(tool); } });
  assert.equal(tools.length, 1);
  return tools[0];
}

const call = async (tool, cwd, params, signal) =>
  tool.execute('id-1', params, signal ?? new AbortController().signal, () => {}, { cwd });

test('registra lab_workspace_report una sola vez y expone schema documentado', () => {
  const tool = registeredTool();
  assert.equal(tool.name, 'lab_workspace_report');
  assert.equal(tool.parameters.type, 'object');
  assert.equal(tool.parameters.additionalProperties, false);
  assert.equal(tool.parameters.properties.limit.minimum, 1);
  assert.equal(tool.parameters.properties.limit.maximum, 20);
  assert.equal(tool.parameters.properties.directory.type, 'string');
  assert.match(tool.promptGuidelines.join(' '), /lab_workspace_report/);
});

test('inspecciona subcarpeta permitida sin leer contenidos', async () => {
  const w = fixtures(); try {
    const report = await inspectWorkspace(w.cwd, { directory: 'src' });
    assert.equal(report.directory, 'src');
    assert.deepEqual(report.entries.map(x => x.name), ['alpha.ts', 'bravo.ts', 'components']);
    assert.equal(report.entries[2].kind, 'directory');
    assert.equal(report.omitted, 0);
    assert.ok(!JSON.stringify(report).includes('TOP SECRET'));
  } finally { w.cleanup(); }
});

test('excluye archivos ocultos y enlaces simbólicos', async () => {
  const w = fixtures(); try {
    try { symlinkSync(join(w.cwd, 'src', 'alpha.ts'), join(w.cwd, 'src', 'linked.ts')); } catch { /* puede faltar permiso Windows */ }
    const report = await inspectWorkspace(w.cwd, { directory: 'src' });
    assert.deepEqual(report.entries.map(x => x.name), ['alpha.ts', 'bravo.ts', 'components']);
  } finally { w.cleanup(); }
});

test('devuelve truncación y conteo determinista', async () => {
  const w = fixtures(); try {
    const r = await inspectWorkspace(w.cwd, { directory: 'src', limit: 1 });
    assert.equal(r.totalVisible, 3);
    assert.equal(r.shown, 1);
    assert.equal(r.omitted, 2);
    assert.deepEqual(r.entries.map(x=>x.name), ['alpha.ts']);
  } finally { w.cleanup(); }
});

test('rechaza rutas superiores y absolutas (POSIX y Windows)', async () => {
  const w = fixtures(); try {
    for (const directory of ['../', 'src/../../', '/etc', 'C:\\Windows', '..\\', 'src/.git']) {
      await assert.rejects(() => inspectWorkspace(w.cwd, { directory }), /ruta|carpetas/);
    }
  } finally { w.cleanup(); }
});

test('rechaza rutas vacías, límites fraccionarios y fuera de rango', async () => {
  const w = fixtures(); try {
    for (const options of [{ directory: '' }, { limit: 0 }, { limit: 21 }, { limit: 1.2 }, { limit: '2' }]) {
      await assert.rejects(() => inspectWorkspace(w.cwd, options));
    }
  } finally { w.cleanup(); }
});

test('realpath bloquea symlinks que escapan del directorio raíz', async (t) => {
  const w = fixtures(); const outside = mkdtempSync(join(tmpdir(), 'lab08-outside-'));
  try {
    try { symlinkSync(outside, join(w.cwd, 'external'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch { t.skip('Sin permisos de symlink en este entorno'); return; }
    await assert.rejects(() => inspectWorkspace(w.cwd, { directory: 'external' }), /fuera del proyecto/);
  } finally { w.cleanup(); rmSync(outside, {recursive:true,force:true}); }
});

test('abort signal se respeta antes de consultar archivos', async () => {
  const w = fixtures(); try {
    const ctrl = new AbortController(); ctrl.abort();
    await assert.rejects(() => inspectWorkspace(w.cwd, {}, ctrl.signal), /abort/i);
  } finally { w.cleanup(); }
});

test('execute entrega contenido y details estructurados y bounded', async () => {
  const w = fixtures(); try {
    const response = await call(registeredTool(), w.cwd, { directory: 'src', limit: 2 });
    assert.equal(response.isError, undefined);
    assert.equal(response.details.ok, true);
    assert.equal(response.details.report.omitted, 1);
    assert.deepEqual(JSON.parse(response.content[0].text), response.details.report);
  } finally { w.cleanup(); }
});

test('execute devuelve error controlado sin filtrar rutas del sistema', async () => {
  const w = fixtures(); try {
    const response = await call(registeredTool(), w.cwd, { directory: 'src/../../private' });
    assert.equal(response.isError, true);
    assert.equal(response.details.ok, false);
    assert.ok(!response.content[0].text.includes(w.cwd));
    assert.equal(response.details.code, 'WORKSPACE_REPORT_FAILED');
  } finally { w.cleanup(); }
});

test('execute informa directorio inexistente sin detalles del sistema operativo', async () => {
  const w = fixtures(); try {
    const response = await call(registeredTool(), w.cwd, { directory: 'missing' });
    assert.equal(response.isError, true);
    assert.ok(!response.content[0].text.includes('ENOENT'));
  } finally { w.cleanup(); }
});

test('config de ejemplo carga tool explícita y extensión sin shell', () => {
  const w = fixtures(); try {
    // CLI sólo valida la ruta. No ejecuta el código de la extensión en dry-run.
    const r = spawnSync(process.execPath, [entry,
      '--config', join(root, 'examples/config/harness.tools.example.json'),
      'run', 'Revisar & echo NO_EJECUTAR | prueba', '--extension', sourcePath, '--dry-run'
    ], { cwd: w.cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const {args} = JSON.parse(r.stdout);
    assert.ok(args.includes('--no-extensions'));
    assert.equal(args[args.indexOf('--extension') + 1], sourcePath);
    assert.ok(args[args.indexOf('--tools') + 1].split(',').includes('lab_workspace_report'));
    assert.equal(args.at(-1), 'Revisar & echo NO_EJECUTAR | prueba');
  } finally { w.cleanup(); }
});
