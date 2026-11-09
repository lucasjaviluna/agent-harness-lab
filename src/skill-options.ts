import { statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** Opciones por ejecución. Pi descubre y carga Skills; nosotros solo pasamos flags. */
export interface SkillOptions {
  paths?: string[];
  noSkills?: boolean;
}

/**
 * Valida que cada ruta explícita señale un skill portable (directorio con SKILL.md
 * o el propio archivo SKILL.md). No interpreta ni ejecuta su contenido.
 */
export function buildSkillArgs(cwd: string, options: SkillOptions = {}): string[] {
  const args: string[] = [];
  if (options.noSkills) args.push('--no-skills');
  const seen = new Set<string>();
  for (const input of options.paths ?? []) {
    if (!input.trim()) throw new Error('--skill requiere una ruta no vacía');
    const absolute = resolve(cwd, input);
    let file = absolute;
    try {
      const metadata = statSync(absolute);
      if (metadata.isDirectory()) file = join(absolute, 'SKILL.md');
      else if (!metadata.isFile() || basename(absolute) !== 'SKILL.md') {
        throw new Error('se espera un directorio o archivo SKILL.md');
      }
      if (!statSync(file).isFile()) throw new Error('SKILL.md no es un archivo');
    } catch (error) {
      throw new Error(`Skill inválida (${input}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!seen.has(file)) {
      args.push('--skill', absolute);
      seen.add(file);
    }
  }
  return args;
}
