# Solución — Módulo 1, Lección 4

Ejercicio: introducir `--session-id <id>` aprovechando la capacidad nativa de Pi.

1. Copia `src/cli.ts` y `src/session-options.ts` a la raíz del proyecto (sobrescribiendo sólo esos dos archivos).
2. Copia `tests/session-id.test.mjs` a `tests/`.
3. Ejecuta `npm test` y `node dist/cli.js run "hola" --session-id story-123 --dry-run`.

La solución acepta `--session-id` con `--fork` (elige el ID del fork). Lo rechaza con `--session` y `--continue`, y valida el formato del ID.
**No apliques estas fuentes automáticamente si aún deseas resolver el ejercicio.**
