import type { HarnessConfig, ModelSelection, ThinkingLevel } from './config.js';

/** Validamos sintaxis local, NO credenciales ni existencia en el catálogo de Pi. */
export function validateModelToken(value: string, name: string): string {
  const v = value.trim();
  if (!v || v.length > 256 || v.startsWith('-') || /[\u0000-\u001f\u007f]/.test(v)) {
    throw new Error(`${name} debe ser un identificador válido (1–256 caracteres, sin controles ni prefijo -)`);
  }
  return v;
}

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export function parseThinkingLevel(value: unknown, name: string): ThinkingLevel {
  if (!THINKING_LEVELS.includes(value as ThinkingLevel)) {
    throw new Error(`${name} debe ser: ${THINKING_LEVELS.join(', ')}`);
  }
  return value as ThinkingLevel;
}

export interface ModelOverrides {
  profile?: string;
  model?: string;
  provider?: string;
  thinking?: ThinkingLevel;
}

/** Precedencia: pi config < perfil predeterminado < perfil explícito < overrides CLI. */
export function resolveModelSelection(config: HarnessConfig, overrides: ModelOverrides = {}): ModelSelection {
  let selected: ModelSelection = {
    ...(config.pi.model ? { model: config.pi.model } : {}),
    ...(config.pi.provider ? { provider: config.pi.provider } : {}),
    ...(config.pi.thinking ? { thinking: config.pi.thinking } : {}),
  };
  const profileName = overrides.profile ?? config.defaultProfile;
  if (profileName) {
    if (!Object.hasOwn(config.modelProfiles, profileName)) throw new Error(`Perfil de modelo desconocido: ${profileName}`);
    const profile = config.modelProfiles[profileName];
    if (profile.model && profile.provider === undefined) delete selected.provider;
    selected = { ...selected, ...profile };
  }
  // Evitamos conservar un --provider heredado incompatible con un --model sobreescrito.
  if (overrides.model !== undefined) {
    selected.model = validateModelToken(overrides.model, '--model');
    if (overrides.provider === undefined) delete selected.provider;
  }
  if (overrides.provider !== undefined) selected.provider = validateModelToken(overrides.provider, '--provider');
  if (overrides.thinking !== undefined) selected.thinking = overrides.thinking;

  // El valor provider/id de Pi es explícito. Detectamos contradicciones antes de invocarlo.
  if (selected.model?.includes('/') && selected.provider) {
    const explicitProvider = selected.model.split('/', 1)[0];
    if (explicitProvider !== selected.provider) {
      throw new Error(`Proveedor incompatible: modelo ${selected.model} y provider ${selected.provider}`);
    }
  }
  return selected;
}
