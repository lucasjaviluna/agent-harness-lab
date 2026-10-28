import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { HarnessConfig } from './config.js';
import { JsonEventCollector, parsePiEvent } from './json-events.js';

// El instalador administrado de Pi en Windows incluye este lanzador junto a pi.cmd.
function piCommand(executable: string, args: string[], cwd: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    const hasPath = /[\\/]/.test(executable);
    const name = executable.split(/[\\/]/).pop()?.toLowerCase();
    if (name === 'pi' || name === 'pi.cmd') {
      const directories = hasPath ? [dirname(resolve(cwd, executable))] : (process.env.PATH ?? '').split(delimiter).filter(Boolean);
      for (const directory of directories) {
        const shim = join(directory, 'pi.cmd');
        const launcher = join(directory, 'pi-launcher.js');
        if (existsSync(shim) && existsSync(launcher)) return { command: process.execPath, args: [launcher, ...args] };
      }
    }
  }
  return { command: executable, args };
}

export type PiMode = 'print' | 'json';
export type JsonView = 'summary' | 'events';

/** Mismo contrato de configuración de Lección 1, ahora con elección de modo. */
export function buildPiArgs(prompt: string, config: HarnessConfig, mode: PiMode = 'print'): string[] {
  const args = mode === 'print' ? ['--print'] : ['--mode', 'json'];
  if (config.pi.noSession) args.push('--no-session');
  if (config.pi.disableMcp) args.push('--no-mcp');
  if (config.pi.disableExtensions) args.push('--no-extensions');
  args.push('--tools', config.pi.tools.join(','));
  if (config.pi.model) args.push('--model', config.pi.model);
  if (config.pi.provider) args.push('--provider', config.pi.provider);
  args.push('--', prompt);
  return args;
}

/** Print sigue funcionando sin cambios para preservar compatibilidad. */
export async function runPi(prompt: string, config: HarnessConfig, cwd: string): Promise<number> {
  const args = buildPiArgs(prompt, config);
  const invocation = piCommand(config.pi.executable, args, cwd);
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd, shell: false, stdio: 'inherit', env: process.env,
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
      } else resolve(code ?? 1);
    });
  });
}

/**
 * JSONL de una única invocación. Sólo se separa por LF (NO node:readline).
 * En modo events, stdout queda reservado a registros JSONL válidos.
 */
export async function runPiJson(prompt: string, config: HarnessConfig, cwd: string, view: JsonView): Promise<number> {
  const args = buildPiArgs(prompt, config, 'json');
  const invocation = piCommand(config.pi.executable, args, cwd);
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd, shell: false, env: process.env, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const collector = new JsonEventCollector();
    const decoder = new StringDecoder('utf8');
    const MAX_PENDING_BYTES = 16 * 1024 * 1024;
    let pending = '';
    let protocolError: string | undefined;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, config.execution.timeoutMs);

    function invalidate(message: string): void {
      if (!protocolError) {
        protocolError = message;
        child.kill('SIGTERM');
      }
    }
    function consume(line: string): void {
      if (protocolError) return;
      try {
        const event = parsePiEvent(line.endsWith('\r') ? line.slice(0, -1) : line);
        collector.ingest(event);
        if (view === 'events') process.stdout.write(`${line}\n`);
      } catch (error) {
        invalidate(error instanceof Error ? error.message : String(error));
      }
    }
    function readChunk(chunk: string): void {
      pending += chunk;
      let index: number;
      while ((index = pending.indexOf('\n')) !== -1 && !protocolError) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 1);
        if (Buffer.byteLength(line, 'utf8') > MAX_PENDING_BYTES) {
          invalidate('Registro JSONL demasiado grande');
          break;
        }
        consume(line);
      }
      if (Buffer.byteLength(pending, 'utf8') > MAX_PENDING_BYTES) {
        invalidate('Registro JSONL demasiado grande');
      }
    }

    child.stdout.on('data', (chunk: Buffer) => readChunk(decoder.write(chunk)));
    child.stdout.once('end', () => {
      readChunk(decoder.end());
      if (pending.length && !protocolError) invalidate('Último registro JSONL sin terminador LF');
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(new Error(`No se pudo iniciar Pi (${config.pi.executable}): ${error.message}`));
    });
    child.once('close', code => {
      clearTimeout(timer);
      const exitCode = timedOut ? 124 : (code ?? 1);
      const summary = collector.finish(exitCode, timedOut ? 'Tiempo máximo excedido' : protocolError);
      if (view === 'summary') process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      if (!summary.ok) process.stderr.write(`[agent-lab] ${summary.error ?? 'Ejecución JSON fallida'}\n`);
      resolve(timedOut ? 124 : protocolError ? 65 : !summary.ok ? (exitCode || 1) : 0);
    });
  });
}

export async function getPiVersion(config: HarnessConfig, cwd: string): Promise<string> {
  const invocation = piCommand(config.pi.executable, ['--version'], cwd);
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000,
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
