# Módulo 2 · Lección 5 — Personalización de la TUI de Pi: estado, widgets, diálogos y paneles

**Curso:** Pi.dev — Agent Harness Engineering
**Módulo:** 2, Extensibilidad
**Número de lección en el módulo:** 5
**Lección global:** 10 de 20
**Nombre:** Personalización de la TUI de Pi: estado, widgets, diálogos y paneles
**Nivel:** Intermedio–Avanzado
**Complejidad:** Alta
**Duración sugerida:** 150–180 minutos
**Versión del laboratorio:** `v0.9.0 → v0.10.0`
**Repositorio de referencia:** https://github.com/lucasjaviluna/agent-harness-lab

> **Meta:** aprender a adaptar la interfaz de terminal de Pi sin reconstruir su renderer ni reimplementar el Agent Loop. Al concluir, el proyecto tendrá una **extensión optativa de consola de operador** que registra métricas no sensibles y muestra status, header, widget, footer alternativo y un panel interactivo.

## 1. Requisitos y punto de partida

La rama `main` del repositorio se verificó en **v0.9.0**. Esta lección continúa directamente desde la Lección 9 (guard de aprobaciones), no crea otro proyecto. No modificaremos `src/runtime.ts`, el lanzador `piCommand()` ni los tests anteriores que adaptaste para Windows.

Requisitos para trabajar localmente:

- Node.js **22.19+** (requisito del Pi actual); la verificación de tests en el entorno de la lección se realizó con Node 22.16, pero **no** prueba el soporte de ese runtime antiguo en Pi real.
- Pi instalado y configurado con un proveedor si querés probar un turno autenticado. Para explorar los comandos visuales no es necesario consumir tokens.
- Versiones del laboratorio v0.9.0 con `npm test` en verde.
- Terminal interactivo (TUI). No confundas la TUI con los modos print, JSON y RPC.

```bash
npm install
npm test
npm run typecheck
node dist/cli.js --help
```

## 2. Modelo mental: UI visual ≠ motor agéntico ≠ seguridad

El modelo propone herramientas y Pi administra los turnos. En la Lección 7 aprendimos las extensiones; en la 8 añadimos una Custom Tool, y en la 9 interceptamos `tool_call`. **En esta lección no cambiamos ninguna de esas responsabilidades.** Sólo adaptamos cómo el operador observa e interactúa con el proceso.

```text
 Usuario / Operador
       │
       ▼
  Pi TUI (renderer y editor nativos)
       │        ctx.ui.*
       ▼
 Extensión operator-ui.ts
       │
       ├─ métricas del ciclo de vida
       ├─ status / header / widget / footer opcional
       ├─ /lab-ui /lab-widget /lab-footer
       └─ /lab-panel → select + custom
       │
       ▼
 Pi Agent Loop + herramientas + modelo (sin cambios)
```

**Advertencia:** mostrar una aprobación en un diálogo no basta para aplicar una política de seguridad. En particular, `/lab-panel` **no** autoriza herramientas. Las decisiones de autorización de la Lección 9 siguen separadas, y las garantías de producción necesitarán límites externos al proceso de Pi.

## 3. Elegir la API visual correcta

| Necesidad | API de Pi | ¿Qué reemplaza? |
|---|---|---|
| Mensaje efímero | `ctx.ui.notify(text, tipo)` | Nada, aviso no bloqueante |
| Indicador simple | `ctx.ui.setStatus(id, texto)` | Añade un estado identificado |
| Recuadro persistente | `ctx.ui.setWidget(id, líneas, opciones)` | Widget identificado, no editor |
| Encabezado de inicio | `ctx.ui.setHeader(factory)` | Encabezado nativo |
| Pie de terminal | `ctx.ui.setFooter(factory)` | **Todo** el footer original |
| Confirmación | `ctx.ui.confirm(...)` | Diálogo temporal |
| Elección | `ctx.ui.select(...)` | Selector temporal |
| Entrada de texto | `ctx.ui.input(...)` | Diálogo temporal |
| Componente libre | `ctx.ui.custom(factory)` | Zona interactiva temporal |

**Regla de diseño:** empezá por `notify`/`setStatus`, seguí con `setWidget` y usá componentes personalizados sólo cuando necesites controlar renderizado o eventos de teclado. Pi ya tiene editor, renderer, gestión del foco y tema.

### 3.1. Cuatro modos que no deben confundirse

