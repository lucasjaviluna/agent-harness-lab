import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

/** Inventario local: no pretende reproducir el descubrimiento o confianza de Pi. */
export function listProjectExtensions(cwd: string) {
  const dir = join(cwd, '.pi', 'extensions');
  const extensions: Array<{ name: string; path: string; kind: 'file' | 'directory' }> = [];
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isFile() && ['.ts', '.js', '.mjs', '.cts', '.cjs'].includes(extname(entry.name))) {
        extensions.push({ name: basename(entry.name, extname(entry.name)), path, kind: 'file' });
      } else if (entry.isDirectory()) {
        for (const name of ['index.ts', 'index.js']) {
          const index = join(path, name);
          try {
            if (lstatSync(index).isFile()) {
              extensions.push({ name: entry.name, path: index, kind: 'directory' });
              break;
            }
          } catch { /* no es entrada reconocida */ }
        }
      }
    }
  }
  extensions.sort((a, b) => a.name.localeCompare(b.name));
  return {
    scope: 'project-directories-only',
    extensions,
    limitations: [
      'Informe estático: no confirma carga, ejecución o confianza en Pi.',
      'No incluye extensiones globales, configuradas ni paquetes externos.',
      'Una extensión carga código con los permisos del proceso. Usa sólo fuentes confiables.'
    ]
  };
}
