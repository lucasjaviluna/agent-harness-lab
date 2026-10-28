import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface HarnessConfig {
  pi: {
    executable: string;
    tools: string[];
    noSession: boolean;
    disableMcp: boolean;
    disableExtensions: boolean;
    model?: string;
    provider?: string;
  };
  execution: { timeoutMs: number };
}

export const DEFAULT_CONFIG: HarnessConfig = {
  pi: {
    executable: 'pi',
    tools: ['read', 'grep', 'find', 'ls'],
    noSession: true,
    disableMcp: true,
    disableExtensions: true,
  },
  execution: { timeoutMs: 120000 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} debe ser un texto no vacío`);
  }
  return value;
}

function boolean(value: unknown, key: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${key} debe ser true o false`);
  return value;
}

/** Config del laboratorio, deliberadamente independiente de la configuración de Pi. */
export function loadConfig(cwd: string, configuredPath?: string): { config: HarnessConfig; path: string } {
  const path = resolve(cwd, configuredPath ?? 'harness.config.json');
  let raw: unknown = {};

  if (existsSync(path)) {
    try {
      raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`No se pudo leer ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (configuredPath) {
    throw new Error(`El archivo de configuración indicado no existe: ${path}`);
  }

  if (!isRecord(raw)) throw new Error('La configuración debe ser un objeto JSON');
  if (raw.pi !== undefined && !isRecord(raw.pi)) throw new Error('pi debe ser un objeto');
  if (raw.execution !== undefined && !isRecord(raw.execution)) throw new Error('execution debe ser un objeto');
  const pi = (raw.pi ?? {}) as Record<string, unknown>;
  const execution = (raw.execution ?? {}) as Record<string, unknown>;

  const config: HarnessConfig = {
    pi: {
      executable: pi.executable === undefined ? DEFAULT_CONFIG.pi.executable : nonEmpty(pi.executable, 'pi.executable'),
      tools: DEFAULT_CONFIG.pi.tools,
      noSession: pi.noSession === undefined ? DEFAULT_CONFIG.pi.noSession : boolean(pi.noSession, 'pi.noSession'),
      disableMcp: pi.disableMcp === undefined ? DEFAULT_CONFIG.pi.disableMcp : boolean(pi.disableMcp, 'pi.disableMcp'),
      disableExtensions: pi.disableExtensions === undefined ? DEFAULT_CONFIG.pi.disableExtensions : boolean(pi.disableExtensions, 'pi.disableExtensions'),
    },
    execution: {
      timeoutMs: execution.timeoutMs === undefined ? DEFAULT_CONFIG.execution.timeoutMs : Number(execution.timeoutMs),
    },
  };

  if (pi.tools !== undefined) {
    if (!Array.isArray(pi.tools) || pi.tools.length === 0 ||
        !pi.tools.every(tool => typeof tool === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tool))) {
      throw new Error('pi.tools debe ser una lista no vacía de nombres de herramientas');
    }
    config.pi.tools = [...new Set(pi.tools as string[])];
  }
  if (pi.model !== undefined) config.pi.model = nonEmpty(pi.model, 'pi.model');
  if (pi.provider !== undefined) {
    config.pi.provider = nonEmpty(pi.provider, 'pi.provider');
    if (!config.pi.model) throw new Error('pi.provider requiere pi.model');
  }
  if (!Number.isInteger(config.execution.timeoutMs) || config.execution.timeoutMs < 1000 || config.execution.timeoutMs > 600000) {
    throw new Error('execution.timeoutMs debe ser un entero entre 1000 y 600000');
  }
  return { config, path };
}
