import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listProjectSkills, readSkillMetadata } from '../dist/skills-report.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = join(root, 'dist', 'cli.js');
function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-lab-skills-'));
  const fakePi = join(cwd, 'fake-pi.mjs');
  writeFileSync(fakePi, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--version')) console.log('pi-test 1.0');
else if (args.includes('json')) {
  console.log(JSON.stringify({type:'session',version:3,id:'skills-session',cwd:process.cwd()}));
  console.log(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:JSON.stringify(args)}]}}));
  console.log(JSON.stringify({type:'agent_settled',aborted:false}));
} else console.log(JSON.stringify(args));
`, { mode: 0o755 });
  writeFileSync(join(cwd, 'harness.config.json'), JSON.stringify({ pi: { executable: fakePi } }));
  writeFileSync(join(cwd, 'preload.cjs'), `
const cp = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const orig = cp.spawn;
cp.spawn = (command,args,options) => command === process.env.FAKE_PI_SCRIPT
  ? orig(process.execPath,[command,...args],options) : orig(command,args,options);
syncBuiltinESMExports();`);
  return { cwd, fakePi, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}
function invoke(w, args) {
  const env = { ...process.env };
  if (process.platform === 'win32') {
    env.FAKE_PI_SCRIPT = w.fakePi;
    const preload = join(w.cwd, 'preload.cjs').replaceAll('\\', '/');
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require "${preload}"`.trim();
  }
  return spawnSync(process.execPath, [entry, ...args], { cwd: w.cwd, env, encoding: 'utf8' });
}
function installSkill(w, name, rootDir = '.agents/skills', content = `---\nname: ${name}\ndescription: Example portable skill ${name}.\n---\n# Example\n`) {
  const dir = join(w.cwd, rootDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), content);
  return dir;
}
function parsedArgs(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).args;
}

test('skills list encuentra Skills locales portables en .agents y .pi sin ejecutar Pi', () => {
  const w = workspace();
  try {
    installSkill(w, 'frontend-review');
    installSkill(w, 'test-triage', '.pi/skills', `---\nname: test-triage\ndescription: Diagnosticar errores de test.\ndisable-model-invocation: true\n---\n# Diagnóstico`);
    const result = invoke(w, ['skills', 'list']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.scope, 'project-directories-only');
    assert.deepEqual(report.skills.map(s => s.name), ['frontend-review','test-triage']);
    assert.equal(report.skills[1].explicitOnly, true);
    assert.ok(report.skills.every(s => s.path.endsWith('SKILL.md')));
    assert.ok(report.limitations.some(t => /globales/.test(t)));
  } finally { w.cleanup(); }
});

test('skills list funciona en un proyecto sin Skills', () => {
  const w = workspace();
  try {
    const result = invoke(w, ['skills', 'list']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).skills, []);
  } finally { w.cleanup(); }
});

test('metadata maneja frontmatter vacío, comillas y descripciones multilinea', () => {
  assert.deepEqual(readSkillMetadata('# no frontmatter'), { name: null, description: null, explicitOnly: false });
  const meta = readSkillMetadata('---\nname: "code-review"\ndescription: >\n  Primera parte\n  segunda parte\ndisable-model-invocation: true\n---\n# Texto');
  assert.equal(meta.name, 'code-review');
  assert.equal(meta.description, 'Primera parte segunda parte');
  assert.equal(meta.explicitOnly, true);
});

test('inventario no sigue directorios symlink', () => {
  const w = workspace();
  try {
    installSkill(w, 'example');
    const result = listProjectSkills(w.cwd);
    assert.equal(result.skills.length, 1);
  } finally { w.cleanup(); }
});

