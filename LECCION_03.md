# Módulo 1 · Lección 3 — Modelos, proveedores y perfiles de ejecución

| Campo | Valor |
|---|---|
| Curso | Pi.dev: de cero a un Agent Harness profesional |
| **Módulo** | **1 — Fundamentos de Pi** |
| **Lección** | **3 — Modelos, proveedores y perfiles de ejecución** |
| **Nivel** | **Principiante–Intermedio** |
| **Complejidad** | **Media** |
| Tiempo sugerido | 120–150 minutos |
| Versión inicial | Agent Harness Lab **v0.2.0** |
| Versión final | Agent Harness Lab **v0.3.0** |
| Documentación verificada | **28 de octubre de 2026** |

> **Objetivo:** aprender cómo Pi descubre modelos, se autentica, selecciona proveedores y controla el nivel de razonamiento; luego extender **el mismo repositorio** para usar perfiles de selección sin copiar el catálogo, duplicar la autenticación ni implementar un router de modelos prematuramente.

## 1. Resultado de la lección

Al completar el módulo podrás:

1. Diferenciar **proveedor**, **modelo**, **API**, **credencial**, **perfil** y **nivel de thinking**.
2. Elegir un modelo desde la interfaz de Pi o con argumentos CLI.
3. Consultar el catálogo desde Pi, sin instalar otro registro de proveedores.
4. Usar sus mecanismos propios de autenticación sin incorporar claves al laboratorio.
5. Configurar presets de ejecución llamados `review`, `deep`, etc.
6. Definir y probar la precedencia de la configuración local frente a overrides de cada ejecución.
7. Explicar las limitaciones de `thinking`, compatibilidad, coste y selección de modelos.

**Incremento de producto:** CLI `agent-lab` con `models`, `profiles`, `--profile`, `--model`, `--provider` y `--thinking`; los modos **print y JSON** de la Lección 2 siguen funcionando.

**Criterios de aceptación:**

- `agent-lab models [filtro]` invoca a Pi para listar modelos sin parsear ni almacenar el catálogo.
- Sin configuración de selección, Pi conserva su elección nativa de modelo.
- `agent-lab profiles` expone los perfiles del archivo de configuración.
- `run` y `run-file` admiten perfiles y overrides en ambos modos de salida.
- Configuración inválida, perfiles desconocidos, `thinking` inválido y contradicciones evidentes se rechazan ANTES de iniciar el agente.
- `--dry-run` muestra el comando preparado sin invocar al modelo.
- Los tests de las lecciones anteriores siguen pasando.

---

## 2. Modelo mental: cinco responsabilidades distintas

```text
Usuario / aplicación
      |
      v
Agent Harness Lab                    <- CLI + perfiles + validación + selección
      |
      |  --provider / --model / --thinking
      v
Pi Runtime                           <- Agent Loop + contexto + ejecución de tools
      |
      +-- Catálogo de modelos        <- capacidades, contexto, coste, proveedores
      +-- Resolución de credenciales <- /login, variables de entorno, auth.json
      +-- Protocolo del proveedor    <- API del modelo y streaming
      |
      v
Proveedor remoto o modelo local
```

**Proveedor:** servicio que expone modelos (`anthropic`, `openai`, `google`, etc.). No es necesariamente la empresa que fabricó el modelo: un agregador puede exponer modelos de varias empresas.

**Modelo:** identificador específico seleccionado dentro de un proveedor. Un mismo nombre comercial puede tener IDs diferentes según la ruta de acceso.

**API/protocolo:** formato real de solicitudes/respuestas entre Pi y el proveedor. Elegir un modelo NO cambia automáticamente el protocolo ni crea una implementación de ese protocolo en nuestro harness.

**Credencial:** mecanismo de autenticación que Pi conoce. No guardaremos `apiKey`, OAuth tokens ni refresh tokens en `harness.config.json`.

**Perfil del harness:** una combinación de selección de modelo/proveedor/thinking con un nombre local para reutilizarla. Es un concepto **nuestro**, no un nuevo tipo de modelo ni una alteración de Pi.

### 2.1. Dónde termina Pi y dónde empieza nuestro código

**Pi ya ofrece:** catálogo de modelos, autenticación, selección de modelos, capacidades y APIs, compatibilidad por proveedor, elección de thinking, sesiones y ejecución del agent loop.

