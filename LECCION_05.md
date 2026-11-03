# Módulo 1 · Lección 5 — Context Engineering, AGENTS.md, system prompts y prompt templates

**Curso:** Pi.dev, de cero a un Agent Harness extensible
**Módulo:** 1 — Fundamentos
**Lección:** 5 de 5
**Nivel:** Principiante–Intermedio
**Complejidad:** Media
**Duración de estudio sugerida:** 120–150 minutos
**Código:** Agent Harness Lab **v0.5.0**, sobre **v0.4.0**
**Repositorio de referencia:** https://github.com/lucasjaviluna/agent-harness-lab

> Advertencia de integración: al preparar esta lección, el `main` público seguía en v0.3.0. Primero aplicá la Lección 4. El ZIP full de esta lección es un snapshot basado en la v0.4.0 anterior, no un reemplazo de archivos personales o skills del repositorio.

## 1. Metas de aprendizaje y resultado práctico

Al completar el módulo deberías poder explicar qué información llega al modelo antes de un turno, distinguir distintos tipos de recursos y construir instrucciones reutilizables mediante archivos y flags nativos de Pi. En el laboratorio incorporamos un comando de diagnóstico orientativo de recursos, la posibilidad de anexar instrucciones por ejecución, un flag para desactivar descubrimiento de instrucciones y dos templates.

**No** vamos a implementar un constructor de system prompts alternativo al de Pi: sería duplicación y agregaría divergencia con el runtime. Tampoco construiremos aprobación humana mediante Markdown; requiere guardrails técnicos y pertenece a módulos posteriores.

## 2. Context Engineering: ¿qué recibe el modelo?

A grandes rasgos, una solicitud de Pi combina: (a) instrucciones del sistema, (b) instrucciones descubiertas en archivos del entorno, (c) definiciones de tools, (d) historial de la rama activa de la sesión y (e) mensaje/archivos seleccionados por el usuario. Skills y extensiones pueden ampliar o transformar esa composición.

```
Prompt del usuario
  ├─ System prompt base de Pi (o SYSTEM.md)
  ├─ Instrucciones adicionales (APPEND_SYSTEM.md / --append-system-prompt)
  ├─ Context files globales, padres y cwd (AGENTS.md, CLAUDE.md)
  ├─ Descripciones de tools y skills disponibles
  └─ Historial de sesión (rama activa; Lección 4)
        ↓
     Modelo LLM  → tool calls → Pi → resultados → modelo
```

**No es lo mismo información de referencia que control de ejecución.** Una instrucción como «no editar archivos» orienta al modelo, pero si la herramienta `write` sigue disponible puede ser invocada. Más adelante veremos políticas y gates efectivos.

## 3. Archivos de contexto: AGENTS.md y jerarquía

Pi admite contexto a nivel usuario, ancestros y directorio de trabajo. En el agent-dir (por defecto `~/.pi/agent`) puede haber `AGENTS.md`. También puede haber archivos `AGENTS.md` en directorios padres y en el propio cwd. Pi selecciona la variante `AGENTS.override.md` sobre `AGENTS.md`/`CLAUDE.md` **dentro del mismo directorio**, pero no elimina instrucciones globales u otros ancestros.

Ejemplo:

```
~/.pi/agent/AGENTS.md                    # instrucciones personales
repos/AGENTS.md                         # convenciones para repos debajo
repos/agent-harness-lab/AGENTS.md       # convenciones de este repositorio
repos/agent-harness-lab/src/AGENTS.md   # no asumir descubrimiento recursivo automático
```

La carpeta desde donde ejecutás Pi importa. Si trabajás desde `repos/agent-harness-lab`, Pi carga los archivos aplicables a ese cwd. No asumas que escanea todos los subdirectorios buscando AGENTS recursivamente.

El repositorio ya posee `AGENTS.md`: explica límites arquitectónicos, testing, la separación del CLI y el runtime y cuidados sobre secretos. Revisalo antes de ejecutar agentes que modifiquen código.

### Mini-lab 3.1

