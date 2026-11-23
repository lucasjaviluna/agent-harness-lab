# US-LAB-019 — Especialista de riesgos condicional

Copiá `src/multi-agent.ts` de esta solución a `src/multi-agent.ts` de la raíz y `tests/risk-reviewer.test.mjs` a `tests/risk-reviewer.test.mjs`. Hacelo en una rama de ejercicio. Ejecutá `npm test` y `npm run typecheck`.

La solución agrega `risk-reviewer` sólo si `classify()` devuelve `complex`. El fan-in se calcula a partir del conjunto seleccionado. No cambia el pool, los permisos, el límite de concurrencia ni el runtime RPC. El resultado no constituye aprobación humana ni una evaluación de seguridad verificada.
