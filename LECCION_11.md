# Curso de Pi.dev — Agent Harness Engineering

**Módulo:** 2 — Extensibilidad
**Lección del módulo:** 6 — Codemode, Tool Search y descubrimiento dinámico de herramientas
**Lección global:** 11 de 20
**Nivel:** Avanzado
**Complejidad:** Alta
**Duración sugerida:** 180–210 minutos
**Versión del laboratorio:** v0.10.0 → v0.11.0
**Repositorio conductor:** https://github.com/lucasjaviluna/agent-harness-lab

> Esta lección es acumulativa. Se aplica sobre la Lección 10, no sobre un proyecto nuevo. Se mantienen `src/runtime.ts` y `piCommand()` para Windows, salvo la adición de la opción de selección de herramientas.

## 1. Objetivos de aprendizaje

Al finalizar podrás:

1. Distinguir una herramienta **declarada** al modelo de una herramienta **registrada y callable** mediante Codemode.
2. Explicar cuándo convienen `codemode`, `tool_search` y la exposición `direct`, `codemode`, `deferred`, `model-only` y `hidden`.
3. Escribir scripts Codemode con `tools.*`, `searchTools`, `describeTool`, `Promise.allSettled` y salida compacta.
4. Permitir que tu CLI configure herramientas para una ejecución sin duplicar el registro interno de Pi.
5. Registrar un par de herramientas con diferentes modos de exposición.
6. Probar los cambios sin credenciales y entender los riesgos de llamar herramientas anidadas.

**Producto al terminar:** Agent Harness Lab v0.11.0 incorpora `--tools` por ejecución, una extensión de ejemplo con herramientas `codemode` y `deferred`, un ejemplo optativo de configuración Pi y pruebas de regresión.

---

## 2. Motivación: por qué no declarar todas las herramientas

Imaginá un harness conectado a 15 servidores MCP, con decenas de herramientas cada uno. Declarar todos los schemas y descripciones en cada turno puede ocupar demasiado contexto e introducir ruido. El agente quizá necesite solamente una herramienta para encontrar tests.

Pi ya ofrece dos mecanismos que resuelven esta situación. **Codemode** permite escribir un programa JavaScript que invoca herramientas y filtra sus respuestas antes de mostrarlas al LLM. **Tool Search** busca herramientas no declaradas y hace disponibles las coincidencias para la próxima llamada al modelo. Por eso no implementaremos un buscador paralelo de tools ni un segundo Agent Loop.

```
Usuario → Pi Agent Loop
             │
             ├── Tools directas (read, grep, …)
             ├── codemode (JavaScript / QuickJS)
             │       └── tools.lab_project_facts({})
             └── tool_search
                     └── activa lab_test_inventory → modelo
```

**Matiz:** Que una herramienta no esté declarada directamente al modelo no significa que esté deshabilitada. La seguridad debe implementarse por separado mediante políticas, sandbox o aislamiento del proceso.

## 3. Codemode en profundidad

Codemode es una **herramienta integrada** de Pi, implementada como extensión. El modelo le pasa *código JavaScript*, no un objeto con JSON ni un bloque Markdown. Se ejecuta en una sandbox **QuickJS** con acceso a las herramientas delegadas por Pi; no tiene acceso directo a `node:fs`, red, timers o al proceso Node.

### 3.1. Globals principales

| Global | Propósito |
|---|---|
| `tools.<nombre>(args)` | Ejecuta una herramienta autorizada por el runtime Pi |
| `searchTools(query, opts?)` | Busca herramientas callable por relevancia |
| `describeTool(name)` | Devuelve definición/descripción de una herramienta |
| `describeNamespace(name)` | Inspecciona un grupo de herramientas |
| `ALL_TOOLS` | Inventario de herramientas callable con nombres y descripciones |
| `text(value)` | Envía texto/resumen al modelo |
| `image(value)` | Emite imagen al modelo |
| `store(key,value)` / `load(key)` | Estado JSON pequeño en la rama actual de sesión |
| `models` | Acceso a modelos auxiliares, cuando están configurados |

### 3.2. Primer script