1. Abrí `AGENTS.md` y describí qué instrucciones son convenciones y cuáles no son seguridad efectiva.
2. Creá **fuera del repositorio** una carpeta de prueba con un AGENTS.md y un AGENTS.override.md diferentes.
3. Ejecutá Pi desde esa carpeta y pedile identificar cuál instrucción específica se aplicó. No uses esto como prueba formal de aislamiento: el modelo puede responder incorrectamente.

## 4. SYSTEM.md vs APPEND_SYSTEM.md

| Archivo | Ubicación | Comportamiento |
|---|---|---|
| `SYSTEM.md` | `~/.pi/agent/` o `.pi/` | Reemplaza la apertura del prompt base de Pi; no elimina necesariamente definiciones de tools/contexto |
| `APPEND_SYSTEM.md` | `~/.pi/agent/` o `.pi/` | Añade instrucciones sin desplazar el prompt base |
| `AGENTS.md` | agent-dir, ancestros, cwd | Contexto de convenciones/proyecto, combinable con otros archivos |

En Pi 1.0, cuando existen versiones de `SYSTEM.md` / `APPEND_SYSTEM.md` en el proyecto y globales, la versión de proyecto confiable prevalece sobre la global; no se concatenan las del mismo nombre en ambos niveles. Usá `APPEND_SYSTEM.md` para extender de forma mínima antes que reemplazar el prompt.

Agregamos `.pi/APPEND_SYSTEM.md` con cuatro pautas de trabajo (cambios pequeños, comprensión de tests, secretos y evidencia). **Pi sólo carga esos recursos de proyecto después de que confíes en él**. No hacemos `--approve` automáticamente desde `agent-lab`.

### Mini-lab 4.1

En un proyecto de prueba: pedile al agente una tarea y compará el resultado con y sin `.pi/APPEND_SYSTEM.md`, tras revisar y confiar explícitamente en el proyecto. Para que los cambios de recurso se apliquen dentro de una sesión Pi activa, utilizá `/reload`.

## 5. Prompt templates: comandos sin código

Un archivo `.pi/prompts/review.md` se convierte en el comando `/review` cuando Pi carga los recursos de proyecto. Por ejemplo:

```markdown
---
description: Analizar cambios locales y riesgos de regresión
argument-hint: "[foco]"
---

Revisa los cambios del proyecto con foco en ${1:-correctitud, regresiones y seguridad}.
No edites archivos. Presenta hallazgos ordenados por gravedad con rutas concretas.
```

Comandos del laboratorio (en **Pi interactivo**):

```text
/review
/review "compatibilidad con Windows"
/plan implementar un comando de historial de ejecuciones
```

El template `/plan` usa `$@` para insertar todos los argumentos y `/review` usa `${1:-valor}` como primer argumento con valor predeterminado. Los templates son sustitución de texto **antes** de enviar el mensaje; no son herramientas ejecutables ni workflows transaccionales. Para recargarlos, `/reload`.

### Importante sobre trust y ejecución por CLI

La ruta `.pi/prompts/` está protegida por el mecanismo de confianza del proyecto. Si Pi se inicia de forma no interactiva sin confianza previa, **no asumas que estas plantillas se cargaron**. Para aprenderlas, ejecutá `pi` en modo interactivo, inspeccioná las instrucciones y aceptá conscientemente el trust. No introducimos `--approve` por defecto en nuestro CLI.

El comando `agent-lab run '/review'` no es la forma recomendada de probar la expansión de comandos interactivos; usá la interfaz Pi hasta que estudiemos su API de entrada más profundamente.

## 6. Contexto por ejecución: `--append-instructions`

Pi ya implementa `--append-system-prompt <text|path>`; nuestra CLI sólo agrega validación de archivos y compone los argumentos.

**Ejemplo de uso:**

```bash
# No consume tokens
node dist/cli.js run "Revisa la arquitectura" \
  --append-instructions examples/instructions/code-review.md \
  --dry-run

# Combinar dos archivos sin sobrescribir AGENTS.md
node dist/cli.js run-file examples/context-experiment.md \
  --append-instructions examples/instructions/code-review.md \
  --append-instructions examples/instructions/test-first.md \
  --mode json --dry-run
```

