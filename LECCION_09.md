# Módulo 2 · Lección 4 (Lección 9) — Interceptores, políticas y aprobaciones humanas

**Curso:** Pi.dev — Agent Harness Engineering
**Módulo:** 2 — Extensibilidad
**Número de lección dentro del módulo:** 4
**Número global:** 9 de 20
**Nivel:** Avanzado inicial
**Complejidad:** Alta
**Duración sugerida:** 180–210 minutos
**Versión del laboratorio:** `v0.8.0 → v0.9.0`
**Prerequisito:** Lección 8 completada y `npm test` en verde.

> **Objetivo:** implementar y probar un primer control de autorización a nivel de herramientas de Pi. El resultado es **didáctico y útil para pruebas**, pero **no es una barrera de seguridad de producción**: la extensión reside en el proceso del agente y puede no estar cargada, ser alterada o convivir con otras extensiones privilegiadas. La autorización efectiva de alto impacto requiere un límite de ejecución externo y aislamiento.

## 1. Resultado de aprendizaje y resultado de producto

Al finalizar sabrás:

1. Distinguir `tool_execution_start`, `tool_call`, `tool_result` y `tool_execution_end`.
2. Interceptar una solicitud **antes de su ejecución real** con `pi.on('tool_call', ...)`.
3. Construir reglas `allow`, `deny` y `ask` sin duplicar el Agent Loop.
4. Usar `ctx.hasUI` y `ctx.ui.confirm` sin autorizar automáticamente desde JSON/print.
5. Definir una política JSON mínima que limita el uso de `bash` y herramientas adicionales.
6. Detectar operaciones de escritura fuera del proyecto, en rutas protegidas o mediante symlinks.
7. Probar un guard con dobles de `ExtensionAPI` y el CLI con `--dry-run`, sin tokens.
8. Argumentar por qué un guard en extensión **no equivale a un sandbox** ni a un sistema de aprobación externo.

**Resultado tangible:** se incorpora `.pi/extensions/approval-guard.ts` y un evaluador puro `.pi/policies/approval-policy.mjs`. El CLI previo se mantiene intacto; los permisos de Pi se configuran mediante sus flags y una extensión cargada explícitamente.

## 2. Qué significa un «gate» en un agent harness

Un agente propone usar una Tool. Antes de ejecutarla, existe un momento para decidir:

```text
Prompt del usuario
    ↓
LLM propone llamar a write({ path: 'src/demo.ts', ... })
    ↓
Pi emite tool_execution_start (señal de intención/preparación)
    ↓
Pi valida el schema de la Tool
    ↓
Pi emite tool_call  ←  NUESTRA EXTENSIÓN (puede bloquear)
    │
    ├── allow → Tool se ejecuta
    ├── ask   → ctx.ui.confirm(...)
    │             ├── true  → Tool se ejecuta
    │             └── false / error / sin UI → bloqueada
    └── deny  → bloqueada
    ↓
Pi emite tool_execution_end (también para bloqueadas)
```

En versiones actuales de Pi, `tool_execution_start` ocurre **antes** del hook que puede bloquear. Un monitor que observa únicamente el evento start no demuestra que una operación se haya realizado. Para estados finales, usar `tool_execution_end` y su resultado.

El orden de `tool_call` también importa: Pi permite que otros handlers modifiquen `event.input` y **no revalida el schema después de esa mutación**. No supongas que nuestra extensión protege de otras extensiones no confiables que puedan alterar argumentos después de la inspección.

