import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { listProjectSkills } from './skills-report.js';

export interface SkillProblem { path: string; message: string }

/** Validación educativa de metadatos portables: NO sustituye el parser de Pi. */
export function checkProjectSkills(cwd: string): { ok: boolean; checked: number; problems: SkillProblem[] } {
  const report = listProjectSkills(cwd);
  const problems: SkillProblem[] = [];
  const seen = new Map<string,string>();
  const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const skill of report.skills) {
    function fail(message: string): void { problems.push({ path: skill.path, message }); }
    if (!skill.name || !validName.test(skill.name) || skill.name.length > 64) {
      fail('name faltante o inválido: usar minúsculas, números y guiones simples (máximo 64).');
    } else {
      const folder = basename(dirname(skill.path));
      if (folder !== skill.name) fail(`nombre del directorio (${folder}) distinto de name (${skill.name})`);
      const first = seen.get(skill.name);
      if (first) fail(`nombre duplicado con ${first}`);
      else seen.set(skill.name, skill.path);
    }
    if (!skill.description || skill.description.length > 1024) {
      fail('description faltante o superior a 1024 caracteres.');
    }
    // Un metadata válido sin cuerpo tampoco es una habilidad útil.
    const source = readFileSync(resolve(cwd, skill.path), 'utf8');
    const closing = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
    if (!closing || !source.slice(closing[0].length).trim()) fail('falta el cuerpo de SKILL.md');
  }
  return { ok: problems.length === 0, checked: report.skills.length, problems };
}
