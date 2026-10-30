# Módulo 1 · Lección 4 — Sesiones, persistencia, branching y compaction

**Curso:** Pi.dev — de cero a construir un Agent Harness profesional  
**Nivel:** Intermedio · **Complejidad:** Media–Alta  
**Duración sugerida:** 150–180 minutos  
**Versión del laboratorio:** v0.4.0 (incremental respecto a v0.3.0)  
**Repositorio de referencia:** https://github.com/lucasjaviluna/agent-harness-lab

## Objetivos de aprendizaje

Al completar esta lección podrás:

1. Diferenciar una **sesión** de un **turno de agente** y de una **ejecución del proceso Pi**.
2. Describir cómo persiste Pi sus sesiones en archivos **JSONL** con estructura de **árbol**.
3. Elegir entre ejecución **efímera**, **persistente**, **continuación**, **sesión explícita** y **fork**.
4. Diferenciar `/tree`, `/fork`, `/clone` y `/compact` sin confundir sesión con worktree o rama de Git.
5. Configurar almacenamiento con `--session-dir` sin implementar un gestor de sesiones paralelo.
6. Incorporar flags nativos de sesión a nuestro CLI, manteniendo compatibilidad Linux/Windows.
7. Probar los contratos de la integración sin llamadas al modelo y distinguir claramente lo que falta verificar con Pi real.

## 1. Punto de partida: el repositorio real

La v0.3.0 ya ofrece CLI, configuración, perfiles, modos print/JSON, parseo JSONL y tests. **No debemos reconstruirla desde cero.** En el repositorio público vimos tres mejoras importantes:

- `src/runtime.ts` resuelve en Windows el lanzador administrado `pi-launcher.js` junto a `pi.cmd`, usando `process.execPath` y `shell: false`.
- `tests/cli.test.mjs`, `tests/json.test.mjs` y `tests/models.test.mjs` usan, en Windows, un preload CJS para ejecutar los falsos scripts de Pi con Node, evitando la ejecución directa de `.mjs`.
- `tests/cli.test.mjs` añade un test sólo para Windows (`skip: process.platform !== 'win32'`) de doctor, modelos, print, JSON y herramientas; además ensaya un prompt con `&` para evitar inyección vía shell.

**Evaluación:** es una estrategia razonable y superior a `shell: true` para esta integración. La búsqueda de un archivo llamado `pi-launcher.js` junto a `pi.cmd` presupone la estructura de una distribución particular; no equivale a compatibilidad universal con todas las instalaciones. No la modificaremos en esta lección. En el futuro la refinaremos con más casos de resolución del ejecutable.

**Estado de verificación:** compilación TypeScript y tests ejecutados en Linux; las pruebas específicas de Windows requieren ejecutarse en Windows para validar su comportamiento real. Los tests con mock no comprueban autenticación, coste, ni compatibilidad con una versión instalada de Pi.

## 2. Fundamentos: ¿qué es una sesión?

Pensá en tres niveles distintos:

```text
Proceso Pi                ejecución del comando (inicia y termina)
    └── Sesión Pi          historial y metadatos persistibles
         └── Rama activa   secuencia histórica enviada al modelo
              └── Turnos  solicitudes/respuestas, herramientas, errores
```

- **Proceso:** cuando hacemos `agent-lab run`, nuestro CLI crea un proceso Pi y espera su salida.
- **Sesión:** Pi puede persistir entradas de conversación, cambios de modelo, compaction y otros metadatos.
- **Rama activa:** el contexto del siguiente turno no necesita contener todas las ramas; usa la ruta activa del árbol.
- **Turno:** unidad de interacción con el LLM; pueden ocurrir múltiples tool calls en un turno.

Una sesión **no** es una terminal abierta permanentemente. Podemos conservar una sesión después de que el proceso finalice y recuperarla en un proceso posterior.

### 2.1. Formato JSONL

Pi guarda por defecto las sesiones en `~/.pi/agent/sessions/`, agrupadas según el directorio de trabajo. Son archivos con una entrada JSON por línea. La estructura incluye referencias `id` y `parentId`: **no es simplemente un array lineal de mensajes**.

Ejemplo didáctico, simplificado (no representa todos los campos ni tipos reales):

```jsonl
{"type":"session","version":3,"id":"session-123","timestamp":"2026-10-29T12:00:00.000Z","cwd":"/workspace"}
{"type":"message","id":"a1","parentId":null,"timestamp":"2026-10-29T12:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"Explica este proyecto"}]}}
{"type":"message","id":"b1","parentId":"a1","timestamp":"2026-10-29T12:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
```

