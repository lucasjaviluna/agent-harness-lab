#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { buildPiArgs, getPiVersion, runPi } from './runtime.js';

const HELP = `Agent Harness Lab v0.1.0 — Módulo 1 / Lección 1

Uso:
  agent-lab doctor [--config archivo.json]
  agent-lab config [--config archivo.json]
  agent-lab run "tu prompt" [--dry-run] [--config archivo.json]
  agent-lab run-file ruta.md [--dry-run] [--config archivo.json]
  agent-lab --help

Comandos:
  doctor     Comprueba si Pi está disponible y muestra su versión.
  config     Muestra la configuración efectiva (sin credenciales).
  run        Ejecuta una tarea de una sola invocación mediante Pi.
  run-file   Ejecuta el prompt contenido en un archivo UTF-8.

Por defecto: herramientas de consulta, sin sesiones persistidas, sin MCP y sin extensiones.
NOTA: limitar tools NO sustituye el aislamiento del sistema operativo.`;

function parseArgs(argv: string[]): { command: string; rest: string[]; configFile?: string } {
  const rest: string[] = [];
  let configFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') {
      if (!argv[i + 1]) throw new Error('--config requiere una ruta');
      configFile = argv[++i];
    } else rest.push(argv[i]);
  }
  return { command: rest.shift() ?? '--help', rest, configFile };
}

async function main(argv: string[]): Promise<number> {
  const { command, rest, configFile } = parseArgs(argv);
  if (command === '--help' || command === 'help' || command === '-h') {
    console.log(HELP);
    return 0;
  }
  if (!['run', 'run-file', 'config', 'doctor'].includes(command)) throw new Error(`Comando desconocido: ${command}. Usa --help.`);
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
    console.log('Autenticación y acceso al modelo deben verificarse desde Pi (/login y /model).');
    return 0;
  }
  const dryRun = rest.includes('--dry-run');
  const terms = rest.filter(token => token !== '--dry-run');
  let prompt: string;
  if (command === 'run-file') {
    if (terms.length !== 1) throw new Error('run-file requiere una única ruta de archivo');
    const file = resolve(process.cwd(), terms[0]);
    try {
      prompt = readFileSync(file, 'utf8').trim();
    } catch (error) {
      throw new Error(`No se pudo leer el prompt ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    prompt = terms.join(' ').trim();
  }
  if (!prompt) throw new Error('Se requiere un prompt no vacío. Ejemplo: agent-lab run "Describe este repositorio"');
  if (dryRun) {
    console.log(JSON.stringify({ command: config.pi.executable, args: buildPiArgs(prompt, config), cwd: process.cwd() }, null, 2));
    return 0;
  }
  return await runPi(prompt, config, process.cwd());
}

main(process.argv.slice(2))
  .then(code => { process.exitCode = code; })
  .catch(error => {
    console.error(`[agent-lab] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
