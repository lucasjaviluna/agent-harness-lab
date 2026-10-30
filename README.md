# Agent Harness Lab — v0.4.0

Curso: **Pi.dev: de cero a construir un Agent Harness profesional**
**Módulo 1 — Fundamentos de Pi · Lección 4 — Sesiones, persistencia, branching y compaction**
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
