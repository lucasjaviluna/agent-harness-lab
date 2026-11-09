# Módulo 2 · Lección 2 — Extensiones TypeScript y eventos del ciclo de vida de Pi

**Curso:** Pi.dev — Agent Harness Engineering (de cero a un harness configurable y extensible)
**Módulo:** 2 — Extensibilidad (de 4 módulos)
**Lección:** 2 de 6 del módulo · 7 de 20 del curso
**Nombre:** Extensiones TypeScript, Extension API y eventos del ciclo de vida
**Nivel:** Intermedio
**Complejidad:** Media–Alta
**Duración:** 150–180 minutos
**Versión:** Agent Harness Lab v0.7.0 (incremental sobre v0.6.0)
**Repositorio de referencia:** https://github.com/lucasjaviluna/agent-harness-lab
**Fecha:** 2026-11-07

> **Base verificada:** GitHub `main` sigue en v0.5.0 (revisión de `package.json` y árbol del repositorio). Por tanto, esta entrega se construye sobre el **ZIP v0.6.0 de la lección anterior**, no directamente sobre `main`. Para aplicar el patch primero incorporá la v0.6.0. El patch fue probado contra el snapshot v0.6.0, no contra tu checkout exacto. Las correcciones de ejecución para Windows, incluyendo `piCommand`, `pi-launcher.js` y `shell:false`, no se modifican.

## 1. Objetivos

Al terminar la lección serás capaz de:

1. Diferenciar Skills, prompt templates, extensiones y herramientas personalizadas.
2. Explicar el proceso de descubrimiento, confianza, carga y recarga de extensiones.
3. Escribir una extensión TypeScript con `export default function (pi: ExtensionAPI)`.
4. Suscribirte a `session_start`, `agent_start`, `tool_execution_end`, `agent_settled` y `session_shutdown`.
5. Usar `ExtensionContext` y `ctx.hasUI` sin asumir que la TUI siempre existe.
6. Registrar un comando `/lab-stats` con `pi.registerCommand`.
7. Pasar archivos de extensión a Pi desde nuestro CLI sin duplicar su loader.
8. Probar código de una extensión con un `ExtensionAPI` simulado, sin consumir tokens.
9. Reconocer los límites de las extensiones: **corren con los permisos de Pi**; no son un sandbox.

**Resultado del producto:** `agent-lab` v0.7.0 añade `extensions list`, `--extension` repetible, `--no-extensions`, una extensión observadora y tests de CLI y de ciclo de vida.

## 2. Recordatorio: qué hace Pi y dónde vive la extensión

```text
Usuario / CLI del laboratorio
           |
           v
       Pi runtime
           |
    carga recursos confiables
       .pi/extensions/*.ts
           |
   llama ExtensionAPI factory
           |
     pi.on(...) / registerCommand(...)
           |
     Agent Loop + Tools
           |
    eventos -> handlers
```

**No construimos un nuevo Agent Loop.** Pi ya decide cuándo consultar al modelo, cuándo ejecutar herramientas y cuándo anunciar el fin de la ejecución. Una extensión actúa como *plugin del proceso Pi*, suscribiéndose a esos acontecimientos e incorporando funciones especializadas.

### 2.1. Comparación

| Recurso | Aporta | Ejemplo |
|---|---|---|
| `AGENTS.md` | Convenciones generales | Cómo escribir tests |
| Prompt template | Un prompt reutilizable | `/review` |
| Skill | Conocimientos y procedimientos bajo demanda | `agent-review/SKILL.md` |
| **Extension** | Código TypeScript que participa en el runtime | Notificación, gate, estado, comando |
| **Custom tool** | Operación invocable por el modelo; se registra desde una extensión | `project_status` (próxima lección) |

**Criterio de elección:** empezá con instrucciones cuando basta con orientar al agente; utilizá extensión cuando necesitás *ejecutar código en respuesta a eventos, controlar operaciones o integrar sistemas*.

## 3. Instalación, descubrimiento y trust

Pi encuentra extensiones en:

```text
~/.pi/agent/extensions/        # Globales
.pi/extensions/*.ts           # Del proyecto (una vez confiable)
.pi/extensions/nombre/index.ts
```

Admite otras rutas mediante configuración y el flag repetible `-e` / `--extension`. **Las extensiones de proyecto se cargan cuando Pi considera confiable el proyecto**. El comando `/reload` recarga los recursos descubiertos. El flag `-e` sirve para pruebas directas: para recargar con `/reload`, ubicá la extensión en una ruta de descubrimiento. Pi carga TypeScript mediante jiti: no es necesario compilar las extensiones por separado.

