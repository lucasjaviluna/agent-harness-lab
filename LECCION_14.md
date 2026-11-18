# Módulo 3 · Lección 3 — RPC, JSON streaming y comunicación entre procesos

**Lección global:** 14/20 · **Nivel:** Avanzado · **Complejidad:** Alta · **Duración sugerida:** 180–210 min.
**Producto:** Agent Harness Lab v0.14.0, evolución de v0.13.0.
**Repositorio:** https://github.com/lucasjaviluna/agent-harness-lab

## 1. Objetivos y punto de partida

Al finalizar vas a poder iniciar Pi como un proceso persistente, enviar comandos por stdin, correlacionar respuestas, leer eventos por stdout, distinguir aceptación de finalización, mantener y reiniciar una sesión, abortar solicitudes y cerrar procesos con un plazo acotado. Aprenderás también cómo responder a diálogos de extensiones. El propósito no es escribir otro Agent Loop: Pi sigue ejecutando el modelo, las herramientas y la sesión.

La rama main consultada contiene v0.13.0. El proyecto descargable se construyó sobre nuestro snapshot v0.13.0; los blobs de `package.json`, `src/runtime.ts`, `src/sdk-runner.ts`, `README.md` y `CHANGELOG.md` coincidían con los consultados remotamente. `src/cli.ts` difería, por lo que se deja intacto en el patch; el snapshot no reemplaza tus cambios. El checkout directo de GitHub falló por DNS. Usar el patch o ZIP incremental, no sobrescribir el repositorio con el snapshot.

## 2. Qué es RPC y cuándo usarlo

RPC (Remote Procedure Call) expresa una solicitud de operación a otro proceso. Remote no significa necesariamente otra máquina: en este caso el proceso Node que constituye nuestro cliente y el proceso Pi se ejecutan en la misma máquina. No hay servidor HTTP ni puerto que abrir. Los pipes del sistema operativo transportan JSON serializado. El proceso hijo mantiene una sesión hasta su cierre o un comando de reinicio.

| Alternativa | Límite | Cuándo elegirla |
|---|---|---|
| CLI print | Proceso por tarea | Automatización sencilla, resultado textual |
| CLI JSON | Proceso por tarea | Observar ejecución y recolectar evidencia |
| SDK | Mismo proceso Node/Bun | Acceso directo a AgentSession, herramientas y estado |
| RPC | Proceso separado y persistente | UI propia, varios prompts, integración con otros lenguajes |

Una ejecución de CLI JSON puede recuperar una sesión en disco, pero lanza un nuevo proceso. RPC conserva el estado vivo. El SDK evita serializar solicitudes y permite integrar extensiones programáticamente. RPC ayuda a aislar fallos y permite reiniciar el proceso, pero no implica aislamiento de archivos, red, secretos ni procesos descendientes.

Pi ofrece un cliente oficial `RpcClient` para TypeScript. Lo estudiaremos en la sección 12. Construiremos un cliente reducido sólo como ejercicio de protocolo y para reutilizar el launcher ya probado de nuestro lab. No proponemos mantener dos clientes RPC de propósito general en producción. La decisión del proyecto será revisada al construir workflows (lección 16).

## 3. Anatomía del transporte

```text
                comandos JSONL
   aplicación ---------------------> stdin de Pi
   LabRpcClient                       sesión persistente
                respuestas/eventos
                <--------------------- stdout de Pi
                diagnósticos separados
                <--------------------- stderr de Pi
```

Un registro es un objeto JSON seguido de LF (`\n`). El separador no es cualquier salto de línea Unicode. No usar `readline` para este framing: U+2028/U+2029 dentro de una cadena JSON no deben dividir el registro. Un chunk de stdout no equivale a un mensaje: puede contener parte de un carácter UTF-8, varios objetos o sólo parte de un objeto. Para resolverlo, `StringDecoder` conserva bytes UTF-8 incompletos y un buffer acumula caracteres hasta el siguiente LF. Un CR anterior al LF se retira para aceptar CRLF. El stream terminado con un registro pendiente es un error de protocolo.

```typescript
const decoder = new StringDecoder('utf8');
let pending = '';
// En cada llegada de datos:
pending += decoder.write(chunk);
let i: number;
while ((i = pending.indexOf('\n')) >= 0) {
  const line = pending.slice(0, i).replace(/\r$/, '');
  pending = pending.slice(i + 1);
  consume(JSON.parse(line));
}
```