Código relevante en `src/context-options.ts`:

```ts
export interface ContextOptions {
  appendInstructions?: string[];
  noContextFiles?: boolean;
}

export function buildContextArgs(cwd: string, options: ContextOptions = {}): string[] {
  const args: string[] = [];
  if (options.noContextFiles) args.push('--no-context-files');
  for (const rawPath of options.appendInstructions ?? []) {
    const path = resolve(cwd, rawPath);
    // se valida existencia, tipo archivo, tamaño y contenido no vacío
    args.push('--append-system-prompt', path);
  }
  return args;
}
```

La implementación completa limita archivos a 64 KiB para evitar errores accidentales en este laboratorio; no es un límite de Pi. Resolvemos rutas absolutas porque los argumentos se pasan a otro proceso; evitamos problemas con directorios de trabajo y espacios en Windows. Los argumentos se pasan mediante `spawn()` con `shell: false` (Lección 1 + arreglos Windows).

`--no-context-files` **sólo** desactiva descubrimiento de archivos de contexto AGENTS/CLAUDE. No significa «sin system prompt», no desactiva herramientas, ni evita instrucciones añadidas de otras formas. Ejemplo:

```bash
node dist/cli.js run "Describe el proyecto" --no-context-files --dry-run
```

No confundas `--no-context-files`, `--no-extensions`, `--no-skills`, `--no-prompt-templates` y `--no-mcp`: tienen ámbitos distintos. En esta lección implementamos sólo el primero; los demás están documentados en la referencia CLI oficial.

### Ejercicio guiado 6.1 — Rutas y seguridad

1. Ejecutá un dry-run con un Markdown válido.
2. Probá un archivo inexistente, uno vacío y una carpeta. Todos deben fallar **antes** de ejecutar Pi.
3. Probá rutas con espacios.
4. Pasá un prompt que contenga `&`, `|`, comillas o `&&`; comprobá que no se interprete como shell.
5. Probá `--mode json` y `run-file` para verificar que todos los argumentos se conserven.

## 7. Diagnóstico offline: `agent-lab context`

```bash
node dist/cli.js context
```

Entrega un reporte JSON de lo que existe en el **directorio de trabajo actual**:

```json
{
  "scope": "working-directory-only",
  "cwd": "/ruta/al/proyecto",
  "contextFiles": ["AGENTS.md"],
  "projectSystemPrompt": null,
  "projectAppendSystemPrompt": ".pi/APPEND_SYSTEM.md",
  "promptTemplates": [".pi/prompts/plan.md", ".pi/prompts/review.md"],
  "requiresProjectTrust": true,
  "notes": ["..."]
}
```

**No** lee ni imprime instrucciones. Tampoco asegura que Pi las haya cargado, no contempla ancestros ni globales, no evalúa el trust real, ni analiza `.agents/skills`. Esto es deliberado: no vamos a escribir una réplica incompleta de `ResourceLoader`/context discovery de Pi. Más adelante veremos inspección efectiva mediante SDK o extensiones.

`requiresProjectTrust` indica presencia de al menos uno de los recursos `.pi` detectados en este directorio; no afirma que el proyecto **esté** confiado ni que sean todos los recursos sujetos a trust.

## 8. Experimento completo (sin y con modelo)

### Preparación (sin tokens)

```bash
npm install
npm test
npm run typecheck
node dist/cli.js context
node dist/cli.js run "Analiza este código" \
  --append-instructions examples/instructions/code-review.md \
  --no-context-files --dry-run
```

### Experimento con Pi real

```bash
# Primero: abrir Pi, revisar archivos de proyecto y decidir el trust
pi
# Dentro de Pi:
/review "errores de tipos y regresiones Windows"
/plan "agregar diagnóstico de contexto"

# Segundo: ejecutar desde agent-lab cuando Pi esté instalado y autenticado
node dist/cli.js run-file examples/context-experiment.md \
  --append-instructions examples/instructions/code-review.md \
  --mode json
```

