# Módulo 1 · Lección 2 — Modos de ejecución de Pi y contratos de integración

| Campo | Valor |
|---|---|
| Curso | Pi.dev: de cero a un Agent Harness profesional |
| **Módulo** | **1 — Fundamentos de Pi** |
| **Lección** | **2 — Modos de ejecución de Pi y contratos de integración** |
| **Nivel** | **Principiante–Intermedio** |
| **Complejidad** | **Media** |
| Duración sugerida | 120–150 minutos |
| Estado inicial | Agent Harness Lab v0.1.0 (Lección 1) |
| Entrega de esta lección | Agent Harness Lab **v0.2.0** |
| Referencias verificadas | 27 de octubre de 2026 |

> **Objetivo:** comprender qué mecanismos ofrece Pi para usarlo desde otro programa y evolucionar **el mismo repositorio**. Implementaremos un segundo contrato de salida (JSONL) sin cambiar el Agent Loop ni crear prematuramente un cliente RPC/SDK propio.

## 1. Qué vas a construir

Al finalizar tendrás el CLI `agent-lab` con:

- La funcionalidad anterior `doctor`, `config` y `run` en modo **print** (sin regresiones).
- `run-file` integrado en el código principal, a partir del ejercicio de la Lección 1.
- `run --mode json`, que pide a Pi un **stream JSONL estructurado**, en lugar de un texto final.
- Dos vistas de JSON: `--view summary`, que devuelve un pequeño objeto de ejecución; y `--view events`, que reenvía eventos JSONL a stdout para otros programas.
- Detección de errores **semánticos** (un modelo puede fallar o abortar aunque Pi termine con código 0).
- Tests sin credenciales que comprueban la compatibilidad de v0.1.0 y casos límite de JSONL.

No incorporaremos RPC ni SDK al CLI principal todavía. **Aprenderemos cómo funcionan**, veremos ejemplos reales y explicaremos cuándo conviene migrar. Esta decisión es intencional: queremos que la arquitectura se justifique por necesidades verificadas.

### Criterios de aceptación

1. `agent-lab run "..."` sigue ejecutando en print sin cambiar su interfaz.
2. `agent-lab run "..." --mode json` devuelve un resumen válido sin mezclar logs en stdout.
3. `agent-lab run "..." --mode json --view events` produce sólo líneas JSONL parseables en stdout.
4. El harness no confunde `agent_end` con el final definitivo; espera `agent_settled`.
5. Aborto, error de modelo, respuesta cortada, framing inválido y exit code del proceso producen el resultado correspondiente.
6. Las herramientas que fallan pueden recuperarse: un `tool_execution_end` con `isError: true` no significa necesariamente que toda la ejecución haya fallado.
7. Los tests pasan sin conectar un modelo real.

---

## 2. Antes de implementar: cinco formas de utilizar Pi

En Pi, el *runtime agéntico* puede ser el mismo, pero cambia la forma de hablar con él y de recibir resultados. La documentación de Pi presenta cuatro modalidades CLI (interactivo, print, JSON y RPC) y una alternativa embebida (SDK).

| Modalidad | Inicio | Entrada | Salida | Proceso | Aplicación típica |
|---|---|---|---|---|---|
| Interactivo | `pi` | Usuario en la TUI | TUI | Persistente hasta salir | Desarrollo manual |
| Print | `pi --print "..."` | Prompt al iniciar | Texto final | Una ejecución | Scripts sencillos |
| JSON | `pi --mode json "..."` | Prompt al iniciar | Eventos JSONL | Una ejecución | Progreso estructurado y observabilidad |
| RPC | `pi --mode rpc` | Comandos JSONL por stdin | Respuestas y eventos JSONL | Persistente | Aplicaciones que controlan sesiones/acciones |
| SDK | `createAgentSession()` | API TypeScript | Promesas y eventos en memoria | Dentro de tu proceso | Integración profunda con Node/Bun |

El **SDK no es un modo CLI**: cambia el límite de integración. En nuestro laboratorio usamos Pi **como subprocess**; el SDK lo incorporaría **en el mismo proceso Node**.

**Regla de elección:**

- Si necesitas el resultado final una sola vez, usa print.
- Si necesitas conocer la ejecución paso a paso sin intervenir durante ella, usa JSON.
- Si necesitas varias órdenes, cambiar el modelo o interactuar con una sesión viva, considera RPC.
- Si tu aplicación es TypeScript y requiere acceso directo a sesiones, tools y eventos, estudia SDK.

