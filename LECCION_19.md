# Curso práctico de Pi.dev — Módulo 4 · Lección 3 (global 19)

**Subagentes, Multi-Agent Workflows, concurrencia y aislamiento**
Nivel: Avanzado. Complejidad: Muy alta. Duración sugerida: 180–240 minutos.
Proyecto conductor: Agent Harness Lab, v0.18.0 → v0.19.0.

## 1. Punto de partida y objetivos

Esta lección integra las sesiones RPC (L14), la clasificación y los workflows (L16), la separación de autoridad (L17) y el trabajo basado en especificaciones (L18). El objetivo es construir un equipo de agentes especializado que produzca informes, no un sistema que implemente y fusione cambios autónomamente.

El repositorio público `lucasjaviluna/agent-harness-lab` fue consultado: `main` reportó 0.18.0 (árbol `a14877f76839b757e27c3f41edcfcc287c401c7f`). El código central de RPC, runtime, README, CHANGELOG y package.json coincide por hash con el snapshot publicado en L18. Trabajamos sobre ese snapshot, no sobre una copia de los datos propios del usuario. Se preservan el launcher de Windows, CLI, SDK, memoria, guard, workflows y SDD.

Al terminar deberías poder explicar y demostrar:

- la diferencia entre un agente, una herramienta y un subagente;
- especialización y aislamiento de historial, procesos y archivos;
- ejecución secuencial, paralela acotada y fan-out/fan-in;
- transferencia explícita de resultados con procedencia;
- cancelación cooperativa y finalización de procesos RPC;
- cuándo evitar la delegación, cómo estimar costos y cómo integrar aprobaciones sin otorgar autoridad al modelo;
- worktrees como práctica independiente de la ejecución de agentes.

## 2. Qué es un subagente

Un subagente es una ejecución delegada de un agente al que se le asigna un objetivo acotado, instrucciones y un conjunto de capacidades. No es necesariamente otro modelo: dos procesos pueden utilizar el mismo proveedor y modelo, pero mantener diferentes historiales, tareas y restricciones. Un `tool_call` corriente normalmente representa una operación de una herramienta dentro del loop; una herramienta de delegación puede iniciar otro loop, esperar su resultado y devolverlo como datos al padre. Una llamada por rol tampoco equivale a un servicio distribuido permanente.

Ejemplo: un analista identifica criterios ambiguos; un arquitecto propone una solución; un especialista de testing deriva escenarios; un revisor contrasta sus informes. El revisor no debería declarar que ejecutó tests si sólo recibió recomendaciones.

### Cuándo no conviene

Para corregir un texto, consultar un archivo o cambiar un estilo localizado, un único agente suele ser suficiente. La descomposición agrega prompts, estados, esperas, costos y posibles desacuerdos. Para una historia compleja con aspectos independientes, puede reducir tiempo de pared y contaminación de contexto. Un equipo no garantiza calidad: varios agentes pueden repetir el mismo error o compartir un sesgo.

## 3. Primitiva real de Pi: ejemplo oficial de subagentes

El repositorio de Pi ofrece una extensión de ejemplo `packages/coding-agent/examples/extensions/subagent/`, no un subcomando universal de la CLI. Incluye `index.ts`, descubrimiento en `agents.ts`, agentes Markdown y plantillas de prompts. Antes de instalar una extensión leé su código y fijá una versión/commit de confianza.

Sus modalidades documentadas son individual (`{agent, task}`), paralela (`{tasks:[...]}`; máximo 8 tareas, 4 simultáneas en el ejemplo consultado) y encadenada (`{chain:[...]}` con `{previous}`). Usa subprocesos, streaming, estadísticas y propagación de Ctrl+C. La configuración de cada agente puede indicar herramientas y modelo mediante frontmatter. Por ejemplo, definición ilustrativa para **esa extensión**, no para nuestro CLI:

```markdown
---
name: planner
description: Diseña un plan acotado
tools: read, grep, find, ls
---
Identifica dependencias, propone cambios mínimos y escenarios de validación.
```

