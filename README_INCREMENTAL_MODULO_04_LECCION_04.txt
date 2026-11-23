AGENT HARNESS LAB — V1.0.0 — LECCIÓN GLOBAL 20
Módulo 4 / Lección 4 — Testing, observabilidad, seguridad y distribución.

BASE: aplicar sobre la v0.19.0. Usa preferentemente el patch:
  git apply --check agent_harness_lab_modulo_04_leccion_04.patch
  git apply agent_harness_lab_modulo_04_leccion_04.patch

Después:
  npm install
  npm test
  npm run typecheck
  npm run release:smoke

El patch no modifica el package-lock.json del usuario. Ejecutar npm install en tu checkout para reconciliarlo; verificar el diff antes del commit. Se preservan src/runtime.ts, src/rpc-client.ts, src/sdk-runner.ts, la lógica Windows y archivos del usuario.

No usar el snapshot completo para sobrescribir archivos personales de memoria, bases SQLite o el package-lock. Versión 1.0.0 = cierre del laboratorio educativo, NO certificación de seguridad empresarial. El paquete sigue private=true y UNLICENSED.
