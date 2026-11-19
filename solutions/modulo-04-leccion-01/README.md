# Solución US-LAB-017 · Verificación contra un ancla confiable

Copiar `src/evidence-anchor.ts` y `src/evidence-cli.ts` de esta carpeta a `src/` del laboratorio; copiar `tests/evidence-anchor.test.mjs` a `tests/`. Ejecutar `npm test` y `npm run typecheck`.

`npm run evidence:verify -- <runId> --expected-head <sha256>` primero verifica la cadena existente, después compara el último hash con un valor obtenido de una ubicación de confianza independiente. No leer el ancla desde el mismo directorio de evidencia. El ejemplo no incluye una infraestructura de firmas, timestamps confiables ni autenticación. La prueba de recálculo demuestra que la cadena por sí sola no da no repudio.
