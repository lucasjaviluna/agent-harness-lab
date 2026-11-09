# Módulo 2 · Lección 3 (Lección 8) — Custom Tools, schemas y ejecución controlada

**Curso:** Pi.dev — Agent Harness Engineering
**Nivel:** Intermedio–Avanzado
**Complejidad:** Media–Alta
**Duración sugerida:** 150–180 minutos
**Proyecto:** `agent-harness-lab`
**Versión:** `0.7.0 → 0.8.0`
**Prerrequisito:** Módulo 2, Lección 2 (v0.7.0) y familiaridad con TypeScript/Node.js.

> Este laboratorio es independiente de otros proyectos y construye un único harness incremental. No cambia el Agent Loop de Pi ni el adaptador de Windows, sólo añade una extensión que registra una herramienta que el modelo puede llamar.

## 1. Objetivos verificables

Al completar la lección deberías poder:

1. Distinguir `Tool`, `Skill`, `Extension` y `prompt template`.
2. Crear un contrato de argumentos con TypeBox (`Type.Object`, `Type.Optional`, `Type.Integer`).
3. Registrar una herramienta mediante `pi.registerTool()`.
4. Comprender cuándo Pi ejecuta `execute(toolCallId, params, signal, onUpdate, ctx)`.
5. Retornar `content`, `details` e `isError` sin filtrar datos sensibles.
6. Entender el efecto de `--tools`, `--extension` y `--no-extensions`.
7. Probar el comportamiento de una herramienta sin gastar tokens y distinguir los mocks de una prueba real contra Pi.
8. Implementar una segunda Custom Tool como ejercicio opcional con solución.

### Producto al finalizar

**Agent Harness Lab v0.8.0:** nueva extensión `.pi/extensions/workspace-inspector.ts`, que registra `lab_workspace_report`. Devuelve un inventario limitado de archivos/directorios visibles, no lee sus contenidos, no modifica archivos y verifica rutas relativas para rechazar traversal y symlinks que salen del workspace.

No añadimos comandos extra ni un plugin manager propio: el CLI de la Lección 7 ya sabe cargar extensiones explícitas. Reutilizamos ese punto de extensión y el allowlist nativo de Pi.

---

## 2. Conceptos: qué aporta cada mecanismo

| Mecanismo | Qué aporta | ¿Puede ejecutar código propio? | ¿Lo llama el modelo? |
|---|---|---|---|
| `AGENTS.md` | Instrucciones generales del workspace | No por sí mismo | No es una Tool |
| Prompt template | Entrada parametrizable como `/review` | No por sí mismo | Se expande como prompt |
| Skill | Conocimientos y procedimientos de una tarea | Puede incluir scripts; para ejecutarlos hacen falta herramientas | Puede descubrirla/leerla |
| Extension | Código TypeScript en el proceso de Pi | Sí, con permisos del proceso | Expone funciones, eventos, comandos y Tools |
| **Custom Tool** | Operación tipada disponible para el agente | Sí: handler `execute()` | Sí, cuando está activa y es accesible |

La extensión **contiene** una Custom Tool; no son sinónimos.

### El circuito de ejecución

```text
Usuario: "Analiza el árbol src"
    ↓
Agent Harness Lab (CLI)
    ├─ configuración y selección de herramientas
    └─ lanza Pi, sin shell:true
          ↓
Pi carga la extensión TypeScript
          ↓
pi.registerTool({ name, parameters, execute })
          ↓
LLM ve la herramienta activa y sus argumentos permitidos
          ↓
LLM solicita lab_workspace_report({directory:"src",limit:8})
          ↓
Pi valida argumentos contra schema JSON
          ↓
Pi llama execute(..., params, signal, ..., ctx)
          ↓
Tool verifica ruta + permisos propios + límites
          ↓
Tool devuelve resultado a Pi y al modelo
          ↓
LLM decide siguiente acción y responde
```

**Importante:** el modelo solicita la operación, pero Pi valida y ejecuta la Tool. El código de la herramienta debe validar además sus reglas de dominio y autorización. Las descripciones del modelo no constituyen un control de seguridad.

---

## 3. Antes de empezar: entorno

Requisitos de las lecciones anteriores:

