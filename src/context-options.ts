import { statSync } from 'node:fs';
import { resolve } from 'node:path';

/** Control por invocación. Pi sigue siendo responsable de armar el contexto real. */
export interface ContextOptions {
  appendInstructions?: string[];
  noContextFiles?: boolean;
}

/** Evita mandar a Pi rutas vacías, inexistentes o directorios por error. */
export function buildContextArgs(cwd: string, options: ContextOptions = {}): string[] {
  const args: string[] = [];
  if (options.noContextFiles) args.push('--no-context-files');
  for (const rawPath of options.appendInstructions ?? []) {
    const path = resolve(cwd, rawPath);
    let size: number;
    try {
      const stat = statSync(path);
      if (!stat.isFile()) throw new Error('no es un archivo regular');
      size = stat.size;
    } catch (error) {
      throw new Error(`No se pueden cargar instrucciones de ${rawPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (size === 0) throw new Error(`Archivo de instrucciones vacío: ${rawPath}`);
    if (size > 64 * 1024) throw new Error(`Archivo de instrucciones demasiado grande (máx. 64 KiB): ${rawPath}`);
    args.push('--append-system-prompt', path);
  }
  return args;
}
