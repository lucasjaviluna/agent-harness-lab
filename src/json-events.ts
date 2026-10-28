/** L2: interpretación mínima de los eventos JSONL documentados por Pi. */

export interface PiJsonSummary {
  ok: boolean;
  exitCode: number;
  sessionId?: string;
  eventCount: number;
  turns: number;
  tools: Record<string, number>;
  toolErrors: number;
  settled: boolean;
  aborted: boolean;
  stopReason?: string;
  lastAssistantText: string;
  error?: string;
}

type ObjectValue = Record<string, unknown>;

function isObject(input: unknown): input is ObjectValue {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

/** No asumimos que todos los eventos tengan el mismo schema. */
export function parsePiEvent(line: string): ObjectValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    throw new Error('Registro JSONL inválido emitido por Pi');
  }
  if (!isObject(parsed) || typeof parsed.type !== 'string') {
    throw new Error('El registro de Pi debe ser un objeto con campo type');
  }
  return parsed;
}

export class JsonEventCollector {
  private eventCount = 0;
  private turns = 0;
  private tools: Record<string, number> = {};
  private toolErrors = 0;
  private sessionId?: string;
  private sawHeader = false;
  private sawSettled = false;
  private aborted = false;
  private stopReason?: string;
  private lastAssistantText = '';

  ingest(event: ObjectValue): void {
    this.eventCount++;
    if (event.type === 'session') {
      this.sawHeader = true;
      if (typeof event.id === 'string') this.sessionId = event.id;
    }
    if (event.type === 'turn_end') this.turns++;
    if (event.type === 'tool_execution_start' && typeof event.toolName === 'string') {
      this.tools[event.toolName] = (this.tools[event.toolName] ?? 0) + 1;
    }
    if (event.type === 'tool_execution_end' && event.isError === true) this.toolErrors++;
    if (event.type === 'agent_settled') {
      this.sawSettled = true;
      this.aborted = event.aborted === true;
    }
    if (event.type === 'message_end' && isObject(event.message) && event.message.role === 'assistant') {
      const message = event.message;
      this.stopReason = typeof message.stopReason === 'string' ? message.stopReason : undefined;
      if (Array.isArray(message.content)) {
        this.lastAssistantText = message.content
          .filter((block): block is ObjectValue => isObject(block) && block.type === 'text' && typeof block.text === 'string')
          .map(block => block.text)
          .join('');
      }
    }
  }

  finish(processExitCode: number, protocolError?: string): PiJsonSummary {
    const failure = protocolError
      ?? (!this.sawHeader ? 'Pi no emitió la cabecera session' : undefined)
      ?? (!this.sawSettled ? 'Pi no emitió agent_settled' : undefined)
      ?? (this.aborted ? 'Ejecución abortada' : undefined)
      ?? (['error', 'aborted', 'length'].includes(this.stopReason ?? '')
        ? `Respuesta incompleta o fallida: ${this.stopReason}` : undefined)
      ?? (processExitCode !== 0 ? `Pi terminó con código ${processExitCode}` : undefined);
    return {
      ok: !failure,
      exitCode: processExitCode,
      ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      eventCount: this.eventCount,
      turns: this.turns,
      tools: this.tools,
      toolErrors: this.toolErrors,
      settled: this.sawSettled,
      aborted: this.aborted,
      ...(this.stopReason ? { stopReason: this.stopReason } : {}),
      lastAssistantText: this.lastAssistantText,
      ...(failure ? { error: failure } : {}),
    };
  }
}
