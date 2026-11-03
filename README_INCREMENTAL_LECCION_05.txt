AGENT HARNESS LAB — MÓDULO 1 / LECCIÓN 5 — INCREMENTAL v0.4.0 → v0.5.0

Origen: https://github.com/lucasjaviluna/agent-harness-lab

AVISO DE VERSIÓN
Al revisar GitHub, main todavía mostraba v0.3.0, mientras que el contenido
incremental de esta entrega PARTE DE LA v0.4.0 DE LA LECCIÓN 4.
Si aún no aplicaste la L4, hacelo antes de L5; NO intentes aplicar L5 sobre v0.3.

PROCEDIMIENTO
1. Respaldá cambios / git status, creá rama feature/module-01-lesson-05.
2. Confirmá que tu package.json declara v0.4.0 y que existe src/session-options.ts.
3. Si tu proyecto equivale a la v0.4.0 entregada, aplicá el patch:
   git apply --check agent_harness_lab_modulo_01_leccion_05.patch
   git apply agent_harness_lab_modulo_01_leccion_05.patch
   De lo contrario, copiá el ZIP incremental y revisá los cambios manualmente.
4. Conservá siempre package-lock.json, .agents/skills/ytk-memory y otros
   archivos propios; NO reemplaces el checkout con el full ZIP a ciegas.
5. npm install && npm test && npm run typecheck
6. node dist/cli.js context
7. node dist/cli.js run "Hola" --append-instructions examples/instructions/code-review.md --dry-run
8. Probar en Windows el comando doctor y un prompt real con el launcher configurado.

INCREMENTAL
- NUEVOS: src/context-options.ts, src/context-report.ts, tests/context.test.mjs,
  .pi/APPEND_SYSTEM.md, .pi/prompts/review.md, .pi/prompts/plan.md,
  examples/instructions/{code-review,test-first}.md, examples/context-experiment.md,
  LECCION_05.md, solutions/modulo-01-leccion-05/...
- MODIFICADOS: src/cli.ts, src/runtime.ts, package.json, README.md, CHANGELOG.md.

IMPORTANTE
- La inspección context sólo refleja recursos visibles en el cwd, no la carga
  real de Pi. Recursos .pi requieren trust explícito del proyecto.
- Los tests utilizan un Pi simulado; validá comportamiento autenticado localmente.
- El CLI nunca activa shell:true y mantiene la compatibilidad Windows de L4.
