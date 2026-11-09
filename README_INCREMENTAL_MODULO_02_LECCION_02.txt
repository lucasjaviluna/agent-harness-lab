MÓDULO 2 / LECCIÓN 2 — Extensiones TypeScript y eventos del ciclo de vida
Base: v0.6.0 → v0.7.0

REPOSITORIO: https://github.com/lucasjaviluna/agent-harness-lab
La rama main fue verificada en v0.5.0 al preparar esta entrega. PRIMERO incorporar v0.6.0.
El patch fue creado contra el snapshot v0.6.0 y debe revisarse con git apply --check.

Incluye:
- `.pi/extensions/lifecycle-observer.ts` y comando Pi `/lab-stats`.
- `src/extension-options.ts`, `src/extensions-report.ts`.
- `agent-lab extensions list`, `--extension` repetible y `--no-extensions`.
- Tests nuevos, ejercicios US-LAB-007 con solución separada, documentación.

Desde raíz del repo:
  git switch -c feature/modulo-02-leccion-02
  git apply --check agent_harness_lab_modulo_02_leccion_02.patch
  git apply agent_harness_lab_modulo_02_leccion_02.patch
  npm install
  npm test
  npm run typecheck
  node dist/cli.js extensions list

Si cambiaste tu repositorio, revisar git diff y comparar el ZIP incremental antes de aplicar.
NO incluir `node_modules`, `dist` ni secretos en el repositorio.
IMPORTANTE: no se modifica `piCommand()` ni su lógica Windows; no se sobrescriben tus Skills personales.
`--no-extensions` desactiva discovery, no las extensiones cargadas con `--extension`.