```bash
# Experimento con Pi directo
pi --no-extensions --extension .pi/extensions/lifecycle-observer.ts

# Para experimentar con recarga en Pi interactivo
pi
/reload
/lab-stats
```

**Matiz importante:** `--no-extensions` desactiva extensiones descubiertas, configuradas y built-in, pero **NO** impide cargar `--extension` explícita. Nuestro laboratorio respeta esta semántica. La v0.6.0 ya establecía `disableExtensions=true` por defecto en `harness.config.json`, por lo que una extensión explícita puede cargarse sin activar todo el conjunto de extensiones automáticas.

**Advertencia:** una extensión es código arbitrario que puede leer archivos y credenciales y ejecutar comandos. Ni `--no-extensions` combinado con una extensión explícita, ni las instrucciones del prompt, constituyen un sandbox. **No cargues extensiones desconocidas**.

## 4. ExtensionAPI: contrato mínimo

La extensión exporta una fábrica por defecto:

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function myExtension(pi: ExtensionAPI) {
  pi.on('session_start', (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.notify('Extensión lista', 'info');
  });
}
```

- `ExtensionAPI` es el conjunto de funciones disponibles durante el registro de la extensión.
- `pi.on(eventName, handler)` registra un callback.
- `ctx` es un `ExtensionContext`: incluye entorno y capacidades de Pi, como `ctx.sessionManager`, `ctx.cwd`, `ctx.hasUI` y `ctx.ui`.
- `ctx.hasUI` es clave: el mismo archivo puede ejecutarse en TUI, print, JSON o RPC. No siempre hay una UI interactiva.
- `pi.registerCommand(name, options)` registra un comando de Pi, no un subcomando de `agent-lab`.

### 4.1. Ciclo de vida

```text
session_start                  (inicio, recarga, reanudación, fork)
     │
     v
before_agent_start             (oportunidad de intervenir el contexto)
     │
     v
agent_start                    (comienza una ejecución de bajo nivel)
     │
     ├── turn_start
     │       ├── modelo propone herramientas
     │       ├── tool_execution_start
     │       ├── tool_call           (interceptar / bloquear)
     │       ├── tool_execution_end  (herramienta finalizada)
     │       └── turn_end
     │
     v
agent_end                      (puede haber retries/continuación)
     │
     ├── otra ejecución si hay trabajo pendiente
     │
     v
agent_before_settle            (última oportunidad de pedir continuación)
     │
     v
agent_settled                  (Pi quedó finalmente inactivo)
```

`agent_end` **no garantiza** que el agente haya terminado completamente: puede haber reintentos, compactación, recuperaciones o mensajes en cola. Usá `agent_settled` si necesitás registrar la finalización definitiva o actualizar un estado visual. Si el usuario aborta, el flujo llega igualmente a `agent_settled`, con `aborted=true`, sin pasar por `agent_before_settle`.

### 4.2. Eventos seleccionados

| Evento | Para qué lo usamos en la lección | Precaución |
|---|---|---|
| `session_start` | Reiniciar contadores | Puede ocurrir también en reload o fork |
| `agent_start` | Contar ejecuciones de bajo nivel | Una solicitud puede generar varios `agent_start` |
| `tool_execution_end` | Contar operaciones finalizadas | Incluye herramientas terminadas con error o bloqueo |
| `agent_end` | Comprender límites de una ejecución | **No** significa *idle final* |
| `agent_settled` | Actualizar estado definitivo | Es un evento informativo; no una etapa para continuar |
| `session_shutdown` | Limpieza del status visual | No guardar referencias antiguas a sesión |

Más adelante veremos `tool_call` (gates), `tool_result` (transformación), `before_agent_start` (contexto avanzado), `session_before_compact` y `project_trust`.

## 5. Laboratorio v0.7.0 — estructura incremental

```text
agent-harness-lab/
├── .pi/
│   └── extensions/
│       └── lifecycle-observer.ts   # NUEVO
├── src/
│   ├── cli.ts                       # MODIFICADO
│   ├── runtime.ts                   # MODIFICADO
│   ├── extension-options.ts         # NUEVO
│   └── extensions-report.ts         # NUEVO
├── tests/
│   └── extensions.test.mjs          # NUEVO
├── examples/
│   └── extensions/use-cases.md      # NUEVO
├── solutions/
│   └── modulo-02-leccion-02/       # Solución separada
├── package.json                     # MODIFICADO a 0.7.0
├── LECCION_07.md                    # NUEVO
└── CHANGELOG.md                     # MODIFICADO
```

### 5.1. Primera extensión: `lifecycle-observer.ts`

La implementación real está en `.pi/extensions/lifecycle-observer.ts`. Este es el núcleo de su comportamiento:

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function lifecycleObserver(pi: ExtensionAPI) {
  let lowLevelRuns = 0;
  let finishedTools = 0;
  let lastAborted = false;

  pi.on('session_start', (_event, ctx) => {
    lowLevelRuns = 0;
    finishedTools = 0;
    lastAborted = false;
    if (ctx.hasUI) ctx.ui.setStatus('agent-lab', 'Extensión lista');
  });

  pi.on('agent_start', () => { lowLevelRuns += 1; });
  pi.on('tool_execution_end', () => { finishedTools += 1; });

  pi.on('agent_settled', (event, ctx) => {
    lastAborted = event.aborted === true;
    if (ctx.hasUI) {
      ctx.ui.setStatus('agent-lab',
        `Runs: ${lowLevelRuns} · Tools: ${finishedTools}${lastAborted ? ' · abortado' : ''}`);
    }
  });

  pi.on('session_shutdown', (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setStatus('agent-lab', undefined);
  });

  pi.registerCommand('lab-stats', {
    description: 'Muestra los contadores de ejecución del laboratorio',
    handler: async (_args, ctx) => {
      if (ctx.hasUI) ctx.ui.notify(
        `Runs: ${lowLevelRuns}, herramientas terminadas: ${finishedTools}, abortado: ${lastAborted}`,
        'info',
      );
    },
  });
}
```