| Modo Pi | `ctx.hasUI` | `ctx.mode` | Capacidades útiles |
|---|---:|---|---|
| Interactivo | true | `tui` | Todas las funciones visuales de esta lección |
| Print | false | `print` | No hay diálogos ni header/footer |
| JSON | false | `json` | Eventos para aplicaciones consumidoras, no TUI |
| RPC | true | `rpc` | Algunas solicitudes UI se envían al cliente; **header, footer y `custom()` no son TUI real** |

En consecuencia, usar sólo `ctx.hasUI` para un panel interactivo es un error: **RPC puede tener `hasUI: true`**. Nuestra extensión exige `ctx.mode === 'tui'` para cualquier operación visual exclusiva de terminal.

Fuente principal: [Extensiones de Pi](https://pi.dev/docs/latest/extensions), [Terminal UI](https://pi.dev/docs/latest/tui), [RPC Extension UI](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-extension-ui.md).

## 4. Resultado de producto: Agent Harness Lab v0.10.0

Creamos dos archivos reales:

```text
.pi/
├── extensions/
│   ├── approval-guard.ts             # Lección 9, sin cambios
│   ├── lifecycle-observer.ts         # Lección 7, sin cambios
│   ├── workspace-inspector.ts        # Lección 8, sin cambios
│   └── operator-ui.ts                # NUEVO: extensión visual de Pi
└── ui/
    └── operator-state.mjs            # NUEVO: estado y presentación puros

tests/
└── operator-ui.test.mjs             # NUEVO: tests de UI simulada

examples/
└── tui-operator.md                  # NUEVO: práctica manual
```

No agregamos un framework de UI externo ni dependencias npm nuevas al CLI. El código de la extensión se ejecuta **dentro del proceso Pi**; la estructura `.pi/ui/` evita que Pi descubra por error el helper puro como una extensión independiente.

### 4.1. Estado mínimo y separado

Archivo `.pi/ui/operator-state.mjs`:

```js
export function createOperatorState() {
  return {
    runs: 0,
    toolCalls: 0,
    failures: 0,
    working: false,
    enabled: false,
    footer: false,
    placement: 'aboveEditor',
  };
}

export function recordOperatorEvent(state, event) {
  switch (event.type) {
    case 'agent_start':
      state.runs += 1;
      state.working = true;
      break;
    case 'tool_execution_end':
      state.toolCalls += 1;
      if (event.isError === true) state.failures += 1;
      break;
    case 'agent_settled':
      state.working = false;
      break;
    case 'session_start':
      state.runs = 0;
      state.toolCalls = 0;
      state.failures = 0;
      state.working = false;
      break;
  }
  return state;
}
```

**Por qué está fuera de la extensión:** podemos testear el estado sin inicializar Pi, un terminal ni un modelo. El estado es **efímero**. No persiste historiales, prompts, argumentos de tools, nombres de archivos sensibles ni credenciales. El nombre `runs` representa el número de eventos `agent_start`, no un identificador único de sesión ni un número de ejecuciones exitosas.

### 4.2. Observación del ciclo de vida

Archivo `.pi/extensions/operator-ui.ts` (fragmento del proyecto real):

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createOperatorState, recordOperatorEvent } from '../ui/operator-state.mjs';

