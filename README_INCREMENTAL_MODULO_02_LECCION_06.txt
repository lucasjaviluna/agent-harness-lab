MÓDULO 2 / LECCIÓN 6 (Lección 11 global) — v0.11.0

Base: v0.10.0 del Agent Harness Lab. Aplicar el patch o los archivos del ZIP incremental.
No reemplazar package-lock.json ni archivos personalizados sin revisar el diff.

Novedades:
- --tools nombres separados por coma, aplicado sólo a run / run-file y sin alterar defaults.
- Tool catalog de solo lectura con exposición codemode y deferred.
- Configuración optativa de Pi para habilitar codemode y tool_search.
- Política del guard actualizada para permitir wrappers y las dos tools; los llamados anidados también pasan por tool_call.
- Ejemplos, tests y ejercicio US-LAB-011 con solución separada.

Advertencias:
- El selector --tools NO es sandbox ni limita necesariamente lo que llama codemode.
- La configuración de ejemplo habilita extensiones, lo cual requiere confianza en el proyecto.
- Con --no-extensions, las extensiones integradas de Pi codemode/tool_search pueden estar deshabilitadas.
- No se modificó piCommand() ni la estrategia Windows.
