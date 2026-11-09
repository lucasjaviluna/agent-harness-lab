# Módulo 2 · Lección 1 — Skills y capacidades especializadas en Pi

**Curso:** Pi.dev — de cero a un Agent Harness sólido y extensible
**Módulo:** 2 — Extensibilidad
**Lección:** 1 de 6 (número global: 6 de 20)
**Nombre:** Skills y capacidades especializadas en Pi
**Nivel:** Intermedio
**Complejidad:** Media
**Duración sugerida:** 120–150 minutos
**Versión del laboratorio:** `agent-harness-lab` v0.6.0, incremental sobre v0.5.0
**Repositorio del usuario:** https://github.com/lucasjaviluna/agent-harness-lab

> **Estado de la base:** El `package.json` público y el `CHANGELOG.md` de la rama `main` fueron comprobados y publican v0.5.0. Como el entorno de elaboración no permite clonar el repositorio, el patch se prepara contra el ZIP v0.5.0 de la Lección 5. Se conservaron los mecanismos de invocación de Pi para Windows, y NO se deben sobrescribir Skills personales como `.agents/skills/ytk-memory`.

## 1. Objetivos de aprendizaje

Al completar esta lección podrás:

1. Explicar por qué Pi tiene Skills y cómo reducen el contexto inicial.
2. Elegir entre `AGENTS.md`, prompt templates, Skills y extensiones.
3. Crear una Skill portable siguiendo Agent Skills, con `SKILL.md`, referencias y assets.
4. Comprender el descubrimiento de Skills en directorios globales, de proyecto y paquetes.
5. Invocar una Skill automáticamente (cuando el modelo la elige) o explícitamente con `/skill:nombre`.
6. Diferenciar descubrimiento, carga del documento, uso de scripts y permisos de herramientas.
7. Consumir los flags nativos `--skill` y `--no-skills` desde nuestro CLI.
8. Ejecutar una batería de tests sin romper el manejo previo de Windows.

**Entregable de producto:** v0.6.0 incorpora `agent-lab skills list`, `--skill` (repetible), `--no-skills`, dos Skills de ejemplo, tests y un script Node portable. NO incorpora todavía un motor de autorización ni un registro alternativo de Skills.

## 2. El problema que resuelven las Skills

En el Módulo 1 incorporamos `AGENTS.md`, instrucciones adicionales y templates. Esos recursos son útiles, pero no querríamos incluir decenas de páginas de conocimientos especializados en todos los prompts.

Las Skills permiten mantener un **índice compacto de capacidades**: al iniciar Pi, el modelo ve los nombres, descripciones y ubicaciones de Skills disponibles. Cuando una tarea lo justifica, el agente puede utilizar `read` para consultar el `SKILL.md` completo. Las referencias y assets del skill permanecen fuera del contexto hasta que sean necesarios.

```text
Antes del primer turno
  Pi → nombre + descripción + ruta de Skills
                       │
                tarea del usuario
                       ▼
          modelo decide una Skill
                       ▼
            read(SKILL.md)
                       ▼
      read(references/...) según necesidad
                       ▼
        herramientas normales de Pi
                       ▼
                  respuesta
```

Se conoce como **progressive disclosure**. No es que la Skill se ejecute automáticamente como una función: el agente lee instrucciones y decide qué hacer con sus herramientas normales. Las Skills tampoco son un SDK ni un nuevo tipo de herramienta.

### 2.1. Cuándo usar cada mecanismo

| Necesidad | Primera elección | Motivo |
|---|---|---|
| Convenciones generales de un repositorio | `AGENTS.md` | Instrucciones permanentes del contexto del proyecto |
| Repetir una instrucción corta | Prompt template | Inserta texto en un comando `/nombre` |
| Flujo especializado con guías, scripts o assets | **Skill** | Carga progresiva por tarea |
| Registrar un tool, interceptar eventos o solicitar aprobación | Extension | Código TypeScript integrado al runtime |
| Ejecutar Pi desde un proceso externo | CLI / RPC / SDK | Contrato de integración, no una Skill |

**Regla de arquitectura:** si Pi soporta la Skill de forma nativa, la nuestra CLI debe limitarse a facilitar su selección; no construimos un segundo loader de Skills.