En Windows, los comandos se pueden ejecutar desde PowerShell adaptando la continuación de línea, o escribirlos en una sola línea. Conservamos el `pi-launcher.js` del runtime anterior: ningún cambio de esta lección sustituye esa lógica.

### Qué medir

- ¿Qué instrucciones se cumplen consistentemente? ¿Cuáles son ambiguas?
- ¿Cuándo es mejor `AGENTS.md` frente a un flag por tarea?
- ¿Qué comportamientos se pierden si desactivás `--no-context-files`?
- ¿Cómo distinguirías una preferencia del modelo de una política técnica obligatoria?

## 9. Ejercicio de implementación US-LAB-005

**Historia:** Como desarrollador quiero poder verificar el formato básico de los prompt templates locales antes de utilizarlos.

**Implementar:** `agent-lab context check`. Reutilizá `inspectProjectContext()` y creá un módulo `src/context-check.ts` separado. El comando debe validar los archivos `.pi/prompts/*.md` locales.

**Criterios de aceptación:**

1. `context` conserva la salida JSON actual.
2. `context check` detecta un template sin frontmatter delimitado por `---`.
3. Detecta falta de `description:` no vacía.
4. Detecta un cuerpo vacío.
5. Imprime `{ok, checked, errors}`.
6. Sale con código 0 si todos son válidos, con código 2 si hay errores de formato.
7. No activa Pi ni modifica archivos, credenciales o trust.
8. Mantiene todos los tests existentes, incluidos los de Windows.

**Pistas:** una expresión regular básica sirve para este ejercicio, pero no implementes un parser YAML de propósito general. Probá las rutas en un directorio temporal.

**Solución completa:** `solutions/modulo-01-leccion-05/README.md`, `src/context-check.ts`, `src/cli.ts` y `tests/context-check.test.mjs` (separados de `src/` del proyecto para que resuelvas antes de copiar).

## 10. Validación de la entrega

Ejecutar `npm test` debe mantener toda la suite anterior más los nuevos tests de contexto. También debe funcionar `npm run typecheck`.

Este entorno puede ejecutar mocks, no una sesión autenticada del modelo. **La prueba de carga efectiva de prompts y trust requiere abrir Pi en tu equipo.** En Windows, volver a ejecutar los tests específicos del launcher y un prompt real.

## 11. Fuentes oficiales (consultadas para la lección)

- [Cómo funciona Pi](https://pi.dev/docs/latest/how-pi-works)
- [Configuración y context files](https://pi.dev/docs/latest/configuration)
- [Prompt templates](https://pi.dev/docs/latest/prompt-templates)
- [Referencia CLI: flags de contexto](https://pi.dev/docs/latest/cli)
- [Seguridad y Project Trust](https://pi.dev/docs/latest/security)
- [Extensiones: before_agent_start y contexto](https://pi.dev/docs/latest/extensions)

## 12. Resumen y siguiente etapa

**Regla central:** primero utilizar las primitivas reales de Pi; agregar un contrato propio únicamente si mejora usabilidad, validación o integración. Evitar que el harness duplique la composición del contexto o trate instrucciones Markdown como restricciones de seguridad.

Con esta lección concluye **Módulo 1 — Fundamentos (5 lecciones)**. Quedan **3 módulos (15 lecciones)** en la estructura definitiva del curso:

- **Módulo 2 — Extensibilidad:** 6 lecciones, de skills y extensions a custom tools, policies, TUI y tool search/codemode.
- **Módulo 3 — Integración:** 5 lecciones, de MCP y SDK a RPC, memoria/contexto y workflows.
- **Módulo 4 — Producción:** 4 lecciones, de controles y SDD a subagentes y distribución/observabilidad.

El temario conceptual original de 20 temas no cambia; se organiza formalmente como **4 módulos de 5 + 6 + 5 + 4 lecciones** para que la nomenclatura sea inequívoca.
