import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkProjectSkills } from '../dist/skills-check.js';

function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-lab-skills-check-'));
  return { cwd, cleanup: () => rmSync(cwd, { recursive:true, force:true }) };
}
function put(w, dir, contents) {
  const folder = join(w.cwd, '.agents', 'skills', dir);
  mkdirSync(folder, {recursive:true});
  writeFileSync(join(folder,'SKILL.md'), contents);
}

test('skills check considera válido un SKILL.md portable', () => {
  const w = workspace();
  try {
    put(w, 'code-review','---\nname: code-review\ndescription: Revisar cambios de código.\n---\n# Cómo revisar');
    assert.deepEqual(checkProjectSkills(w.cwd), { ok: true, checked: 1, problems: [] });
  } finally { w.cleanup(); }
});

test('skills check informa problemas de nombre y descripción', () => {
  const w = workspace();
  try {
    put(w, 'CodeReview','---\nname: CodeReview\n---\n# Contenido');
    const report = checkProjectSkills(w.cwd);
    assert.equal(report.ok, false);
    assert.ok(report.problems.some(p => /name/.test(p.message)));
    assert.ok(report.problems.some(p => /description/.test(p.message)));
  } finally { w.cleanup(); }
});

test('skills check detecta Skills duplicadas en ambas ubicaciones', () => {
  const w = workspace();
  try {
    put(w, 'code-review','---\nname: code-review\ndescription: Review.\n---\n# A');
    const folder = join(w.cwd, '.pi', 'skills', 'code-review');
    mkdirSync(folder,{recursive:true});
    writeFileSync(join(folder, 'SKILL.md'), '---\nname: code-review\ndescription: Review.\n---\n# B');
    const report = checkProjectSkills(w.cwd);
    assert.equal(report.checked, 2);
    assert.equal(report.ok, false);
    assert.ok(report.problems.some(p => /duplicado/.test(p.message)));
  } finally { w.cleanup(); }
});
