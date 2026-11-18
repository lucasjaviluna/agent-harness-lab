/** Alternativa mantenida por Pi. No requiere nuestro cliente didáctico. */
import { RpcClient } from '@earendil-works/pi-coding-agent';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

async function main() {
  const [cliPath, prompt] = process.argv.slice(2);
  if (!cliPath || !existsSync(resolve(cliPath)) || !prompt?.trim() || prompt.trimStart().startsWith('/')) {
    throw new Error('Uso: rpc-native.example.ts <ruta-al-cli.js> <prompt>');
  }
  const client = new RpcClient({ cliPath: resolve(cliPath), cwd: process.cwd(), args: [
    '--no-session', '--no-tools', '--no-mcp', '--no-extensions', '--no-skills', '--no-context-files', '--no-prompt-templates',
  ] });
  try {
    await client.start();
    const events = await client.promptAndWait(prompt, undefined, 60000);
    const final = events.filter(e => e.type === 'message_end').map(e => e.message).filter(m => m.role === 'assistant').at(-1);
    const settled = events.filter(e => e.type === 'agent_settled').at(-1);
    if (!settled || settled.aborted || !final || final.role !== 'assistant' || final.stopReason !== 'stop') throw new Error('Ejecución incompleta');
    process.stdout.write(JSON.stringify({ text: final.content.filter(c => c.type === 'text').map(c => c.text).join('') }) + '\n');
  } finally { await client.stop(); }
}
main().catch(() => { process.stderr.write('RPC nativo: ejecución fallida; verificar ruta, versión y autenticación.\n'); process.exitCode = 1; });
