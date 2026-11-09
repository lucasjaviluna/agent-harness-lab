# Agent Harness Lab — v0.10.0

**Módulo 2 · Lección 5 (Lección global 10): Personalización de la TUI de Pi**
**Nivel:** Intermedio–Avanzado · **Complejidad:** Alta

Se incorpora `.pi/extensions/operator-ui.ts` con comandos `/lab-ui`, `/lab-panel`, `/lab-widget` y `/lab-footer`. No modifica el Agent Loop, el CLI, ni el ejecutable de Pi en Windows. La interfaz está desactivada por defecto (opt-in).

```bash
npm install
npm test
npm run typecheck
pi --no-extensions --extension .pi/extensions/operator-ui.ts
```

Dentro de Pi: `/lab-ui on` → `/lab-panel` → `/lab-widget below` → `/lab-ui off`. La guía de laboratorio está en [examples/tui-operator.md](examples/tui-operator.md) y la explicación completa en [LECCION_10.md](LECCION_10.md).

**Limitaciones:** los comandos con TUI son exclusivos de `ctx.mode === 'tui'`; los tests usan dobles de Pi y no certifican renderizado en un terminal Windows. Los controles de autorización de la Lección 9 son independientes de la UI.

---

# Agent Harness Lab — v0.9.0

**Módulo 2 · Lección 4 (Lección global 9): Interceptores, políticas y aprobaciones humanas**
**Nivel:** Avanzado inicial · **Complejidad:** Alta

Lección completa en [LECCION_09.md](LECCION_09.md). Sobre v0.8.0, se añade una extensión `approval-guard` que intercepta `tool_call` y decide `allow`, `deny` o `ask`. La configuración del proyecto está en `.pi/policies/tool-approvals.json`. **No se modifica el Agent Loop de Pi ni el CLI existente.**

```bash
npm install
npm test
npm run typecheck
node dist/cli.js run-file examples/approvals/change-request.md --config examples/config/harness.approvals.example.json --extension .pi/extensions/approval-guard.ts --dry-run
```

En una instalación real de Pi, probar aprobaciones en modo TUI:

```bash
pi --no-extensions --extension .pi/extensions/approval-guard.ts --tools read,ls,find,grep,write,edit
```

**Comportamiento:** lectura básica permitida, escritura y edición con confirmación por llamada, rutas protegidas denegadas y shell deshabilitado por defecto. Print/JSON no pueden responder confirmaciones, por eso se deniegan allí las operaciones que exigen aprobación. El guard sólo existe cuando se carga la extensión; no garantiza sandboxing, DLP ni enforcement de producción.

**Ejercicio:** US-LAB-009 en `solutions/modulo-02-leccion-04/`, separado de la implementación base.

---

# Agent Harness Lab — v0.8.0

**Módulo 2 · Lección 3 (Lección 8) — Custom Tools, schemas y ejecución controlada**
**Nivel:** Intermedio–Avanzado · **Complejidad:** Media–Alta

Se incorpora `.pi/extensions/workspace-inspector.ts`, una extensión con la herramienta `lab_workspace_report`. Reutiliza `--extension` de la Lección 7 y la selección explícita `--tools` de Pi. El CLI **no** ejecuta la Tool: su `execute()` se ejecuta dentro del proceso Pi.

```bash
npm install
npm test
npm run typecheck
node dist/cli.js run-file examples/tools/workspace-inspection.md \
  --config examples/config/harness.tools.example.json \
  --extension .pi/extensions/workspace-inspector.ts --mode json --view tools --dry-run
```

**Importante:** para que el modelo pueda invocar la nueva Tool, `pi.tools` debe incluir `lab_workspace_report`. `--no-extensions` no impide cargar una extensión explícita. La Tool es de solo lectura por diseño, pero **no proporciona sandboxing**. La verificación real contra Pi requiere un proveedor autenticado; los tests automatizados no usan tokens.

**Material:** [LECCION_08.md](LECCION_08.md) · Ejercicio opcional US-LAB-008 en `solutions/modulo-02-leccion-03/`.

---

# Agent Harness Lab — v0.6.0

**Módulo 2 · Lección 1 — Skills y capacidades especializadas en Pi**
**Nivel:** Intermedio · **Complejidad:** Media

**Proyecto incremental:** continuación de las cinco lecciones del Módulo 1. El CLI delega en Pi el Agent Loop, modelos, sesiones y descubrimiento real de Skills. No requiere modificar `pi-harness`.

## Novedades v0.6.0

