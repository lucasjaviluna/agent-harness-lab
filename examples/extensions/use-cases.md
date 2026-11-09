# Ejemplos para probar la extensión

1. `agent-lab extensions list` debe encontrar `lifecycle-observer`.
2. `agent-lab run "Describe este repositorio" --extension .pi/extensions/lifecycle-observer.ts --dry-run` inspecciona los argumentos sin consumir tokens.
3. Ejecutar `pi` dentro del repositorio confiable. Tras la carga de recursos, invocar `/lab-stats`.
4. Iniciar una tarea de lectura y observar el footer: `Runs: 1 · Tools: N`.
5. Probar `pi --no-extensions -e .pi/extensions/lifecycle-observer.ts` para dejar sólo la extensión explícita.

La extensión no guarda datos ni habilita nuevas herramientas; sólo observa eventos. En el Módulo 2 / Lección 3 se registrará una herramienta real y en Lección 4 se diseñarán gates.