El código completo también impone un límite de 16 MiB por registro, verifica que el objeto tenga `type`, drena stderr sin mezclarlo con stdout y limita la cola pendiente de stdin. No afirmar que esta cota limite toda la memoria de una sesión: Pi mantiene su propio contexto y el cliente conserva una respuesta de texto por prompt. Los prompts tienen un límite de 128 KiB.

## 4. Cuatro familias de registros

Ejemplo de intercambio (en `examples/rpc/protocol.example.jsonl` están los registros de ejemplo en secuencia):

```json
{"id":"req-1","type":"get_state"}
{"type":"response","id":"req-1","command":"get_state","success":true,"data":{"messageCount":0}}
```

El primer registro se escribe en stdin, el segundo lo emite Pi en stdout. El contenido real de `get_state` incluye datos adicionales.

Para pedir una ejecución:

```json
{"id":"req-2","type":"prompt","message":"Explica CQRS en una frase"}
{"type":"response","id":"req-2","command":"prompt","success":true,"data":{"disposition":"started"}}
```

La respuesta confirma la operación de control, no el trabajo del modelo. Luego llegan eventos sin ID de comando, por ejemplo:

```json
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"CQRS separa "}}
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"lecturas y escrituras."}}
{"type":"agent_settled","aborted":false}
```

La cuarta familia corresponde a diálogos/notificaciones de extensiones: `extension_ui_request` y `extension_ui_response`. Se correlacionan por su propio ID, y una respuesta de UI no produce una respuesta normal de comando.

No usar un ID de prompt para asociar arbitrariamente cada evento a una tarea concurrente: los eventos generalmente pertenecen a la sesión completa. El cliente didáctico sólo admite un prompt en vuelo, aunque permite consultas concurrentes por ID. La gestión de múltiples agentes requerirá procesos separados o una estrategia de orquestación explícita.

## 5. Correlación y ciclo de vida

La clave es un mapa de solicitudes pendientes. Cada comando crea un UUID y registra su promesa antes de escribir. Si dos consultas se ejecutan en paralelo, la segunda puede responder antes que la primera; el mapa permite resolver ambas correctamente. También comprobamos que el nombre del comando recibido coincida. Respuestas con ID desconocido, sin ID o no correlacionables invalidan el cliente de laboratorio; no se intenta recuperar una corriente cuya integridad se desconoce.

```typescript
const id = randomUUID();
// Registrar resolve + reject + timer antes de escribir.
pending.set(id, request);
child.stdin.write(JSON.stringify({ type: 'get_state', id }) + '\n');
```

En `src/rpc-client.ts` la función `request()` centraliza esta lógica. El límite es 32 comandos pendientes y cada uno tiene timeout. El final de una solicitud elimina su timer y su entrada. Los errores de Pi no se reproducen en bruto; mostramos códigos controlados y el nombre del comando. La excepción: mensajes de arranque/configuración del runner pueden requerir revisión local antes de compartirlos.

### Aceptación vs asentamiento

`prompt` puede responder con disposición:

- `started`: comenzó una ejecución; continuar observando.
- `queued`: el mensaje fue encolado por steering/follow-up; no es una ejecución independiente.
- `handled`: una extensión o handler consumió la entrada; no necesariamente habrá un nuevo run.

El modo didáctico sólo acepta `started`; rechaza `queued` y `handled` sin esperar indefinidamente. También rechaza prompts que comienzan por `/` para evitar ambigüedades con comandos de extensión. El cliente de producto puede soportar otras disposiciones con una máquina de estados específica.

`agent_end` indica que finalizó una corrida interna. Pi puede seguir con recuperación, retry, compaction o trabajo encolado. `agent_settled` indica que la actividad automática de esa ejecución se asentó. Suscribirse antes de enviar el prompt evita perder un asentamiento rápido incluso si precede al ACK. Además, comprobar el `stopReason` del último mensaje assistant (`stop` en el caso exitoso). Un mensaje parcial por error no se considera éxito.

```text
suscribir -> prompt -> ACK started -----------+
                 \-> agent_end -> retry -> agent_settled --+
                                     esperar AMBOS, comprobar stopReason
```

