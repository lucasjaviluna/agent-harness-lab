import type { HarnessConfig } from './config.js';

/** Sólo un adaptador de flags: la sesión pertenece a Pi, no al harness. */
export interface SessionOptions {
  persist?: boolean;
  ephemeral?: boolean;
  continue?: boolean;
  session?: string;
  sessionId?: string;
  fork?: string;
  sessionDir?: string;
  name?: string;
}

export function buildSessionArgs(config: HarnessConfig, options: SessionOptions = {}): string[] {
  const targets = [options.continue === true, Boolean(options.session), Boolean(options.fork)].filter(Boolean).length;
  if (targets > 1) throw new Error('--continue, --session y --fork son mutuamente excluyentes');
  if (options.sessionId && !/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(options.sessionId)) {
    throw new Error('--session-id requiere un identificador válido (letras, números, ., _, -)');
  }
  if (options.sessionId && (options.continue || options.session)) {
    throw new Error('--session-id no puede combinarse con --continue ni --session');
  }
  if (options.persist && options.ephemeral) throw new Error('--persist y --ephemeral no pueden combinarse');
  if (options.ephemeral && (targets || options.sessionId || options.sessionDir || options.name)) {
    throw new Error('--ephemeral es incompatible con --continue, --session, --fork, --session-dir o --name');
  }
  // Preferimos efímero por defecto (v0.3); elegir sesión implica persistir.
  const persisted = options.ephemeral ? false : options.persist || Boolean(targets) || Boolean(options.sessionId) || !config.pi.noSession;
  if (!persisted && (options.name || options.sessionDir)) {
    throw new Error('--name y --session-dir necesitan una sesión persistente (--persist)');
  }
  const args: string[] = [];
  if (!persisted) args.push('--no-session');
  if (options.continue) args.push('--continue');
  if (options.session) args.push('--session', options.session);
  if (options.sessionId) args.push('--session-id', options.sessionId);
  if (options.fork) args.push('--fork', options.fork);
  if (options.sessionDir) args.push('--session-dir', options.sessionDir);
  if (options.name) args.push('--name', options.name);
  return args;
}