No crearemos ni editaremos ese formato en el harness: **Pi es el dueño de la sesión**. Más adelante, si necesitamos manipulación programática avanzada, evaluaremos `SessionManager` del SDK.

> **Privacidad**: los archivos pueden contener prompts, información de repositorios, salidas de herramientas y datos sensibles. No los agregues a Git, no los compartas sin revisarlos y considerá acceso/permisos del usuario del sistema.

## 3. Persistencia y opciones nativas

Comandos equivalentes *directamente en Pi*:

```bash
# Ejecución efímera: no quedará una sesión recuperable
pi --no-session --print "Explicá la estructura del proyecto"

# Nueva ejecución persistente con nombre
pi --name "exploracion-arquitectura" --print "Explicá la estructura"

# Continuación de la última sesión del directorio actual
pi --continue --print "Ahora compará dos alternativas"

# Elegir una sesión específica
pi --session <ruta-o-id> --print "Profundizá en los tests"

# Crear una sesión nueva a partir de una existente
pi --fork <ruta-o-id> --print "Investigá otra alternativa"

# Directorio de sesiones elegido explícitamente
pi --session-dir ./sesiones-locales --print "Explicá la arquitectura"
```

**Cuidado con `--continue`:** se refiere a la última sesión del *proyecto/directorio* actual, no a "la última petición de este mismo usuario" si varias personas o procesos usan ese directorio. Para integraciones concurrentes convendrá utilizar `--session` / `--session-id` y aislamiento explícito. Este módulo no resuelve todavía concurrencia.

## 4. Branching, fork y clone: ¿qué se copia?

### 4.1. Árbol dentro de una sesión: `/tree`

En el modo interactivo de Pi:

```text
pi
/tree
```

`/tree` permite seleccionar un punto anterior y continuar generando otra rama **dentro del mismo archivo de sesión**. La rama abandonada sigue existiendo.

```text
Mensaje inicial
     |
Respuesta 1
     +--------- Rama A: solución rápida
     |
     +--------- Rama B: solución mantenible
```

### 4.2. Fork vs clone

- `/fork` crea una **nueva sesión** a partir de un mensaje elegido.
- `/clone` genera una **nueva sesión** copiando la rama activa.
- `pi --fork <ruta|id>` realiza el fork de una sesión antes de entrar a la ejecución.
- **No son** comandos para crear ramas Git ni para copiar tu directorio de trabajo. Un fork de conversación no garantiza aislamiento de archivos o procesos externos.

## 5. Compaction: qué resuelve y qué no

Una sesión larga puede superar el presupuesto de contexto del modelo. Pi permite reducir el historial enviado al LLM mediante *compaction*: resume la parte anterior de la conversación y conserva mensajes recientes.

En una sesión interactiva:

```text
/compact
/compact Conservá decisiones arquitectónicas, problemas abiertos y comandos verificados
```

Pi también puede compactar automáticamente cuando se aproxima al límite de contexto, según la configuración. La compactación **no elimina el historial original guardado en el archivo**. Es un mecanismo para reorganizar el contexto del modelo, no un sistema de backups, no un RAG y no un mecanismo de seguridad.

**Por qué no programamos `/compact` desde agent-lab aún:** las ejecuciones print/JSON de una sola petición no ofrecen el mismo canal de comandos interactivos que RPC/SDK. En un módulo posterior estudiaremos los métodos programáticos de sesión, sin inventar un comando de shell que envíe texto al modelo simulando un slash command.

## 6. Implementación incremental en Agent Harness Lab v0.4.0

### 6.1. Decisión de diseño

Conservamos el comportamiento existente: `pi.noSession = true` en la configuración del laboratorio. La persistencia es **explícita** para los escenarios de práctica:

```bash
agent-lab run "Presentá el proyecto" --mode json --persist --name "intro"
agent-lab run "Continuá el análisis" --mode json --continue
agent-lab run "Alternativa" --mode json --fork <ruta-o-id>
agent-lab run "Diagnóstico aislado" --ephemeral
```

Ninguna de estas funciones requiere copiar el JSONL ni persistir un ID propio fuera de Pi.

### 6.2. Archivo nuevo: `src/session-options.ts`