El resultado `{text, events, tools, toolErrors}` sólo representa una ejecución asentada normalmente. Los errores de herramientas pueden ser recuperables: `toolErrors` no obliga a fallar si el modelo terminó normalmente. La aplicación consumidora decide si esos errores impiden aceptar una tarea de negocio. El texto final se obtiene del último mensaje de assistant y no del stream concatenado (que puede incluir intentos fallidos previos).

## 6. Implementación de Agent Harness Lab

```text
src/rpc-client.ts     framing, correlación, eventos y ciclo de vida
src/rpc-runner.ts     opciones, configuración, prompts secuenciales
src/rpc-cli.ts        punto de entrada npm rpc:run
src/runtime.ts        exporta el piCommand existente; no cambia su lógica
examples/rpc/         registros, instrucciones y ejemplos
examples/sdk/rpc-native.example.ts  ejemplo del cliente oficial
 tests/rpc-client.test.mjs
 tests/fixtures/fake-rpc.mjs
```

`LabRpcClient.start()` reutiliza `piCommand()` de la lección inicial. El código existente reconoce `pi.cmd` y `pi-launcher.js` en Windows cuando ambos están disponibles y utiliza `process.execPath`. Se mantiene `shell: false`; el prompt no forma parte de los argumentos de shell ni de línea de comandos de Pi: viaja por stdin como JSON. No se amplía aún la compatibilidad a cualquier wrapper de Windows. Tests de protocolo lanzan un script mediante `process.execPath` para ser portables.

```typescript
const client = LabRpcClient.start({
  executable: 'pi', cwd: process.cwd(), readOnly: false,
});
try {
  await client.getState();
  const a = await client.prompt('El proyecto ficticio se llama Atlas');
  const b = await client.prompt('¿Cómo se llama?');
  console.log(a.text, b.text);
} finally {
  await client.close();
}
```

Este ejemplo usa los exports compilados en `dist/rpc-client.js`. Las peticiones `getState()` y `getMessages()` son programáticas; no imprimimos por defecto el estado completo porque puede contener historial, metadatos o rutas. `newSession()` inicia una sesión nueva, comprueba `cancelled: false` y no se permite durante un prompt. `abort()` es el comando nativo. El cliente rechaza un prompt simultáneo (`RPC_BUSY`) y no lo pone en cola.

La sesión se inicia con `--no-session`; por tanto no persiste el historial de conversación a disco mediante SessionManager. Eso no implica que Pi o sus proveedores no registren otra información. El perfil RPC toma únicamente `pi.executable` de la configuración del harness. Modelo, proveedor y thinking son opciones CLI independientes; defaults de modelo los decide Pi. No usa los perfiles, flags de herramientas ni las sesiones persistentes de CLI. Es una decisión optativa para no implicar paridad de capacidades entre adaptadores antes de verificarla.

## 7. Laboratorio paso a paso

Requisitos: Node >=22.19, TypeScript del proyecto, Pi instalado y autenticado para ejercicios reales. Los tests no requieren Pi ni credenciales. Desde la raíz:

```powershell
npm install
npm test
npm run typecheck
```

Primero inspecciona `tests/fixtures/fake-rpc.mjs`: es un proceso simulado que entiende parte del protocolo y no tiene LLM. Ejecuta sólo los tests RPC:

```powershell
node --test tests/rpc-client.test.mjs
```

Luego verifica `pi --version` y `pi --help` en tu entorno. No uses un repositorio con datos sensibles. Si aún falta autenticación, entra en Pi y configúrala mediante `/login` y `/model` cuando corresponda.

### Práctica A — mismo contexto

```powershell
npm run rpc:run -- "Mi proyecto ficticio se llama Atlas" "¿Cómo se llama mi proyecto?"
```

Esperamos que la segunda respuesta pueda recuperar el nombre (depende del modelo). Una estructura representativa de resultado es:

```json
{"turns":[{"text":"Entendido: Atlas.","events":8,"tools":0,"toolErrors":0},{"text":"Atlas.","events":9,"tools":0,"toolErrors":0}]}
```

Los contadores son ilustrativos, no una ejecución registrada. El script usa el mismo proceso para ambos prompts. stdout del módulo Node contiene el JSON final; npm puede imprimir sus propios encabezados, por lo que para encadenar otra aplicación conviene invocar `node dist/rpc-cli.js` directamente.

### Práctica B — contexto nuevo

```powershell
npm run rpc:run -- --reset-between "Mi proyecto ficticio se llama Atlas" "¿Cómo se llama mi proyecto?"
```