## 3. Estructura de una Skill portable

Una Skill es, preferentemente, una carpeta con un archivo `SKILL.md`:

```text
.agents/skills/
├── agent-review/
│   ├── SKILL.md
│   ├── references/
│   │   └── checklist.md
│   └── assets/
│       └── report.template.md
└── test-triage/
    ├── SKILL.md
    ├── references/
    │   └── diagnosis.md
    └── scripts/
        └── summarize-test-log.mjs
```

El frontmatter mínimo contiene `name` y `description`:

```markdown
---
name: agent-review
description: Revisar código TypeScript/JavaScript en busca de bugs, regresiones y riesgos. Usar cuando se solicita un code review o análisis de un PR.
---

# Revisión técnica incremental

1. Determinar alcance y archivos afectados.
2. Consultar `references/checklist.md` si corresponde.
3. Leer el código y evaluar fallos reproducibles.
4. Informar cada hallazgo con severidad, archivo y evidencia.
```

En nuestro repositorio incluimos una variante más detallada. La descripción debe indicar **qué hace** y **cuándo se usa**: expresiones vagas como “Ayuda al desarrollar” disminuyen las chances de selección correcta.

### 3.1. Reglas y campos útiles

- `name`: minúsculas, números y guiones simples, hasta 64 caracteres.
- `description`: texto claro, hasta 1024 caracteres.
- `disable-model-invocation: true`: oculta la Skill de selección automática; sigue disponible mediante invocación explícita.
- `compatibility`, `metadata` y `license`: metadatos opcionales.
- `allowed-tools`: campo experimental; **no debe interpretarse como una política universal de permisos**.

La implementación de Pi es flexible con algunas diferencias respecto de Agent Skills; para la portabilidad alineamos nombre declarado y nombre de carpeta.

## 4. Descubrimiento, selección y confianza

Pi descubre Skills desde ubicaciones como:

- `~/.pi/agent/skills/` y `~/.agents/skills/` a nivel usuario.
- `.pi/skills/` en el proyecto confiable.
- `.agents/skills/` desde el directorio de trabajo y ancestros hasta la raíz del repositorio.
- Recursos aportados por paquetes y rutas definidas explícitamente.

El descubrimiento automático **no garantiza** que el modelo utilice la Skill. La Skill se puede forzar en Pi interactivo escribiendo:

```text
/skill:agent-review revisar src/runtime.ts sin modificar código
```

Luego de editar una Skill con una sesión abierta, utilizá `/reload` para actualizar los recursos cargados.

Las Skills de un proyecto no confiable pueden no cargarse hasta aprobar la confianza del proyecto. **No** se debe forzar esa aprobación desde el harness. Leé primero Skills ajenas, sus scripts y referencias.

### 4.1. Diferenciar descubrimiento de ejecución

`--skill ruta` indica a Pi que cargue la **definición del recurso**, pero no obliga al modelo a seguir sus instrucciones ante cualquier prompt. `--no-skills` deshabilita el descubrimiento implícito; las rutas explícitas `--skill` siguen siendo aditivas.

`disable-model-invocation: true` significa que la Skill sólo se expone cuando el usuario la invoca explícitamente (p. ej. `/skill:test-triage`), no que tenga mayor nivel de seguridad.

### 4.2. Las tools condicionan lo que una Skill puede hacer

La configuración inicial del laboratorio mantiene herramientas de lectura:

```json
{"pi":{"tools":["read","grep","find","ls"],"disableMcp":true,"disableExtensions":true}}
```

Una Skill que indique “ejecutá `node scripts/foo.mjs`” **no podrá hacerlo automáticamente si `bash` no está habilitada**. El script de `test-triage` se ejecuta manualmente en esta lección, para mantener la política conservadora. En etapas posteriores estudiaremos tools autorizadas y aprobaciones humanas.

## 5. Dos Skills para aprender por comparación

### Skill A: `agent-review` — uso automático posible

Ubicación: `.agents/skills/agent-review/SKILL.md`.

Incluye una lista de comprobación de correctitud, seguridad, portabilidad Windows y tests, además de una plantilla de informe. No puede modificar archivos por sí sola: sus instrucciones orientan al modelo.