- Node.js 22.19 o posterior para la versión actual de Pi.
- Proyecto v0.7.0 compilable y con tests correctos.
- Pi instalado y autenticado para las prácticas reales (`agent-lab doctor` no verifica credenciales).

```bash
npm install
npm run build
npm test
npm run typecheck
node dist/cli.js doctor
```

Los **tests automatizados** de esta lección usan un ejecutable simulado cuando invocan el CLI y un doble de `ExtensionAPI` al probar la extensión. **No llaman a un proveedor real, ni verifican la implementación interna de TypeBox de Pi**. Las pruebas con el modelo se hacen al final, en tu propia máquina.

---

## 4. `pi.registerTool()`: contrato y responsabilidades

Pi documenta `pi.registerTool()` para registrar herramientas ejecutables por el modelo. Una definición típica contiene:

```ts
import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function myExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'hello_team',
    label: 'Hello Team',
    description: 'Devuelve un saludo a un integrante del equipo.',
    parameters: Type.Object({
      name: Type.String({ minLength: 1, maxLength: 60 }),
    }, { additionalProperties: false }),
    async execute(_callId, params, _signal, _onUpdate, _ctx) {
      return {
        content: [{ type: 'text', text: `Hola, ${params.name}` }],
        details: { greeted: params.name },
      };
    },
  });
}
```

En esta lección **no incorporamos** `hello_team` al producto: sólo sirve para explicar la forma de una herramienta.

| Campo | Responsabilidad |
|---|---|
| `name` | Identificador único, usado por el modelo y por `--tools` |
| `label` | Nombre corto visible en la interfaz |
| `description` | Explica qué hace la Tool y cuándo usarla |
| `parameters` | Contrato JSON Schema (TypeBox lo produce) |
| `promptSnippet` | Resumen opcional en la sección de herramientas del system prompt |
| `promptGuidelines` | Reglas opcionales que se incorporan cuando la Tool está activa |
| `execute` | Implementación real; se ejecuta dentro de Pi, no en nuestro CLI |

La documentación actual recomienda `import { Type } from 'typebox'`. Pi mapea esa dependencia a su propia copia cuando carga extensiones.

### `execute()` no es un controlador HTTP

Su firma recibe:

```ts
async execute(toolCallId, params, signal, onUpdate, ctx) { /* ... */ }
```

- `toolCallId`: identificador de llamada, útil para trazabilidad.
- `params`: argumentos propuestos por el modelo, validados por Pi contra el schema.
- `signal`: permite respetar cancelaciones.
- `onUpdate`: emite progreso parcial; lo veremos en una extensión posterior.
- `ctx.cwd`: directorio de trabajo de la sesión; no asumir `process.cwd()` global.

La Tool debe evitar depender del estado mutable de otros procesos, especialmente cuando Pi ejecuta llamadas paralelas. Para operaciones con efectos laterales se requieren controles adicionales (más adelante veremos aprobaciones, colas de mutación y aislamiento).

---

## 5. JSON Schema no es una política de seguridad

En nuestra Tool definimos:

```ts
parameters: Type.Object({
  directory: Type.Optional(Type.String({
    minLength: 1,
    maxLength: 256,
    description: 'Directorio relativo como src, tests o .',
  })),
  limit: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 20,
    description: 'Máximo de entradas que se devolverán',
  })),
}, { additionalProperties: false })
```

Esto protege la **forma** de los argumentos. No protege por sí solo contra rutas `../../`, symlinks externos, archivos confidenciales o efectos laterales.

En Pi, la validación de argumentos se basa en JSON Schema. El runtime puede realizar algunas coerciones triviales antes de validar (por ejemplo valores numéricos representados como texto), pero no debemos asumir que una propiedad validada queda autorizada en el sistema de archivos.

Por ello implementamos una segunda validación dentro del handler:

1. Ruta relativa y no vacía; rechazar rutas absolutas POSIX/Windows.
2. Rechazar `..` y directorios ocultos.
3. Canonicalizar `cwd` y el destino con `realpath()`.
4. Verificar que la ruta resuelta continúa dentro de `cwd`.
5. Omitir archivos ocultos y symlinks en el resultado.
6. Limitar resultados a 20 entradas, sin leer sus contenidos.
7. Honrar `signal` y responder con errores controlados.