La segunda solicitud no recibe el historial de la primera. Comparar respuestas y revisar el test `new_session limpia historial`. Esta práctica pide al modelo que no adivine el dato perdido si se necesita una comprobación más clara.

### Práctica C — streaming y herramientas de lectura

```powershell
npm run rpc:run -- --stream --read-only "Enumera los archivos TypeScript de src"
```

Los deltas de texto llegan por stderr para reservar stdout para JSON. El streaming puede exponer datos sensibles y texto de intentos anteriores. Sin `--read-only`, las herramientas están desactivadas. El conjunto de lectura habilitado es `read,grep,find,ls`. No supone restricción al árbol del proyecto ni es un sandbox. Nunca ejecutar con permisos innecesarios.

### Práctica D — proveedor y cancelación

```powershell
npm run rpc:run -- --provider anthropic --model MODELO_DISPONIBLE --thinking low --timeout-ms 60000 "Explica Mediator"
```

Sustituir los identificadores por los de tu instalación. Ctrl+C pide abortar y evita enviar los siguientes prompts. El cliente tiene un plazo por prompt (120 s por defecto), plazos para comandos y un plazo adicional para intentar abortar en caso de timeout; no es una garantía exacta de tiempo total. Tras timeout/error/aborto el cliente se invalida. El runner siempre llama `close()`.

## 8. Cancelar y cerrar no significan lo mismo

`abort` solicita detener el trabajo y espera respuesta de Pi. En una UI que admite colas habría que considerar `clear_queue` antes de abortar; este laboratorio no ofrece steering/follow-up. El comando puede ser ignorado si el agente está bloqueado. El cliente intenta abortar en un plazo acotado y, ante un estado ambiguo, no reusa el proceso. `close()` marca el cliente cerrado, rechaza solicitudes pendientes y cierra stdin. Espera 500 ms, intenta SIGTERM y espera 500 ms, intenta SIGKILL y espera otros 500 ms. Si no observa cierre, desconecta sus streams y emite un error. Los tiempos son deliberadamente pequeños para el laboratorio; producción debe configurarlos según carga. No es una garantía de eliminar todo el árbol de procesos en Windows o Linux.

Los errores del protocolo, salida inesperada o comando vencido invalidan el cliente y rechazan las promesas pendientes. El consumidor debe cerrar en `finally`; no asumir que invalidar equivale a matar automáticamente. No hacer retry automático de una operación cuyo efecto es desconocido.

## 9. UI RPC, approvals y seguridad

En RPC, `ctx.hasUI` puede ser verdadero aunque no haya una terminal de Pi: los diálogos viajan por el protocolo. Ejemplo:

```json
{"type":"extension_ui_request","id":"dialog-42","method":"confirm","title":"Autorizar cambio","message":"Modificar archivo"}
```

El cliente responde con el ID del diálogo, no el del prompt:

```json
{"type":"extension_ui_response","id":"dialog-42","cancelled":true}
```

Este runner no presenta un operador ni un canal de aprobación; cancela `confirm`, `select`, `input` y `editor`. Ignora notificaciones informativas sin enviar respuestas. Es la opción fail-closed para la interacción, no una política completa. Una UI futura podrá mostrar una solicitud, comprobar la identidad, asociar la aprobación a argumentos concretos y responder solamente tras una decisión humana real.

No se activa nuestro Approval Guard automáticamente en este runner. Se deshabilitan extensiones, MCP, Skills, templates y context files, y no se ofrecen herramientas salvo lectura optativa. Estas opciones no impiden toda carga de configuración o código ni restringen permisos de sistema. La API RPC tiene comandos como `bash`: **no** se exponen en nuestro cliente público. No crear una API web que acepte JSON RPC arbitrario del navegador. Cualquier usuario capaz de escribir en stdin del proceso o ejecutar código local puede saltarse nuestro contrato.

En la lección 17 revisaremos una política común, identidad, auditoría, evidencias y límites externos. No registrar credenciales, argumentos completos o mensajes de usuario por defecto. El proceso hereda el entorno para permitir autenticación de Pi: esto no es aislamiento de secretos.

## 10. Pruebas y troubleshooting