- `agent-lab skills list`: inventario de directorios de Skills del proyecto, sin ejecutar Pi. Es diagnóstico orientativo, no la lista efectiva de Pi.
- `agent-lab run ... --skill <ruta>` (repetible): registro explícito de Skills en Pi, tras validar un directorio con `SKILL.md`.
- `agent-lab run ... --no-skills`: desactiva descubrimiento implícito; `--skill` explícito sigue habilitado.
- Dos ejemplos portables: `.agents/skills/agent-review` y `.agents/skills/test-triage` (este último es sólo invocación explícita).
- `tests/skills.test.mjs`, ejemplos de logs Node y solución opcional US-LAB-006 separada.

```bash
npm install
npm test
npm run typecheck
node dist/cli.js skills list
node dist/cli.js run "Revisá src/runtime.ts" --skill .agents/skills/agent-review --dry-run
node dist/cli.js run "Revisá tests" --no-skills --skill .agents/skills/test-triage --dry-run
```

Las Skills automáticas no garantizan invocación por el modelo. Usá `/skill:agent-review` y `/skill:test-triage` en Pi interactivo para invocación explícita. Pi puede requerir confiar en el proyecto. La configuración inicial del laboratorio no habilita `bash`: los scripts incluidos se prueban manualmente con Node.

**Documentación:** [LECCION_06.md](LECCION_06.md). La solución del ejercicio está en `solutions/modulo-02-leccion-01/`, sin aplicar al código principal.

---

# Agent Harness Lab — v0.5.0

Curso: **Pi.dev: de cero a construir un Agent Harness profesional**
**Módulo 1 — Fundamentos de Pi · Lección 5 — Context Engineering, AGENTS.md y prompt templates**
**Nivel:** Principiante–Intermedio · **Complejidad:** Media

Proyecto conductor **independiente** de `pi-harness`. Evoluciona sobre v0.2.0 sin reconstruir Agent Loop, modelos ni catálogo de proveedores. En esta etapa el harness invoca el CLI de Pi como proceso hijo.

## Requisitos y primera ejecución

- Node.js **22.19+** para la instalación actual de Pi.
- Pi instalado: `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`
- Autenticación del proveedor desde `pi` → `/login`, o credencial del proveedor configurada por los mecanismos de Pi.

```bash
npm install
npm test
npm run typecheck
node dist/cli.js doctor
node dist/cli.js config
node dist/cli.js profiles
node dist/cli.js models
node dist/cli.js models claude
node dist/cli.js run "Analiza la arquitectura" --dry-run
```

Para usar el ejecutable sin prefijo: `npm link`, luego `agent-lab ...`.

## Modelos y perfiles

En ausencia de selección de modelo en nuestro config, **Pi decide el modelo** según su configuración propia. Se evita fijar un proveedor que no esté disponible para el usuario.

```bash
node dist/cli.js run "Hola" --model openai/gpt-4o --thinking low --dry-run
node dist/cli.js run-file examples/prompts/model-evaluation.md --mode json --dry-run
node dist/cli.js --config examples/config/harness.profiles.example.json profiles
node dist/cli.js --config examples/config/harness.profiles.example.json run "Revisa código" --profile deep --dry-run
```

El archivo `examples/config/harness.profiles.example.json` contiene **patrones de muestra**, no modelos garantizados en tu cuenta. Usa `models` para descubrir cuáles están disponibles y ajusta los perfiles. No incluyas credenciales en el repositorio.

Precedencia: `pi.model/provider/thinking` → `defaultProfile` → `--profile` → `--model/--provider/--thinking`.

`--model` directo descarta un `provider` anterior heredado, si no se pasa un nuevo `--provider`, para evitar pares contradictorios. Cuando un modelo se expresa como `provider/id` y se proporciona `provider` simultáneamente, ambos deben coincidir.

## Comandos

| Comando | Función |
|---|---|
| `doctor` | Comprueba la existencia del ejecutable de Pi, no las credenciales |
| `config` | Muestra configuración efectiva sin secretos (no se admiten claves en el schema) |
| `models [filtro]` | Delegación directa a `pi --list-models [filtro]` |
| `profiles` | Lista perfiles y el predeterminado local del lab |
| `run` | Print o JSONL, modelos opcionales, dry-run |
| `run-file` | Igual que run, leyendo un prompt Markdown desde disco |

## Estructura y documentación

- `src/model-selection.ts`: composición y validación local de selección.
- `src/config.ts`: validación de JSON y perfiles.
- `src/runtime.ts`: subprocess de Pi, flags y salida.
- `src/json-events.ts`: interpretación de eventos (L2, sin cambios).
- `tests/`: pruebas con un binario Pi simulado; no consumen tokens.
- `LECCION_01.md`, `LECCION_02.md`, `LECCION_03.md`: materiales de estudio.
- `solutions/modulo-01-leccion-03/`: ejercicio resuelto **no aplicado** al código principal.

## Advertencias

