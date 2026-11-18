# US-LAB-012 — list_stories

Ejecutar la solución sin tocar la base:

```bash
node --test solutions/modulo-03-leccion-01/tests/list-stories.test.mjs
```

Los dos archivos `examples/mcp/` de esta carpeta son reemplazos completos de los homónimos de la raíz del repositorio. Para integrar, copiarlos tras revisar el diff y copiar `tests/list-stories.test.mjs` a `tests/`. La prueba general de MCP sólo exige la primera herramienta y sigue siendo válida. `npm test` ejecutará ambas suites. La alternativa SDK requiere registrar `listTool` allí también; el ejercicio se centra en el servidor didáctico.

No se activa la herramienta automáticamente. Agregar `mcp__lab_stories__list_stories` a la lista `pi.tools` de una copia de `examples/config/harness.mcp.example.json` y, después de revisar implementación y origen del servidor, a `allowMcpTools` de la política local. Mantener `denyTools`/`askTools` existentes; deny y ask ganan. Si no se agrega, se bloquea o no se expone. La herramienta no lee archivos y no realiza llamadas externas.