| Caso | Qué valida |
|---|---|
| UTF-8 dividido y separadores Unicode | Framing independiente de chunks |
| Respuestas fuera de orden | Correlación por UUID |
| `agent_settled` antes del ACK | Suscripción temprana |
| `agent_end` seguido de retry | No terminar antes de tiempo |
| `handled` | No quedarse esperando un run inexistente |
| stopReason error | No presentar texto parcial como éxito |
| `tool_execution_end.isError` | Métrica de herramientas fallidas |
| Timeout, proceso muerto y spawn fallido | Rechazo de pendientes y estado inválido |
| Diálogo `confirm` | Cancelación explícita |
| `new_session` | Historial limpio |
| Cierre repetido | Idempotencia |

El fixture devuelve resultados ficticios, no un modelo. Para añadir casos reproducibles puedes modificar temporalmente el fixture, por ejemplo retrasar la aceptación, emitir dos respuestas fuera de orden o enviar una línea truncada. Nunca usarlo para simular capacidad real sin indicarlo.

- `RPC_PROCESS_ERROR`: verificar ejecutable de Pi, PATH, instalación en Windows o `pi.executable` de la config.
- `RPC_COMMAND_TIMEOUT`: comprobar que el proceso emite respuestas RPC; no confundir stdout textual con JSONL.
- `RPC_PROTOCOL_ERROR`: comprobar que ninguna extensión escribe logos o logs a stdout. Pi puede cambiar de versión; contrastar protocolo.
- `RPC_PROMPT_TIMEOUT` / `RPC_INCOMPLETE_RUN`: comprobar proveedor, red, modelo y autenticación. No reintentar automáticamente modificaciones.
- `RPC_PROMPT_NOT_STARTED`: entrada procesada por otro handler o encolada. Este cliente sólo permite un prompt normal a la vez.
- Si en Windows el launcher no está disponible, no activar `shell: true` como arreglo genérico. Revisar ruta de instalación.

## 11. Comandos avanzados (conocer antes de implementar)

| Comando | Responsabilidad |
|---|---|
| `get_state`, `get_messages` | Consultas de estado e historial (implementados) |
| `new_session`, `abort` | Reiniciar y abortar (implementados) |
| `steer`, `follow_up`, `clear_queue` | Controlar trabajo encolado (no implementados) |
| `set_model`, `set_thinking_level` | Cambios en caliente (no implementados) |
| `compact` | Compactar contexto (no implementado) |
| `switch_session`, `fork`, `clone` | Gestión de sesiones persistentes (no implementados) |
| `get_session_stats` | Métricas acumuladas (ejercicio) |

En una aplicación con sesión persistente, no cambiar de modelo o de sesión mientras corre un prompt sin conocer las reglas de concurrencia del servidor. El SDK y el cliente nativo ya ofrecen métodos para muchos de estos comandos. No implementar cada método en el laboratorio sólo porque existe.

## 12. Cliente oficial RpcClient

Pi exporta `RpcClient` con comandos tipados, eventos y gestión del proceso. En TypeScript, es el punto de partida recomendado para una integración RPC general. Ejemplo simplificado:

```typescript
import { RpcClient } from '@earendil-works/pi-coding-agent';
const client = new RpcClient({
  cliPath: '/ruta/al/cli.js', cwd: process.cwd(),
  args: ['--no-session', '--no-tools', '--no-extensions', '--no-mcp'],
});
try {
  await client.start();
  const events = await client.promptAndWait('Qué es RPC?', undefined, 60000);
  // Verificar agent_settled, aborted y stopReason antes de aceptar el resultado.
  console.log(events.length);
} finally {
  await client.stop();
}
```

La versión completa se incluye en `examples/sdk/rpc-native.example.ts`, con verificación del resultado y sin imprimir el stream completo. Requiere el SDK de la Lección 13 (1.5.2) y una ruta al entrypoint JavaScript del CLI de la misma versión; no un `pi.cmd` ni binario autónomo. El constructor nativo usa Node para iniciarlo. La versión local del CLI podría utilizar una distribución distinta. Revisa `examples/rpc/README.md`.

En este entorno no se pudo instalar ni autenticar Pi SDK; el ejemplo nativo se contrastó con el código oficial, pero no se ejecutó ni se verificaron sus tipos con el paquete real. No confundir esto con los tests TypeScript del cliente didáctico, que sí se ejecutaron.

## 13. Ejercicio — US-LAB-014

Agregar `LabRpcClient.getSessionStats()` para consultar métricas acumuladas del agente sin invocar el modelo.

Requisitos:

