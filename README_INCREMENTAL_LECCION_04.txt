AGENT HARNESS LAB — MÓDULO 1 / LECCIÓN 4 — INCREMENTAL SOBRE v0.3.0

Origen: https://github.com/lucasjaviluna/agent-harness-lab

Esta actualización fue preparada tomando como referencia el código público y
los arreglos Windows existentes, pero no fue posible clonar el repositorio
por restricciones de conexión del entorno. Verifica tus diffs antes de copiar.

PROCEDIMIENTO RECOMENDADO
1. git switch -c feature/modulo-01-leccion-04
2. Copia los archivos de este ZIP a la raíz del repositorio,
   manteniendo tu package-lock.json, tu .agents/ y cualquier archivo propio.
3. Confirma especialmente en src/runtime.ts que piCommand()/pi-launcher.js
   y shell:false siguen presentes. No elimines tests ya modificados para Win.
4. npm install
5. npm test
6. npm run typecheck
7. node dist/cli.js run "hola" --persist --dry-run
8. Ejecuta con Pi real autenticado y realiza /tree, /compact en modo interactivo.

Archivos nuevos: src/session-options.ts, tests/sessions.test.mjs,
LECCION_04.md, ejemplos de sesiones/prompt, solutions/modulo-01-leccion-04/.
Modificados: src/cli.ts, src/runtime.ts, README.md, CHANGELOG.md,
package.json, .gitignore.

Las soluciones del ejercicio se ubican fuera de src/ para no aplicarlas
por accidente. No reemplaces todo el repositorio con el ZIP full si tienes
archivos adicionales; el full es un snapshot didáctico reconstruido.

No se proporcionan credenciales. Las sesiones reales pueden almacenar datos
sensibles, por lo que el directorio de prácticas 'sesiones-locales/' está
en .gitignore.
