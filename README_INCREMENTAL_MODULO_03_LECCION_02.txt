Lección 13: aplicar sobre snapshot v0.12.0 (Lección 12). Main remoto consultado: v0.11.0.
Preferir git apply --check y git apply del patch; revisar diffs antes de copiar archivos.
No reemplazar src/runtime.ts, src/cli.ts, package-lock.json ni archivos propios: no forman parte de esta actualización (package.json sí cambia).
Ejecutar npm install, npm test, npm run typecheck con Node >=22.19.
Para SDK: npm install --prefix examples/sdk --ignore-scripts; npm run sdk:typecheck; npm run sdk:run -- "Hola".
No se instaló ni ejecutó SDK real en el entorno de generación por DNS EAI_AGAIN. Sólo se verificó el núcleo simulado y las regresiones. Leer LECCION_13.md para alcance y seguridad.
