import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspectProjectContext } from './context-report.js';

export interface TemplateCheckResult { ok: boolean; checked: number; errors: string[] }

/** Solución del ejercicio: valida sólo los templates locales descubiertos. */
export function checkProjectTemplates(cwd: string): TemplateCheckResult {
  const report = inspectProjectContext(cwd);
  const errors: string[] = [];
  for (const template of report.promptTemplates) {
    const contents = readFileSync(join(cwd, template), 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
    if (!match) {
      errors.push(`${template}: falta frontmatter YAML delimitado por ---`);
      continue;
    }
    if (!/^description:\s*\S.+$/m.test(match[1])) {
      errors.push(`${template}: falta description no vacía`);
    }
    if (!contents.slice(match[0].length).trim()) {
      errors.push(`${template}: cuerpo vacío`);
    }
  }
  return { ok: errors.length === 0, checked: report.promptTemplates.length, errors };
}