test('agrega --skill repetible a una ejecución print y respeta prompt especial', () => {
  const w = workspace();
  try {
    const first = installSkill(w, 'code-review');
    const second = installSkill(w, 'test-triage');
    const prompt = 'Analizar & echo NO_EJECUTAR | otra';
    const args = parsedArgs(invoke(w, ['run', prompt, '--skill', first, '--skill', second, '--dry-run']));
    assert.deepEqual(args.filter(v => v === '--skill'), ['--skill','--skill']);
    assert.equal(args[args.indexOf('--skill')+1], first);
    assert.equal(args.at(-1), prompt);
    assert.ok(!args.includes('--no-skills'));
  } finally { w.cleanup(); }
});

test('no-skills desactiva descubrimiento pero mantiene --skill explícito', () => {
  const w = workspace();
  try {
    const dir = installSkill(w, 'review');
    const args = parsedArgs(invoke(w, ['run','Revisa','--no-skills','--skill',dir,'--dry-run']));
    assert.ok(args.includes('--no-skills'));
    assert.ok(args.includes('--skill'));
    assert.equal(args[args.indexOf('--skill')+1], dir);
  } finally { w.cleanup(); }
});

test('acepta archivo SKILL.md explícito con espacios en la ruta y JSON', () => {
  const w = workspace();
  try {
    const dir = installSkill(w, 'skill con espacios');
    const file = join(dir, 'SKILL.md');
    const args = parsedArgs(invoke(w, ['run', 'test','--mode','json','--skill',file,'--dry-run']));
    assert.deepEqual(args.slice(0,2), ['--mode', 'json']);
    assert.equal(args[args.indexOf('--skill')+1], file);
  } finally { w.cleanup(); }
});

test('elimina Skills duplicadas por archivo canónico en el argumento', () => {
  const w = workspace();
  try {
    const dir = installSkill(w, 'review');
    const args = parsedArgs(invoke(w,['run','hola','--skill',dir,'--skill',join(dir,'SKILL.md'),'--dry-run']));
    assert.equal(args.filter(a => a === '--skill').length, 1);
  } finally { w.cleanup(); }
});

test('rechaza rutas inexistentes y directorios sin SKILL.md', () => {
  const w = workspace();
  try {
    mkdirSync(join(w.cwd,'empty'));
    writeFileSync(join(w.cwd,'other.md'),'markdown');
    for (const path of ['missing','empty','other.md']) {
      const r = invoke(w,['run','Hola','--skill',path,'--dry-run']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /Skill inválida/);
    }
  } finally { w.cleanup(); }
});

test('los flags de Skills sólo aplican a run y run-file', () => {
  const w = workspace();
  try {
    assert.match(invoke(w,['skills','list','--no-skills']).stderr, /sólo aplican/);
    assert.match(invoke(w,['models','--skill','cualquiera']).stderr, /sólo aplican/);
    assert.match(invoke(w,['run','hola','--skill']).stderr, /requiere un valor/);
  } finally { w.cleanup(); }
});

test('run-file JSON y ejecución print real pasan flags sin shell', () => {
  const w = workspace();
  try {
    const dir = installSkill(w, 'test-triage');
    writeFileSync(join(w.cwd, 'request.md'), 'Explica fallo & echo NO_EJECUTAR');
    const dry = parsedArgs(invoke(w,['run-file','request.md','--mode','json','--skill',dir,'--no-skills','--dry-run']));
    assert.equal(dry.at(-1), 'Explica fallo & echo NO_EJECUTAR');
    assert.ok(dry.includes('--no-skills'));
    const executed = invoke(w,['run','Hola & echo NO_EJECUTAR','--skill',dir]);
    assert.equal(executed.status, 0, executed.stderr);
    const raw = JSON.parse(executed.stdout);
    assert.equal(raw.at(-1), 'Hola & echo NO_EJECUTAR');
    assert.equal(raw[raw.indexOf('--skill')+1], dir);
  } finally { w.cleanup(); }
});

test('script Node de ejemplo resume logs sin dependencias externas', () => {
  const result = spawnSync(process.execPath, [join(root, '.agents/skills/test-triage/scripts/summarize-test-log.mjs'), join(root, 'examples/skills/node-test-example.log')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# tests 12/);
  assert.match(result.stdout, /# fail 1/);
});
