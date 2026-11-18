# Laboratorio de memoria local

Todos los datos de la semilla son didácticos. No usar datos reales de clientes, código confidencial o credenciales. El proveedor local no hace red ni embeddings. Soporta un solo escritor por workspace y guarda hasta 100 entradas.

```powershell
npm run memory:search -- "CQRS"
$env:AGENT_LAB_MEMORY = "1"
$env:AGENT_LAB_MEMORY_WRITE = "0"
pi --no-session --no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --extension .pi/extensions/memory-context.ts --print "Explica CQRS usando las referencias disponibles"
```

Requiere Pi autenticado para el último comando. La alternativa CLI (herramientas de consulta, guard explícito) es:

```powershell
node dist/cli.js run "Explica CQRS" --config examples/config/harness.memory.example.json --extension .pi/extensions/memory-context.ts --extension .pi/extensions/approval-guard.ts --no-skills --mode json --dry-run
```

Quitar `--dry-run` sólo para una prueba real. El discovery de extensiones queda desactivado, los dos módulos se cargan por nombre explícito. El comando de Pi directo desactiva también plantillas, y no habilita herramientas (recomendado para captura). El modo CLI puede expandir plantillas, por lo que no debe usarse para escritura con recursos no confiables.

```powershell
$env:AGENT_LAB_MEMORY_WRITE = "1"
pi --no-session --no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --extension .pi/extensions/memory-context.ts --print "RECORDAR: En el proyecto ficticio Atlas se usa Vitest para pruebas unitarias."
Remove-Item Env:AGENT_LAB_MEMORY_WRITE
npm run memory:search -- "Atlas Vitest"
pi --no-session --no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --extension .pi/extensions/memory-context.ts --print "¿Qué usamos para pruebas unitarias en Atlas?"
Remove-Item Env:AGENT_LAB_MEMORY
```

En bash, `export AGENT_LAB_MEMORY=1`, `export AGENT_LAB_MEMORY_WRITE=1` y `unset AGENT_LAB_MEMORY_WRITE AGENT_LAB_MEMORY` en lugar de sintaxis PowerShell. Los procesos reciben las variables en el arranque. Un fallo de ejecución del agente no guarda la decisión. La memoria es visible en `.lab-memory/records.json` (gitignored). Eliminar ese archivo manualmente con Pi cerrado reinicia la memoria local, pero no borra conversaciones ni copias previas: revisar antes. Los chunks inyectados pueden quedar en sesiones persistentes y llegar al proveedor LLM. No se usa la memoria de otros proyectos, incluida `.ytk-memory`.