### Interceptar sin modificar el Agent Loop

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function demo(pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName === 'bash') {
      return { block: true, reason: 'Shell bloqueado' };
    }
  });
}
```

La función puede devolver `undefined` para permitir la ejecución, o `{ block: true, reason }` para impedirla. Nuestra implementación utiliza también `terminate: true` al bloquear; en llamadas paralelas Pi puede continuar si hay otros resultados no terminantes en el mismo lote. No lo interpretes como una garantía universal de detención del agente.

## 3. Reglas de autorización del laboratorio

| Operación | Política inicial | ¿Por qué? |
|---|---|---|
| `read`, `ls`, `find`, `grep` | Allow | Facilidad para el laboratorio; NO asegura confidencialidad de archivos |
| `lab_workspace_report` | Allow | Custom Tool de solo lectura de la Lección 8 |
| `write`, `edit` | Ask | Necesitan confirmación por cada llamada y path permitido |
| `write/edit` en `.git`, `.pi`, `.agents`, `.env*`, `node_modules`, `dist` | Deny | Protecciones mínimas de integridad, incluso con UI |
| `write/edit` fuera del workspace o con symlink existente | Deny | Reducir errores de destino y traversal |
| `bash` | Deny | Puede modificar cualquier recurso e invalidar controles de path |
| Tool desconocida | Deny | Ningún permiso automático por desconocimiento |

**Importante:** permitir `read`, `grep` y `find` no limita qué archivos confidenciales pueden inspeccionar. Este guard prioriza integridad de escritura, **no constituye una solución DLP**. El acceso a secretos y el aislamiento del filesystem deben controlarse fuera de Pi.

### Configuración del proyecto

Archivo `.pi/policies/tool-approvals.json`:

```json
{
  "version": 1,
  "bash": "deny",
  "denyTools": [],
  "askTools": []
}
```

- `bash`: `deny` (default) o `ask`. El modo ask sólo se recomienda para explorar el diálogo; un shell aprobado puede alterar cualquier recurso al que tenga acceso el proceso.
- `denyTools`: bloqueos adicionales por nombre.
- `askTools`: herramientas adicionales cuya invocación requerirá confirmación. No permite rebajar la protección de las herramientas integradas ni convertir modificaciones en allow automático.
- La configuración es validada estrictamente. Si está mal formada o no puede leerse, el guard bloquea la llamada (**fail closed**).
- Si el archivo no existe, se adoptan valores conservadores. Esto es una convención educativa; una política fuerte debería almacenarse fuera de un workspace que el agente pueda alterar.

## 4. Código del evaluador puro

Archivo `.pi/policies/approval-policy.mjs`. Es JavaScript ESM deliberadamente, para probar la evaluación con `node:test` sin arrancar Pi, ni `jiti`, ni un proveedor.

```js
import { decideToolCall, parsePolicy } from './.pi/policies/approval-policy.mjs';

const policy = parsePolicy({
  version: 1,
  bash: 'deny',
  denyTools: [],
  askTools: []
});

// Si cwd es el directorio raíz de tu lab:
const result = decideToolCall(process.cwd(), 'write', {
  path: 'src/nueva-funcionalidad.ts'
}, policy);

console.log(result); // { action:'ask', target:'src/nueva-funcionalidad.ts', ... }
```

La separación entre reglas y API de Pi evita mezclar decisiones de seguridad con llamadas TUI. Tests de política pueden verificar todos los casos sin simular un agente completo.

### Normalización de rutas

`validateWritePath()` aplica las siguientes comprobaciones:

1. Rechazar path no textual, vacío, desmesurado, con NUL o incompatible con plataforma.
2. Resolver el root canónico y el destino respecto al root.
3. Comprobar que el destino permanece dentro del root.
4. Rechazar rutas protegidas y componentes `.env*`.
5. Rechazar symlinks detectados en cualquier componente existente del path.

No impide carreras TOCTOU: después de inspeccionar un path, otro proceso puede cambiarlo antes de que Pi escriba. El control para una garantía fuerte requiere permisos de sistema operativo/sandbox y una autoridad externa al agente. En Windows, también conviene probar junctions y rutas con diferente capitalización.

## 5. Extensión Pi: el guard de aprobación

Archivo `.pi/extensions/approval-guard.ts`:

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { decideToolCall, loadPolicy } from '../policies/approval-policy.mjs';

export default function approvalGuard(pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    let decision;
    try {
      decision = decideToolCall(
        ctx.cwd, event.toolName, event.input, loadPolicy(ctx.cwd)
      );
    } catch {
      return { block: true, reason: 'Política no disponible', terminate: true };
    }

    if (decision.action === 'allow') return;
    if (decision.action === 'deny') {
      return { block: true, reason: decision.reason, terminate: true };
    }
    if (!ctx.hasUI || typeof ctx.ui?.confirm !== 'function') {
      return { block: true, reason: 'Aprobación requerida sin UI', terminate: true };
    }
    const confirmed = await ctx.ui.confirm(
      `Autorizar herramienta: ${event.toolName}`,
      `Destino: ${decision.target}`
    );
    return confirmed === true ? undefined
      : { block: true, reason: 'No aprobado', terminate: true };
  });
}
```

Éste es un **esqueleto didáctico**. El código real maneja errores de UI y valida también el comando completo si alguien habilita `bash: "ask"`. No se guarda información sensible en logs ni se registra un «approved forever»: **cada llamada requiere confirmación**.

### UI disponible según el modo de Pi

| Modo Pi | `ctx.hasUI` | Resultado para cambios |
|---|---|---|
| TUI interactiva | true | `ctx.ui.confirm` solicita intervención humana |
| RPC con cliente que responda | true | Confirmación transportada por RPC |
| Print (`--print`) | false | Denegado (fail closed) |
| JSON (`--mode json`) | false | Denegado (fail closed) |