El siguiente bloque es el **contenido** que el modelo debe enviar a la herramienta Codemode; no hay que pegarlo directamente en el shell:

```javascript
const matches = await searchTools("resumen de proyecto y package.json", { limit: 5 });
text(matches.map(t => `${t.name}: ${t.description}`).join("\n"));

const report = await tools.lab_project_facts({});
text(report);
```

El resultado de `tools.lab_project_facts` es la respuesta de esa herramienta, no un acceso al sistema de archivos desde QuickJS. Codemode podrá llamarla porque la hemos registrado con `exposure: 'codemode'`.

### 3.3. Paralelismo y límites del contexto

```javascript
const results = await Promise.allSettled([
  tools.lab_project_facts({}),
  tools.lab_test_inventory({}),
]);
for (const [i, result] of results.entries()) {
  text(result.status === "fulfilled"
    ? `Consulta ${i + 1}: ${JSON.stringify(result.value).slice(0, 600)}`
    : `Consulta ${i + 1}: error controlado`);
}
```

El ejemplo anterior ilustra el uso de `Promise.allSettled()`: Codemode recibe los resultados y emite solamente una fracción relevante. **No infieras que todas las herramientas son seguras para paralelismo**: dos llamadas que escriben el mismo archivo pueden colisionar.

### 3.4. Store: memoria pequeña, no RAG

```javascript
store("last-project-check", { checked: true, version: "v1" });
text(load("last-project-check"));
```

El store persiste datos JSON limitados en la rama de sesión. No es un sistema de memoria empresarial, una DB, ni un lugar para guardar secretos. Los datos viajan con el historial de la sesión.

## 4. Tool Search y exposición de herramientas

`tool_search` busca herramientas no declaradas al modelo y activa coincidencias para que puedan utilizarse en una llamada posterior. Una herramienta diferida sigue siendo registrada por Pi.

| Exposure | Declarada al LLM al activarse | Callable desde Codemode | Uso típico |
|---|---|---|---|
| `direct` | Sí | Sí mientras está activa | Tool frecuente de uso directo |
| `model-only` | Sí | No | UI o herramienta orquestadora que no debe invocarse desde otra tool |
| `codemode` | No por defecto | Sí | Tool de bajo nivel para composición |
| `deferred` | No hasta ser encontrada | Sí, pero no enumerada por Codemode | Catálogo grande, Tool Search |
| `hidden` | No | No | Tool registrada pero no alcanzable |

**Ejemplo:** `lab_project_facts` usa `codemode` y `lab_test_inventory` usa `deferred`.

```typescript
pi.registerTool({
  name: 'lab_test_inventory',
  label: 'Test Inventory',
  exposure: 'deferred',
  description: 'Lista los tests disponibles en tests/',
  parameters: Type.Object({}, { additionalProperties: false }),
  async execute(_id, _params, signal, _onUpdate, ctx) {
    const inventory = await listTestInventory(ctx.cwd, signal);
    return {
      content: [{ type: 'text', text: JSON.stringify(inventory) }],
      details: { inventory },
    };
  },
});
```

Un modelo podría buscar «inventario de archivos de pruebas», recibir un nombre candidato mediante `tool_search` y luego invocarlo directamente. También es posible encontrar herramientas con `searchTools` dentro de Codemode, pero el comportamiento de declaración de herramientas no es el mismo.

## 5. Activar las extensiones integradas: detalle importante

En nuestro proyecto `harness.config.json` mantiene `pi.disableExtensions: true` por defecto. Esto mantiene el arranque del laboratorio deliberadamente limitado, **pero también deshabilita las extensiones integradas Codemode y Tool Search**.

Pi ofrece el ejemplo nativo `pi --tools +codemode` para modificar su selección predeterminada de tools. **No lo usamos dentro de agent-lab**: como ya tenemos una lista explícita limitada, reemplazarla accidentalmente por los defaults de Pi podría habilitar `bash`, `write` o `edit`. El lab acepta solamente nombres explícitos.

El archivo de ejemplo `examples/config/harness.codemode.example.json` habilita las extensiones para una ejecución de laboratorio:

