# US-LAB-013 — Métricas por prompt

Solución optativa. Desde la raíz, comparar `src/sdk-runner.ts` con `solutions/modulo-03-leccion-02/src/sdk-runner.ts`, incorporar los cambios y copiar `tests/sdk-metrics.test.mjs` de esta carpeta a `tests/`. Ejecutar `npm test` y `npm run typecheck`. No reemplazar otros archivos.

`internalTurns` cuenta eventos `turn_end` por solicitud; `elapsedMs` mide tiempo monotónico de la observación de esa solicitud. No confundir turnos internos con cantidad de prompts del usuario ni con costo de tokens. El tiempo no incluye creación de la sesión ni carga de recursos.