**Agent Harness Lab añade:** una interfaz no interactiva estable, presets declarativos y reglas claras de qué prevalece cuando el usuario combina `harness.config.json`, `--profile` y flags.

No implementamos una clase `ClaudeProvider`, una clase `OpenAIProvider` ni un registro de modelos; eso duplicaría funcionalidades de Pi sin haber detectado un problema real.

---

## 3. Explorar los modelos con Pi nativo

### 3.1. Preparar el entorno

Para la distribución actual de Pi, se recomienda Node.js 22.19 o superior:

```bash
node --version
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
```

Si todavía no tenés un proveedor configurado, iniciá `pi` y usá `/login`. Según el proveedor podrás autenticarte por suscripción, API key u otros métodos soportados. La disponibilidad depende del proveedor y de tu plan, no del laboratorio.

```text
pi
/login
/model
/thinking
```

**Comandos para el CLI**:

```bash
# Lista modelos; puede mostrar sólo los disponibles para el entorno configurado
pi --list-models

# Búsqueda aproximada en el catálogo expuesto por Pi
pi --list-models claude
pi --list-models gpt

# Ejecución puntual por ID explícito (ejemplo; verificá que esté disponible)
pi --model openai/gpt-4o --thinking low --print "Explica el concepto de provider"

# Cuando proveedor e ID se eligen de manera independiente
pi --provider openai --model gpt-4o --print "Saludá en español"
```

Pi también admite expresiones de búsqueda de modelo y patrones; el **ID real disponible puede cambiar**. Conviene consultar `pi --list-models` en el entorno donde se ejecutará.

### 3.2. Autenticación y seguridad

Según documentación oficial, Pi puede tomar credenciales de `/login` y `auth.json`, variables de entorno o integraciones propias del proveedor. La precedencia exacta la define Pi; no la replicamos. Ejemplo con un proveedor que acepta la variable `ANTHROPIC_API_KEY`:

```bash
# Ejemplo únicamente ilustrativo: NO escribir claves en historial compartido
# export ANTHROPIC_API_KEY="..."
pi --print "Hola"
```

**No copies `auth.json` al repositorio.** Tampoco uses `--api-key` en el laboratorio, ya que exponer un secreto como argumento de proceso crea riesgos adicionales en logs y diagnósticos. `doctor` sólo detecta un ejecutable Pi; **no verifica que la sesión esté autenticada**.

**Pregunta práctica:** si `pi --list-models` lista un modelo, ¿puedo asumir que la ejecución funcionará? **No**. El modelo puede no estar autorizado, tener cuota insuficiente, rechazar parámetros, sufrir cambios de endpoint o fallar por conectividad.

---

## 4. Qué es `thinking` y por qué no equivale a “modelo más inteligente”

En Pi el nivel de razonamiento se selecciona con `/thinking`, `--thinking` o en la propia especificación del modelo. Los valores documentados para el CLI actual son:

| Nivel | Interpretación operacional |
|---|---|
| `off` | No solicitar razonamiento extendido |
| `minimal` | Nivel mínimo, si el modelo lo admite |
| `low` | Menor presupuesto de razonamiento, si se admite |
| `medium` | Presupuesto intermedio |
| `high` | Presupuesto mayor |
| `xhigh` | Presupuesto aún mayor, dependiente del modelo |
| `max` | Máximo nivel expuesto por Pi, dependiente del modelo |

**Clave:** que el CLI acepte el texto `max` no significa que tu modelo lo soporte. Pi traduce/limita los niveles según las capacidades del modelo y proveedor. A mayor razonamiento pueden cambiar latencia y consumo, pero no hay una equivalencia universal de coste o calidad. Debemos comparar con tareas reales y métricas, no asumir que `high` siempre es mejor.

### 4.1. Experimento controlado

Ejecutá el mismo prompt varias veces, si tu proveedor permite los niveles:

```bash
pi --model <MODELO_DISPONIBLE> --thinking low --print "Propón tests para un parser de JSONL"
pi --model <MODELO_DISPONIBLE> --thinking high --print "Propón tests para un parser de JSONL"
```

Registrar **latencia percibida**, **tests útiles propuestos**, **errores**, **coste/uso según el proveedor** y **consistencia**, no sólo cantidad de palabras. Repetir las pruebas mejora la evaluación. No tenemos aún un medidor automatizado de costes: lo estudiaremos más adelante cuando incorporaremos observabilidad.

---

## 5. Preparación del repositorio existente

