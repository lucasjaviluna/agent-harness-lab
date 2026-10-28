# Agent Harness Lab — instrucciones para agentes

## Propósito
CLI educativo en TypeScript que delega la ejecución agéntica a Pi. Es un proyecto nuevo, independiente de cualquier pi-harness existente.

## Convenciones
- Antes de editar, explicar el cambio propuesto.
- Mantener la separación `cli.ts` (interfaz), `config.ts` (configuración), `runtime.ts` (invocación de Pi).
- No incorporar frameworks, DI containers ni un Agent Loop propio.
- Agregar tests cuando se modifique comportamiento.
- No incluir secretos en repositorio ni imprimir credenciales.
- Ejecutar `npm test` después de cambiar el código.

## Seguridad
Las instrucciones de este archivo orientan al modelo: no son controles de acceso obligatorios. Las políticas efectivas se implementarán en módulos posteriores.

<!-- BEGIN ytk-memory-init:codex -->
## YTK Memory

Project: `agent-harness-lab`. Apply the `ytk-memory` skill for meaningful project work and whenever the user asks about saved YTK Memory. If the skill is unavailable, follow `.ytk-memory/YTK-MEMORY.md`. Never store secrets.
<!-- END ytk-memory-init:codex -->