Un `true` devuelto por una UI controlada por el mismo proceso no representa una aprobación externa infalsificable. La extensión es útil para enseñanza y control cotidiano, no para proteger un entorno no confiable.

## 6. Ejecución práctica paso a paso

### 6.1. Comprobar que nada cambió en Windows

```bash
npm install
npm test
npm run typecheck
node dist/cli.js doctor
```

`src/runtime.ts`, `piCommand()`, `src/cli.ts` y el test de `pi-launcher.js` **no se modificaron**. El guard se pasa como extensión, no como wrapper de subprocess.

### 6.2. Verificar argumentos sin iniciar el modelo

```bash
node dist/cli.js run-file examples/approvals/change-request.md --config examples/config/harness.approvals.example.json --extension .pi/extensions/approval-guard.ts --dry-run
```

Comprobá que los argumentos incluyen:

- `--tools read,ls,find,grep,write,edit`
- `--no-extensions` (descubrimiento automático deshabilitado)
- `--extension <ruta>/approval-guard.ts` (carga explícita)
- el prompt del archivo como **un único argumento**, sin `shell:true`.

**Límite importante:** la presencia de `--extension` en los argumentos no prueba que Pi haya cargado efectivamente el módulo. La carga real se verifica únicamente contra una instalación compatible.

### 6.3. Primera sesión real con TUI

Desde la raíz del repositorio:

```bash
pi --no-extensions --extension .pi/extensions/approval-guard.ts --tools read,ls,find,grep,write,edit
```

En PowerShell ejecutá la línea completa igual, sin barras de continuación. Dentro de Pi probá:

1. «Leé `src/cli.ts` y explicá su función» → lectura permitida.
2. «Escribí `examples/sample-approval.txt` con la palabra aprobado» → debe ofrecer un diálogo.
3. Negá la primera autorización y verificá que el archivo no exista; repetí aprobando y comprobá el resultado.
4. «Modificá `.pi/policies/tool-approvals.json`» → debe bloquearse sin ofrecer aprobación.
5. «Ejecutá `npm test` usando bash» → denegado por la política actual.

Cuidado: la TUI puede requerir confianza del proyecto antes de cargar el módulo. Si utilizás otras extensiones o ejecutás Pi sin este guard, **esta política no tiene efecto obligatorio**.

### 6.4. Ejecución headless

```bash
node dist/cli.js run-file examples/approvals/change-request.md --config examples/config/harness.approvals.example.json --extension .pi/extensions/approval-guard.ts --mode json --view tools
```

En JSON no hay diálogo. Si el modelo intenta escribir, la extensión devolverá un bloqueo; la respuesta final del agente puede variar porque el modelo podría elegir no usar la Tool. No interpretes el exit code `0` como prueba de aprobación ni de ejecución. Usá eventos y comprobación del archivo de destino.

### 6.5. Preguntas de diagnóstico

- ¿Qué diferencia hay entre que el modelo *proponga* una herramienta y que el sistema la *ejecute*?
- ¿Qué sucede si un handler de otra extensión cambia `event.input` después de tu revisión?
- ¿Por qué un `tool_execution_start` no equivale a operación ejecutada?
- ¿Por qué una ejecución JSON sin UI debe denegar una operación que necesita aprobación?
- ¿Por qué la Tool `bash` puede escapar a reglas diseñadas sólo para `write/edit`?
- ¿Qué controles deberías mover fuera del proceso Pi para producción?

## 7. Tests sin consumo de tokens

`tests/approval-guard.test.mjs` verifica:

- parseo de política y rechazo de configuraciones inválidas;
- precedencia de denegaciones y rechazo de Tools desconocidas;
- rutas válidas, path traversal, rutas protegidas, symlinks y Windows paths;
- aprobación de `write/edit` **sólo** con respuesta explícita `true`;
- rechazo al no tener UI, al cancelar, con `undefined`/`null` o ante error de RPC;
- `bash` denegado por defecto y confirmación optativa con comando completo;
- integración de CLI `--extension` con `--tools` sin interpretar caracteres especiales como comandos.

Además se ejecutan **todos los tests de lecciones anteriores**. El entorno de CI Linux omite una prueba propia de Windows; necesitás correrla en tu PC Windows para verificar la plataforma real.

La suite no prueba que Pi cargue la extensión mediante `jiti`, ni que un proveedor LLM cumpla el prompt. Es un test de nuestro código, no un test end-to-end autenticado.