**Decisiones de diseño:**

1. Los contadores viven en el proceso y se reinician en `session_start` (no persisten).
2. No capturamos prompts, argumentos de tools, tokens o información sensible.
3. No añadimos herramientas ni modificamos el comportamiento del LLM.
4. El status sólo aparece cuando existe una UI disponible.
5. El comando `/lab-stats` pertenece a **Pi interactivo**, no a `agent-lab`.

## 6. Integración con nuestro CLI

En `src/extension-options.ts`, implementamos validación de rutas explícitas y deduplicación canónica:

```typescript
import { realpathSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

// Fragmento conceptual simplificado del archivo real:
const absolute = resolve(cwd, input);
const info = statSync(absolute);
if (!info.isFile() || !['.ts', '.js', '.mjs'].includes(extname(absolute))) {
  throw new Error('Archivo de extensión no válido');
}
const canonical = realpathSync(absolute);
if (!seen.has(canonical)) args.push('--extension', absolute);
```

El archivo real también acepta directorios con `index.ts` o `index.js`, y otras extensiones de archivo TypeScript/JavaScript. La validación **no importa, evalúa ni ejecuta** el archivo: sólo Pi carga la extensión.

`src/runtime.ts` compone los argumentos:

```typescript
args.push(...buildExtensionArgs(cwd, extensions));
if (config.pi.disableExtensions || extensions.noExtensions) {
  args.push('--no-extensions');
}
```

Pi interpreta ambos flags de forma compatible: se impide el descubrimiento, pero se permite el archivo especificado explícitamente.

### 6.1. Comandos de práctica

```bash
npm install
npm run build
npm test

# Encontrar extensiones locales sin ejecutar Pi
node dist/cli.js extensions list

# Verificar argumentos sin consumir tokens
node dist/cli.js run "Explica este proyecto" \
  --extension .pi/extensions/lifecycle-observer.ts \
  --dry-run

# Ejecutar con el modelo autenticado
node dist/cli.js run "Explica la arquitectura" \
  --mode json --view summary \
  --extension .pi/extensions/lifecycle-observer.ts
```

La vista `extensions list` inspecciona sólo `.pi/extensions` del directorio actual, no las extensiones globales, configuradas, externas ni los resultados del sistema de trust de Pi.

### 6.2. Comparar con Pi directo

```bash
pi --no-extensions --extension .pi/extensions/lifecycle-observer.ts
```

En la interfaz interactiva, después de iniciar una conversación, probá `/lab-stats`. También podés comprobar `/reload` si la extensión está en una ruta autodetectada y el proyecto es confiable.

### 6.3. Por qué NO creamos un loader TypeScript propio

Sería tentador instalar transpilers, registrar módulos o copiar la API de Pi dentro del harness. No hace falta: **Pi ya carga y ejecuta extensiones**. `agent-lab` es responsable únicamente de seleccionar rutas y pasar parámetros confiables al proceso Pi.

Esta decisión evita acoplar nuestro código a detalles internos del sistema de módulos de Pi y permite que una extensión útil funcione tanto con `agent-lab` como directamente con `pi`.

## 7. Cómo probamos una extensión sin consumir tokens

La lección incorpora `tests/extensions.test.mjs` con dos niveles de pruebas:

