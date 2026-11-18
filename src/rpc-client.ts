/** Lección 14: cliente JSONL didáctico. Para integraciones generales preferir RpcClient de Pi. */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { piCommand } from "./runtime.js";

type RecordValue = Record<string, unknown>;
export function asRecord(input: unknown): RecordValue | undefined {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as RecordValue)
    : undefined;
}
const MAX_RECORD = 16 * 1024 * 1024;
const DIALOGS = new Set(["confirm", "select", "input", "editor"]);

/** LF solamente; conserva U+2028/U+2029 y caracteres UTF-8 fragmentados. */
export class RpcFramer {
  private decoder = new StringDecoder("utf8");
  private pending = "";
  push(chunk: Buffer, emit: (record: RecordValue) => void): void {
    this.pending += this.decoder.write(chunk);
    let index: number;
    while ((index = this.pending.indexOf("\n")) >= 0) {
      const line = this.pending.slice(0, index).replace(/\r$/, "");
      this.pending = this.pending.slice(index + 1);
      if (Buffer.byteLength(line) > MAX_RECORD)
        throw new Error("RPC_RECORD_TOO_LARGE");
      const value = asRecord(JSON.parse(line));
      if (!value || typeof value.type !== "string")
        throw new Error("RPC_INVALID_RECORD");
      emit(value);
    }
    if (Buffer.byteLength(this.pending) > MAX_RECORD)
      throw new Error("RPC_RECORD_TOO_LARGE");
  }
  finish(): void {
    if (this.pending + this.decoder.end())
      throw new Error("RPC_INCOMPLETE_RECORD");
  }
}
interface Pending {
  command: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
}
export interface RpcTurn {
  text: string;
  events: number;
  tools: number;
  toolErrors: number;
}
export interface RpcLaunch {
  executable: string;
  cwd: string;
  readOnly?: boolean;
  model?: string;
  provider?: string;
  thinking?: string;
}
export function buildRpcArgs(options: RpcLaunch): string[] {
  const args = [
    "--mode",
    "rpc",
    "--no-session",
    "--no-mcp",
    "--no-extensions",
    "--no-skills",
    "--no-context-files",
    "--no-prompt-templates",
  ];
  if (options.readOnly) args.push("--tools", "read,grep,find,ls");
  else args.push("--no-tools");
  if (options.provider) args.push("--provider", options.provider);
  if (options.model) args.push("--model", options.model);
  if (options.thinking) args.push("--thinking", options.thinking);
  return args;
}
function deadline(ms: number): void {
  if (!Number.isSafeInteger(ms) || ms < 1 || ms > 1800000)
    throw new Error("Timeout inválido");
}

export class LabRpcClient {
  private pending = new Map<string, Pending>();
  private listeners = new Set<(event: RecordValue) => void>();
  private failureListeners = new Set<(error: Error) => void>();
  private failure?: Error;
  private closing = false;
  private closed = false;
  private busy = false;
  private exited: Promise<void>;
  private closeTask?: Promise<void>;
  private framer = new RpcFramer();

