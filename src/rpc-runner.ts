import { parseArgs } from 'node:util';
import { LabRpcClient, asRecord } from './rpc-client.js';
import { loadConfig } from './config.js';

export interface RpcRunOptions { prompts: string[]; timeoutMs: number; readOnly: boolean; stream: boolean; resetBetween: boolean; config?: string; provider?: string; model?: string; thinking?: string; }
export function parseRpcArgs(argv: string[]): RpcRunOptions {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
    config: {type:'string'}, 'read-only': {type:'boolean'}, stream: {type:'boolean'}, 'reset-between': {type:'boolean'}, 'timeout-ms': {type:'string'}, provider: {type:'string'}, model: {type:'string'}, thinking: {type:'string'},
  } });
  const timeoutMs = Number(values['timeout-ms'] ?? '120000');
  if (!positionals.length || positionals.some(p => !p.trim() || p.trimStart().startsWith('/'))) throw new Error('Se requiere al menos un prompt de texto (sin comandos /)');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 1800000) throw new Error('Timeout inválido');
  for (const v of [values.provider, values.model]) if (v !== undefined && (!v.trim() || v.startsWith('-'))) throw new Error('Modelo/proveedor inválido');
  if (values.thinking !== undefined && !['off','minimal','low','medium','high','xhigh','max'].includes(values.thinking)) throw new Error('Thinking inválido');
  return { prompts: positionals, timeoutMs, readOnly: !!values['read-only'], stream: !!values.stream, resetBetween: !!values['reset-between'], config: values.config, provider: values.provider, model: values.model, thinking: values.thinking };
}
export async function runRpc(options: RpcRunOptions): Promise<void> {
  const cwd = process.cwd();
  const { config } = loadConfig(cwd, options.config);
  // Perfil RPC didáctico cerrado: sólo se reutiliza el ejecutable configurado.
  const client = LabRpcClient.start({ executable: config.pi.executable, cwd, readOnly: options.readOnly, provider: options.provider, model: options.model, thinking: options.thinking });
  const unsub = client.subscribe(event => {
    if (!options.stream || event.type !== 'message_update') return;
    const delta = asRecord(event.assistantMessageEvent);
    if (delta?.type === 'text_delta' && typeof delta.delta === 'string') process.stderr.write(delta.delta);
  });
  let interrupted = false;
  const interrupt = () => { interrupted = true; void client.abort().catch(() => {}); };
  process.once('SIGINT', interrupt);
  try {
    await client.getState(Math.min(options.timeoutMs, 10000));
    const turns = [];
    for (const [i, prompt] of options.prompts.entries()) {
      if (interrupted) throw new Error('RPC_INTERRUPTED');
      if (i && options.resetBetween) await client.newSession(Math.min(options.timeoutMs, 10000));
      if (interrupted) throw new Error('RPC_INTERRUPTED');
      turns.push(await client.prompt(prompt, options.timeoutMs));
      if (interrupted) throw new Error('RPC_INTERRUPTED');
    }
    if (options.stream) process.stderr.write('\n');
    console.log(JSON.stringify({ turns }, null, 2));
  } finally {
    process.removeListener('SIGINT', interrupt); unsub(); await client.close();
  }
}