En el ejemplo oficial, el alcance de descubrimiento predeterminado es de usuario; los agentes locales del proyecto requieren optar por ese alcance y respetar las verificaciones de confianza/confirmación. Una definición del repositorio es código/configuración no necesariamente confiable. El ejemplo incluye agentes con shell y capacidades de modificación: no lo confundas con un sandbox ni copies sus permisos indiscriminadamente. Sus estadísticas de uso de subagentes no se suman automáticamente al total de la sesión padre.

Nuestra implementación no instala esa extensión ni busca agentes Markdown. Reutiliza la idea de subprocesos con el `LabRpcClient` de L14. Para una aplicación TypeScript general, Pi recomienda su `RpcClient` oficial. Este lab conserva el cliente didáctico para estudiar el protocolo sin instalar dependencias nuevas.

Referencia: [ejemplo oficial de subagentes](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent); [RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).

## 4. Patrones de coordinación

### Secuencial (chain)

```text
Scout → Planner → Reviewer
```

El segundo paso necesita el primero. Útil cuando hay dependencias reales. No paralelizar una implementación que depende de un contrato todavía no aprobado. El costo de tiempo tiende a sumar las duraciones.

### Paralelo (fan-out)

```text
                  ┌── Analyst
Historia ─────────├── Architect
                  └── Test designer
```

Los tres especialistas reciben la misma historia (no el historial de los demás), con instrucciones propias. Pueden avanzar independientemente. Un pool acotado regula cuántas ejecuciones están activas. Con límite 2, sólo dos especialistas se ejecutan en paralelo y el tercero espera.

### Consolidación (fan-in)

```text
Analyst ───────┐
Architect ─────┼── Reviewer → Informe integrado
Test designer ─┘
```

El revisor comienza únicamente si todos los especialistas del plan han finalizado y sus respuestas son válidas. Recibe sus informes completos, limitados, etiquetados con rol y hash. No se usan resultados parciales ni se crea un reviewer por cada respuesta que llega. El orden del resultado es el del plan, no el de finalización.

Otros patrones que deliberadamente dejamos afuera: debate abierto agente-agente, ciclos de autorrevisión indefinidos, descubrimiento dinámico de tareas, DAG declarativo arbitrario, ejecución distribuida, reanudación y merges automáticos. Implementarlos sólo cuando exista un caso real que lo requiera.

## 5. Diseño del laboratorio v0.19.0

```text
team:run (plan / simulate / live)
       │
       ├── parseStory / classify (L16)
       └── runTeam
            ├── Pool (1 o 2) → 3 especialistas
            │   ├── analyst
            │   ├── architect
            │   └── test-designer
            └── reviewer (depende de los tres)
                        │
                TeamResult JSON
```

Archivos nuevos:

| Archivo | Responsabilidad |
|---|---|
| `src/multi-agent.ts` | Plan, pool, estados, transferencia, hashes y adaptador RPC |
| `src/multi-agent-cli.ts` | Validación de argumentos y elección de modo |
| `examples/multi-agent/README.md` | Prácticas y worktrees manuales |
| `tests/multi-agent.test.mjs` | Pruebas del scheduler, RPC simulado y CLI |
| `solutions/modulo-04-leccion-03/` | Ejercicio resuelto y tests separados |

El plan base tiene cuatro agentes y es fijo. `classify` informa el nivel, pero no cambia los permisos ni decide ejecutar automáticamente el equipo. `team:run` es una vía adicional optativa, no reemplaza `workflow:run --governed` ni `sdd:run`. En particular, no tiene gates de aprobación L17 porque no aplica cambios, ni ejecuta los Quality Gates de producto. No permite que el modelo seleccione herramientas, cree subagentes recursivamente o defina nuevas rutas.

## 6. Contrato del orquestador

Fragmentos del código real, simplificados para explicar sus responsabilidades:

