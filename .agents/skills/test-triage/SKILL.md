---
name: test-triage
description: Diagnosticar tests de Node.js fallidos mediante evidencia reproducible. Usar al investigar fallos del runner node:test o regresiones de una integración.
disable-model-invocation: true
---

# Diagnóstico de tests Node.js (invocación explícita)

Usá `/skill:test-triage` cuando la persona decida iniciar una investigación de fallos.

1. Leé primero la descripción del problema y los logs relevantes.
2. Pedí o revisá los comandos de reproducción exactos.
3. Clasificá posibles causas: instalación, entorno, Windows, resolución de rutas, lógica y tests inestables.
4. Para un informe **sintético**, ejecutá `node .agents/skills/test-triage/scripts/summarize-test-log.mjs examples/skills/node-test-example.log` desde la raíz del proyecto. Este script lee un archivo local y no ejecuta tests.
5. Consultá [la guía de diagnóstico](references/diagnosis.md) cuando necesites clasificar los fallos.
6. Proponé el cambio mínimo y las pruebas de regresión antes de editar.

Un Skill no concede permisos de ejecución: `disable-model-invocation` controla la selección automática, no es una barrera de seguridad.
