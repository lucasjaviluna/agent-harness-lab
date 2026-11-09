# US-LAB-009 — Solución completa (extensiones sensibles)

La solución añade `denyWriteExtensions` a la política, de forma que los ficheros `.pem`, `.key` y `.p12` queden **bloqueados incluso en TUI**. No modifica la extensión `approval-guard.ts` ni el runtime, sólo el evaluador de política.

## Aplicación

Después de terminar el ejercicio, para comparar tu implementación con la solución:

1. Copiá `.pi/policies/approval-policy.mjs` de esta carpeta al mismo path de la raíz (sobrescribiendo la versión de la práctica).
2. Copiá `.pi/policies/tool-approvals.json` de esta carpeta al mismo path de la raíz.
3. Copiá `tests/approval-extensions.test.mjs` al directorio `tests/` de la raíz.
4. Ejecutá `npm test` y `npm run typecheck`.

Se mantienen las reglas base de protección de rutas, bloqueo de shell y denegación sin UI. **No es un sandbox de sistema operativo.**