El hecho de usar RPC/SDK no convierte automáticamente un flujo en seguro. El control sobre herramientas, permisos y aislamiento se evalúa por separado.

### 2.1. Ejecución directa, sin nuestro wrapper

```bash
pi --print --no-session "Explica qué hace este repositorio"
pi --mode json --no-session "Explica qué hace este repositorio" > run.jsonl
```

Para comparar streams puedes hacer:

```bash
# Shells POSIX con jq instalado
jq -r '.type' run.jsonl | sort | uniq -c
jq -c 'select(.type == "tool_execution_start")' run.jsonl
```

**Cuidado:** el archivo JSONL puede contener prompts, nombres de archivos, argumentos de herramientas y resultados con datos privados. **No lo subas sin revisarlo.**

---

## 3. JSON no significa «una respuesta en formato JSON»

Este es el punto conceptual más importante de la lección.

`pi --mode json` emite **múltiples registros separados por salto de línea LF**. Cada registro es un objeto JSON, pero **todo el stdout NO es un único objeto JSON**.

Ejemplo resumido:

```jsonl
{"type":"session","version":3,"id":"example","cwd":"/project"}
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hola"}}
{"type":"message_end","message":{"role":"assistant","stopReason":"stop","content":[{"type":"text","text":"Hola desde Pi"}]}}
{"type":"turn_end"}
{"type":"agent_end","messages":[],"willRetry":false}
{"type":"agent_settled","aborted":false}
```

El archivo `examples/pi-json-session.jsonl` tiene un ejemplo sintético adicional con una herramienta `read`. **No es una captura real de una sesión autenticada.**

### 3.1. Tipos de evento que debemos reconocer

| Evento | Qué representa | Uso en el harness |
|---|---|---|
| `session` | Cabecera del stream JSON: ID y metadata | Identificar el contexto de la ejecución |
| `agent_start` | Empieza un agent run de bajo nivel | Diagnóstico |
| `turn_start` | Comienza un turno | Métricas |
| `message_update` | Delta de texto/pensamiento/tool-call | Streaming en vivo, más adelante |
| `message_end` | Mensaje final **autoritativo** | Recuperar texto final y `stopReason` |
| `tool_execution_start` | Comienza una herramienta | Contar e identificar herramientas |
| `tool_execution_end` | Termina una herramienta | Detectar errores de herramientas |
| `turn_end` | Turno completado | Contar turnos |
| `agent_end` | Termina un agent run particular | **No** declarar completado aún |
| `agent_settled` | No queda trabajo automático pendiente | Decidir si terminó la ejecución |

### 3.2. `agent_end` no equivale a «todo terminó»

Pi puede terminar un run y continuar automáticamente por reintentos, compactación, recuperación u otras acciones. Por eso **`agent_settled` es la marca relevante de finalización**.

```text
agent_start
   ├── turn_start
   ├── tools, messages, etc.
   └── agent_end   ← puede haber recuperación o nuevo trabajo
             |
             v
      agent_settled ← no continuará automáticamente
```

### 3.3. Eventos incrementales vs contenido autoritativo

Los eventos `message_update` contienen deltas. Ejemplo:

```json
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hola "}}
```

Un consumidor que quiera pintar texto en tiempo real puede acumular esos deltas, respetando `contentIndex`. Cuando llega `message_end`, su campo `message` reemplaza la reconstrucción provisional: es la forma final del mensaje.

Para nuestra primera implementación de resumen elegimos sólo `message_end`. No reconstruimos manualmente el streaming de texto todavía. Eso evita duplicar una parte del protocolo que no necesitamos para los criterios actuales.

### 3.4. El problema de los códigos de salida

En modo print, Pi informa algunos errores mediante un código de proceso distinto de cero. Pero en **modo JSON**, errores o abortos del asistente **no necesariamente cambian el exit status del proceso**. La documentación dice expresamente que hay que inspeccionar los eventos.

Un harness que haga sólo esto es insuficiente:

```ts
const ok = processExitCode === 0;
```

En nuestro laboratorio evaluamos también:

- Presencia de cabecera `session` y `agent_settled`.
- `agent_settled.aborted`.
- El `stopReason` del último mensaje `assistant` (si es `error`, `aborted` o `length`).
- La integridad de cada registro JSONL.

