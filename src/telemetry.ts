/** Lección 20: métricas de Pi JSONL sin conservar ni devolver contenido sensible. */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 25000;

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const metric = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12 ? v : 0;

export interface TelemetrySummary {
  schemaVersion: 1;
  records: number;
  agentStarts: number;
  agentSettled: number;
  abortedRuns: number;
  toolCalls: number;
  toolResults: number;
  toolErrors: number;
  assistantMessages: number;
  failedMessages: number;
  retries: number;
  usageSamples: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  costUsd: number | null;
}

export function summarizeTelemetryJsonl(raw: string): TelemetrySummary {
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('Registro de eventos demasiado grande');
  const result: TelemetrySummary = {
    schemaVersion: 1, records: 0, agentStarts: 0, agentSettled: 0,
    abortedRuns: 0, toolCalls: 0, toolResults: 0, toolErrors: 0,
    assistantMessages: 0, failedMessages: 0, retries: 0,
    usageSamples: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    costUsd: null,
  };
  for (const line0 of raw.split('\n')) {
    const line = line0.endsWith('\r') ? line0.slice(0, -1) : line0;
    if (!line.trim()) continue;
    if (++result.records > MAX_RECORDS) throw new Error('Demasiados eventos');
    let event: unknown;
    try { event = JSON.parse(line); } catch { throw new Error('Registro JSONL inválido'); }
    if (!object(event) || typeof event.type !== 'string') throw new Error('Evento inválido');
    if (event.type === 'agent_start') result.agentStarts++;
    if (event.type === 'agent_settled') {
      result.agentSettled++;
      if (event.aborted === true) result.abortedRuns++;
    }
    if (event.type === 'auto_retry_start') result.retries++;
    if (event.type === 'tool_execution_start') result.toolCalls++;
    if (event.type === 'tool_execution_end') {
      result.toolResults++;
      if (event.isError === true) result.toolErrors++;
    }
    if (event.type === 'message_end' && object(event.message) && event.message.role === 'assistant') {
      const message = event.message;
      result.assistantMessages++;
      if (['error', 'aborted', 'length'].includes(String(message.stopReason ?? ''))) result.failedMessages++;
      if (object(message.usage)) {
        const usage = message.usage;
        result.usageSamples++;
        result.tokens.input += metric(usage.input);
        result.tokens.output += metric(usage.output);
        result.tokens.cacheRead += metric(usage.cacheRead);
        result.tokens.cacheWrite += metric(usage.cacheWrite);
        result.tokens.total += metric(usage.totalTokens);
        if (object(usage.cost) && typeof usage.cost.total === 'number' && Number.isFinite(usage.cost.total) && usage.cost.total >= 0) {
          result.costUsd = (result.costUsd ?? 0) + usage.cost.total;
        }
      }
    }
  }
  return result;
}
