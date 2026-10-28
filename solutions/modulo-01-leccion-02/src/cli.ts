#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { buildPiArgs, getPiVersion, runPi, runPiJson } from './runtime.js';
import type { JsonView, PiMode } from './runtime.js';

const HELP = `Agent Harness Lab v0.2.0 — Módulo 1 / Lección 2

Uso:
  agent-lab doctor [--config archivo.json]
  agent-lab config [--config archivo.json]
  agent-lab run "prompt" [--mode print|json] [--view summary|events|tools] [--dry-run]
  agent-lab run-file archivo.md [--mode print|json] [--view summary|events|tools] [--dry-run]
  agent-lab --help

Flags comunes:
  --config archivo.json  Configuración del laboratorio
  --mode print|json      print (por defecto): texto final; json: eventos estructurados
  --view summary|events|tools  Sólo con --mode json; summary (por defecto) o JSONL original
  --dry-run              Mostrar argumentos preparados sin iniciar Pi

La salida de --view events contiene sólo JSONL en stdout; los diagnósticos van a stderr.
Limitación: seleccionar tools NO es un mecanismo de aislamiento del sistema operativo.`;

interface ParsedArgs {
  command: string;
  rest: string[];
  configFile?: string;
  mode: PiMode;
  view?: JsonView;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const rest: string[] = [];
  let configFile: string | undefined;
  let mode: PiMode = 'print';
  let view: JsonView | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--config' || token === '--mode' || token === '--view') {
      const value = argv[++i];
      if (!value) throw new Error(`${token} requiere un valor`);
      if (token === '--config') configFile = value;
      else if (token === '--mode') {
        if (value !== 'print' && value !== 'json') throw new Error('--mode debe ser print o json');
        mode = value;
      } else {
        if (value !== 'summary' && value !== 'events' && value !== 'tools') throw new Error('--view debe ser summary, events o tools');
        view = value;
      }
    } else if (token === '--dry-run') dryRun = true;
    else rest.push(token);
  }
  return { command: rest.shift() ?? '--help', rest, configFile, mode, view, dryRun };
}

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  const { command, rest, configFile, mode, view, dryRun } = parsed;
  if (['--help', '-h', 'help'].includes(command)) {
    console.log(HELP);
    return 0;
  }
  if (!['run', 'run-file', 'config', 'doctor'].includes(command)) {
    throw new Error(`Comando desconocido: ${command}. Usa --help.`);
  }
  if (view && mode !== 'json') throw new Error('--view sólo se permite con --mode json');
  if (!['run', 'run-file'].includes(command) && (mode !== 'print' || view || dryRun)) {
    throw new Error(`Las opciones --mode, --view y --dry-run sólo aplican a run y run-file`);
  }

  const { config, path } = loadConfig(process.cwd(), configFile);
  if (command === 'config') {
    if (rest.length) throw new Error('config no acepta otros argumentos');
    console.log(JSON.stringify({ path, config }, null, 2));
    return 0;
  }
  if (command === 'doctor') {
    if (rest.length) throw new Error('doctor no acepta otros argumentos');
    const version = await getPiVersion(config, process.cwd());
    console.log(`Pi encontrado: ${version}`);
    console.log('La autenticación debe verificarse desde Pi.');
    return 0;
  }
  let prompt: string;
  if (command === 'run-file') {
    if (rest.length !== 1) throw new Error('run-file requiere una sola ruta de archivo');
    try { prompt = readFileSync(resolve(process.cwd(), rest[0]), 'utf8').trim(); }
    catch (error) { throw new Error(`No se pudo leer el archivo: ${error instanceof Error ? error.message : String(error)}`); }
  } else prompt = rest.join(' ').trim();
  if (!prompt) throw new Error(`${command} requiere un prompt no vacío`);

  if (dryRun) {
    console.log(JSON.stringify({ command: config.pi.executable, args: buildPiArgs(prompt, config, mode), cwd: process.cwd() }, null, 2));
    return 0;
  }
  return mode === 'print'
    ? runPi(prompt, config, process.cwd())
    : runPiJson(prompt, config, process.cwd(), view ?? 'summary');
}

main(process.argv.slice(2))
  .then(code => { process.exitCode = code; })
  .catch(error => {
    console.error(`[agent-lab] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
