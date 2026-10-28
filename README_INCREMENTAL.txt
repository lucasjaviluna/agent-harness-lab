# Agent Harness Lab — actualización incremental de Módulo 1 / Lección 2
Nivel: Principiante–Intermedio · Complejidad: Media

Este ZIP contiene SÓLO archivos nuevos/modificados respecto al ZIP original v0.1.0.
TODOS los paths dentro del ZIP son relativos a la RAÍZ de `agent-harness-lab`.

Pasos recomendados:
  git checkout -b feature/module-01-lesson-02
  # Hacer copia local o git stash si tienes cambios sin commitear.
  # Descomprimir este ZIP sobre la raíz del repo, revisando conflictos.
  npm install
  npm test
  npm run typecheck
  git diff

La solución del ejercicio L1 (`run-file`) fue incorporada al core.
Si la implementaste por tu cuenta, compara src/cli.ts antes de sobreescribir.

No incluye node_modules/ ni dist/ ni credenciales.

Archivos cambiados:
  .gitignore
  CHANGELOG.md
  LECCION_02.md
  README.md
  examples/pi-json-session.jsonl
  examples/rpc-command.example.jsonl
  examples/sdk-minimal.example.ts
  package.json
  solutions/modulo-01-leccion-02/README.md
  solutions/modulo-01-leccion-02/src/cli.ts
  solutions/modulo-01-leccion-02/src/runtime.ts
  solutions/modulo-01-leccion-02/tests/tool-view.integration.test.mjs
  solutions/modulo-01-leccion-02/tests/tools.test.mjs
  src/cli.ts
  src/json-events.ts
  src/runtime.ts
  tests/json.test.mjs

Archivos borrados:
  (ninguno)