```ts
export interface SessionOptions {
  persist?: boolean;
  ephemeral?: boolean;
  continue?: boolean;
  session?: string;
  fork?: string;
  sessionDir?: string;
  name?: string;
}
```

La función `buildSessionArgs(config, options)` transforma estas opciones en argumentos nativos de Pi. No modela el almacenamiento; sólo garantiza que no construyamos combinaciones incompatibles:

```ts
if (options.persist && options.ephemeral) {
  throw new Error('--persist y --ephemeral no pueden combinarse');
}

if (options.continue) args.push('--continue');
if (options.session) args.push('--session', options.session);
if (options.fork) args.push('--fork', options.fork);
```

> Lee el archivo completo: también rechaza combinaciones de destinos excluyentes, `--ephemeral` con persistencia implícita y nombre/directorio sin persistencia.

### 6.3. Adaptación del runtime

En `src/runtime.ts`, las tres funciones existentes aceptan ahora un argumento opcional al final:

```ts
buildPiArgs(prompt, config, mode, modelSelection, sessionOptions);
runPi(prompt, config, cwd, modelSelection, sessionOptions);
runPiJson(prompt, config, cwd, view, modelSelection, sessionOptions);
```

Se evita una nueva clase Runtime o una capa de almacenamiento. `buildPiArgs` reutiliza `buildSessionArgs`; los ejecutores siguen empleando `piCommand()` y `spawn(..., { shell: false })`.

### 6.4. Adaptación del CLI

El parser reconoce las opciones de sesión sólo en `run` y `run-file`. Por ejemplo:

```bash
node dist/cli.js run "Investigá este módulo" \
  --persist \
  --session-dir ./sesiones-locales \
  --name "exploracion-modulo"
```

Los parámetros de control conservan su semántica:

```bash
# La ejecución NO llama al LLM ni crea sesiones
node dist/cli.js run "Analizá el proyecto" --persist --dry-run
```

El dry-run debe mostrar que `--no-session` desaparece y que aparece `--name` cuando corresponde.

### 6.5. Configuración y precedencia

El laboratorio mantiene la configuración `pi.noSession` como valor base. La selección efectiva es:

| Configuración/flag | Comportamiento |
|---|---|
| `pi.noSession: true` | Efímero por defecto |
| `pi.noSession: false` | Persistente por defecto |
| `--persist` | Persistente para esta invocación |
| `--ephemeral` | Efímero para esta invocación |
| `--continue`, `--session`, `--fork` | Selección de sesión y persistencia implícita |
| `--session-dir`, `--name` | Requieren persistencia seleccionada |

`--persist` y `--ephemeral` no se permiten simultáneamente. Tampoco `--continue` con `--session` o `--fork`.

## 7. Laboratorio guiado

### Paso A — Compilar y correr regresión

```bash
npm install
npm run build
npm test
npm run typecheck
```

El proyecto debe mantener todos los tests de las lecciones 1–3 y sumar los de sesiones.

### Paso B — Comparar los argumentos

```bash
node dist/cli.js run "Hola" --dry-run
node dist/cli.js run "Hola" --persist --dry-run
node dist/cli.js run "Hola" --continue --dry-run
node dist/cli.js run "Hola" --session-id story-101 --dry-run   # Sólo ejercicio resuelto
```

**Antes de resolver el ejercicio**, el último ejemplo debe fallar al no estar implementado `--session-id`.

### Paso C — Persistir una primera conversación con Pi real

Desde un proyecto de prueba (no desde un repositorio con secretos), y con Pi configurado/autenticado:

```bash
node dist/cli.js run-file examples/prompts/session-analysis.md \
  --mode json --persist --name "sesion-leccion-04"
```

Pi debe gestionar la sesión. Si tu versión emite un ID en el JSONL, anotá ese ID y verificá el archivo desde la interfaz de Pi. **No asumas que el campo JSON `sessionId` es un path del archivo.**

### Paso D — Continuar

```bash
node dist/cli.js run "Mencioná dos decisiones previas y sus trade-offs" \
  --mode json --continue
```

Atención: si trabajaste en otra carpeta, `--continue` puede apuntar a otra sesión. Usa el mismo `cwd` o una sesión explícita.

### Paso E — Branching interactivo

```bash
pi --continue
```

En Pi ejecutá `/session`, luego `/tree`. Elegí una respuesta previa, continuá por otra rama y verificá que podés regresar al punto original. Para experimentar con otro archivo de sesión probá `/fork` o `/clone`.

### Paso F — Compaction interactiva

