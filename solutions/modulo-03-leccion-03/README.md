# Solución US-LAB-014: consultar estadísticas RPC acumuladas

No implementar contabilidad propia ni interpretar el texto del modelo. Agregar `getSessionStats()` a `LabRpcClient`, delegar al comando `get_session_stats`, validar números y devolver sólo `userMessages`, `totalTokens` y `cost`. La cifra de coste es la estimación de Pi; no es una factura. No mostrar rutas ni IDs. Consultar con la sesión inactiva. Este contrato es intencionalmente más pequeño que la respuesta nativa.

Para usar la solución, estando en una rama de práctica y desde la raíz, copiar `src/rpc-client.ts` y `tests/rpc-stats.test.mjs` **de esta carpeta** a los directorios homónimos del proyecto. Luego ejecutar `npm test`. Ejemplo programático: `await client.prompt('Hola'); console.log(await client.getSessionStats());`.

Los valores sintéticos del fixture sirven para comprobar el contrato sin coste; no representan consumo real.
