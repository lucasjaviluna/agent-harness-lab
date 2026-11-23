import { lstatSync, readFileSync } from 'node:fs';
import { summarizeTelemetryJsonl } from './telemetry.js';

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] === '--help') {
    if (args.length === 1 && args[0] === '--help') {
      console.log('Uso: agent-lab telemetry <events.jsonl> (métricas agregadas, sin prompts)');
    } else throw new Error('Entrada inválida');
  } else {
    const stat = lstatSync(args[0]);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error('Archivo inválido');
    const summary = summarizeTelemetryJsonl(readFileSync(args[0], 'utf8'));
    console.log(JSON.stringify(summary, null, 2));
  }
} catch {
  console.error('[telemetry] Archivo inválido o inaccesible (máximo 4 MiB)');
  process.exitCode = 1;
}
