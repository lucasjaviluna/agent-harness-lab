/** US-LAB-008 — solución opcional: segundo Custom Tool de sólo lectura.
 * Colocar una copia en .pi/extensions/package-summary.ts para habilitarla en Pi.
 */
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, relative, sep, isAbsolute } from 'node:path';
import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const MAX_PACKAGE_BYTES = 64 * 1024;

export async function readPackageSummary(cwd: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const root = await realpath(cwd);
  const source = join(root, 'package.json');
  const info = await lstat(source);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_PACKAGE_BYTES) {
    throw new Error('package.json no es un archivo local válido o supera el límite de lectura');
  }
  const target = await realpath(source);
  const r = relative(root, target);
  if (r === '..' || r.startsWith(`..${sep}`) || isAbsolute(r)) {
    throw new Error('El package.json resuelto sale del proyecto');
  }
  signal?.throwIfAborted();
  const raw = await readFile(target, 'utf8');
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('package.json no contiene un objeto');
  }
  const pkg = data as Record<string, unknown>;
  const safeRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const scripts = Object.keys(safeRecord(pkg.scripts)).sort();
  return {
    name: typeof pkg.name === 'string' ? pkg.name.slice(0, 100) : null,
    version: typeof pkg.version === 'string' ? pkg.version.slice(0, 40) : null,
    dependencies: Object.keys(safeRecord(pkg.dependencies)).length,
    devDependencies: Object.keys(safeRecord(pkg.devDependencies)).length,
    scriptNames: scripts.slice(0, 20),
    scriptsOmitted: Math.max(0, scripts.length - 20),
  };
}

export default function packageSummaryExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'lab_package_summary',
    label: 'Package Summary',
    description: 'Resume metadatos seguros de package.json sin devolver los comandos de scripts ni leer dependencias.',
    parameters: Type.Object({}, { additionalProperties: false }),
    promptSnippet: 'lab_package_summary: leer un resumen acotado de package.json del proyecto actual',
    async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
      try {
        const summary = await readPackageSummary(ctx.cwd, signal);
        return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }], details: { ok: true, summary } };
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'No es posible consultar package.json en este workspace.' }],
          details: { ok: false }, isError: true,
        };
      }
    },
  });
}
