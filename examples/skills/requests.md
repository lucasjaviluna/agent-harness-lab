# Ejemplos para practicar Skills

## Selección automática (requiere Pi real)
Revisá las modificaciones recientes de TypeScript. Quiero encontrar bugs, regresiones y problemas de portabilidad. No edites archivos.

## Comando explícito en Pi interactivo
/skill:agent-review revisar src/runtime.ts sin modificar código

## Tarea explícita de diagnóstico
/skill:test-triage explica cómo clasificar errores ENOENT en Windows

## Flags de ejecución desde agent-lab
node dist/cli.js run "Revisá src/runtime.ts" --skill .agents/skills/agent-review --dry-run
node dist/cli.js run "Revisá tests" --no-skills --skill .agents/skills/test-triage --dry-run

La carga efectiva depende de los recursos de Pi, de la confianza del proyecto, de las tools disponibles y del modelo.
