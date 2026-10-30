import type { HarnessConfig } from './config.js';

/** Sólo un adaptador de flags: la sesión pertenece a Pi, no al harness. */
export interface SessionOptions {
  persist?: boolean;
  ephemeral?: boolean;
  continue?: boolean;
  session?: string;
  fork?: string;
  sessionDir?: string;
  name?: string;
}

export function buildSessionArgs(config: HarnessConfig, options: SessionOptions = {}): string[] {
  const targets = [options.continue === true, Boolean(options.session), Boolean(options.fork)].filter(Boolean).length;
  if (targets > 1) throw new Error('--continue, --session y --fork son mutuamente excluyentes');
  if (options.persist && options.ephemeral) throw new Error('--persist y --ephemeral no pueden combinarse');
  if (options.ephemeral && (targets || options.sessionDir || options.name)) {
    throw new Error('--ephemeral es incompatible con --continue, --session, --fork, --session-dir o --name');
  }
  // Preferimos efímero por defecto (v0.3); elegir sesión implica persistir.
  const persisted = options.ephemeral ? false : options.persist || Boolean(targets) || !config.pi.noSession;
  if (!persisted && (options.name || options.sessionDir)) {
    throw new Error('--name y --session-dir necesitan una sesión persistente (--persist)');
  }
  const args: string[] = [];
  if (!persisted) args.push('--no-session');
  if (options.continue) args.push('--continue');
  if (options.session) args.push('--session', options.session);
  if (options.fork) args.push('--fork', options.fork);
  if (options.sessionDir) args.push('--session-dir', options.sessionDir);
  if (options.name) args.push('--name', options.name);
  return args;
}