**Límite de la técnica:** no convierte la Tool en sandbox. Puede existir una carrera entre verificar `realpath` y abrir el directorio si otro proceso cambia symlinks. Además, otras extensiones o herramientas pueden tener permisos más amplios. Para garantías fuertes se necesita aislamiento del proceso Pi y políticas de sistema operativo.

---

## 6. Primera herramienta real: `lab_workspace_report`

Archivo: `.pi/extensions/workspace-inspector.ts`.

### 6.1 Núcleo funcional

```ts
export async function inspectWorkspace(
  cwd: string,
  input: { directory?: string; limit?: number } = {},
  signal?: AbortSignal,
) {
  // 1. Validar directory y limit.
  // 2. Resolver cwd y directory con realpath().
  // 3. Bloquear rutas que salgan de cwd.
  // 4. Leer solamente la lista de entradas.
  // 5. Omitir dotfiles y symlinks y truncar a limit.
  // 6. Retornar: { directory, totalVisible, shown, omitted, entries }.
}
```

La implementación completa está en el laboratorio. Conservar el núcleo como función exportada permite probarlo **sin instanciar Pi ni consumir tokens**.

### 6.2 Registro dentro del proceso Pi

```ts
export default function workspaceInspector(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'lab_workspace_report',
    label: 'Workspace Report',
    description: 'Enumera nombres y tipos de entradas de un directorio del proyecto.',
    parameters: Type.Object({
      directory: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      try {
        const report = await inspectWorkspace(ctx.cwd, params, signal);
        return {
          content: [{ type: 'text', text: JSON.stringify(report) }],
          details: { ok: true, report },
        };
      } catch {
        return {
          content: [{ type: 'text', text: 'No se pudo inspeccionar el directorio solicitado.' }],
          details: { ok: false, code: 'WORKSPACE_REPORT_FAILED' },
          isError: true,
        };
      }
    },
  });
}
```

Este snippet es un resumen didáctico; la versión entregada incluye schema detallado, ayuda para el modelo, límites y seguridad en los nombres.

### 6.3 Formato de salida

El resultado es deliberadamente simple y limitado:

```json
{
  "directory": "src",
  "totalVisible": 3,
  "shown": 2,
  "omitted": 1,
  "entries": [
    { "name": "cli.ts", "kind": "file" },
    { "name": "config.ts", "kind": "file" }
  ]
}
```

Este JSON es un **ejemplo ilustrativo** del contrato, no una salida capturada del repositorio. `details.report` contiene la misma información. Las respuestas reales dependen de los archivos actuales.

- `content`: bloques que el modelo puede leer.
- `details`: metadatos de la llamada útiles para vistas, estado y pruebas.
- `isError`: marca un resultado fallido sin exponer excepciones del sistema al modelo.

Pi también soporta `structuredContent` junto a `outputSchema`, útil especialmente para herramientas consumidoras como codemode. Lo estudiaremos con un laboratorio dedicado a resultados estructurados; `details` y `structuredContent` **no son equivalentes**.

---

## 7. Cómo activar una Custom Tool con nuestro CLI

Este punto es crucial: nuestro `harness.config.json` original tiene una lista explícita:

```json
"tools": ["read", "grep", "find", "ls"]
```

En Pi, `--tools` con nombres simples **reemplaza** la selección predeterminada. Por lo tanto, aunque cargues la extensión, el modelo no necesariamente tendrá disponible `lab_workspace_report` si no la incluyes en el allowlist.

Incluimos `examples/config/harness.tools.example.json`:

```json
{
  "pi": {
    "executable": "pi",
    "tools": ["read", "grep", "find", "ls", "lab_workspace_report"],
    "noSession": true,
    "disableMcp": true,
    "disableExtensions": true
  },
  "execution": { "timeoutMs": 120000 }
}
```

`disableExtensions: true` se transforma en `--no-extensions`, **pero** Pi sigue permitiendo cargar extensiones pasadas mediante `--extension` explícito. Es el comportamiento documentado, no una excepción creada por nuestro harness.

### 7.1 Primero: inspección sin gastar tokens

Desde la raíz del repositorio:

```bash
npm run build

node dist/cli.js run-file examples/tools/workspace-inspection.md \
  --config examples/config/harness.tools.example.json \
  --extension .pi/extensions/workspace-inspector.ts \
  --mode json --view tools --dry-run
```