## 8. Ejercicio US-LAB-009 — Proteger extensiones de archivos sensibles

**Historia:** «Como responsable del Agent Harness quiero bloquear escrituras de archivos `.pem`, `.key` y `.p12`, incluso cuando el usuario disponga de TUI, para evitar modificaciones accidentales de llaves y certificados».

### Criterios de aceptación

1. Agregar el arreglo `denyWriteExtensions` a `.pi/policies/tool-approvals.json`.
2. Validar que sus elementos tengan forma `.ext`, sólo minúsculas alfanuméricas y longitud acotada.
3. Denegar `write` y `edit` cuando el destino termine en una de las extensiones protegidas, ignorando mayúsculas en el nombre del archivo.
4. Mantener `ask` para archivos `.ts`, `.md`, etc. que no estén protegidos.
5. Conservar bloqueos de rutas `.pi`, `.git`, traversal y symlinks, además del manejo headless.
6. Incorporar tests. **No modificar la API de Pi ni el runtime de Windows.**

Pistas: el archivo que conviene modificar es `.pi/policies/approval-policy.mjs`. Conservar el conjunto inmutable de reglas mínimas y verificar los sufijos luego de validar la ruta.

**Solución:** `solutions/modulo-02-leccion-04/` contiene el evaluador completo, la configuración y cuatro tests adicionales. No está aplicada a la versión principal de la lección: primero intentá resolverlo por tu cuenta.

## 9. Límites de seguridad: lo que NO garantiza este guard

- No protege si se inicia Pi sin la extensión, si el agente puede deshabilitarla o si otra extensión evade sus reglas.
- No impide modificaciones fuera de las Tools de Pi (por scripts, MCP, extensiones y otros procesos).
- El código de extensión y su política viven en el workspace: no son una autoridad inmutable frente a código del proyecto no confiable.
- Los checks de `realpath()` y `lstat()` no eliminan carreras TOCTOU.
- Las Tools de lectura admitidas pueden leer archivos sensibles, si el proceso tiene permisos.
- `bash: ask` no impide modificar rutas protegidas una vez aprobado un shell arbitrario.
- Las llamadas paralelas pueden pedir múltiples aprobaciones; Pi puede seguir procesando otros resultados.
- Una confirmación visual no proporciona, por sí misma, evidencia de aprobación firmada o auditoría persistente.

**Para producción:** política fuera de Pi y del repositorio analizado, separación entre modelo/herramientas y un runner con permisos reducidos, control de filesystem/red, aprobación gestionada por un canal confiable y evidencia auditable por WorkItem. Lo estudiaremos más adelante, sin introducir todavía un motor de orquestación.

## 10. Qué cambia en el proyecto (y qué no)

**Archivos nuevos:**

```text
.pi/extensions/approval-guard.ts
.pi/policies/approval-policy.mjs
.pi/policies/tool-approvals.json
examples/config/harness.approvals.example.json
examples/approvals/read-only.md
examples/approvals/change-request.md
examples/approvals/manual-checklist.md
tests/approval-guard.test.mjs
solutions/modulo-02-leccion-04/...
LECCION_09.md
README_INCREMENTAL_MODULO_02_LECCION_04.txt
```

**Archivos modificados:** `package.json`, `README.md` y `CHANGELOG.md`.

**Sin modificar:** código `src/` completo, configuración principal `harness.config.json`, `piCommand()` y test de Windows. El usuario incorpora cambios sobre `v0.8.0`; no debe reemplazar todo el repo por un ZIP.

## 11. Recursos oficiales

- [Documentación de extensiones Pi](https://pi.dev/docs/latest/extensions) — eventos, `tool_call`, UI y limitaciones por modo.
- [Ejemplo oficial permission-gate.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/permission-gate.ts) — un gate con controles sobre comandos.
- [Ejemplo oficial protected-paths.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/protected-paths.ts) — bloqueo de destinos específicos.
- [Documentación RPC Extension UI](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-extension-ui.md) — confirmar por cliente RPC.
- [Código de Agent Loop](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts) — emisión de `tool_execution_start` y finalización de herramientas.

## 12. Cierre de la lección

**Ya sabemos:** observar ciclos de vida (Lección 7), registrar Tools (Lección 8), y **bloquear o confirmar llamadas** (Lección 9). El siguiente paso es una mejor interfaz TUI para los diálogos, la información de estado y la revisión humana.

**Próxima:** Módulo 2 · Lección 5 (Lección 10): personalización de TUI, estados, diálogos y experiencia del operador. Nivel Intermedio–Avanzado; complejidad Alta.
