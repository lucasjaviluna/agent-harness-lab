/** Módulo 2 · Lección 6. Selector de nombres declarados a Pi.
 * No sustituye el catálogo de Pi ni establece una frontera de seguridad.
 */
import type { HarnessConfig } from './config.js';

export interface ToolSelectionOptions { tools?: string[]; excludeTools?: string[]; }

/** --tools recibe un allowlist explícito. Modificadores nativos +/- no se mezclan aquí
 * con defaults del lab, porque podrían reintroducir herramientas peligrosas.
 */
export function parseToolList(value: string): string[] {
  if (typeof value !== 'string' || !value.trim()) throw new Error('--tools requiere una lista no vacía');
  const items = value.split(',').map(value => value.trim());
  if (items.length > 32 || items.some(name => !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(name))) {
    throw new Error('--tools sólo acepta de 1 a 32 nombres exactos separados por coma (sin +, -, ni patrones)');
  }
  if (new Set(items).size !== items.length) throw new Error('--tools no admite nombres duplicados');
  return items;
}

export function effectiveTools(config: HarnessConfig, opts: ToolSelectionOptions = {}): string[] {
  return opts.tools ?? config.pi.tools;
}

/** Solución US-LAB-011: patrones limitados a nombres con * (sin sintaxis de shell). */
export function parseExcludedTools(input: string): string[] {
  if (typeof input !== 'string' || !input.trim()) throw new Error('--exclude-tools requiere una lista no vacía');
  const items = input.split(',').map(v => v.trim());
  if (items.length > 32 || items.some(name => !/^[a-zA-Z][a-zA-Z0-9_*\-]{0,79}$/.test(name))) {
    throw new Error('--exclude-tools sólo acepta hasta 32 nombres o patrones con *');
  }
  if (new Set(items).size !== items.length) throw new Error('--exclude-tools no acepta duplicados');
  return items;
}
