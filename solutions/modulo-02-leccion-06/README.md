# Solución US-LAB-011 — `--exclude-tools`

**Módulo 2 · Lección 6 (global 11) · Nivel Avanzado · Complejidad Alta.**

Para probar la solución sin sobrescribir tu código original, copiá estos archivos a una **copia** del proyecto v0.11.0 (respetando las rutas), y ejecutá `npm test` y `npm run typecheck`.

- `src/tool-selection.ts` añade `excludeTools` y `parseExcludedTools`.
- `src/cli.ts` reconoce el flag, valida repeticiones y lo restringe a `run`/`run-file`.
- `src/runtime.ts` emite `--exclude-tools` a Pi sin usar shell.
- `tests/exclude-tools.test.mjs` incluye cuatro tests propios.

En PowerShell usá una sola línea para los comandos del README.

**Nota:** Pi define la semántica de exclusión; esto no es un sandbox del sistema operativo.
