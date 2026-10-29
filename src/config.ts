import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseThinkingLevel, validateModelToken } from './model-selection.js';

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export interface ModelSelection {
  model?: string;
  provider?: string;
  thinking?: ThinkingLevel;
}
export interface HarnessConfig {
  pi: {
    executable: string;
    tools: string[];
    noSession: boolean;
    disableMcp: boolean;
    disableExtensions: boolean;
  } & ModelSelection;
  execution: { timeoutMs: number };
  defaultProfile?: string;
  modelProfiles: Record<string, ModelSelection>;
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
  modelProfiles: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function nonEmpty(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} debe ser un texto no vacío`);
  return value;
}
function boolean(value: unknown, key: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${key} debe ser true o false`);
  return value;
}
function parseSelection(value: unknown, path: string): ModelSelection {
  if (!isRecord(value)) throw new Error(`${path} debe ser un objeto`);
  const selection: ModelSelection = {};
  if (value.model !== undefined) selection.model = validateModelToken(nonEmpty(value.model, `${path}.model`), `${path}.model`);
  if (value.provider !== undefined) selection.provider = validateModelToken(nonEmpty(value.provider, `${path}.provider`), `${path}.provider`);
  if (value.thinking !== undefined) selection.thinking = parseThinkingLevel(value.thinking, `${path}.thinking`);
  return selection;
}

/** Configuración propia del lab: NUNCA almacena API keys ni tokens. */
export function loadConfig(cwd: string, configuredPath?: string): { config: HarnessConfig; path: string } {
  const path = resolve(cwd, configuredPath ?? 'harness.config.json');
  let raw: unknown = {};
  if (existsSync(path)) {
    try { raw = JSON.parse(readFileSync(path, 'utf8')) as unknown; }
    catch (error) { throw new Error(`No se pudo leer ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  } else if (configuredPath) throw new Error(`El archivo de configuración indicado no existe: ${path}`);

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
      ...parseSelection(pi, 'pi'),
    },
    execution: { timeoutMs: execution.timeoutMs === undefined ? DEFAULT_CONFIG.execution.timeoutMs : Number(execution.timeoutMs) },
    modelProfiles: {},
  };
  if (pi.tools !== undefined) {
    if (!Array.isArray(pi.tools) || pi.tools.length === 0 ||
        !pi.tools.every(tool => typeof tool === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tool))) {
      throw new Error('pi.tools debe ser una lista no vacía de nombres de herramientas');
    }
    config.pi.tools = [...new Set(pi.tools as string[])];
  }
  if (config.pi.provider && !config.pi.model) throw new Error('pi.provider requiere pi.model');
  if (!Number.isInteger(config.execution.timeoutMs) || config.execution.timeoutMs < 1000 || config.execution.timeoutMs > 600000) {
    throw new Error('execution.timeoutMs debe ser un entero entre 1000 y 600000');
  }
  if (raw.modelProfiles !== undefined) {
    if (!isRecord(raw.modelProfiles)) throw new Error('modelProfiles debe ser un objeto');
    for (const [name, value] of Object.entries(raw.modelProfiles)) {
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) throw new Error(`Nombre de perfil inválido: ${name}`);
      const profile = parseSelection(value, `modelProfiles.${name}`);
      if (!profile.model) throw new Error(`modelProfiles.${name}.model es obligatorio`);
      config.modelProfiles[name] = profile;
    }
  }
  if (raw.defaultProfile !== undefined) {
    const name = nonEmpty(raw.defaultProfile, 'defaultProfile');
    if (!Object.hasOwn(config.modelProfiles, name)) throw new Error(`defaultProfile desconocido: ${name}`);
    config.defaultProfile = name;
  }
  return { config, path };
}
