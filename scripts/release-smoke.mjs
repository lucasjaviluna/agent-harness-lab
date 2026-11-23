/** US-LAB-020: empaquetado + instalación offline sin usar el registro npm.
 * No publica en npm, no copia credenciales ni escribe en el proyecto. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cli = process.env.npm_execpath;
if (!cli) throw new Error('Ejecutar mediante npm run release:smoke (necesita npm_execpath)');
const tmp = mkdtempSync(join(tmpdir(), 'agent-lab-pack-'));
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
delete env.NODE_OPTIONS;
function npm(args) {
  const done = spawnSync(process.execPath, [cli, ...args], {
    cwd: root, env, shell: false, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
  });
  if (done.error || done.status !== 0) throw new Error(`npm ${args[0]} falló: ${(done.stderr ?? '').slice(-500)}`);
  return done.stdout;
}
function runNode(entry, args, cwd) {
  const done = spawnSync(process.execPath, [entry, ...args], {
    cwd, env, shell: false, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  if (done.error || done.status !== 0) throw new Error(`Smoke ${args[0] ?? '<none>'} falló: ${(done.stderr ?? '').slice(-500)}`);
  return done.stdout;
}
try {
  const pack = JSON.parse(npm(['pack', '--json', '--pack-destination', tmp]));
  assert.equal(pack.length, 1);
  const item = pack[0];
  const names = item.files.map(f => f.path);
  assert.ok(names.includes('dist/lab-cli.js'), 'dist/lab-cli.js no está en el tarball');
  assert.ok(names.includes('dist/workflow-cli.js'), 'falta workflow CLI');
  assert.ok(names.includes('dist/multi-agent-cli.js'), 'falta team CLI');
  assert.ok(names.includes('dist/telemetry-cli.js'), 'falta telemetry CLI');
  assert.ok(names.every(f => f === 'package.json' || f === 'README.md' || f.startsWith('dist/') || f.startsWith('docs/')), 'paquete contiene archivos fuera de la allowlist');
  assert.ok(!names.some(f => /(?:\.env|\.pi\/|\.agents\/|\.lab-memory|\.lab-evidence|\.sqlite|tests\/|solutions\/|harness\.config\.json)/.test(f)), 'paquete contiene datos del proyecto');
  const tarball = join(tmp, item.filename);
  assert.ok(existsSync(tarball));
  const prefix = join(tmp, 'installation');
  mkdirSync(prefix);
  npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', prefix, tarball]);
  const bin = join(prefix, 'node_modules', '.bin', process.platform === 'win32' ? 'agent-lab.cmd' : 'agent-lab');
  assert.ok(existsSync(bin), 'npm no creó el ejecutable');
  const installed = join(prefix, 'node_modules', 'agent-harness-lab', 'dist', 'lab-cli.js');
  const version = JSON.parse(readFileSync(join(prefix, 'node_modules', 'agent-harness-lab', 'package.json'), 'utf8')).version;
  assert.equal(runNode(installed, ['--version'], tmp).trim(), version);
  assert.match(runNode(installed, ['--help'], tmp), /agent-lab workflow/);
  const plan = JSON.parse(runNode(installed, ['workflow', '--mode', 'plan', 'Corregir el texto del botón'], tmp));
  assert.equal(plan.mode, 'plan');
  assert.ok(Array.isArray(plan.stages));
  const events = join(tmp, 'events.jsonl');
  writeFileSync(events, [
    { type: 'agent_start', prompt: 'DATO-SECRETO-NO-EXPONER' },
    { type: 'tool_execution_end', toolName: 'private_tool_name', isError: false },
    { type: 'agent_settled', aborted: false },
  ].map(v => JSON.stringify(v)).join('\n') + '\n');
  const out = runNode(installed, ['telemetry', events], tmp);
  assert.equal(JSON.parse(out).agentSettled, 1);
  assert.ok(!out.includes('DATO-SECRETO-NO-EXPONER') && !out.includes('private_tool_name'));
  console.log(JSON.stringify({ ok: true, tarballFiles: names.length, version, commands: ['version', 'help', 'workflow', 'telemetry'], secretsPacked: false }, null, 2));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