En PowerShell es más cómodo escribir la línea en una sola fila o usar la continuación `` ` ``. El objetivo del dry-run es comprobar que los argumentos contienen `--extension`, `--tools` y `lab_workspace_report`, sin iniciar el modelo.

### 7.2 Ejecución real mediante Agent Harness Lab

```bash
node dist/cli.js run-file examples/tools/workspace-inspection.md \
  --config examples/config/harness.tools.example.json \
  --extension .pi/extensions/workspace-inspector.ts \
  --mode json --view tools
```

La vista `tools` muestra eventos de inicio/fin, no el contenido de la respuesta final. Para inspeccionar el JSONL completo utiliza `--view events`; para el resumen final, omite `--view`.

El modelo puede decidir no invocar la herramienta en algún contexto. Para probar la extensión directamente en una sesión interactiva:

```bash
pi --no-extensions --extension .pi/extensions/workspace-inspector.ts \
  --tools read,grep,find,ls,lab_workspace_report
```

Pedile: **"Usá lab_workspace_report para enumerar src con limit=5. No utilices otras herramientas."**

Requiere instalación y autenticación válidas de Pi. Las extensiones sólo deben cargarse desde ubicaciones confiables.

### 7.3 ¿Qué cambia en Windows?

Nada en el adaptador `piCommand()` ni en la ejecución con `shell: false`. Los paths de la Tool se resuelven usando `node:path`, y bloqueamos explícitamente rutas absolutas de Windows y separadores `\\` no admitidos en el contrato de entrada. En las pruebas la CLI continúa propagando texto con caracteres especiales como datos, no como comandos de shell.

---

## 8. Código y tests entregados

Archivos nuevos:

```text
.pi/extensions/workspace-inspector.ts
examples/config/harness.tools.example.json
examples/tools/workspace-inspection.md
examples/tools/use-cases.md
tests/workspace-tool.test.mjs
solutions/modulo-02-leccion-03/
  ├── README.md
  ├── package-summary.ts
  └── tests/package-summary.test.mjs