```typescript
export type AgentExecutor = (
  agent: AgentDefinition,
  prompt: string,
  signal: AbortSignal
) => Promise<RpcTurn>;

export interface TeamOptions {
  concurrency: number;
  signal?: AbortSignal;
  execute: AgentExecutor;
}
```

El resultado de `runTeam(story, options)` contiene `storyId`, `classification`, `status`, `peakConcurrency`, `elapsedMs` y `agents` en orden definido. Cada agente tiene `role`, `status`, y cuando corresponda `elapsedMs`, `promptHash`, `outputHash`, `text`, `events`, `error`. El hash es SHA-256 de los bytes UTF-8; no autentica autor ni garantiza corrección. No se incluyen los mensajes internos completos ni se persisten automáticamente los informes.

`execute` constituye una frontera de ejecución: permite usar un proceso real, un stub o una simulación. Debe respetar cancelación y cerrar recursos antes de resolver. El scheduler no puede forzar un callback arbitrario que ignore su señal; el adaptador RPC sí configura plazos y cierra el hijo antes de liberar su slot.

## 7. Concurrencia acotada

`runTeam` lleva un índice compartido, un contador de activos y un máximo observado. Cada worker toma el siguiente índice sin un `await` entre la comprobación y su asignación. JavaScript ejecuta esa sección sin intercalarla con otra continuación asíncrona. Se ejecuta un pool de workers mediante `Promise.all`; cada uno espera el resultado de su agente antes de consumir otra tarea.

```typescript
async function worker() {
  while (!controller.signal.aborted) {
    const i = next++;
    if (i >= plan.length - 1) return;
    await run(i);
  }
}
await Promise.all(
  Array.from({ length: options.concurrency }, () => worker())
);
```

No es un pool de threads; los procesos Pi trabajan independientemente y Node coordina sus I/O. Al cerrar cada ejecución antes de liberar el slot, el adaptador no deja intencionalmente un proceso previo activo. Si el cierre no puede confirmarse, se informa un error y no se inicia más trabajo. El máximo de activos mide ejecuciones de `execute`, no un censo de todos los procesos del sistema operativo.

Ejemplo ilustrativo: tres especialistas de 20, 30 y 15 s, revisor de 10 s. Secuencial ≈75 s; límite 2 con orden dado ≈45 s (A y B arrancan juntos; C ocupa el slot de A cuando éste termina; después del último entra el revisor). Es una cuenta idealizada sin latencias, reintentos ni límites del proveedor. Más concurrencia no significa menos tokens; la historia se transmite tres veces y los informes se transmiten al revisor. Proveedores pueden aplicar rate limits; los reintentos automáticos de Pi también pueden aumentar duración/costo. El lab no estima precio ni impone un techo de tokens monetario.

## 8. Context Engineering entre agentes

Cada prompt se construye con instrucciones fijas por rol, la historia JSON y los informes de las dependencias. Para especialistas `Informes previos JSON: []`. Para el revisor se incluyen únicamente las tres dependencias, con `role`, `outputHash` y `text`.

El transporte JSON delimita datos pero no neutraliza prompt injection. Marcamos los inputs como material no confiable inyectado en un prompt de usuario; no se elevan a mensajes de sistema confiables. El modelo podría seguir instrucciones maliciosas incluidas en un informe. Por eso la capa de ejecución deshabilita capacidades de acción, no se apoya solamente en el texto del prompt.

Cada salida se limita a 6000 bytes UTF-8 y debe ser no vacía. Se rechaza cualquier resultado con tools o errores de tools distintos de cero o métricas inválidas. Es una verificación posterior, no un control preventivo de herramientas; la prevención depende de los argumentos cerrados con los que se inicia Pi. La historia se acota con `parseStory`, y el cliente RPC acota a su vez el prompt y los registros. Si un agente devuelve demasiado contenido, el equipo falla: no se trunca silenciosamente evidencia.