- El CLI no actúa como sandbox ni aplica presupuestos de tokens o límites de gasto.
- `--list-models` no demuestra que las credenciales funcionen; probar con Pi real.
- Los perfiles son una abstracción del laboratorio; no modifican `~/.pi/agent/models.json` ni `auth.json`.
- La configuración de un ejecutable externo (`pi.executable`) es una capacidad sensible: revisa configs ajenas antes de invocarlas.
- Nunca almacenes claves/tokens en `harness.config.json`, en ejemplos o en tests.

Referencias: https://pi.dev/docs/latest/models · https://pi.dev/docs/latest/providers · https://pi.dev/docs/latest/cli · https://pi.dev/docs/latest/models-configuration


## Módulo 1 / Lección 4: sesiones y contexto

El laboratorio sigue siendo efímero por defecto. Sólo se persiste al usar `--persist` o una
selección de sesión (`--continue`, `--session`, `--fork`), respetando el manejo nativo de Pi.

```bash
node dist/cli.js run "Presenta este proyecto" --mode json --persist --name "intro"
node dist/cli.js run "Explica su estructura" --mode json --continue
node dist/cli.js run "Alternativa de solución" --mode json --fork <ruta-o-id>
node dist/cli.js run-file examples/prompts/session-analysis.md --mode json --persist --dry-run
```

`--session-dir` puede dirigir el almacenamiento de Pi a una carpeta elegida. El harness no crea
su propio formato de sesiones. Ver `LECCION_04.md` para práctica de `/tree`, `/compact`,
`/resume`, privacidad y limitaciones del modo print/JSON.

**Windows:** se conservan la resolución de `pi-launcher.js` y los tests de simulación mediante
preload, sin `shell: true`. El ensayo real en Windows debe ejecutarse en un equipo Windows.


## Módulo 1 / Lección 5: Context Engineering

Los recursos nativos de Pi hacen la mayor parte del trabajo. El lab ofrece inspección
orientativa del directorio actual y opciones explícitas por ejecución.

```bash
node dist/cli.js context
node dist/cli.js run "Revisa este proyecto" --append-instructions examples/instructions/code-review.md --dry-run
node dist/cli.js run "Explica la estructura" --no-context-files --dry-run
node dist/cli.js run-file examples/context-experiment.md --append-instructions examples/instructions/test-first.md --mode json --dry-run
```

- `context` muestra archivos y rutas del **cwd solamente**; no inspecciona recursos
  globales ni confirma que Pi haya confiado/cargado los recursos. No revela contenidos.
- `--append-instructions ruta.md` valida el archivo local y lo delega a Pi como
  `--append-system-prompt ruta-absoluta`; puede repetirse.
- `--no-context-files` deshabilita discovery de archivos AGENTS/CLAUDE de Pi para
  esa ejecución, pero NO impide agregar instrucciones mediante otras vías.
- `.pi/prompts/*.md` sólo se activa tras trust del proyecto; usa Pi interactivo
  para probar `/review` y `/plan`. Nunca autoapruebes repositorios desconocidos.
- Los archivos de instrucciones NO son barreras de seguridad. Revisa el contenido
  antes de usar proyectos externos o archivos pasados por `--append-instructions`.
- No se toca `piCommand()` de Windows; se mantienen los tests y el uso de `shell:false`.

Lección: `LECCION_05.md`; ejercicio opcional resuelto en
`solutions/modulo-01-leccion-05/`.


## Módulo 2 / Lección 2: Extensiones TypeScript

`agent-lab` no implementa un loader de TypeScript: usa el mecanismo de Pi para extender el Agent Loop. La nueva extensión `.pi/extensions/lifecycle-observer.ts` observa eventos y registra `/lab-stats` dentro de Pi interactivo.

```bash
node dist/cli.js extensions list
node dist/cli.js run "Analiza el repositorio" --extension .pi/extensions/lifecycle-observer.ts --dry-run
node dist/cli.js run "Analiza el repositorio" --extension .pi/extensions/lifecycle-observer.ts --mode json
```

- Por defecto la configuración del lab bloquea las extensiones autodetectadas (`disableExtensions=true`); **las rutas `--extension` explícitas sí se cargan**, igual que en Pi.
- `extensions list` inspecciona el directorio local, no representa el inventario efectivo de Pi ni comprueba confianza del proyecto.
- Las extensiones pueden ejecutar código arbitrario con los permisos de Pi; **no son un sandbox**.
- Para ver `/lab-stats`, iniciá `pi --no-extensions -e .pi/extensions/lifecycle-observer.ts` en una sesión interactiva.
- Leer `LECCION_07.md` y el ejercicio resuelto en `solutions/modulo-02-leccion-02/`.
- No se altera el lanzador ni los tests específicos de Windows.