  /** Inyección del proceso para tests multiplataforma sin Pi instalado. */
  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.exited = new Promise((resolve) =>
      child.once("close", () => {
        this.closed = true;
        resolve();
      }),
    );
    child.stdout.on("data", (chunk: Buffer) => {
      if (this.failure) return;
      try {
        this.framer.push(chunk, (value) => this.receive(value));
      } catch {
        this.fail(new Error("RPC_PROTOCOL_ERROR"));
      }
    });
    child.stdout.on("end", () => {
      try {
        this.framer.finish();
      } catch {
        this.fail(new Error("RPC_INCOMPLETE_RECORD"));
      }
    });
    child.on("error", () => this.fail(new Error("RPC_PROCESS_ERROR")));
    child.stdin.on("error", () => {
      if (!this.closing) this.fail(new Error("RPC_STDIN_ERROR"));
    });
    child.stdout.on("error", () => this.fail(new Error("RPC_STDOUT_ERROR")));
    // Drenar stderr continuamente, sin enviarlo al modelo ni mezclarlo con JSONL.
    child.stderr.resume();
    child.stderr.on("error", () => this.fail(new Error("RPC_STDERR_ERROR")));
    child.once("close", () => {
      if (!this.closing || this.pending.size || this.busy)
        this.fail(new Error("RPC_PROCESS_EXIT"));
    });
  }
  static start(options: RpcLaunch): LabRpcClient {
    const invocation = piCommand(
      options.executable,
      buildRpcArgs(options),
      options.cwd,
    );
    return new LabRpcClient(
      spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        shell: false,
        stdio: "pipe",
      }),
    );
  }
  subscribe(listener: (event: RecordValue) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private fail(error: Error): void {
    if (this.failure) return;
    this.failure = error;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    for (const listener of [...this.failureListeners]) listener(error);
  }
  private write(record: RecordValue): void {
    // Cada escritura queda ordenada por el stream; el número de solicitudes pendientes está acotado.
    const line = JSON.stringify(record) + "\n";
    if (
      Buffer.byteLength(line) > MAX_RECORD ||
      this.child.stdin.writableLength + Buffer.byteLength(line) > MAX_RECORD
    ) {
      this.fail(new Error("RPC_INPUT_LIMIT"));
      return;
    }
    this.child.stdin.write(line, (error) => {
      if (error && !this.closing) this.fail(new Error("RPC_WRITE_ERROR"));
    });
  }
  private receive(record: RecordValue): void {
    if (this.failure) return;
    if (record.type === "response") {
      const pending =
        typeof record.id === "string" ? this.pending.get(record.id) : undefined;
      if (
        !pending ||
        pending.command !== record.command ||
        typeof record.success !== "boolean"
      ) {
        this.fail(new Error("RPC_UNEXPECTED_RESPONSE"));
        return;
      }
      this.pending.delete(record.id as string);
      clearTimeout(pending.timer);
      if (record.success) pending.resolve(record.data);
      else
        pending.reject(new Error(`RPC_COMMAND_REJECTED: ${pending.command}`));
      return;
    }
    if (record.type === "extension_ui_request") {
      // Sin operador interactivo: cancelación explícita, nunca auto-approve.
      if (
        typeof record.id === "string" &&
        typeof record.method === "string" &&
        DIALOGS.has(record.method)
      ) {
        this.write({
          type: "extension_ui_response",
          id: record.id,
          cancelled: true,
        });
      }
      return;
    }
    for (const listener of [...this.listeners]) listener(record);
  }
  private request(
    command: string,
    fields: RecordValue,
    timeoutMs: number,
  ): Promise<unknown> {
    deadline(timeoutMs);
    if (this.failure || this.closing || this.closed)
      return Promise.reject(this.failure ?? new Error("RPC_CLOSED"));
    if (this.pending.size >= 32)
      return Promise.reject(new Error("RPC_TOO_MANY_REQUESTS"));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new Error(`RPC_COMMAND_TIMEOUT: ${command}`)),
        timeoutMs,
      );
      this.pending.set(id, { command, timer, resolve, reject });
      try {
        this.write({ ...fields, type: command, id });
      } catch {
        this.fail(new Error("RPC_WRITE_ERROR"));
      }
    });
  }
  getState(timeoutMs = 10000): Promise<unknown> {
    return this.request("get_state", {}, timeoutMs);
  }
  getMessages(timeoutMs = 10000): Promise<unknown> {
    return this.request("get_messages", {}, timeoutMs);
  }
  abort(timeoutMs = 3000): Promise<unknown> {
    return this.request("abort", {}, timeoutMs);
  }
  async newSession(timeoutMs = 10000): Promise<void> {
    if (this.busy) throw new Error("RPC_BUSY");
    this.busy = true;
    try {
      const data = asRecord(await this.request("new_session", {}, timeoutMs));
      if (data?.cancelled !== false) throw new Error("RPC_SESSION_NOT_CREATED");
    } finally {
      this.busy = false;
    }
  }
  async prompt(message: string, timeoutMs = 120000): Promise<RpcTurn> {
    deadline(timeoutMs);
    if (
      !message.trim() ||
      message.trimStart().startsWith("/") ||
      Buffer.byteLength(message) > 128 * 1024
    )
      throw new Error("RPC_INVALID_PROMPT");
    if (this.busy) throw new Error("RPC_BUSY");
    if (this.failure || this.closing)
      throw this.failure ?? new Error("RPC_CLOSED");
    this.busy = true;
    let events = 0,
      tools = 0,
      toolErrors = 0;
    let final: RecordValue | undefined;
    let settle!: (aborted: boolean) => void;
    const settled = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const unsubscribe = this.subscribe((e) => {
      events++;
      if (e.type === "tool_execution_start") tools++;
      if (e.type === "tool_execution_end" && e.isError === true) toolErrors++;
      if (e.type === "message_end") {
        const m = asRecord(e.message);
        if (m?.role === "assistant") final = m;
      }
      if (e.type === "agent_settled") settle(e.aborted !== false);
    });
    let rejectRun!: (error: Error) => void;
    const failed = new Promise<never>((_, reject) => {
      rejectRun = reject;
    });
    this.failureListeners.add(rejectRun);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      rejectRun(new Error("RPC_PROMPT_TIMEOUT"));
    }, timeoutMs);
    // Suscripción anterior al envío; esperar tanto ACK como asentamiento, en cualquier orden.
    const work = async (): Promise<RpcTurn> => {
      const ack = asRecord(
        await this.request(
          "prompt",
          { message },
          Math.min(1800000, timeoutMs + 1500),
        ),
      );
      if (ack?.disposition !== "started")
        throw new Error("RPC_PROMPT_NOT_STARTED");
      if ((await settled) || final?.stopReason !== "stop")
        throw new Error("RPC_INCOMPLETE_RUN");
      const content = Array.isArray(final.content) ? final.content : [];
      const text = content
        .map(asRecord)
        .filter((x) => x?.type === "text" && typeof x.text === "string")
        .map((x) => x!.text as string)
        .join("");
      return { text, events, tools, toolErrors };
    };
    try {
      return await Promise.race([work(), failed]);
    } catch (error) {
      // El estado es ambiguo tras timeout, error, abort o disposición inesperada: no reutilizar.
      if (expired && !this.failure) await this.abort(1500).catch(() => {});
      this.fail(error instanceof Error ? error : new Error("RPC_RUN_ERROR"));
      throw error;
    } finally {
      clearTimeout(timer);
      unsubscribe();
      this.failureListeners.delete(rejectRun);
      settle(true);
      this.busy = false;
    }
  }
  close(): Promise<void> {
    return (this.closeTask ??= this.shutdown());
  }
  private async shutdown(): Promise<void> {
    this.closing = true;
    this.fail(new Error("RPC_CLOSED"));
    if (this.closed) return;
    this.child.stdin.end();
    const wait = async (ms: number): Promise<boolean> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          this.exited.then(() => true),
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), ms);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    if (await wait(500)) return;
    this.child.kill("SIGTERM");
    if (await wait(500)) return;
    this.child.kill("SIGKILL");
    if (await wait(500)) return;
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    this.child.stderr.destroy();
    this.child.unref();
    throw new Error("RPC_SHUTDOWN_UNCONFIRMED");
  }
}