El contexto de memoria L15 no se habilita en esta ruta. Podríamos agregar una recuperación previa, filtrar por alcance y pasar un conjunto documentado de chunks a los especialistas; no deberíamos enviar toda la memoria a todos los roles ni permitir que almacenen informes autónomamente.

## 9. Manejo de fallos y cancelación

Estados: `pending` (interno), `running`, `completed`, `failed`, `cancelled`, `skipped`. Tras retornar, los pendientes quedan como `skipped`. El primer fallo activa el AbortController compartido, no inicia otras tareas y solicita que los activos se cancelen. Se espera que los callbacks activos finalicen/limpien antes de devolver el informe. No se elimina evidencia de los especialistas que ya terminaron correctamente. Fallar el revisor produce un equipo fallido aunque todos los especialistas hayan terminado.

Un éxito que llega después de solicitar cancelación no cuenta como completado. Un cierre de proceso no confirmado se registra como `AGENT_CLEANUP_FAILED` aun si hubo cancelación. No se incluyen excepciones completas que puedan contener rutas o secretos. Los demás errores devuelven `AGENT_EXECUTION_FAILED`; se puede ampliar la taxonomía en L20.

La señal externa, por ejemplo Ctrl+C, se propaga al controller compartido. No existe un deadline global de equipo; cada rol tiene timeout por prompt y el handshake/cierre tienen límites propios. Concurrencia 1 implica hasta cuatro plazos secuenciales, y hay latencias de arranque/cierre. Tampoco se garantizan la terminación de descendientes del proceso ni la recuperación de trabajo ante un apagado abrupto. L20 tratará contención y observabilidad.

## 10. Adaptador Pi RPC

`rpcAgentExecutor` crea un nuevo `LabRpcClient` por rol. Reutiliza `piCommand` de `src/runtime.ts` y `buildRpcArgs` de L14. Los argumentos incluyen `--mode rpc --no-session --no-mcp --no-extensions --no-skills --no-context-files --no-prompt-templates --no-tools`. Se fuerza `readOnly:false`, que en el contrato existente significa **sin herramientas**, no permiso de escritura. Sólo se reutilizan ejecutable y selección de modelo del perfil. No se importan herramientas o extensiones de ese perfil.

```typescript
const client = LabRpcClient.start({
  executable: 'pi', cwd: process.cwd(), readOnly: false
});
try {
  await client.getState(10000);
  const turn = await client.prompt(prompt, 60000);
  return turn;
} finally {
  await client.close();
}
```

El código de producción didáctica incluye el listener `abort`, cierre temprano si se cancela durante handshake, `abort` RPC si está en prompt, cierre de respaldo si abort falla, y manejo explícito de errores de limpieza. El cliente L14 espera ACK y `agent_settled` y comprueba el `stopReason`; no confunde aceptación y terminación.

Cada rol tiene sesión propia; `--no-session` evita persistir el historial normal de sesión, no garantiza que proveedor, configuración o telemetría no almacenen información. Los procesos comparten cwd y permisos del usuario. Desactivar las herramientas de Pi no es sandbox de sistema operativo; inicia sólo binarios confiables y utiliza datos ficticios o permitidos.

## 11. Aprobaciones, evidencia y seguridad

El revisor es un modelo, no un aprobador humano. En un futuro workflow gobernado podemos usar los informes como insumos para crear un artefacto de especificación o plan, cuya huella deberá revisar y aprobar un operador mediante L17. Si el artefacto cambia, la aprobación previa deja de corresponder. Las llamadas de herramientas de un futuro worker deben pasar por políticas propias y aislamiento OS; nunca inferir permiso de un informe del architect.

El resultado JSON registra rol, estado, tiempos y hashes; no es un diario durable encadenado. Si lo exportás, controlá permisos/retención y no lo commitees: el texto puede contener información sensible. No integra automáticamente `.lab-evidence`, OpenSpec ni la memoria. Los tests diseñados por el test-designer son propuestas, **no** pruebas ejecutadas. El resultado `completed` sólo confirma que los cuatro informes textuales fueron obtenidos y pasaron sus validaciones; no confirma calidad semántica ni implementación de una US.