En la misma sesión ejecutá:

```text
/compact Conservá objetivos, decisiones, archivos tocados y problemas pendientes
```

Comprobá que el resumen permite continuar la conversación. Identificá qué datos quedaron como contexto activo y qué registros continúan en el JSONL original.

### Paso G — Errores intencionales

```bash
node dist/cli.js run "Hola" --persist --ephemeral --dry-run
node dist/cli.js run "Hola" --continue --fork origen --dry-run
node dist/cli.js run "Hola" --session-dir ./tmp --dry-run
```

Los tres deben ser rechazados **antes** de ejecutar Pi.

## 8. Ejercicio — US-LAB-004 (solución separada)

**Historia:** como usuario del harness, quiero iniciar o recuperar una sesión mediante un identificador estable (`--session-id`), para asignar una sesión determinística a una tarea de automatización sin depender de que sea la sesión más reciente.

### Requisitos

1. Soportar `agent-lab run "Hola" --session-id story-123`.
2. Delegar a Pi `--session-id story-123` y habilitar persistencia.
3. Validar un ID que empiece y termine con letra o número y permita letras, números, punto, guion y guion bajo.
4. Impedir combinarlo con `--session` o `--continue`.
5. Permitir `--session-id nuevo --fork origen` para asignar un ID a la sesión derivada (según el contrato documentado de Pi).
6. Respetar `--ephemeral` como conflicto.
7. Agregar tests para combinaciones válidas/inválidas, y mantener las pruebas anteriores.

**Pistas:** agrega `sessionId?: string` a `SessionOptions`, compone `--session-id` al final del bloque de flags de sesión y amplía el parser de `src/cli.ts`. No guardes la sesión manualmente.

**Solución:** `solutions/modulo-01-leccion-04/` contiene los archivos completos y tests adicionales (no aplicados a `src/`).

## 9. Tests y compatibilidad Windows

Los tests existentes verifican flujos v0.3, incluido el manejo de Pi en Windows. Los nuevos tests comprueban las combinaciones del parser, el contrato de argumentos, salida print/JSON y que un prompt con `&` se mantenga literal.

```bash
npm test
npm run typecheck
```

**Límites de estas pruebas:** se ejecutan con `fake-pi.mjs`; no son end-to-end con el binario real. Los tests Windows están preparados para ejecutar el mock mediante preload, pero hay que correr `npm test` en Windows. El test que comprueba `pi-launcher.js` está omitido cuando el sistema no es win32. Una instalación real puede diferir en la forma del lanzador y en la versión de los flags.

## 10. Qué no implementamos todavía (deliberadamente)

- No creamos un almacén de sesiones propio, DB, índice, RAG ni sincronización entre equipos.
- No implementamos compactación programática por un comando propio, pues requiere manejar el ciclo de vida de sesión mediante RPC/SDK.
- No definimos estrategia de concurrencia, expiración, locking ni cuotas: se cubrirán más adelante.
- No confundimos aislamiento de la conversación con aislamiento del sistema de archivos. Pi sigue ejecutándose con los permisos del proceso que lo inicia.

## 11. Checklist de finalización

- [ ] Entiendo qué persiste Pi y qué parte del historial se envía al modelo.
- [ ] Uso correctamente `--persist`, `--continue`, `--session`, `--fork` y `--session-dir`.
- [ ] Conozco los usos diferentes de `/tree`, `/fork`, `/clone` y `/compact`.
- [ ] Mi CLI no perdió el soporte Windows de v0.3.0.
- [ ] Los tests de regresión y nuevos tests terminan sin fallos.
- [ ] Probé al menos una sesión real persistida con el proveedor autenticado en mi equipo.
- [ ] Comprendí por qué el historial de sesión no es un control de seguridad ni un repositorio de memoria RAG.

## 12. Referencias verificadas (29 de octubre de 2026)

- [Pi — Sessions and Context](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md)
- [Pi — Session File Format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md)
- [Pi — CLI reference: sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md#sessions)
- [Pi — SDK / SessionManager](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)
- [Agent Harness Lab — repositorio del curso](https://github.com/lucasjaviluna/agent-harness-lab)

## Siguiente paso

**Módulo 1 · Lección 5 — AGENTS.md, system prompts, context files y prompt templates.** Nivel: Principiante–Intermedio · Complejidad: Media. Ampliaremos la personalización del contexto con ejemplos controlados, sin convertir Markdown en una falsa política de permisos.
