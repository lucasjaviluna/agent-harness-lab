# Diagnóstico rápido

| Síntoma | Comprobación |
|---|---|
| ENOENT al iniciar proceso | Resolver executable, PATH y directorio actual |
| EACCES / permisos | Modo del archivo o política del SO |
| Windows .cmd / .mjs | Verificar lanzador y no usar `shell:true` con prompts |
| Tests fallan solo en CI | Revisar Node, variables, reloj y cwd |
| Fallos intermitentes | Aislamiento, fixtures, concurrencia y cleanup |

Registrar evidencia antes de modificar código.
