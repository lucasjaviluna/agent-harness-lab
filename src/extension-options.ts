import { realpathSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

export interface ExtensionOptions {
  paths?: string[];
  noExtensions?: boolean;
}

const FILE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cts', '.cjs']);

/**
 * Pi carga las extensiones. Nuestro harness valida sólo lo imprescindible
 * y pasa los argumentos como datos. Nunca ejecuta el código para comprobarlo.
 * Para extensiones empaquetadas complejas, Pi admite package.json/manifest;
 * este laboratorio inicialmente admite archivos e index.ts/index.js.
 */
export function buildExtensionArgs(cwd: string, options: ExtensionOptions = {}): string[] {
  const args: string[] = [];
  const seen = new Set<string>();
  for (const input of options.paths ?? []) {
    if (!input.trim()) throw new Error('--extension requiere una ruta no vacía');
    const absolute = resolve(cwd, input);
    let canonical: string;
    try {
      const metadata = statSync(absolute);
      if (metadata.isDirectory()) {
        const tsIndex = join(absolute, 'index.ts');
        const jsIndex = join(absolute, 'index.js');
        let index: string | undefined;
        for (const candidate of [tsIndex, jsIndex]) {
          try { if (statSync(candidate).isFile()) { index = candidate; break; } } catch { /* continuar */ }
        }
        if (!index) throw new Error('se requiere index.ts o index.js en este laboratorio');
        canonical = realpathSync(index);
      } else if (metadata.isFile() && FILE_EXTENSIONS.has(extname(absolute).toLowerCase())) {
        canonical = realpathSync(absolute);
      } else throw new Error('se espera un archivo .ts/.js/.mjs/.cts/.cjs o directorio con index.ts/index.js');
    } catch (error) {
      throw new Error(`Extensión inválida (${input}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!seen.has(canonical)) {
      args.push('--extension', absolute);
      seen.add(canonical);
    }
  }
  return args;
}