**Ejercicio corto:** iniciá Pi interactivo desde la raíz del repositorio, revisá y aceptá la confianza si corresponde, y solicitá:

```text
Revisa src/runtime.ts buscando regresiones, shell injection y problemas de compatibilidad con Windows. No cambies archivos.
```

Después compará el resultado con:

```text
/skill:agent-review revisar src/runtime.ts sin modificar archivos
```

Observá si el modelo leyó realmente el `SKILL.md` y si consultó `references/checklist.md`. No basta con que el texto final se parezca a nuestras instrucciones para demostrar la carga.

### Skill B: `test-triage` — invocación explícita

Ubicación: `.agents/skills/test-triage/SKILL.md`.

Esta Skill usa `disable-model-invocation: true`. Probala en Pi interactivo:

```text
/skill:test-triage explica cómo investigar un error ENOENT que sólo aparece en Windows
```

Incluye un script de ejemplo que lee un log sintético de `node:test`:

```bash
node .agents/skills/test-triage/scripts/summarize-test-log.mjs examples/skills/node-test-example.log
```

Salida esperada:

```text
# tests 12
# pass 10
# fail 1
# skipped 1
```

El script no instala dependencias, no llama a internet, no inicia procesos hijos y funciona con Node en Windows, Linux y macOS.

## 6. Evolución del Agent Harness Lab v0.6.0

### 6.1. CLI — nuevos comandos

```bash
# Inventario local de Skills en el proyecto (no llama al modelo)
node dist/cli.js skills list

# Ruta explícita, validación local, sin consumo de tokens
node dist/cli.js run "Revisa este módulo" \
  --skill .agents/skills/agent-review --dry-run

# Deshabilitar descubrimiento implícito y conservar una Skill explícita
node dist/cli.js run "Analiza el error" \
  --no-skills \
  --skill .agents/skills/test-triage \
  --dry-run

# Pasar también argumentos en modo JSON
node dist/cli.js run-file examples/prompts/review.md \
  --mode json --skill .agents/skills/agent-review --dry-run
```

`skills list` inspecciona exclusivamente `.agents/skills` y `.pi/skills` del directorio actual. **No** incluye Skills globales, ancestros, paquetes ni demuestra que Pi las haya cargado. Su objetivo es facilitar el trabajo local sin duplicar el loader.

### 6.2. Código — `src/skill-options.ts`

```typescript
export interface SkillOptions {
  paths?: string[];
  noSkills?: boolean;
}

export function buildSkillArgs(cwd: string, options: SkillOptions = {}): string[] {
  const args: string[] = [];
  if (options.noSkills) args.push('--no-skills');
  // Cada ruta es validada antes de pasarla a Pi como --skill <path>.
  // La implementación completa está en src/skill-options.ts.
  return args;
}
```

El runtime compone los argumentos con una llamada pequeña:

```typescript
args.push(...buildSkillArgs(cwd, skills));
```

El adaptador conserva `spawn(..., { shell: false })`, el fallback de `pi-launcher.js` para Windows y los modos `print` / `json`.

### 6.3. Código — `src/skills-report.ts`

El inventario lee únicamente metadatos estáticos de `SKILL.md`, sin ejecutar scripts. El parser de frontmatter se limita a campos sencillos; **no es un parser YAML completo**. El reconocimiento final de Skills y las advertencias del estándar siguen siendo responsabilidad de Pi.

### 6.4. ¿Por qué no incorporamos un SkillRegistry propio?

Porque Pi ya descubre, publica y carga Skills. Duplicar ese comportamiento introduciría problemas de precedencia, colisiones y trust. Más adelante podríamos necesitar un catálogo corporativo para administrar o distribuir Skills, pero eso es otro problema y no es necesario para aprender esta capacidad.

## 7. Pruebas y validación

El proyecto incorpora `tests/skills.test.mjs` con casos de:

- Inventario local en `.agents/skills` y `.pi/skills`.
- Proyecto sin Skills, lectura de metadatos y campos opcionales.
- `--skill` repetible, con espacios y deduplicación.
- `--no-skills` combinado con Skills explícitas.
- Integración con print, JSON y `run-file`.
- Rechazo de rutas inexistentes, carpetas sin `SKILL.md` y flags en comandos incorrectos.
- Preservación de prompts con caracteres `&` y `|` sin habilitar shell.
- Ejecución del script Node portable.

