import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import type { HarnessConfig } from './config.js';

// El instalador administrado de Pi en Windows incluye este lanzador junto a pi.cmd.
function piCommand(executable: string, args: string[], cwd: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    const hasPath = /[\\/]/.test(executable);
    const name = executable.split(/[\\/]/).pop()?.toLowerCase();
    if (name === 'pi' || name === 'pi.cmd') {
      const directories = hasPath
        ? [dirname(resolve(cwd, executable))]
        : (process.env.PATH ?? '').split(delimiter).filter(Boolean);
      for (const directory of directories) {
        const shim = join(directory, 'pi.cmd');
        const launcher = join(directory, 'pi-launcher.js');
        if (existsSync(shim) && existsSync(launcher)) {
          return { command: process.execPath, args: [launcher, ...args] };
        }
      }
    }
  }
  return { command: executable, args };
}

/** Prepara una invocación de Pi: mantenemos el boundary del proceso explícito. */
export function buildPiArgs(prompt: string, config: HarnessConfig): string[] {
  const args = ['--print'];
  if (config.pi.noSession) args.push('--no-session');
  if (config.pi.disableMcp) args.push('--no-mcp');
  if (config.pi.disableExtensions) args.push('--no-extensions');
  args.push('--tools', config.pi.tools.join(','));
  if (config.pi.model) args.push('--model', config.pi.model);
  if (config.pi.provider) args.push('--provider', config.pi.provider);
  args.push('--', prompt);
  return args;
}

export async function runPi(prompt: string, config: HarnessConfig, cwd: string): Promise<number> {
  const args = buildPiArgs(prompt, config);
  const invocation = piCommand(config.pi.executable, args, cwd);
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      stdio: 'inherit',
      env: process.env,
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, config.execution.timeoutMs);

    child.once('error', error => {
      clearTimeout(timer);
      reject(new Error(`No se pudo iniciar Pi (${config.pi.executable}): ${error.message}`));
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        console.error(`Se alcanzó el tiempo máximo (${config.execution.timeoutMs} ms).`);
        resolve(124);
      } else {
        resolve(code ?? 1);
      }
    });
  });
}

export async function getPiVersion(config: HarnessConfig, cwd: string): Promise<string> {
  const invocation = piCommand(config.pi.executable, ['--version'], cwd);
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { err += chunk.toString(); });
    child.once('error', e => reject(new Error(`Pi no disponible: ${e.message}`)));
    child.once('close', code => {
      if (code !== 0) reject(new Error(`Pi respondió con error: ${err.trim() || `código ${code}`}`));
      else resolve(out.trim() || '(sin información de versión)');
    });
  });
}