**(A) Contrato CLI / proceso:** usamos un Pi simulado para comprobar selección repetible, deduplicación, salida JSON/print, propagación correcta de argumentos y prompt con caracteres como `&` y `|` (sin shell). También probamos rutas inexistentes y opciones inválidas.

**(B) Eventos de la extensión:** Node elimina las anotaciones de tipos para importar el archivo TypeScript y construimos una API falsa:

```javascript
const hooks = new Map();
const commands = new Map();
factory({
  on(type, handler) { hooks.set(type, handler); },
  registerCommand(name, definition) { commands.set(name, definition); },
});

hooks.get('session_start')({}, ctx);
hooks.get('agent_start')({}, ctx);
hooks.get('tool_execution_end')({}, ctx);
hooks.get('agent_settled')({ aborted: false }, ctx);
```

Verificamos el footer, el comando `/lab-stats`, el reinicio por sesión, el caso abortado y la ausencia de UI. Esto **no** sustituye una prueba end-to-end contra una instalación autenticada de Pi: validamos nuestra lógica y nuestros contratos, no el loader real de Pi.

## 8. Ejercicio US-LAB-007 — Inspeccionar una extensión local

**Objetivo:** implementar `agent-lab extensions show <nombre>`.

### Criterios de aceptación

1. Muestra los detalles de la extensión por nombre usando el inventario existente.
2. No inicia Pi ni importa/ejecuta el archivo de extensión.
3. Rechaza nombres inexistentes con error claro y código de salida distinto de cero.
4. Sólo acepta un nombre por ejecución.
5. Los flags `--extension`, `--no-extensions` y `--skill` siguen limitados a `run`/`run-file`.
6. Incluye pruebas automáticas del caso exitoso y del caso de error.

Uso esperado:

```bash
agent-lab extensions show lifecycle-observer
```

Ejemplo de salida (orientativa):

```json
{
  "name": "lifecycle-observer",
  "path": "/ruta/del/proyecto/.pi/extensions/lifecycle-observer.ts",
  "kind": "file"
}
```

**Pistas:** reutilizá `listProjectExtensions(process.cwd())`, ampliá el subcomando `extensions` dentro de `src/cli.ts` y evitá modificar `src/runtime.ts`. La solución completa, con archivo `src/cli.ts` y tests, se encuentra en `solutions/modulo-02-leccion-02/`.

## 9. Preguntas de repaso

1. ¿Por qué una Skill no equivale a una extensión?
2. ¿Qué hace `pi.on('tool_execution_end', callback)`?
3. ¿En qué momento puede haber más actividad después de `agent_end`?
4. ¿Por qué `agent_settled` es útil para un indicador visual de finalización?
5. ¿Qué riesgo tiene ejecutar extensiones no confiables?
6. ¿Por qué `/lab-stats` no aparece como subcomando de `agent-lab`?
7. ¿Cómo combinamos `--no-extensions` con `--extension`?
8. ¿Qué test necesitaríamos para verificar la carga real de extensiones en Windows?

## 10. Checklist de finalización

- [ ] Construí el proyecto y ejecuté `npm test`.
- [ ] Comprendí la diferencia entre Pi CLI y una extensión ejecutada dentro de Pi.
- [ ] Revisé `lifecycle-observer.ts` y los hooks registrados.
- [ ] Probé `extensions list` y `--extension ... --dry-run`.
- [ ] Probé el archivo con Pi interactivo y `/lab-stats` en un proyecto confiable.
- [ ] Pude explicar la diferencia entre `agent_end` y `agent_settled`.
- [ ] Implementé US-LAB-007 y comparé la solución.
- [ ] Revisé en Windows que `doctor`, `run` y `--extension` conserven el comportamiento sin `shell:true`.

## 11. Recursos oficiales

- Extensiones, API, eventos y ejemplos: https://pi.dev/docs/latest/extensions
- Flags CLI y selección explícita de recursos: https://pi.dev/docs/latest/cli
- Ejemplos oficiales: https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions
- Ejecutar Pi en Windows: https://pi.dev/docs/latest/windows
- Documentación de Pi: https://pi.dev/docs/latest

**Importante:** la API de Pi evoluciona. Estos ejemplos están basados en la documentación oficial consultada el 7 de noviembre de 2026. Antes de integrar una extensión corporativa de larga duración, fijá una versión de Pi y hacé pruebas contra esa versión.

## 12. Próxima lección

**Módulo 2 · Lección 3 — Custom Tools, schemas y ejecución controlada**.
**Nivel:** Intermedio–Avanzado · **Complejidad:** Media–Alta.

Implementaremos la primera herramienta personalizada invocable por el LLM, con validación de parámetros y pruebas de los resultados. Separaremos claramente una herramienta expuesta al modelo de la política de autorización de su ejecución.
