/** Lección 20: un único ejecutable; cada comando conserva su implementación.
 * Delegar en Node (no shell) permite funcionar en Windows sin invocar .cmd. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROUTES: Record<string, string> = {
  workflow: 'workflow-cli.js',
  team: 'multi-agent-cli.js',
  rpc: 'rpc-cli.js',
  sdd: 'sdd-cli.js',
  evidence: 'evidence-cli.js',
  telemetry: 'telemetry-cli.js',
  readiness: 'readiness-cli.js',
};

export function subcommandTarget(argv: string[]): { script: string; args: string[] } | undefined {
  const script = Object.hasOwn(ROUTES, argv[0]) ? ROUTES[argv[0]] : undefined;
  if (!script) return undefined;
  let args = argv.slice(1);
  if (args[0] === '--') args = args.slice(1);
  if (argv[0] === 'evidence') {
    if (args[0] !== 'verify') throw new Error('Uso: agent-lab evidence verify <runId>');
    args = args.slice(1);
  }
  if (args.length > 100) throw new Error('Demasiados argumentos');
  return { script, args };
}

/** No interpretamos ni interpolamos los argumentos del operador. */
export async function delegateSubcommand(target: { script: string; args: string[] }): Promise<number> {
  const scriptPath = fileURLToPath(new URL(`./${target.script}`, import.meta.url));
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...target.args], {
      cwd: process.cwd(), env: process.env, shell: false, stdio: 'inherit', windowsHide: false,
    });
    const interrupt = () => { if (!child.killed) child.kill('SIGTERM'); };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => { cleanup(); resolve(signal ? 130 : code ?? 1); });
  });
}
