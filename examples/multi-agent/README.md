# Laboratorio de equipos

Desde la raíz del proyecto:

```sh
npm run team:run -- --story examples/workflows/complex.json
npm run team:run -- --story examples/workflows/complex.json --mode simulate --concurrency 2
npm run team:run -- --story examples/workflows/complex.json --mode simulate --concurrency 1
npm run team:run -- --story examples/workflows/complex.json --mode live --concurrency 2 --timeout-ms 60000
```

Plan no ejecuta agentes. Simulate no invoca Pi y los tiempos no representan rendimiento LLM. Live requiere Pi autenticado y puede consumir tokens; cada rol crea una sesión independiente. No hay tools, MCP, skills, extensiones ni archivos de contexto de Pi. No se escribe código ni memoria, ni se ejecutan tests de producto. Las salidas y hashes se imprimen en JSON; no se incorporan al diario de L17. Si redirigís el resultado a un archivo, protegelo como datos sensibles. La ruta es optativa incluso para historias simples: la clasificación se informa, no habilita capacidades.

## Worktrees manuales

Sobre un repositorio Git de práctica local con HEAD existente, sin cambios pendientes, ejecutá `git worktree add -b lab/agent-front ../lab-agent-front HEAD` y `git worktree add -b lab/agent-back ../lab-agent-back HEAD`. Cada operador puede hacer cambios de prueba en su rama y revisar `git diff` desde su propio directorio. Para integrar, revisá contratos y PRs, luego aplicá los procedimientos habituales. Para limpiar, primero conserva o commitea los cambios que quieras guardar y ejecutá `git worktree remove ../lab-agent-front` y `git worktree remove ../lab-agent-back` desde el repositorio original. No uses `--force` para descartar trabajo ajeno. Los worktrees comparten objetos y metadatos Git, y no son un sandbox; sus procesos conservan los permisos del usuario. No están gestionados por team:run.