## 12. Prácticas incrementales

Requisitos: Node >=22.19, Git, npm. Los modos plan y simulate no requieren Pi ni credenciales. Para live, Pi autenticado y una versión que admita los flags de L14; consulta `pi --help`.

```sh
npm install
npm test
npm run typecheck
npm run team:run -- --story examples/workflows/complex.json
npm run team:run -- --story examples/workflows/complex.json --mode simulate --concurrency 1
npm run team:run -- --story examples/workflows/complex.json --mode simulate --concurrency 2
```

Inspeccioná `agents`, `dependsOn`, `peakConcurrency`, `status`, `promptHash` y `outputHash`. En simulación las tareas son sintéticas e inmediatas: no compares los milisegundos como rendimiento real. La concurrencia se comprueba en tests con barreras que mantienen agentes activos hasta que el test los libera.

Una historia realista para el ejemplo: coordinar un cambio de contrato de beneficios entre frontend y backend. Ejecutá primero el plan y revisá los roles. Si querés usar Pi autenticado:

```powershell
npm run team:run -- --story examples/workflows/complex.json --mode live --concurrency 2 --timeout-ms 60000
```

Esto puede realizar cuatro solicitudes agénticas y consumir tokens. El reporte sale por stdout. Probá Ctrl+C durante ejecución con datos ficticios y observa estados; el CLI retorna 130 al cancelar y 1 si falla. No agregues `--read-only`, el equipo no expone esa opción. Para elegir el perfil de modelo configurado en el harness usá `--profile nombre` en live; no cambies permisos desde la historia. El comando `--help` muestra las opciones.

## 13. Aislamiento de código: práctica Git worktrees

Un proceso separado tiene su propio estado en memoria; un `cwd` distinto ayuda a trabajar en directorios diferentes. Ninguno garantiza confinamiento. Un Git worktree asocia un directorio de trabajo y una rama a un mismo repositorio: evita que dos agentes editando simultáneamente compartan los mismos archivos de trabajo por accidente, pero comparten objetos, referencias y configuración Git. La cuenta OS aún puede leer o escribir otras rutas.

En un repositorio de práctica con commits y estado limpio, desde la raíz:

```sh
git status --short
git worktree add -b lab/agent-front ../lab-agent-front HEAD
git worktree add -b lab/agent-back ../lab-agent-back HEAD
git worktree list
```

En terminales distintas, editá manualmente un archivo de práctica diferente en cada rama y revisá `git diff` desde cada carpeta. No uses estas órdenes sobre tus ramas de producción. Antes de integrar, conserva cambios mediante commits revisados, verifica conflictos y contrato común, ejecuta tests y solicita aprobación. Para limpiar, guardá primero cualquier cambio que quieras conservar y desde el repo original:

```sh
git worktree remove ../lab-agent-front
git worktree remove ../lab-agent-back
```