```json
{
  "pi": {
    "executable": "pi",
    "tools": ["read", "grep", "find", "ls", "codemode", "tool_search"],
    "noSession": true,
    "disableMcp": true,
    "disableExtensions": false
  },
  "execution": { "timeoutMs": 120000 }
}
```

**Precaución:** activar extensiones permite que Pi descubra también otras extensiones del proyecto o del usuario. **Solo hagas esto con recursos confiables**. Para entornos corporativos, es necesaria una frontera de seguridad externa a Pi.

### 5.1. Probar sin consumir tokens

```bash
npm install
npm test
npm run typecheck

node dist/cli.js --config examples/config/harness.codemode.example.json \
  run-file examples/prompts/codemode-lab.md --dry-run
```

Deberías ver un `args` con `--tools read,grep,find,ls,codemode,tool_search` y **sin** `--no-extensions`.

### 5.2. Ejecución real (requiere Pi y proveedor)

```bash
node dist/cli.js --config examples/config/harness.codemode.example.json \
  run-file examples/prompts/codemode-lab.md --mode json --view tools
```

En PowerShell, utilizá una sola línea o el carácter de continuación `` ` `` en lugar de `\`.

La extensión `.pi/extensions/tool-catalog.ts` se descubre automáticamente al activar las extensiones del proyecto. En una sesión interactiva también podés ejecutar:

```bash
pi --tools read,grep,find,ls,codemode,tool_search
```

La disponibilidad de las herramientas depende de la versión instalada de Pi, de los recursos cargados y de la confianza en el proyecto. Verificá con `pi --help` y el panel de tools de tu instalación. La ejecución autenticada no está cubierta por los tests offline de esta entrega.

## 6. Cómo evolucionó nuestro código

### 6.1. Selector por ejecución

Agregamos `src/tool-selection.ts`:

```typescript
export function parseToolList(value: string): string[] {
  const items = value.split(',').map(v => v.trim());
  if (!items.length || items.length > 32 ||
      items.some(n => !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(n))) {
    throw new Error('Lista inválida');
  }
  if (new Set(items).size !== items.length) {
    throw new Error('Duplicados no permitidos');
  }
  return items;
}
```

El runtime sólo cambia al construir los argumentos de Pi:

```typescript
args.push('--tools', effectiveTools(config, toolSelection).join(','));
```

`--tools` funciona con `run` y `run-file`. No altera `harness.config.json`, perfiles, ni el catálogo interno de Pi.

**Decisión:** rechazamos `+name`, `-name`, patrones `*` y listas mixtas en el CLI del laboratorio. Pi tiene una semántica más completa; en esta lección mantenemos un contrato deliberadamente sencillo y explícito para evitar sorpresas con la configuración heredada.

### 6.2. Registro de las dos herramientas

`.pi/extensions/tool-catalog.ts` registra las herramientas. `.pi/tools/lab-catalog-core.mjs` implementa el comportamiento aislado y testeable:

- `readProjectFacts`: nombre/versión, número de dependencias y nombres de scripts; **nunca** devuelve los comandos de scripts.
- `listTestInventory`: enumera un número acotado de archivos `*.test.*` en `tests/`; no abre su contenido.

Ambas rechazan fallos con mensajes sanitizados y admiten `AbortSignal`. Las rutas se obtienen de ubicaciones fijas del workspace, no de parámetros del modelo.

## 7. Seguridad: Codemode no reemplaza el guard

El `approval-guard` anterior mantiene un allowlist de herramientas. Lo ampliamos únicamente para que reconozca `codemode`, `tool_search` y las dos herramientas nuevas, todas usadas en este ejercicio de lectura.

**Punto crítico:** el script Codemode no puede escribir archivos directamente a través de Node, pero puede pedir a Pi que ejecute otras herramientas que sí lo hagan. Pi emite eventos `tool_call` también para llamadas anidadas. Por tanto, el guard debe revisar **la operación interna**, no solamente la invocación de Codemode. Ejemplos:

- `codemode` → `lab_project_facts`: permitido por la política del laboratorio.
- `codemode` → `bash`: denegado por la política actual.
- `codemode` → `write` de un archivo normal: solicita aprobación en TUI; sin UI se deniega.
- `codemode` → `write` de `.pi/approval.json`: denegado por ruta protegida.

**Advertencia:** esto aún no es una garantía de seguridad para producción. Las extensiones reciben permisos del proceso; el guard puede no estar cargado, y existen ataques de confusión, concurrencia y TOCTOU. Usá un entorno aislado y políticas externas al ejecutar código no confiable.

## 8. Tests y criterios de aceptación

Las pruebas nuevas verifican:

- Parseo válido e inválido de `--tools`.
- Preservación de la configuración de herramientas anterior.
- Validación de listas vacías, duplicados, modificadores y caracteres de shell.
- `run-file` y JSON compatibles con la opción.
- Configuración optativa que activa las extensiones integradas.
- Exposición `codemode` y `deferred` realmente registrada por las extensiones.
- Consultas de metadatos sin contenido confidencial y resultados acotados.
- Aborto, archivos malformados, errores sanitizados.
- Política del guard sobre herramientas internas (incluidos llamados anidados).
- Regresión de los tests previos de Windows (se ejecutarán en Windows; aquí pueden estar omitidos por plataforma).

Para validar en Windows, repetí `npm test` desde PowerShell y probá los casos de `--tools` y `doctor` con el launcher real. No cambiamos `piCommand`.

## 9. Ejercicio — US-LAB-011

**Historia:** «Como operador quiero excluir herramientas por nombre o patrón, en una ejecución puntual, para reducir la exposición disponible al agente».

Implementá `--exclude-tools <csv>` en `run` y `run-file`, delegando a Pi su flag nativo `--exclude-tools`.

**Criterios de aceptación**:

1. Se puede usar una sola vez por ejecución.
2. Acepta nombres y patrones limitados con `*`, como `mcp__*`.
3. Rechaza argumentos vacíos, duplicados e inyecciones de shell.
4. Aparece en `--dry-run` sin ejecutar Pi.
5. Funciona junto con `--tools`.
6. No altera el comportamiento de `doctor`, `models`, `config` ni las configuraciones anteriores.
7. Incorpora pruebas de opción válida, errores y composición de flags.

Ejemplo esperado:

```bash
agent-lab run "Inspeccioná tests" --tools read,grep,codemode \
  --exclude-tools 'mcp__*' --dry-run