Ejecutá:

```bash
npm install
npm test
npm run typecheck
node dist/cli.js skills list
node dist/cli.js run "Hola" --no-skills --dry-run
```

En el entorno de preparación: **75 tests superados, 1 omitido por plataforma, 0 fallidos**, con la solución del ejercicio **78 superados, 1 omitido**. El test omitido es el específico de Windows, que debe ejecutarse en tu entorno Windows real. Los tests usan un Pi simulado; **no se verificó autenticación real ni selección automática con un LLM**.

## 8. Ejercicio integrador — US-LAB-006

### Historia de usuario

> Como desarrollador del harness quiero ejecutar `agent-lab skills check` para validar previamente las Skills locales y detectar errores de estructura antes de usarlas.

### Criterios de aceptación

1. `agent-lab skills check` devuelve JSON con `{ok, checked, problems}`.
2. Cuando no hay Skills, el resultado es válido: `ok: true, checked: 0`.
3. Rechaza names vacíos, con mayúsculas, con guiones dobles o superiores a 64 caracteres.
4. Rechaza `description` vacía o superior a 1024 caracteres.
5. Marca duplicados entre `.agents/skills` y `.pi/skills`.
6. Advierte si el nombre declarado no coincide con la carpeta (portabilidad).
7. Marca un `SKILL.md` sin cuerpo útil.
8. Devuelve exit code 0 cuando todo está bien y 1 cuando hay problemas.
9. No ejecuta Pi ni scripts de Skills.
10. Mantiene todos los tests existentes y compatibilidad Windows.

### Pasos sugeridos

1. Creá `src/skills-check.ts` y reutilizá `listProjectSkills(cwd)`.
2. Para cada Skill validá nombre, descripción, carpeta y cuerpo.
3. Incorporá `skills check` en `src/cli.ts`; conserva `skills list`.
4. Escribí al menos tres tests negativos/positivos.
5. Ejecutá tests y typecheck.

### Solución

El directorio `solutions/modulo-02-leccion-01/` contiene **la implementación completa** y sus tests, separados del código productivo para no resolver el ejercicio antes de tiempo. Instrucciones para aplicarla: `solutions/modulo-02-leccion-01/README.md`.

## 9. Preguntas de repaso

1. ¿Por qué una descripción específica ayuda a seleccionar mejor una Skill?
2. ¿Qué carga Pi inicialmente y qué carga solamente cuando lo necesita?
3. ¿Por qué `--skill` no asegura la ejecución de los scripts incluidos?
4. ¿Qué diferencia hay entre `--no-skills` y `disable-model-invocation: true`?
5. ¿Qué ventaja aporta `.agents/skills` frente a un mecanismo exclusivo del harness?
6. ¿Por qué `skills list` no se usa como fuente de verdad del descubrimiento de Pi?
7. ¿Cómo afectaría a una Skill de testing que `bash` no esté disponible?
8. ¿Qué controles de seguridad siguen faltando para que el harness sea profesional?

## 10. Recursos oficiales y lectura recomendada

1. [Pi: Skills](https://pi.dev/docs/latest/skills) — estructura, descubrimiento y progressive disclosure.
2. [Pi: CLI](https://pi.dev/docs/latest/cli) — flags `--skill` y `--no-skills`.
3. [Pi: Settings](https://pi.dev/docs/latest/settings) — configuración y recursos.
4. [Pi: Packages](https://pi.dev/docs/latest/packages) — distribución de Skills.
5. [Agent Skills Specification](https://agentskills.io/specification) — formato portable.
6. [Pi: Extensions](https://pi.dev/docs/latest/extensions) — siguiente mecanismo de extensibilidad.

## 11. Próxima lección

**Módulo 2 · Lección 2 — Extensiones TypeScript: Extension API, lifecycle y comandos personalizados.**
**Nivel:** Intermedio · **Complejidad:** Media–Alta.

Aprenderemos a registrar una extensión real de Pi, observar eventos e introducir comportamiento programático sin duplicar el Agent Loop. Esto todavía no implica establecer un framework de workflows ni aprobar acciones de manera automática.