No usar `--force` para descartar cambios sin revisar. Las ramas quedan existentes; eliminarlas es una decisión independiente. Si esos nombres ya existen, elegí nombres distintos. Se puede repetir el ejercicio sobre dos repositorios diferentes (frontend y backend), con un worktree por repo. Para un agente worker real serán necesarios permisos por repositorio, mitigación de symlinks/TOCTOU, contenedor/usuario restringido, control de red, límites de CPU/memoria, secretos y una estrategia de teardown. El runner de esta lección **no crea ni administra worktrees**. Fuente: [git-worktree](https://git-scm.com/docs/git-worktree).

## 14. Pruebas y criterios de aceptación del laboratorio

`npm test` ejecuta la suite histórica y las nuevas pruebas. `node --test tests/multi-agent.test.mjs` tras `npm run build` ejecuta sólo esta lección. Las pruebas nuevas incluyen roles, clasificación informativa, pool con barreras, fan-in, transferencia y hashes, fallo y cancelación, validación de salidas, limpieza y CLI. Se crean cuatro procesos Node reales que simulan Pi mediante el protocolo JSONL ya usado en L14; no basta con simular la respuesta de una función para comprobar el ciclo de vida de un proceso. Tests adicionales fuerzan un timeout y una cancelación sobre el fake RPC. La suite no utiliza un proveedor LLM ni tokens.

Resultados base: 287 tests aprobados, 0 fallos, 1 omitido por plataforma (265 anteriores + 22 nuevos). Compilador de núcleo correcto. Node 22.16 en entorno de pruebas, menor que el mínimo 22.19; validar localmente con versión requerida. Pi real/autenticado y Windows nativo no se probaron. No hay nuevos paquetes. El patch se verifica sobre el snapshot v0.18.0, no clon remoto íntegro. No se incluyen bases de memoria del usuario ni su lockfile remoto.

## 15. Ejercicio US-LAB-019 — Especialista de riesgos condicional

Queremos incorporar el rol `risk-reviewer` únicamente cuando `classify(story).level === 'complex'`, sin iniciar otro workflow ni cambiar permisos.

Criterios de aceptación:

1. Ampliar `Role` con `risk-reviewer`.
2. Mantener cuatro agentes en historias simples o medias.
3. Para una historia compleja agregar un especialista adicional antes de reviewer, con instrucciones de riesgo (seguridad, migración, compatibilidad y multi-repo).
4. Calcular las dependencias del reviewer a partir de los agentes seleccionados.
5. Mantener concurrencia máxima 2 y el mismo comportamiento ante fallo/cancelación.
6. Comprobar que el informe llega al reviewer y que un fallo del especialista lo bloquea.

Pistas: `agentPlan` ya recibe una historia validada. Construí `selected` como lista nueva en cada llamada. El pool consume todos los índices previos a reviewer; no debería requerir otro algoritmo. No agregar otro límite por modelo ni una etapa de aprobación inventada.

Solución completa en `solutions/modulo-04-leccion-03/`. En una rama de práctica copiá `src/multi-agent.ts` y `tests/risk-reviewer.test.mjs` de esa carpeta a sus rutas equivalentes en la raíz. Ejecutá `npm test` y `npm run typecheck`; son cuatro tests adicionales. La solución no queda aplicada a la implementación principal del lab.

## 16. Conclusiones, troubleshooting y próximos pasos

- `RPC_PROCESS_ERROR`: comprueba instalación, `pi --version`, ejecutable configurado y launcher Windows. No sustituyas `shell:false` por shell para esconder el problema.
- `AGENT_EXECUTION_FAILED`: puede ser error del runtime, timeout, respuesta incompleta o límites. El informe no expone errores privados; reproducí sobre datos ficticios mediante los comandos individuales de L14 para diagnosticar.
- `AGENT_CLEANUP_FAILED`: no continuar ni iniciar nuevos procesos como si el anterior hubiera terminado. Inspeccioná procesos de prueba desde tu OS.
- Algunos agentes no se inician: es compatible con una cancelación o fallo anterior; observa `skipped` frente a `cancelled`.
- Rate limit: probá concurrencia 1 y plazos razonables. No aumentes automáticamente el paralelismo.
- Worktree no se elimina: revisá cambios y conservá lo necesario antes de quitarlo.

Recursos: [Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), [RPC commands](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md), [extensiones de Pi: subagent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent), [Node AbortController](https://nodejs.org/api/globals.html#class-abortcontroller), [Git worktrees](https://git-scm.com/docs/git-worktree).

Progreso: 19/20 (95%). Próxima y última lección: Módulo 4 · Lección 4 (global 20) — Testing, observabilidad, seguridad y distribución. Consolidaremos interfaces y criterios de release, telemetría acotada, compatibilidad de instalación y revisión de límites de producción. No asumiremos que pasar tests equivale a estar listo para operar con permisos de escritura en producción.
