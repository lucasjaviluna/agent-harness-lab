/** Lección 13: ciclo de vida del SDK, sin depender de Pi para compilar los tests. */
import { parseArgs } from 'node:util';

export interface SdkOptions {
  prompts: string[];
  readOnly: boolean;
  stream: boolean;
  timeoutMs: number;
  model?: string;
  thinking?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export function parseSdkArgs(argv: string[]): SdkOptions {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
    'read-only': { type: 'boolean' }, stream: { type: 'boolean' },
    'timeout-ms': { type: 'string' }, model: { type: 'string' }, thinking: { type: 'string' },
  } });
  if (!positionals.length || positionals.some(p => !p.trim())) throw new Error('Se requiere al menos un prompt no vacío');
  const timeoutMs = Number(values['timeout-ms'] ?? '120000');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 1800000) throw new Error('timeout-ms debe ser un entero entre 1 y 1800000');
  const model = values.model;
  if (model !== undefined && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:/-]+$/.test(model)) throw new Error('model requiere provider/id exacto');
  const thinking = values.thinking as SdkOptions['thinking'];
  if (thinking !== undefined && !['off','minimal','low','medium','high','xhigh','max'].includes(thinking)) throw new Error('Nivel thinking inválido');
  return { prompts: positionals, readOnly: values['read-only'] === true, stream: values.stream === true, timeoutMs, model, thinking };
}

/** Contrato mínimo del SDK que necesitamos. El puente real se tipa en examples/sdk. */
export interface SdkSession {
  subscribe(listener: (event: unknown) => void): () => void;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  getLastAssistantText(): string | undefined;
  dispose(): void;
}
export interface SdkTurnResult { text: string | null; events: number; tools: number; toolErrors: number; internalTurns: number; elapsedMs: number; }
export interface SdkResult { turns: SdkTurnResult[]; }
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

/** Una sesión, N prompts secuenciales; no confundir con N turnos internos del agente. */
export async function runSdkSession(
  create: () => Promise<SdkSession>, options: SdkOptions,
  onDelta: (text: string) => void = () => {},
): Promise<SdkResult> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 1800000) throw new Error('Timeout inválido');
  if (!options.prompts.length || options.prompts.some(p => !p.trim())) throw new Error('Prompts inválidos');
  const session = await create();
  const turns: SdkTurnResult[] = [];
  try {
    for (const prompt of options.prompts) {
      const startedAt = performance.now();
      let events = 0, tools = 0, toolErrors = 0, internalTurns = 0;
      let settled = false, aborted = false, expired = false;
      let stopReason: unknown;
      let aborting: Promise<void> | undefined;
      const unsubscribe = session.subscribe(raw => {
        const e = record(raw);
        if (!e) return;
        events++;
        if (e.type === 'turn_end') internalTurns++;
        if (e.type === 'tool_execution_start') tools++;
        if (e.type === 'tool_execution_end' && e.isError === true) toolErrors++;
        if (e.type === 'message_end') {
          const m = record(e.message);
          if (m?.role === 'assistant') stopReason = m.stopReason;
        }
        if (e.type === 'agent_settled') { settled = true; aborted = e.aborted === true; }
        if (options.stream && e.type === 'message_update') {
          const d = record(e.assistantMessageEvent);
          if (d?.type === 'text_delta' && typeof d.delta === 'string') onDelta(d.delta);
        }
      });
      const timer = setTimeout(() => {
        expired = true;
        // Cancelación cooperativa. Capturamos el rechazo para no crear una promesa huérfana.
        aborting = Promise.resolve().then(() => session.abort()).catch(() => {});
      }, options.timeoutMs);
      try {
        await session.prompt(prompt);
        if (expired) throw new Error('SDK_TIMEOUT: se solicitó cancelar el prompt');
        if (!settled || aborted || stopReason !== 'stop') throw new Error('SDK_INCOMPLETE: ejecución sin finalización normal');
        turns.push({ text: session.getLastAssistantText() ?? null, events, tools, toolErrors, internalTurns, elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)) });
      } catch (error) {
        if (expired) throw new Error('SDK_TIMEOUT: se solicitó cancelar el prompt');
        throw error;
      } finally {
        clearTimeout(timer);
        try { if (aborting) await aborting; } finally { unsubscribe(); }
      }
    }
    return { turns };
  } finally {
    session.dispose();
  }
}