Partimos **exactamente de la v0.2.0**, no de un proyecto nuevo:

```bash
git status --short
git checkout -b feature/module-01-lesson-03
# aplicar después el ZIP incremental o el patch
npm install
npm test
npm run typecheck
```

El laboratorio 0.3.0 añade/modifica estos archivos:

```text
agent-harness-lab/
├── src/
│   ├── cli.ts              # nuevos flags y comandos
│   ├── config.ts           # perfiles y thinking
│   ├── model-selection.ts  # NUEVO: composición de selección
│   ├── runtime.ts          # flags de selección y --list-models
│   └── json-events.ts      # SIN cambios
├── tests/
│   ├── cli.test.mjs        # SIN cambios
│   ├── json.test.mjs       # SIN cambios
│   └── models.test.mjs     # NUEVO
├── examples/
│   ├── config/harness.profiles.example.json # NUEVO
│   └── prompts/model-evaluation.md          # NUEVO
├── solutions/modulo-01-leccion-03/ # NUEVO, separado
├── LECCION_03.md
├── CHANGELOG.md
└── README.md
```

**Compatibilidad:** la configuración base `harness.config.json` NO fija un modelo. Por lo tanto, quien ya usa OpenAI, Anthropic u otro proveedor con Pi no recibe un cambio inesperado de selección.

---

## 6. Diseño de los perfiles y configuración

Ejemplo *optativo* en `examples/config/harness.profiles.example.json`:

```json
{
  "pi": {
    "executable": "pi",
    "tools": ["read", "grep", "find", "ls"],
    "noSession": true,
    "disableMcp": true,
    "disableExtensions": true
  },
  "execution": { "timeoutMs": 120000 },
  "defaultProfile": "review",
  "modelProfiles": {
    "review": { "model": "anthropic/claude-sonnet-*", "provider": "anthropic", "thinking": "low" },
    "deep": { "model": "anthropic/claude-opus-*", "provider": "anthropic", "thinking": "high" },
    "openai-review": { "model": "openai/gpt-*", "provider": "openai", "thinking": "low" }
  }
}
```

**Nota:** son *patrones educativos*, no identificadores de modelos garantizados ni una recomendación automática. Confirmá con `agent-lab models` que los modelos y capacidades existen en tu cuenta. Si un patrón resuelve a varios modelos, conviene fijar el ID específico para ejecuciones reproducibles.

### 6.1. ¿Por qué no copiar `models.json` de Pi?

`~/.pi/agent/models.json` sirve para configurar proveedores personalizados y sobrescrituras a nivel Pi. Nuestro archivo define *preferencias por tarea*, sin URLs, tokens ni configuración del protocolo remoto. Dos cosas con responsabilidades distintas.

- Configuración de un endpoint compatible: usar **models.json de Pi**.
- Un provider con protocolo o autenticación no estándar: considerar **extensión de provider** de Pi.
- La selección reutilizable “revisar PR con X, pensar low”: usar **modelProfiles del lab**.

---

## 7. Implementación paso a paso

### 7.1. Contratos TypeScript — `src/config.ts`

Añadimos sólo los datos necesarios:

```ts
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export interface ModelSelection {
  model?: string;
  provider?: string;
  thinking?: ThinkingLevel;
}
export interface HarnessConfig {
  pi: {
    executable: string;
    tools: string[];
    noSession: boolean;
    disableMcp: boolean;
    disableExtensions: boolean;
  } & ModelSelection;
  execution: { timeoutMs: number };
  defaultProfile?: string;
  modelProfiles: Record<string, ModelSelection>;
}
```

Los campos `model`, `provider` y `thinking` siguen siendo opcionales. **Ausencia de selección significa delegar en Pi**, no asumir un proveedor concreto.

### 7.2. Precisión de validaciones

Verificamos localmente:

- `modelProfiles` es un mapa de objetos.
- Cada perfil tiene un `model` no vacío.
- `defaultProfile` refiere a un perfil definido.
- `thinking` corresponde a un valor reconocido por el CLI de Pi.
- Un `provider/id` explícito no contradice el `provider` elegido.

**No verificamos** que el modelo exista, esté habilitado, sea accesible, acepte imágenes, tenga una ventana de contexto determinada o soporte un nivel de thinking concreto. Esto corresponde a la **fuente de verdad de Pi**, no a un regex.

### 7.3. Resolución — `src/model-selection.ts`

