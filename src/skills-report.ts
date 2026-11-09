import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface ProjectSkill {
  name: string | null;
  description: string | null;
  path: string;
  explicitOnly: boolean;
}

/**
 * Inventario orientativo del proyecto actual, NO el catálogo efectivo de Pi.
 * No recorre symlinks, directorios de padres, instalaciones globales ni paquetes.
 */
export function listProjectSkills(cwd: string): { scope: string; skills: ProjectSkill[]; limitations: string[] } {
  const found: ProjectSkill[] = [];
  const roots = [join(cwd, '.agents', 'skills'), join(cwd, '.pi', 'skills')];
  let visited = 0;
  const maxEntries = 500;
  const maxDepth = 6;

  function walk(directory: string, depth: number): void {
    if (depth > maxDepth) return;
    const entries = readdirSync(directory, { withFileTypes: true });
    visited += entries.length;
    if (visited > maxEntries) throw new Error(`Demasiadas entradas en Skills locales (máximo ${maxEntries})`);
    const candidate = entries.find(entry => entry.name === 'SKILL.md' && entry.isFile());
    if (candidate) {
      const file = join(directory, 'SKILL.md');
      const source = readFileSync(file, 'utf8');
      const meta = readSkillMetadata(source);
      found.push({ path: relative(cwd, file).split(sep).join('/'), ...meta });
    }
    for (const entry of entries) {
      if (entry.isDirectory()) walk(join(directory, entry.name), depth + 1);
    }
  }

  for (const root of roots) if (existsSync(root)) walk(root, 0);
  found.sort((a, b) => a.path.localeCompare(b.path));
  return {
    scope: 'project-directories-only',
    skills: found,
    limitations: ['No incluye Skills globales, paquetes ni directorios ancestros.', 'El inventario no sustituye la validación o el mecanismo de confianza de Pi.'],
  };
}

/** Parser deliberadamente limitado para inventariar campos escalares de frontmatter. */
export function readSkillMetadata(source: string): Pick<ProjectSkill, 'name' | 'description' | 'explicitOnly'> {
  const normalized = source.replace(/^\uFEFF/, '');
  const front = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!front) return { name: null, description: null, explicitOnly: false };
  const lines = front[1].split(/\r?\n/);
  function field(key: string): string | null {
    const at = lines.findIndex(line => line.startsWith(`${key}:`));
    if (at < 0) return null;
    let value = lines[at].slice(key.length + 1).trim();
    if (value === '>' || value === '|') {
      const parts: string[] = [];
      for (let i = at + 1; i < lines.length; i++) {
        if (!/^\s+\S/.test(lines[i])) break;
        parts.push(lines[i].trim());
      }
      value = parts.join(value === '>' ? ' ' : '\n');
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value || null;
  }
  return { name: field('name'), description: field('description'), explicitOnly: field('disable-model-invocation') === 'true' };
}