```

**Nota:** `--exclude-tools` administra la disponibilidad declarada/ejecutable según las reglas de Pi; no constituye un sandbox. La solución completa está separada en `solutions/modulo-02-leccion-06/` para que puedas practicar primero.

## 10. Preguntas de repaso

1. ¿Cuál es la diferencia entre herramienta registrada, callable y declarada?
2. ¿Qué aporta Codemode frente a encadenar varias llamadas directas al LLM?
3. ¿Por qué Tool Search favorece catálogos grandes?
4. ¿Por qué no basta con quitar `bash` de la lista declarada para garantizar seguridad?
5. ¿Qué efecto tiene `--no-extensions` sobre las extensiones integradas?
6. ¿Por qué el guard debe interceptar llamadas anidadas?
7. ¿Cuándo usarías `deferred` en vez de `codemode`?
8. ¿Qué decisión del laboratorio es deliberadamente más restrictiva que el CLI nativo de Pi?

## 11. Recursos oficiales

- Pi — CLI y selección de herramientas: https://pi.dev/docs/latest/cli
- Pi — Codemode: https://pi.dev/docs/latest/codemode
- Pi — Extensions y Tool Exposure: https://pi.dev/docs/latest/extensions
- Pi — Settings (`defaultTools`, `codemode.mode`): https://pi.dev/docs/latest/settings
- Pi — MCP y exposición: https://pi.dev/docs/latest/mcp
- Código de referencia: https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions

## 12. Próxima etapa

Se completa el **Módulo 2 (Extensibilidad)**: 11 de 20 lecciones realizadas.

El próximo módulo será **Módulo 3 · Lección 1 (global 12): MCP y conexión de herramientas externas**, de nivel Avanzado y complejidad Alta. Profundizaremos en servidores, transporte, exposición de tools, autenticación, confianza y casos de integración empresarial sin replicar lo que Pi ya proporciona.
