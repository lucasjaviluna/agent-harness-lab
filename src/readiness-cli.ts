import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readiness } from './readiness.js';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(x => x !== '--enforce')) {
  console.error('Uso: agent-lab readiness [--enforce]');
  process.exitCode = 1;
} else {
  const target = fileURLToPath(new URL('./lab-cli.js', import.meta.url));
  const value = readiness(process.version, existsSync(target));
  console.log(JSON.stringify(value, null, 2));
  if (args.includes('--enforce') && !value.canRunLab) process.exitCode = 2;
}