```

Archivos actualizados: `package.json`, `README.md`, `CHANGELOG.md`, `LECCION_08.md` y `README_INCREMENTAL_MODULO_02_LECCION_03.txt`.

**No modificamos:** `src/runtime.ts`, `src/cli.ts`, `src/config.ts`, `src/extension-options.ts`, las Skills anteriores, ni `tests/extensions.test.mjs`. Los ajustes de Windows se mantienen intactos.

### 8.1 ¿Qué prueban los tests?

- El registro de un nombre único y su schema.
- Las rutas válidas y el resultado acotado.
- La omisión de archivos ocultos y symlinks.
- Rechazo de traversal, rutas absolutas y límites inválidos.
- Aborto y error controlado sin filtrar rutas de sistema.
- Contrato `content` y `details`.
- La construcción del comando CLI con `--tools`, `--extension`, `--no-extensions` y texto especial sin shell.

Los tests cargan el TypeScript de la extensión usando `stripTypeScriptTypes` y un **doble mínimo del constructor de schemas de TypeBox**, porque este repo todavía no instala los paquetes de Pi como dependencias del CLI. Por eso prueban **la lógica** y **la estructura declarada**, pero la validación real del schema por Pi queda pendiente de la prueba manual con Pi instalado.

```bash
npm test
npm run typecheck
node --test tests/workspace-tool.test.mjs
```

---

## 9. Ejercicio práctico — US-LAB-008

**Historia:** como desarrollador de Agent Harness Lab, quiero que el modelo pueda obtener un resumen seguro del `package.json` del proyecto, sin leer scripts completos ni claves.

### Requisitos funcionales

1. Crear `.pi/extensions/package-summary.ts` con una Custom Tool llamada `lab_package_summary`.
2. Usar un schema sin parámetros (`Type.Object({}, { additionalProperties: false })`).
3. Leer **sólo** el `package.json` del directorio de trabajo actual.
4. Devolver `name`, `version`, conteo de dependencias, conteo de devDependencies y nombres de scripts, **no sus valores**.
5. Rechazar archivos inválidos, symlinks y archivos demasiado grandes (máximo 64 KiB).
6. Respetar cancelación y devolver error controlado con `isError: true`.
7. Incorporar la herramienta a `pi.tools` y cargar la extensión explícitamente desde la CLI.
8. Agregar tests que no dependan de credenciales ni de un modelo externo.

**Pistas:** `lstat`, `readFile`, `realpath`, `Type.Object`, `JSON.parse`, `Object.keys`, `pi.registerTool`.

### Criterios de aceptación

- `agent-lab ... --dry-run` muestra `lab_package_summary` en `--tools` y la extensión seleccionada.
- La herramienta no devuelve scripts ejecutables, tokens ni rutas absolutas.
- Los casos de error devuelven `isError: true`.
- `npm test` sigue pasando.
- La implementación no introduce `shell: true` ni cambia `piCommand()`.

La solución completa está en `solutions/modulo-02-leccion-03/`. No la apliques al código principal antes de intentar el ejercicio.

### Solución: explicación breve

La implementación de referencia agrega `lab_package_summary` mediante `pi.registerTool`, usa `lstat()` para bloquear symlinks y verificar el tamaño, comprueba `realpath()`, y entrega únicamente metadatos explícitamente permitidos.

Para verificar la solución sin copiarla:

```bash
node --test solutions/modulo-02-leccion-03/tests/package-summary.test.mjs
```

El archivo `solutions/modulo-02-leccion-03/README.md` explica cómo instalarla en la extensión del proyecto y habilitarla.

---

## 10. Preguntas para reforzar

1. ¿Por qué una Tool necesita `parameters` si `execute()` también verifica la entrada?
2. ¿Qué diferencia existe entre el `description` y un control de seguridad real?
3. ¿Qué ocurre si registramos `lab_workspace_report` pero el allowlist `--tools` no la incluye?
4. ¿Por qué las funciones exportadas independientemente de Pi facilitan los tests?
5. ¿Por qué `realpath()` no convierte un proceso en sandbox?
6. ¿Qué pasa cuando el usuario cancela la ejecución?
7. ¿En qué se diferencia un resultado `details` de un resultado `structuredContent`?
8. ¿Qué riesgos tendría una Tool que aceptara una ruta absoluta y ejecutara `bash` con interpolación?

### Respuestas orientativas

1. El schema describe el contrato visible al modelo y valida tipos y rangos; el handler valida autorización y reglas del filesystem.
2. `description` guía al modelo; las restricciones reales deben ser aplicadas por código, permisos y aislamiento.
3. No estará declarada para el modelo con ese allowlist, aunque la extensión pueda haberse cargado.
4. La lógica se invoca sin un modelo, UI ni SessionManager.
5. No bloquea toda la actividad del proceso ni elimina carreras del filesystem, ni limita otros módulos cargados.
6. El `AbortSignal` permite abortar trabajo cooperativo; hay que propagarlo.
7. `details` es metadata auxiliar; `structuredContent` está pensado para datos estructurados consumibles y puede validarse con `outputSchema`.
8. Escape de workspace, fuga de datos e inyección de comandos.

---

## 11. Próxima lección

**Módulo 2 · Lección 4 (Lección 9): Interceptores, policies y human approval gates**
**Nivel:** Avanzado · **Complejidad:** Alta.

Construiremos controles previos a la ejecución, aprenderemos a interceptar eventos como `tool_call`, evaluar decisiones humanas cuando corresponda y registrar un motivo de rechazo. **No implementaremos un framework genérico de políticas hasta tener casos concretos y tests que demuestren su necesidad.**

---

## 12. Referencias oficiales (verificadas)

- Pi — Extensions y Custom Tools: https://pi.dev/docs/latest/extensions
- Pi — CLI y selección de Tools: https://pi.dev/docs/latest/cli
- Pi — Seguridad y aislamiento: https://pi.dev/docs/latest/security
- Pi — Ejemplo oficial `hello.ts`: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts
- Pi — Ejemplo oficial de truncación: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts

> Nota sobre versiones: Pi evoluciona con rapidez. Los argumentos y APIs aquí utilizados se contrastaron con la documentación actual al elaborar la lección; ejecutar `pi --help` y revisar los ejemplos de la versión instalada antes de usarla en producción.
