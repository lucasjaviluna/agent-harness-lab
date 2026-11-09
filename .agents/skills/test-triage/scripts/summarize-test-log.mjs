#!/usr/bin/env node
// Script portatil, sin dependencias ni ejecución de comandos externos.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = process.argv[2];
if (!path) {
  console.error('Uso: node summarize-test-log.mjs archivo.log');
  process.exitCode = 2;
} else {
  try {
    const text = readFileSync(resolve(path), 'utf8');
    const match = text.match(/^# (?:tests|pass|fail|skipped) .+$/gm) ?? [];
    console.log(match.join('\n') || 'No se encontró un resumen de node:test.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
