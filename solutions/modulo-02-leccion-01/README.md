# US-LAB-006 — Solución de referencia: `agent-lab skills check`

**Módulo 2 · Lección 1 — Skills · Nivel intermedio · Complejidad media**

La solución NO está aplicada al código principal: se entrega por separado para practicar primero.

Copiá estos tres archivos a sus ubicaciones equivalentes en la raíz del proyecto:

- `src/skills-check.ts` → `src/skills-check.ts`.
- `src/cli.ts` → `src/cli.ts` (es la versión COMPLETA del CLI al finalizar la lección).
- `tests/skills-check.test.mjs` → `tests/skills-check.test.mjs`.

Después ejecutá `npm test`, `npm run typecheck` y `node dist/cli.js skills check`.

El comando verifica metadatos portables, nombres duplicados y cuerpos vacíos, pero NO simula el parser YAML completo ni confirma que Pi haya cargado las Skills. El código debe mantenerse en un ejercicio aislado hasta validarlo.
