#!/usr/bin/env node
/** Entrada única de distribución. No se modifica la CLI histórica del curso. */
import { readFileSync } from 'node:fs';
import { subcommandTarget, delegateSubcommand } from './subcommand.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8') as string).version as string;
const HELP = `Agent Harness Lab v${VERSION} — Curso completo (20 lecciones)

Uso:
  agent-lab --version | --help
  agent-lab doctor | config | profiles | models [filtro]
  agent-lab context | skills list | extensions list
  agent-lab run "prompt" [opciones CLI existentes]
  agent-lab run-file <archivo.md> [opciones CLI existentes]
  agent-lab workflow [--story file.json | "prompt"] --mode plan|simulate|live [--governed]
  agent-lab team [--story file.json | "prompt"] --mode plan|simulate|live
  agent-lab rpc <opciones>
  agent-lab sdd route|review|instructions|verify <opciones>
  agent-lab evidence verify <runId>
  agent-lab telemetry <events.jsonl>     (sólo métricas agregadas)
  agent-lab readiness [--enforce]        (no certifica producción)

Para ayuda detallada del CLI anterior: node dist/cli.js --help (desde el repositorio).
Las herramientas Pi no son un sandbox. Evitar subir credenciales o prompts sensibles.
`;

async function main(args: string[]): Promise<number> {
  if (args.length === 0 || ['--help', '-h', 'help'].includes(args[0])) { console.log(HELP); return 0; }
  if (['--version', '-V', 'version'].includes(args[0])) { console.log(VERSION); return 0; }
  const target = subcommandTarget(args);
  return delegateSubcommand(target ?? { script: 'cli.js', args });
}
main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
  console.error('[agent-lab] '+(error instanceof Error ? error.message : 'Error inesperado'));
  process.exitCode = 1;
});
