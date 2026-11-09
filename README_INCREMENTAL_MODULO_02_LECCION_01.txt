Agent Harness Lab — actualización incremental v0.5.0 → v0.6.0
Módulo 2 · Lección 1 — Skills y capacidades especializadas

BASE:
  v0.5.0 del curso; el package.json/CHANGELOG públicos del repositorio main
  muestran esta versión. El patch está producido contra el ZIP v0.5.0 que se
  entregó con la Lección 5 (no sobre un git clone de main).

ARCHIVOS NUEVOS:
  src/skill-options.ts
  src/skills-report.ts
  tests/skills.test.mjs
  .agents/skills/agent-review/**
  .agents/skills/test-triage/**
  examples/skills/**
  solutions/modulo-02-leccion-01/**
  LECCION_06.md
  README_INCREMENTAL_MODULO_02_LECCION_01.txt

ARCHIVOS MODIFICADOS:
  src/cli.ts, src/runtime.ts, package.json, README.md, CHANGELOG.md.

NO CAMBIAR:
  Tu Skill .agents/skills/ytk-memory ni las modificaciones propias de tests
  y Windows; no se sobreescriben archivos de estas rutas.
  No borrar package-lock.json: npm install resolverá el nuevo número de
  versión local, sin agregar dependencias.

COMANDOS:
  npm install
  npm test
  npm run typecheck
  node dist/cli.js skills list
  node dist/cli.js run 'Revisar' --skill .agents/skills/agent-review --dry-run

PRACTICA:
  La solución de US-LAB-006 está separada, NO aplicada en src/ del proyecto.