Consideramos `length` una respuesta incompleta: la política del laboratorio es marcarla como fallo para evitar aceptar una respuesta truncada como entrega terminada. No es una imposición universal de Pi.

Una herramienta que falla puede ser reintentada o sorteada por el agente. Por eso **`isError: true` en una tool se cuenta como incidencia, pero no significa fallo del trabajo global**.

---

## 4. Evolución de Agent Harness Lab v0.1.0 a v0.2.0

**No empieces otro repositorio.** Si subiste la Lección 1, crea una rama:

```bash
git checkout main
git pull
git checkout -b feature/module-01-lesson-02
```

Si descargaste `agent_harness_lab_modulo_01_leccion_02_incremental.zip`, su contenido está preparado **relativo a la raíz de `agent-harness-lab/`**: incluye sólo archivos nuevos o modificados. Puedes revisar `CHANGELOG.md` y el manifiesto antes de copiarlos; si modificaste archivos por tu cuenta, compara antes de sobrescribir.

La versión completa `agent_harness_lab_modulo_01_leccion_02_full.zip` es un snapshot nuevo que incluye también la Lección 1; sirve como referencia, no necesitas reemplazar tu proyecto entero.

### 4.1. Estructura añadida

```text
agent-harness-lab/
├── src/
│   ├── cli.ts           # Modificado: --mode / --view / run-file
│   ├── config.ts        # Sin cambios
│   ├── runtime.ts       # Modificado: print + JSONL
│   └── json-events.ts   # Nuevo: parser y resumen semántico
├── tests/
│   ├── cli.test.mjs     # Tests de regresión de L1
│   └── json.test.mjs    # Nuevo: escenarios JSONL
├── examples/
│   └── pi-json-session.jsonl  # Nuevo: stream sintético
├── solutions/
│   └── modulo-01-leccion-02/  # Ejercicio resuelto, separado
├── LECCION_01.md
├── LECCION_02.md       # Este documento
├── CHANGELOG.md
└── package.json        # v0.2.0
```

Conservamos `src/config.ts` y el archivo `harness.config.json` sin cambios de esquema. Una decisión deliberada: **no necesitamos nuevas configuraciones para elegir una vista de salida por ejecución**.

### 4.2. Seleccionar el contrato en `buildPiArgs`

Archivo: `src/runtime.ts`.

```ts
export type PiMode = 'print' | 'json';

export function buildPiArgs(
  prompt: string,
  config: HarnessConfig,
  mode: PiMode = 'print',
): string[] {
  const args = mode === 'print' ? ['--print'] : ['--mode', 'json'];
  // ... flags comunes de la Lección 1
  args.push('--', prompt);
  return args;
}
```

**Decisión:** el modo por defecto sigue siendo print para preservar la experiencia y los tests anteriores. RPC no es una opción válida de `run`: su contrato es *bidireccional y persistente*, por lo tanto necesita una interfaz diferente.

### 4.3. Procesar stdout correctamente

Archivo: `src/runtime.ts`.

La dificultad está en que los chunks que Node recibe desde un proceso hijo **no se corresponden con registros JSON completos**. Un objeto JSON puede venir dividido en múltiples `data` chunks; o un chunk puede contener varios registros.

Además, la documentación exige separar **sólo en LF (`\\n`)**, no en cualquier separador de línea. `node:readline` no es adecuado para este protocolo porque también reconoce `U+2028` y `U+2029`.

Por eso usamos `StringDecoder` (para no romper caracteres UTF-8 entre chunks) y buscamos `\\n`:

```ts
const decoder = new StringDecoder('utf8');
let pending = '';

function readChunk(chunk: string): void {
  pending += chunk;
  let index: number;
  while ((index = pending.indexOf('\n')) !== -1) {
    const line = pending.slice(0, index);
    pending = pending.slice(index + 1);
    // parsear el registro y consumir el evento
  }
}

child.stdout.on('data', chunk => readChunk(decoder.write(chunk)));
```

El código completo también:

- Acepta `CRLF` retirando el `\\r` final del registro antes de parsear.
- Valida que haya `type` en el objeto.
- Rechaza registros finales sin LF (el protocolo establece ese terminador).
- Limita a 16 MiB el tamaño de un registro pendiente; es un límite de seguridad del **laboratorio**, no de Pi.
- Detecta timeout, error de spawn y fin incompleto.

Por simplicidad todavía sólo terminamos el proceso hijo, no todo su árbol de procesos. Esto no se debe confundir con cancelación robusta de una ejecución de producción.