La selección tiene cuatro capas:

```text
base pi.model/provider/thinking
          |
          v
defaultProfile (si existe)
          |
          v
--profile <nombre> (si existe)
          |
          v
--model / --provider / --thinking explícitos
          |
          v
selección enviada a Pi
```

Código simplificado del método real:

```ts
export function resolveModelSelection(
  config: HarnessConfig,
  overrides: ModelOverrides = {},
): ModelSelection {
  let selected: ModelSelection = {
    ...(config.pi.model ? { model: config.pi.model } : {}),
    ...(config.pi.provider ? { provider: config.pi.provider } : {}),
    ...(config.pi.thinking ? { thinking: config.pi.thinking } : {}),
  };

  const profileName = overrides.profile ?? config.defaultProfile;
  if (profileName) {
    if (!Object.hasOwn(config.modelProfiles, profileName)) {
      throw new Error(`Perfil de modelo desconocido: ${profileName}`);
    }
    const profile = config.modelProfiles[profileName];
    if (profile.model && profile.provider === undefined) delete selected.provider;
    selected = { ...selected, ...profile };
  }

  if (overrides.model !== undefined) {
    selected.model = validateModelToken(overrides.model, '--model');
    if (overrides.provider === undefined) delete selected.provider;
  }
  if (overrides.provider !== undefined) {
    selected.provider = validateModelToken(overrides.provider, '--provider');
  }
  if (overrides.thinking !== undefined) selected.thinking = overrides.thinking;
  // La implementación real además comprueba contradicción provider/id.
  return selected;
}
```

Si cambiás `--model` desde un perfil Anthropic a `openai/...` sin `--provider`, **no retenemos** `anthropic` de manera accidental. Cuando ambos se indican explícitamente, deben coincidir.

Esto crea un contrato predecible sin interpretar capacidades ni credenciales.

### 7.4. Traducir la selección a flags nativos

`src/runtime.ts` sigue invocando `spawn` (sin shell). Sólo añade las opciones necesarias:

```ts
export function buildPiArgs(
  prompt: string,
  config: HarnessConfig,
  mode: PiMode = 'print',
  selection: ModelSelection = config.pi,
): string[] {
  const args = mode === 'print' ? ['--print'] : ['--mode', 'json'];
  if (config.pi.noSession) args.push('--no-session');
  if (config.pi.disableMcp) args.push('--no-mcp');
  if (config.pi.disableExtensions) args.push('--no-extensions');
  args.push('--tools', config.pi.tools.join(','));
  if (selection.model) args.push('--model', selection.model);
  if (selection.provider) args.push('--provider', selection.provider);
  if (selection.thinking) args.push('--thinking', selection.thinking);
  args.push('--', prompt);
  return args;
}
```

La ejecución `runPi`/`runPiJson` ahora recibe un `selection` opcional. No cambiamos los parsers JSONL de la Lección 2 ni la gestión del proceso.

### 7.5. Listar modelos sin duplicar el catálogo

El nuevo comando `models` delega a `pi --list-models`:

```ts
const args = ['--list-models', ...(filter ? [filter] : [])];
const child = spawn(config.pi.executable, args, {
  cwd,
  shell: false,
  env: process.env,
  stdio: 'inherit',
});
```

**Decisión deliberada:** no parseamos una tabla CLI que puede cambiar de forma. El comando sirve para inspección humana. Más adelante, si necesitamos un catálogo estructurado y fiable, investigaremos la API del SDK/registro de modelos, no haremos scraping de texto.

---

## 8. Laboratorio guiado de la v0.3.0

### Paso A. Verificar estado y regresiones

```bash
npm install
npm test
npm run typecheck
node dist/cli.js doctor
```

**Esperado:** `doctor` informa la versión instalada de Pi; **no** acredita autenticación.

### Paso B. Explorar modelos reales

```bash
node dist/cli.js models
node dist/cli.js models claude
node dist/cli.js models gpt
```

Anotá dos modelos a los que tengas acceso y cuál de ellos soporta `thinking`. Esto se confirma con Pi y la documentación específica del modelo/proveedor.

### Paso C. Usar un perfil optativo sin alterar la configuración principal

```bash
node dist/cli.js --config examples/config/harness.profiles.example.json profiles
node dist/cli.js --config examples/config/harness.profiles.example.json \
  run "Revisa los tests" --profile deep --dry-run
```