1. Usar el comando oficial `get_session_stats`, no sumar los eventos `message_update` como si fueran tokens.
2. Reutilizar `request()` y su correlación por ID.
3. Exponer exclusivamente `userMessages`, `totalTokens` (de `tokens.total`) y `cost`.
4. Verificar que los contadores sean enteros no negativos y el coste un número finito no negativo.
5. Rechazar consultas durante un prompt activo.
6. Verificar que las estadísticas se reinician tras `new_session`; no mostrar rutas ni IDs del servidor.

Salida sintética de ejemplo:

```json
{"userMessages":2,"totalTokens":20,"cost":0.02}
```

El coste que informa Pi es una estimación, no una factura. El fixture ya responde a `get_session_stats` para que puedas escribir el test sin instalar Pi.

**Pista:** añade el método a la clase; interpreta los campos con `asRecord()` y evita copiar todo el objeto remoto. Usa el patrón `newSession()` para identificar cuándo rechazar por actividad, pero esta operación de consulta no necesita modificar el historial. La solución completa incluye el archivo final y tres tests en `solutions/modulo-03-leccion-03/`. Aplica sólo después de resolver tu propia versión; no es necesario incorporar el ejercicio a main para continuar el curso.

## 14. Preguntas de repaso y verificación de aprendizaje

1. ¿Por qué JSON y RPC no son equivalentes si ambos entregan JSONL? — JSON ejecuta una invocación; RPC mantiene un proceso bidireccional y una sesión viva.
2. ¿Por qué no se puede resolver una solicitud por orden de llegada? — Las respuestas pueden llegar fuera de orden; se necesita ID.
3. ¿Por qué no se espera siempre `agent_settled` al enviar prompt? — `handled` puede significar que no inició un run; `queued` pertenece a otra actividad.
4. ¿Por qué `agent_end` no basta? — Puede haber retry, compaction u otro trabajo interno.
5. ¿Un stream de deltas es el resultado final? — No; se valida el último mensaje y el asentamiento.
6. ¿Una extensión con `ctx.hasUI` implica autorización? — No; en RPC puede haber diálogos remotos sin operador. Una autorización requiere una respuesta humana real.
7. ¿En qué arquitectura elegirías SDK? — Cuando el consumidor es Node/TypeScript y requiere control directo; RPC cuando prima el límite de proceso o interoperabilidad.
8. ¿Por qué el proceso separado no es sandbox? — Hereda permisos de sistema, entorno y posiblemente acceso a archivos/red.
9. ¿Por qué invalidar tras timeout? — No sabemos si la operación aún continúa o produjo efectos; reusar la sesión puede mezclar resultados.
10. ¿Qué añadir para producción? — Contrato común, límites de recursos y tiempos, supervisor, aislamiento real, política de tools, auditoría, observabilidad y pruebas con Pi autenticado en cada plataforma.

Criterio de finalización: ejecutar las prácticas A/B/C, observar los tests y poder explicar el flujo de un prompt, desde el ID hasta `agent_settled`, así como la diferencia con SDK y JSON.

## 15. Referencias y siguiente lección

- Pi RPC: https://docs.pi.dev/latest/rpc
- Comandos: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md
- UI RPC: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-extension-ui.md
- Eventos JSON: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md
- Cliente oficial: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-client.ts
- Ejemplo oficial: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/rpc-client.ts
- SDK: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md

Próxima: Módulo 3 · Lección 4 (global 15) — Context Engineering, RAG y memoria. Conectaremos recuperación de contexto y memoria mediante adaptadores, sin crear otro motor de búsqueda ni almacenar indiscriminadamente el historial. Quedan seis lecciones después de ésta.

## 16. Estado de la validación

Snapshot v0.13.0: 163 tests aprobados, 1 omitido. v0.14.0: 185 aprobados, 1 omitido (Windows); solución: 188 aprobados, 1 omitido. Typecheck del núcleo aprobado. Node local 22.16, menor que 22.19 requerido; TypeScript y tipos disponibles en el entorno, sin instalación nueva de npm. El fixture usa procesos reales simulados y no consume tokens. No se ejecutaron Pi real, proveedor autenticado ni cliente oficial, ni el test nativo Windows. El patch se verifica contra snapshot y no contra el checkout remoto completo. No hay commits remotos. La versión de la dependencia Pi sigue fijada en 1.5.2 para el SDK independiente.