### 4.4. Extraer un resumen compacto

Archivo nuevo: `src/json-events.ts`.

Separar el resumen de los detalles del subprocess tiene una justificación clara: **un evento JSONL debe poder ser analizado y testeado sin arrancar Pi**.

```ts
export class JsonEventCollector {
  private turns = 0;
  private sawSettled = false;
  private lastAssistantText = '';

  ingest(event: Record<string, unknown>): void {
    if (event.type === 'turn_end') this.turns++;
    if (event.type === 'agent_settled') this.sawSettled = true;
    // message_end, herramientas, errores, sesión...
  }

  // finish(exitCode) calcula si el run fue correcto
}
```

No mantenemos un segundo Agent Loop, ni hacemos inferencias sobre qué hará el modelo. Sólo transformamos **eventos observados** en un resultado de nuestro CLI.

Un resumen esperado se parece a esto:

```json
{
  "ok": true,
  "exitCode": 0,
  "sessionId": "fake-session",
  "eventCount": 10,
  "turns": 1,
  "tools": { "read": 1 },
  "toolErrors": 0,
  "settled": true,
  "aborted": false,
  "stopReason": "stop",
  "lastAssistantText": "Hola desde Pi"
}
```

**Nota:** no es un contrato oficial de Pi; es el **formato resumido de nuestro harness**, construido a partir de sus eventos. Si la respuesta se corta o el modelo falla, `ok` pasa a `false` y se agrega `error`.

### 4.5. Dos presentaciones del mismo stream

```bash
# Texto final: comportamiento original de L1
node dist/cli.js run "¿Qué módulos tiene este repositorio?"

# JSONL convertido en resumen por nuestro harness
node dist/cli.js run "¿Qué módulos tiene este repositorio?" --mode json

# JSONL original: ideal para piping a jq, scripts o herramientas externas
node dist/cli.js run "¿Qué módulos tiene este repositorio?" --mode json --view events

# Verificar flags sin usar un modelo
node dist/cli.js run "Revisar proyecto" --mode json --dry-run

# Ejecutar un prompt desde archivo: ejercicio L1 promovido al core
node dist/cli.js run-file examples/prompts/architecture.md --mode json
```

`--view summary` es el valor por defecto al elegir JSON. Si usas `--view events`, **stdout queda limpio de banners, progress bars y diagnósticos**. Esto permite redirigirlo directamente a un archivo o pipe. Cualquier error diagnóstico va a stderr.

**Atención:** `--view summary` mantiene sólo el último texto del asistente, ciertos contadores y el estado final. No sirve como traza completa. `--view events` sí puede revelar datos sensibles; revisa la salida antes de guardarla o compartirla.

---

## 5. RPC: qué aprender ahora y qué implementaremos después

RPC permite mantener un proceso Pi abierto y enviarle comandos. No consiste en ejecutar `pi --mode rpc "prompt"`: se escriben objetos JSONL por **stdin** y se reciben respuestas/eventos por **stdout**.

```bash
pi --mode rpc --no-session
```

Una orden de ejemplo es:

```json
{"id":"req-1","type":"prompt","message":"Resume este repositorio"}
```

Pi responde con un registro cuyo `type` es `response` y cuyo `id` permite correlacionarlo con la orden. Esa respuesta puede indicar que se aceptó el prompt, **no que el modelo haya terminado**. Debes seguir escuchando hasta `agent_settled` cuando realmente importe finalizar.

¿Por qué todavía no lo integramos? Porque un cliente RPC **correcto** necesita gestionar al menos:

1. Lectura y escritura continuas de JSONL.
2. Correlación de `id`, respuestas y eventos.
3. Estado de sesión, prompt activo y comandos concurrentes.
4. Errores, shutdown y recuperación.
5. Solicitudes interactivas de extensiones cuando se usen.

Pi ya exporta un **`RpcClient` tipado** para Node/TypeScript. Cuando construyamos una integración RPC, primero evaluaremos usarlo; no tendría sentido reinventar el protocolo completo sin una necesidad concreta.

Recurso oficial: https://pi.dev/docs/latest/rpc y https://pi.dev/docs/latest/cli-integration

---

## 6. SDK: cuándo importa más que RPC

Pi publica la función `createAgentSession` para integración embebida en TypeScript:

