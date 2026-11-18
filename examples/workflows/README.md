# Workflows — Lección 16

Ver [LECCION_16.md](../../LECCION_16.md). Ejemplos ficticios; ninguna acción modifica el proyecto.

```bash
npm run workflow:run -- --story examples/workflows/simple.json
npm run workflow:run -- --story examples/workflows/medium.json --mode simulate --decision approve
npm run workflow:run -- --story examples/workflows/complex.json --mode simulate --decision deny
npm run workflow:run -- --memory "CQRS MCP"
```

`plan` (default) y `simulate` no arrancan Pi ni consumen tokens. `live` usa Pi RPC cerrado, sin tools, MCP, Skills ni extensiones; sólo genera propuestas y revisiones textuales. En live, los gates exigen TTY y la palabra APROBAR. No hay `--decision` en live. `--llm-classify` es optativo y sólo puede elevar la complejidad. La clasificación es didáctica, no una evaluación real de impacto. `--memory` lee información local y puede enviarla al proveedor en live, nunca guarda decisiones. Usar datos ficticios. No es sandbox. Para JSON limpio: `npm run build` y `node dist/workflow-cli.js ...`.