export default function operatorUi(pi: ExtensionAPI) {
  const state = createOperatorState();

  pi.on('agent_start', (_event, ctx) => {
    recordOperatorEvent(state, { type: 'agent_start' });
    // Aquí sólo se actualiza presentación, no se autoriza ninguna Tool.
  });

  pi.on('tool_execution_end', (event, ctx) => {
    recordOperatorEvent(state, {
      type: 'tool_execution_end',
      isError: event.isError,
    });
  });
}
```

El archivo real también escucha `session_start` y `agent_settled`, y ejecuta `refresh(ctx)` cuando el dashboard está activado. `agent_settled` marca que terminó el trabajo corriente; no tiene que significar que todas las tools terminaron sin errores. El hook `tool_execution_end` contabiliza resultados de invocaciones, **no demuestra éxito**: para eso se usa la propiedad `isError`.

### 4.3. Estado y widget sin crear una segunda interfaz

```ts
function refresh(ctx: ExtensionContext) {
  if (ctx.mode !== 'tui' || !state.enabled) return;

  ctx.ui.setStatus('agent-lab', operatorStatus(state));
  const options = state.placement === 'belowEditor'
    ? { placement: 'belowEditor' }
    : undefined;

  ctx.ui.setWidget('agent-lab-dashboard', operatorWidget(state), options);
}
```

El **ID estable** evita crear múltiples widgets al refrescar. La variante `belowEditor` mueve el widget debajo del editor; con opciones omitidas conserva la posición predeterminada. No colocamos estas actualizaciones en un polling ni agregamos timers: el propio ciclo de vida de Pi brinda los eventos relevantes.

### 4.4. Header y footer: personalización, pero optativa

El encabezado se establece desde `setHeader`, usando el `theme` provisto por Pi:

```ts
ctx.ui.setHeader((_tui, theme) => ({
  render(width) {
    return [theme.fg('accent', 'Agent Harness Lab')];
  },
  invalidate() {},
}));
```

Al contrario que el status, `setHeader` **reemplaza** el encabezado original. El footer también reemplaza toda la información nativa (puede incluir rama, tokens, modelo, costes, etc.). Por eso **no** lo activamos automáticamente. Para restaurarlo:

```ts
ctx.ui.setHeader(undefined);
ctx.ui.setFooter(undefined);
ctx.ui.setStatus('agent-lab', undefined);
ctx.ui.setWidget('agent-lab-dashboard', undefined);
```

**Limitación funcional intencional:** si otras extensiones controlan el mismo header/footer, la última que lo establezca prevalece. No existe composición automática entre factories. Tampoco conocemos el título de ventana previo del terminal, por lo que al desactivar nuestra UI restauramos un título genérico (`Pi`).

### 4.5. Diálogos nativos y panel de teclado

En lugar de inventar un sistema de popups, utilizamos primero `select()` y luego `custom()` para la pantalla que realmente requiere renderizado propio:

```ts
pi.registerCommand('lab-panel', {
  description: 'Panel interactivo del operador',
  handler: async (_args, ctx) => {
    if (ctx.mode !== 'tui') return;

    const option = await ctx.ui.select('Agent Lab', [
      'Ver resumen', 'Cambiar posición del widget', 'Cancelar',
    ]);

    if (option !== 'Ver resumen') return;

    await ctx.ui.custom((_tui, _theme, keybindings, done) => ({
      render(width) {
        return [
          '=== AGENT HARNESS LAB ==='.slice(0, Math.max(0, width)),
          'Enter: cerrar | Esc: cancelar'.slice(0, Math.max(0, width)),
        ];
      },
      handleInput(data) {
        if (keybindings.matches(data, 'tui.select.confirm')) done(true);
        else if (keybindings.matches(data, 'tui.select.cancel')) done(false);
      },
      invalidate() {},
    }));
  },
});
```

Este fragmento está simplificado para aprender la estructura: el proyecto incluye además las estadísticas, el selector de ubicación y las funciones de recorte. Fijate en tres decisiones:

1. `ctx.ui.select` maneja el selector y su foco por nosotros.
2. `ctx.ui.custom` sólo toma control temporal; al ejecutar `done(...)` Pi recupera el editor.
3. `keybindings.matches` respeta las teclas configuradas en Pi; comparar crudos `'return'`/`'escape'` es más frágil.

Los componentes de ejemplo devuelven cadenas ASCII generadas localmente. En un componente más rico que use ANSI, caracteres de ancho variable o emoji, deberíamos importar `truncateToWidth` y otras utilidades de `@earendil-works/pi-tui`; **no** alcanza con cortar cadenas JavaScript usando `.slice()`.

### 4.6. Comandos disponibles

| Comando dentro de Pi | Efecto |
|---|---|
| `/lab-ui status` | Notifica contadores sin activar panel |
| `/lab-ui on` | Activa header, status y widget |
| `/lab-ui off` | Limpia UI y restablece header/footer nativos |
| `/lab-widget above` | Ubica widget por encima del editor |
| `/lab-widget below` | Ubica widget por debajo |
| `/lab-footer on` | **Reemplaza** el pie de Pi con resumen reducido |
| `/lab-footer off` | Restablece footer original |
| `/lab-panel` | Abre un selector y una pantalla interactiva |

**Aclaración:** estos comandos se escriben **dentro de Pi**, no después de `node dist/cli.js`. El CLI `agent-lab` continúa siendo un wrapper no interactivo; el modo TUI nativo lo provee `pi`.

## 5. Laboratorio guiado

### Paso A — Aplicar la actualización

```bash
git switch -c feature/module-02-lesson-05

