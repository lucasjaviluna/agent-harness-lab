Agent Harness Lab v0.12.0 — Lección global 12
Base: snapshot v0.11.0 (Lección 11); el main de GitHub consultado todavía mostraba v0.10.0.
Aplicar primero Lección 11. Revisar los cambios propios antes de copiar archivos o aplicar el patch.
El ZIP incremental incluye sólo archivos nuevos/modificados; no elimina archivos.
No copiar automáticamente los ejemplos MCP a .pi ni reemplazar la política original: leer LECCION_12.md y combinar manualmente.
Ejecutar npm install, npm test, npm run typecheck y node examples/mcp/probe.mjs.
No se cambia src/runtime.ts, el launcher Windows ni la configuración de ejecución por defecto.
Node usado aquí: 22.16 (usar >=22.19 localmente); 151 tests pasan, 1 omitido Windows. Solución integrada: 154 pasan, 1 omitido.
Sin ejecución real de Pi, SDK optativo ni Azure. El servidor didáctico se probó por stdio.