**Importante:** el perfil `deep` es un ejemplo. Si no tenés Anthropic, copiá el archivo y ajustá los IDs a modelos disponibles antes de ejecutar sin `--dry-run`.

### Paso D. Probar precedencia explícita

```bash
node dist/cli.js --config examples/config/harness.profiles.example.json \
  run "Hola" --model openai/gpt-4o --thinking off --dry-run
```

Observá que `--provider anthropic` **no** se conserva del perfil predeterminado. Esta protección está probada automáticamente.

Ahora probá un error intencional:

```bash
node dist/cli.js run "Hola" --model openai/gpt-4o --provider anthropic --dry-run
```

**Esperado:** error local de proveedor incompatible y exit code 1. El agente no se inicia.

### Paso E. Verificar modo JSON sin regresiones

```bash
node dist/cli.js run-file examples/prompts/model-evaluation.md \
  --mode json --dry-run
```

Al quitar `--dry-run` usarás credenciales, cuota y acceso a modelos reales de Pi. **No grabes JSONL con datos privados en un repositorio público.**

### Paso F. Validar desde el CLI nativo

Finalmente, si tenés acceso a un modelo apropiado, compará la misma ejecución desde `pi --print` y desde `agent-lab run`. El objetivo es confirmar que el wrapper agrega configuración y validación, sin cambiar el comportamiento central del agente.

---

## 9. Pruebas automatizadas

`tests/models.test.mjs` utiliza un ejecutable Pi simulado; una prueba de integración *de argumento a proceso*, no un proveedor remoto.

Ejemplo del patrón:

```js
test('CLI reemplaza modelo y thinking del perfil', () => {
  const w = workspace();
  try {
    const result = invoke(w.dir, [
      'run', 'Hola', '--model', 'openai/gpt-4o',
      '--thinking', 'off', '--dry-run',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(result.stdout).args;
    assert.ok(args.includes('openai/gpt-4o'));
    assert.ok(!args.includes('--provider'));
  } finally { w.cleanup(); }
});
```

El suite cubre: precedencia, perfiles por defecto/explícitos, selección en JSON, flags de thinking, incompatibilidades, perfiles ausentes, `--list-models`, configuración sin perfiles, `run-file`, comandos incorrectos y regresiones de lecciones anteriores.

**Resultado de verificación del código entregado:** 36 tests sobre el núcleo v0.3.0; 38 tras aplicar la solución del ejercicio. Se ejecutaron con TypeScript y un Pi simulado, **no contra un servicio LLM autenticado**.

---

## 10. Ejercicio obligatorio — US-LAB-003: inspeccionar un perfil

**Historia de usuario:** como persona que configura el harness, quiero conocer los parámetros finales de un perfil sin iniciar Pi, para verificar que la selección es coherente.

### Requerimiento

Implementá:

```bash
agent-lab profiles show deep
```

Salida ejemplo (con el archivo de perfiles incluido):

```json
{
  "name": "deep",
  "selection": {
    "model": "anthropic/claude-opus-*",
    "provider": "anthropic",
    "thinking": "high"
  }
}
```

### Criterios de aceptación

1. `profiles` sin argumentos conserva su salida actual.
2. `profiles show <nombre>` muestra la selección efectiva del perfil en JSON.
3. Se reutiliza `resolveModelSelection`, sin volver a implementar precedencia.
4. No se ejecuta Pi ni se accede a credenciales.
5. Un perfil desconocido genera un error claro y código de salida no cero.
6. Se agregan al menos dos tests para casos válido e inválido.
7. Se mantienen los 36 tests de la versión principal.

### Pistas

- Modificá sólo el caso `command === 'profiles'` en `src/cli.ts` y el texto de ayuda.
- Procesá `rest` como `['show', 'deep']`.
- Utilizá `resolveModelSelection(config, { profile: name })`.
- Prepará un directorio temporal con configuración para los tests.
- Para comparar tu implementación, consultá `solutions/modulo-01-leccion-03/`.

**Solución completa:** `solutions/modulo-01-leccion-03/src/cli.ts`, `tests/profile-show.test.mjs` y su README. Se guarda separada del core intencionalmente.

---

## 11. Preguntas de repaso

