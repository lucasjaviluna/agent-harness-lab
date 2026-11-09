/**
 * Módulo 2 / Lección 3 (Lección 8): una Custom Tool real de solo lectura.
 *
 * Se ejecuta DENTRO de Pi (jiti); no requiere compilarla con el CLI del lab.
 * La herramienta no lee contenidos, no ejecuta shell y no escribe archivos.
 * No es un sandbox: las extensiones siguen teniendo los permisos del proceso.
 */
import { readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const MAX_ENTRIES = 20;
const MAX_NAME_LENGTH = 100;

interface WorkspaceRequest {
  directory?: string;
  limit?: number;
}

interface WorkspaceEntry {
  name: string;
  kind: 'file' | 'directory';
}

interface WorkspaceReport {
  directory: string;
  totalVisible: number;
  shown: number;
  omitted: number;
  entries: WorkspaceEntry[];
}

/** No confiar sólo en el schema: validar también en el límite de ejecución. */
function validateRequest(input: WorkspaceRequest): { directory: string; limit: number } {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Los parámetros deben ser un objeto');
  }
  let directory = input.directory ?? '.';
  if (typeof directory !== 'string' || !directory.trim() || directory.length > 256) {
    throw new Error('directory debe ser una ruta relativa no vacía');
  }
  if (directory.startsWith('@')) directory = directory.slice(1); // convenciones de path de Pi
  if (!directory || isAbsolute(directory) || win32.isAbsolute(directory) || directory.includes('\\')) {
    throw new Error('Se requiere una ruta relativa dentro del proyecto');
  }
  const segments = directory.split('/').filter(Boolean);
  if (segments.some(segment => segment === '..' || (segment.startsWith('.') && segment !== '.'))) {
    throw new Error('No se permiten rutas superiores ni carpetas ocultas');
  }
  const limit = input.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ENTRIES) {
    throw new Error(`limit debe ser un entero entre 1 y ${MAX_ENTRIES}`);
  }
  return { directory, limit };
}

/**
 * Núcleo funcional separado de la API de Pi para que se pueda probar fácilmente.
 * La validación de rutas se hace tanto léxica como canónicamente (realpath),
 * evitando atravesar symlinks que apunten fuera del workspace.
 */
export async function inspectWorkspace(
  cwd: string,
  input: WorkspaceRequest = {},
  signal?: AbortSignal,
): Promise<WorkspaceReport> {
  const { directory, limit } = validateRequest(input);
  signal?.throwIfAborted();
  const root = await realpath(cwd);
  const selected = await realpath(resolve(root, directory));
  const relativeToRoot = relative(root, selected);
  if (relativeToRoot === '..' || relativeToRoot.startsWith(`..${sep}`) || isAbsolute(relativeToRoot)) {
    throw new Error('La ruta resuelta queda fuera del proyecto');
  }
  signal?.throwIfAborted();
  const children = await readdir(selected, { withFileTypes: true });
  signal?.throwIfAborted();
  const entries = children
    .filter(entry => !entry.name.startsWith('.') && !entry.isSymbolicLink())
    .filter(entry => entry.isFile() || entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const selectedEntries: WorkspaceEntry[] = entries.slice(0, limit).map(entry => ({
    // Limitar el tamaño del texto incluso ante nombres inesperadamente largos.
    name: entry.name.length > MAX_NAME_LENGTH
      ? `${entry.name.slice(0, MAX_NAME_LENGTH - 1)}…`
      : entry.name,
    kind: entry.isDirectory() ? 'directory' : 'file',
  }));
  return {
    directory: relativeToRoot ? relativeToRoot.split(sep).join('/') : '.',
    totalVisible: entries.length,
    shown: selectedEntries.length,
    omitted: entries.length - selectedEntries.length,
    entries: selectedEntries,
  };
}

export default function workspaceInspector(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'lab_workspace_report',
    label: 'Workspace Report',
    description: 'Enumera hasta 20 archivos y carpetas visibles en un directorio relativo del proyecto. Sólo muestra nombres y tipos; no lee contenido.',
    promptSnippet: 'lab_workspace_report: inspeccionar de forma limitada la estructura de carpetas del proyecto',
    promptGuidelines: ['Usa lab_workspace_report para obtener un inventario de un directorio antes de analizar su estructura.'],
    parameters: Type.Object({
      directory: Type.Optional(Type.String({ minLength: 1, maxLength: 256, description: 'Directorio relativo, por ejemplo src, tests o .' })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_ENTRIES, description: 'Cantidad máxima de entradas (1–20)' })),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      try {
        const report = await inspectWorkspace(ctx.cwd, params, signal);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(report) }],
          details: { ok: true, report },
        };
      } catch (error) {
        // No devolver rutas del sistema ni mensajes internos del FS al modelo.
        const message = error instanceof Error && error.name === 'AbortError'
          ? 'La inspección fue cancelada.'
          : 'No se pudo inspeccionar el directorio solicitado. Verifica que sea visible, válido y esté dentro del proyecto.';
        return {
          content: [{ type: 'text' as const, text: message }],
          details: { ok: false, code: 'WORKSPACE_REPORT_FAILED' },
          isError: true,
        };
      }
    },
  });
}