```ts
import { createAgentSession } from '@earendil-works/pi-coding-agent';

const { session } = await createAgentSession();
try {
  await session.prompt('Describe los archivos del proyecto');
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

**Este ejemplo es ilustrativo y no forma parte del código base de v0.2.0.** No agregamos la dependencia ni autenticación en este módulo. Cuando lo incorporemos de verdad, testearemos su lifecycle con herramientas específicas.

RPC y SDK ofrecen capacidades que no tiene un wrapper de print/JSON, pero son diferentes:

- **SDK:** integra Pi en el proceso Node (menos fricción para TypeScript, mayor acoplamiento y mismo límite de proceso).
- **RPC:** Pi queda separado, lo que facilita integraciones de otros lenguajes y permite un boundary más claro; **no es por sí solo un sandbox**.

Para un producto extensible en TypeScript, **SDK merece especial atención**. No tomamos todavía la decisión final de arquitectura.

Recurso oficial: https://pi.dev/docs/latest/sdk

---

## 7. Laboratorio paso a paso

### Paso 1 — Preparación

```bash
npm install
npm run build
npm test
```

Espera **22 tests** en el proyecto v0.2.0 de referencia, antes de aplicar la solución de esta lección. No se requiere conexión a un modelo.

### Paso 2 — Confirmar compatibilidad con v0.1.0

```bash
node dist/cli.js doctor
node dist/cli.js config
node dist/cli.js run "Resume README.md" --dry-run
node dist/cli.js run-file examples/prompts/architecture.md --dry-run
```

`doctor` sí necesita que Pi esté instalado y disponible; los otros comandos mencionados no lo requieren.

### Paso 3 — Ver los nuevos argumentos

```bash
node dist/cli.js run "Resume README.md" --mode json --dry-run
```

La lista de argumentos debe comenzar por `--mode json` en lugar de `--print`, y conservar los flags comunes de L1.

### Paso 4 — Ejecutar con proveedor real (opcional)

Primero configura Pi de manera normal, en un repositorio **de confianza**:

```bash
pi
# /login
# /model
```

Ahora prueba:

```bash
node dist/cli.js run "Explica el objetivo del proyecto" --mode json
node dist/cli.js run "Explica el objetivo del proyecto" --mode json --view events > mi-ejecucion.jsonl
```

Si la ejecución no tiene credenciales o modelo disponible, mostrará un error. No hay claves hardcodeadas en el proyecto. `mi-ejecucion.jsonl` debe considerarse un archivo potencialmente sensible y no subirse al repositorio.

### Paso 5 — Inspeccionar el stream

```bash
# Si tienes jq instalado
jq -r '.type' mi-ejecucion.jsonl
jq -c 'select(.type == "tool_execution_start")' mi-ejecucion.jsonl
jq -c 'select(.type == "agent_settled")' mi-ejecucion.jsonl
```

Una forma de comparar las modalidades es observar que print sólo expone la salida final y JSON puede informar qué herramientas se ejecutaron y cómo concluyó la sesión.

### Paso 6 — Tests de regresión

```bash
npm test
npm run typecheck
```

Los 22 tests incluyen los 9 de L1 y 13 nuevos para L2:

- Print sin regresiones.
- Resumen JSON correcto.
- Stream JSONL con `U+2028` sin falsos cortes de línea.
- `stopReason` fallido (`error`, `aborted`, `length`).
- Una herramienta fallida sin fallar toda la tarea.
- Falta de `agent_settled`.
- JSONL malformado y registro incompleto.
- Exit code del proceso, dry-run, run-file, flags inválidos.

---

## 8. Ejercicio — Vista de herramientas (`--view tools`)

**Contexto:** cuando ejecutamos un agente nos interesa observar qué herramientas se invocaron sin registrar sus argumentos o resultados completos. Queremos una salida compacta que no contenga información de archivos leídos.

### Historia de usuario LAB-002

> Como desarrollador que integra Agent Harness Lab, quiero ejecutar una tarea en modo JSON y consumir un stream de **inicio y fin de herramientas**, para poder observar actividad sin exponer los argumentos y resultados de cada tool.

**Nueva sintaxis requerida:**

```bash
agent-lab run "Inspecciona el repositorio" --mode json --view tools
```

**Criterios de aceptación:**

1. `--view tools` sólo se acepta en modo JSON.
2. En stdout sólo salen líneas JSON de `tool_execution_start` y `tool_execution_end`.
3. Cada salida contiene `type`, `toolName` y (para `tool_execution_end`) `isError`; no contiene `args` ni `result`.
4. Se mantiene el mismo criterio de finalización y errores que en modo summary.
5. No modifica el comportamiento de print, summary ni events.
6. Agrega al menos un test que compruebe el filtro y que los argumentos/resultados no estén presentes.

**Pistas de implementación:**

- Ampliar `JsonView` en `src/runtime.ts`.
- Modificar la validación de `--view` en `src/cli.ts`.
- En el punto donde `runPiJson` procesa cada objeto, serializar **un nuevo objeto reducido**, no el evento original.
- Mantener `collector.ingest(event)` incluso cuando el evento no se muestra.

La carpeta `solutions/modulo-01-leccion-02/` contiene una **solución funcional completa para los archivos modificados**, además de un test auxiliar de referencia. No se encuentra aplicada a la versión base para que puedas resolverla primero.

---

## 9. Preguntas de repaso con respuestas

**1. ¿Qué diferencia hay entre print y JSON?**
Print devuelve texto final; JSON devuelve una secuencia de eventos de una ejecución. JSON no implica que el modelo esté obligado a responder con un único objeto JSON.

**2. ¿Por qué no basta con `exitCode === 0`?**
Porque en JSON el agente puede terminar con un error o aborto expresado dentro del stream sin que eso cambie el código de salida del proceso.

**3. ¿Cuándo termina realmente un run?**
Para nuestro criterio de finalización, cuando Pi emite `agent_settled` y no hay error semántico o de proceso. `agent_end` no garantiza que no haya trabajo automático pendiente.

**4. ¿Por qué no usar `readline`?**
El framing de Pi exige dividir los registros exclusivamente en LF; `readline` también interpreta separadores Unicode que pueden aparecer dentro de strings JSON.

**5. ¿RPC equivale a ejecutar JSON muchas veces?**
No. JSON crea un proceso de un solo uso; RPC mantiene un proceso y acepta nuevas órdenes por stdin, correlacionándolas con las respuestas.

**6. ¿SDK es siempre mejor que RPC?**
No. SDK integra la lógica en el mismo proceso TypeScript; RPC proporciona un boundary entre procesos y un protocolo independiente del lenguaje. La elección depende de restricciones y capacidades requeridas.

**7. ¿Limitar `--tools` hace seguro el harness?**
No. Limita las herramientas expuestas al modelo en esa ejecución, pero no reemplaza permisos del SO, aislamiento, análisis de recursos confiados ni políticas sobre ejecución.

---

## 10. Límites honestos y próximos pasos

**Lo que tenemos:** un wrapper funcional de una sola ejecución con dos contratos de salida, control del proceso, configuración, pruebas y un pequeño observador de eventos.

**Lo que aún no tenemos:** sesiones administradas en tiempo real, comunicación bidireccional, un sistema robusto de autorización, sandbox, interrupción de árboles de procesos, un runtime dentro de Node ni herramientas propias. No debemos llamar a v0.2.0 «harness listo para producción» todavía.

Si el proyecto requiere Windows nativo, ten presente que los launchers `.cmd` de npm pueden requerir un adaptador; en este laboratorio recomendamos WSL o un ejecutable directo confiable. Los tests de proceso están orientados a Node en entorno POSIX.

### Próxima lección

**Módulo 1 · Lección 3 — Modelos, proveedores y selección de capacidades**  
**Nivel:** Principiante–Intermedio · **Complejidad:** Media

Trabajaremos configuración efectiva de modelos, credenciales sin secretos en archivos, parámetros de ejecución, validación de compatibilidad y una estrategia mínima para seleccionar proveedores, sin introducir todavía un motor de routing sofisticado.

---

## 11. Referencias oficiales consultadas

- Pi CLI Integration: https://pi.dev/docs/latest/cli-integration
- Pi Command Line: https://pi.dev/docs/latest/cli
- Pi JSON Event Stream: https://pi.dev/docs/latest/json
- Pi RPC: https://pi.dev/docs/latest/rpc
- Pi SDK: https://pi.dev/docs/latest/sdk
- Pi Quickstart: https://pi.dev/docs/latest/quickstart
- Pi repository and official examples: https://github.com/earendil-works/pi

**Validación de la entrega:** se compiló la versión TypeScript del laboratorio con las herramientas disponibles, se ejecutaron 22 tests automatizados del proyecto base y 24 tests en la solución superpuesta. Los tests usan un Pi simulado; **no se verificó una sesión de Pi real con credenciales** en este entorno.