1. ¿Cuál es la diferencia entre un `provider` y un `model`?
2. ¿Por qué `profiles` es responsabilidad de nuestro CLI, pero `models` delega en Pi?
3. ¿Cuál es la fuente de verdad para saber si un modelo soporta un nivel específico de thinking?
4. ¿Por qué no guardamos API keys en `harness.config.json`?
5. Si un perfil tiene `provider: anthropic` y el usuario pasa `--model openai/...`, ¿qué debería ocurrir?
6. ¿Por qué `--list-models` no equivale a “credenciales verificadas”?
7. ¿Qué argumentos justificarían un enrutador avanzado de modelos y cuáles serían señales de sobreingeniería?
8. ¿Cómo probarías la ausencia de un `defaultProfile` sin tener un proveedor configurado?

**Respuestas esperadas resumidas:** 1) conexión vs identidad del modelo; 2) preferencia local vs catálogo nativo; 3) Pi/modelo/proveedor; 4) seguridad y responsabilidades; 5) descartar provider heredado o rechazar contradicción explícita; 6) listado no ejecuta inferencia; 7) necesidades medibles de SLA/costes/fallback, no intuición; 8) con dry-run y Pi simulado.

---

## 12. ¿Qué NO implementamos todavía y por qué?

| Capacidad | Decisión en Lección 3 | Motivo |
|---|---|---|
| Catálogo de modelos propio | No | Pi ya tiene un catálogo activo y actualizable |
| Credenciales y renovación OAuth | No | Pi maneja sus propios mecanismos; duplicar aumenta el riesgo |
| Fallback automático entre proveedores | No | Requiere políticas de reintento, idempotencia, costes y compatibilidad |
| Routing por precio/latencia | No | Aún no tenemos métricas ni requisitos de optimización verificados |
| Presupuesto máximo por tarea | No | Requiere observabilidad confiable y señales de consumo |
| Validación del soporte de thinking | Delegada a Pi | Sólo Pi/modelo conoce capacidades reales |
| SDK y control de sesión en memoria | No | Seguimos evaluando el límite de integración |
| Provider personalizado | No | Usar `models.json` o una extensión de Pi si surge una necesidad real |

Esto es una mejora funcional pequeña, verificable y **evolutiva**, no un framework nuevo.

## 13. Recursos para profundizar

### Documentación oficial

- [Elegir un modelo — Pi](https://pi.dev/docs/latest/models): `/login`, `/model`, thinking, local models y troubleshooting.
- [Proveedores — Pi](https://pi.dev/docs/latest/providers): autenticación y configuración específica.
- [Referencia CLI — Pi](https://pi.dev/docs/latest/cli): `--model`, `--provider`, `--thinking`, `--list-models`, modos de uso.
- [Configuración de modelos](https://pi.dev/docs/latest/models-configuration): schema de `models.json`, APIs, endpoints y overrides.
- [Extensiones de proveedores](https://pi.dev/docs/latest/custom-providers): punto de extensión si Pi no soporta una integración específica.
- [Catálogo de modelos en Pi](https://pi.dev/models): información de modelos actualizable.

### Recursos incluidos en el repositorio

- `examples/config/harness.profiles.example.json`: perfiles optativos editables.
- `examples/prompts/model-evaluation.md`: prompt reproducible de revisión.
- `src/model-selection.ts`: selección con precedencia explícita.
- `tests/models.test.mjs`: regresiones y casos límite sin credenciales.
- `solutions/modulo-01-leccion-03/`: solución de US-LAB-003.
- `CHANGELOG.md`: historial incremental desde la Lección 1.

---

## 14. Checklist antes de pasar a la Lección 4

- [ ] Puedo describir provider/model/credentials/thinking con mis propias palabras.
- [ ] Ejecuté `pi --list-models` o `agent-lab models` en un entorno con Pi.
- [ ] Entendí por qué `agent-lab config` y `~/.pi/agent/models.json` son diferentes.
- [ ] Puedo ejecutar `--dry-run` con un perfil optativo.
- [ ] Puedo explicar la regla de precedencia de la selección.
- [ ] Los 36 tests base pasan.
- [ ] Completé el ejercicio `profiles show` y lo comparé con la solución.
- [ ] Verifiqué (o dejé registrado como pendiente) al menos una ejecución real autenticada.

## 15. Próximo paso

**Módulo 1 · Lección 4 — Sesiones, persistencia, branching y compaction.**
**Nivel:** Intermedio · **Complejidad:** Media.

La siguiente lección deberá conservar el modelo de configuración y agregar una estrategia de sesión simple, sin inventar un motor de memoria ni duplicar los formatos internos de Pi.