git apply --check agent_harness_lab_modulo_02_leccion_05.patch
git apply agent_harness_lab_modulo_02_leccion_05.patch

npm install
npm test
npm run typecheck
```

Si hiciste cambios posteriores, revisá manualmente los conflictos: no reemplaces el repositorio por un snapshot más antiguo.

### Paso B — Explorar la extensión sin tokens

Desde la raíz del proyecto:

```bash
node dist/cli.js extensions list
node dist/cli.js run "Diagnóstico de interfaz" \
  --no-extensions \
  --extension .pi/extensions/operator-ui.ts \
  --dry-run
```

El `--dry-run` verifica cómo se pasaría el módulo a Pi, pero **no** abre la TUI ni demuestra que Pi lo haya cargado.

### Paso C — Abrir el terminal de Pi

```bash
pi --no-extensions --extension .pi/extensions/operator-ui.ts
```

Ahora, **dentro de Pi**, escribí:

```text
/lab-ui status
/lab-ui on
/lab-panel
/lab-widget below
/lab-footer on
/lab-footer off
/lab-ui off
```

**En Windows:** podés usar el comando en PowerShell en una línea, siempre que `pi` esté correctamente instalado. Para la vía de CLI `agent-lab`, la solución Windows anterior mantiene `pi-launcher.js` y `shell: false`. La TUI se ejecuta directamente en Pi, sin pasar por nuestro wrapper.

### Paso D — Probar cambios de estado

Activá `/lab-ui on`, pedí una operación de lectura simple y observá cómo cambian los contadores de turnos y herramientas. Para evitar modificar archivos accidentalmente, usá una carpeta de práctica o pedí una inspección read-only.

### Paso E — Volver a la interfaz original

Ejecutá `/lab-ui off`, comprobá que desaparezca el widget y que el encabezado y footer vuelvan a los nativos de Pi. La extensión sigue cargada (sus listeners aún pueden contar eventos), pero no muestra nada hasta activarla de nuevo.

## 6. Pruebas automatizadas

El test `tests/operator-ui.test.mjs` realiza dos cosas: comprueba la función pura de estado y simula las llamadas a `ExtensionAPI` y `ctx.ui`.

La suite comprueba:

1. Alta de comandos y listeners del ciclo de vida.
2. Dashboard desactivado por defecto: ninguna UI se modifica durante `session_start`.
3. Activar, actualizar y restaurar header/status/widget.
4. Elegir ubicación superior o inferior, sin duplicar widgets.
5. Activar y quitar footer reemplazado.
6. No intentar UI cuando `ctx.mode` es `print`, `json` o `rpc`.
7. Panel interactivo con cancelación y teclado configurable simulado.
8. Métricas sin guardar prompts ni contenidos de tools.
9. Restauración de UI ante `session_shutdown`.
10. Permanencia de todas las pruebas previas (regresión).

```bash
npm test
npm run typecheck
node --test tests/operator-ui.test.mjs
```

**Resultado en el entorno de generación:** 127 tests superados, 1 omitido por plataforma (Windows), 0 fallos. El compilador TypeScript del CLI pasó; los tests de la extensión usan `stripTypeScriptTypes` y dobles de la API. **No se verificó renderizado real ni autenticación de Pi en Windows.**

## 7. Ejercicio — US-LAB-010: Reiniciar contadores sin perder preferencias

**Historia:** como operador de un Agent Harness, quiero reiniciar el contador de turnos, herramientas y errores desde la propia TUI, sin perder la ubicación de mi widget ni desactivar el panel.

**Comando objetivo:**

```text
/lab-ui reset
```

**Criterios de aceptación**

1. Si había 3 turnos, 10 tools y 2 errores, luego de reset los tres indicadores valen 0.
2. La posición del widget (`above`/`below`) no cambia.
3. Si la UI estaba activada, se refresca inmediatamente.
4. En print/JSON/RPC no realiza operaciones visuales.
5. Se añade feedback visual sólo en TUI y tests aislados.
6. No persiste ningún dato en disco.

**Pistas:** el reducer actual ya contempla una transición `session_start` que reinicia contadores, pero conserva flags de presentación. Podés reutilizarla como operación de reset y ejecutar `refresh(ctx)`.

**Solución completa** (después de intentarlo): `solutions/modulo-02-leccion-05/`. Incluye copia de la extensión, helper y dos tests:

```bash
node --test solutions/modulo-02-leccion-05/tests/reset.test.mjs
```

No reemplaces el archivo base del proyecto por la solución hasta que hayas terminado el ejercicio, para evitar que se mezclen modificaciones con las próximas lecciones.

## 8. Preguntas de repaso

1. ¿Qué diferencia hay entre `notify()` y `setStatus()`? ¿Qué sucede si llamamos repetidamente a `setWidget()` con el mismo ID?
2. ¿Por qué un `ctx.hasUI === true` no alcanza para ejecutar `custom()`?
3. ¿Qué se pierde al habilitar un footer alternativo y cómo se restaura?
4. ¿Cuándo alcanza con `select()` y cuándo conviene `custom()`?
5. ¿Por qué no debemos mostrar prompts ni argumentos de herramientas en un dashboard por defecto?
6. ¿Qué limitaciones tienen los tests con dobles respecto del renderizado real en Windows Terminal?
7. ¿Qué parte de esta lección depende de Pi y cuál conserva nuestro harness?

### Respuestas orientativas

`notify()` es temporal, `setStatus()` mantiene un estado; un ID estable actualiza el mismo widget. `hasUI` también puede ser verdadero en RPC, así que para TUI completa se verifica `ctx.mode === 'tui'`. Un footer alternativo reemplaza el nativo; `setFooter(undefined)` lo restaura. Los diálogos simples permiten reutilizar navegación y foco de Pi, mientras que `custom()` justifica su uso para render/teclas propios. Evitamos mostrar datos sensibles porque el terminal se puede compartir o quedar registrado. Las pruebas mock no certifican colores, focus real ni compatibilidad exacta de un terminal Windows.

## 9. Decisiones de arquitectura (checkpoint)

- **No agregamos otro CLI.** Seguimos con `agent-lab` y el wrapper actual, pero usamos `pi` interactivo para la experiencia terminal.
- **No tocamos el núcleo de Pi.** Toda personalización vive en una extensión Pi.
- **La UI es opt-in.** Evitamos imponer look & feel y conservar comportamiento previo.
- **Nada de persistencia de la UI todavía.** Preferencias por sesión; futuras versiones podrán estudiar configuraciones, pero no se sobreingeniería ahora.
- **La UI no es seguridad.** Las aprobaciones siguen en el guard de la Lección 9 y la protección robusta requiere un límite de seguridad externo.
- **Los recursos visuales son controlados.** Usamos métricas agregadas, no texto del LLM ni parámetros de herramientas; no los volcamos automáticamente a logs.

### Limitaciones honestas

- Los listeners son pasivos; el panel no muestra datos de tokens/coste que Pi ya tiene en su interfaz. Si activás el footer alternativo, podrías ocultarlos.
- La fábrica de header/footer no se compone automáticamente con otras extensiones que reemplacen la misma región.
- La UI TUI real exige `ctx.mode === 'tui'`, no es portable tal cual a un frontend web o cliente RPC.
- Los tests ejercitan la lógica y el contrato simulado, no prueban una autenticación ni el renderer real de Pi.
- El ZIP completo de referencia puede no incluir tu `package-lock.json` o Skills personalizados. Preferí aplicar el patch o ZIP incremental sobre tu checkout real.

## 10. Recursos oficiales y referencias

- [Pi — Extensiones (API `ctx.ui`, comandos y lifecycle)](https://pi.dev/docs/latest/extensions)
- [Pi — Terminal UI (`@earendil-works/pi-tui` y componentes)](https://pi.dev/docs/latest/tui)
- [Pi — RPC Extension UI (diferencias TUI/RPC)](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-extension-ui.md)
- [Ejemplo oficial: custom-header.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-header.ts)
- [Ejemplo oficial: custom-footer.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-footer.ts)
- [Ejemplo oficial: tools.ts (settings con UI)](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tools.ts)
- [Proyecto del curso — agent-harness-lab](https://github.com/lucasjaviluna/agent-harness-lab)

## 11. Próxima lección

**Módulo 2 · Lección 6 (global 11) — Codemode, Tool Search y selección dinámica de herramientas.**
**Nivel:** Avanzado · **Complejidad:** Alta.

Estudiaremos qué capacidades proporciona Pi para descubrir o seleccionar herramientas dinámicamente. Sólo implementaremos lo que realmente sume al harness: el objetivo no es replicar mecánicas ya existentes.
