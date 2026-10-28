# Módulo 1 · Lección 1 — Fundamentos de Pi y construcción del primer Agent Harness

| Campo | Valor |
|---|---|
| Curso | Pi.dev: de cero a Agent Harness profesional |
| Módulo | **1 — Fundamentos de Pi** |
| Lección | **1 — Fundamentos de Pi y construcción del primer Agent Harness** |
| Nivel | **Principiante** |
| Complejidad | **Baja** |
| Tiempo estimado | **90–120 minutos** |
| Artefacto | **Agent Harness Lab v0.1.0** |
| Fecha de referencias | **27 de octubre de 2026** |

> **Propósito:** entender el runtime agéntico y entregar la primera versión ejecutable de un harness propio, separado de proyectos previos. El código es educativo pero real, está organizado para evolucionar y tiene tests automatizados.

## 1. Objetivos y criterios de finalización

Al finalizar, deberías poder:

1. Distinguir claramente modelo, agente, agente de coding y harness.
2. Explicar paso por paso un Agent Loop que utiliza herramientas.
3. Instalar Pi y elegir un proveedor/modelo.
4. Distinguir modos interactivo, `--print`, JSON, RPC y SDK.
5. Ejecutar el CLI `agent-lab` sobre Pi sin implementar otro Agent Loop.
6. Modificar una configuración JSON de manera validada, diagnosticar disponibilidad del binario y verificar el resultado mediante tests que no requieren credenciales.
7. Reconocer la diferencia entre restringir *herramientas declaradas al modelo* y aplicar *políticas de seguridad efectivas*.

### Qué **no** implementaremos todavía

Ni plan mode, ni workflows, ni agentes múltiples, ni memorias RAG, ni TUI propia, ni sistema de permisos completo. Antes vamos a dominar el contrato básico entre nuestro CLI y Pi.

## 2. Fundamentos: de un LLM a un harness

**Modelo:** genera texto y solicitudes estructuradas de ejecución de herramientas; por sí solo no tiene acceso a archivos ni procesos.

**Herramienta (tool):** operación que el runtime permite invocar, por ejemplo leer un archivo. Es el harness/runtime quien ejecuta realmente la operación y devuelve el resultado al modelo.

**Agent Loop:** ciclo por el que el modelo recibe contexto, responde, opcionalmente pide herramientas, recibe sus resultados y vuelve a decidir. Finaliza al producir una respuesta final, interrumpirse o sufrir un error.

**Agent Harness:** entorno que organiza ese ciclo: modelo, herramientas, sesión, contexto, interfaz, extensiones y políticas. Pi ya aporta esta infraestructura; el propósito de nuestro producto es controlarla y especializarla, no duplicarla.

Ejemplo de un ciclo:

```text
Usuario: "Revisá la arquitectura del proyecto"
        |
        v
Pi: construye contexto (instrucciones, historial, tools disponibles)
        |
        v
Modelo: decide solicitar "ls" y "read"
        |
        v
Pi: ejecuta y entrega resultados al modelo
        |
        v
Modelo: analiza y produce respuesta final
        |
        v
Pi: muestra o devuelve la respuesta
```

Una tool puede producir un error. En ese caso, el agente puede inspeccionarlo, tomar otra decisión y continuar. Esto explica por qué la respuesta del modelo *no* equivale a toda la ejecución.

### 2.1. Diferencias entre los componentes

| Pieza | ¿Quién la aporta inicialmente? | Función |
|---|---|---|
| LLM y proveedor | Proveedor configurado en Pi | Inferencia y llamadas de herramientas |
| Agent Loop | Pi | Coordinar turnos, tools y resultados |
| Herramientas de archivos | Pi | `read`, `write`, `edit`, `grep`, `find`, `ls` |
| Ejecución de comandos | Pi | `bash` o equivalente según plataforma |
| Sesiones | Pi | Contexto e historial de ejecución |
| Prompt/contexto | Pi + proyecto | Instrucciones y recursos disponibles |
| Nuestro CLI `agent-lab` | Agent Harness Lab | Definir cómo se invoca Pi y exponer configuración |
| Políticas obligatorias | Futuro módulo | Aprobaciones, aislamiento, control y auditoría |

**Decisión arquitectónica:** el primer adaptador de Pi será un **proceso externo**. Más adelante compararemos esta alternativa con SDK y RPC antes de elegir una arquitectura de producción.

## 3. Instalar y usar Pi sin nuestro harness

Pi documenta npm como opción de instalación y requiere Node.js 22.19 o superior para esa vía.

```bash
node --version
npm --version
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
```

Para configurar acceso a un modelo:

```bash
pi
# Ya dentro de la interfaz interactiva:
# /login
# /model
```

`/login` permite autenticar un proveedor compatible (suscripción, API key o modelo local según proveedor), y `/model` permite elegir entre los modelos disponibles. Los costes y la disponibilidad dependen del proveedor y del método de acceso. **No ingreses claves API en nuestros ejemplos.**

### 3.1. Modos de uso

| Modalidad | Ejemplo | Cuándo se usa |
|---|---|---|
| Interactivo | `pi` | Cuando una persona está trabajando en el terminal |
| Print | `pi --print "..."` | Una ejecución y su respuesta final |
| JSON | `pi --mode json "..."` | Consumir eventos de una ejecución |
| RPC | `pi --mode rpc` | Control bidireccional de un proceso persistente |
| SDK | `createAgentSession(...)` | Embeber directamente Pi desde TypeScript |

En esta lección usaremos únicamente el **modo print**, suficiente para comprender el proceso externo y construir el primer CLI. Al no recibir eventos intermedios estructurados, este enfoque es limitado para workflows complejos; lo estudiaremos en lecciones posteriores.

### 3.2. Primera ejecución directa

```bash
pi --no-session --no-mcp --no-extensions \
  --tools read,grep,find,ls \
  --print "Explica la estructura de este proyecto sin modificar archivos"
```

- `--print`: una respuesta y salida del proceso.
- `--no-session`: no persiste la sesión para recuperarla después.
- `--no-mcp`: deshabilita los servidores MCP incorporados en Pi para esa ejecución.
- `--no-extensions`: evita cargar extensiones normales para este laboratorio.
- `--tools`: selecciona las herramientas expuestas al modelo. Aquí evitamos herramientas de escritura o ejecución de shell.

**Advertencia de seguridad:** este conjunto de flags reduce la superficie disponible al modelo, pero **no crea un sandbox de sistema operativo** ni elimina capacidades de módulos confiados que se ejecuten por otras vías. Tampoco es un mecanismo suficiente para imponer políticas de seguridad empresariales.

**Nota actualizada:** Pi sí dispone de integración MCP nativa en sus versiones actuales. No es necesario desarrollar soporte MCP desde cero para la mayoría de los casos.

## 4. Proyecto conductor: Agent Harness Lab

Queremos un harness independiente de cualquier proyecto previo, inicialmente pequeño y con posibilidades reales de expansión.

```text
agent-harness-lab/
├── package.json
├── tsconfig.json
├── harness.config.json
├── AGENTS.md
├── src/
│   ├── cli.ts
│   ├── config.ts
│   └── runtime.ts
├── tests/
│   └── cli.test.mjs
├── examples/
│   ├── prompts/
│   │   ├── architecture.md
│   │   └── review.md
│   └── pi-comparison.md
└── solutions/
    └── modulo-01-leccion-01/
```

### 4.1. Responsabilidades

- `cli.ts`: recibe comandos, valida la entrada y presenta mensajes. Evita lógica de IA.
- `config.ts`: define opciones y valores predeterminados del laboratorio. Se mantiene aparte de `~/.pi/agent/settings.json`, que pertenece a Pi.
- `runtime.ts`: transforma intención en flags y administra la ejecución del proceso Pi. No implementa el Agent Loop.
- `tests/`: ejecuta escenarios reales del CLI con un ejecutable Pi **simulado**, sin gastar tokens.

Esta arquitectura de tres archivos es suficiente para el primer módulo. No habrá servicios, interfaces o contenedores de dependencias artificiales.

## 5. Implementación explicada

### 5.1. Configuración del producto

Archivo `harness.config.json`:

```json
{
  "pi": {
    "executable": "pi",
    "tools": ["read", "grep", "find", "ls"],
    "noSession": true,
    "disableMcp": true,
    "disableExtensions": true
  },
  "execution": {
    "timeoutMs": 120000
  }
}
```

Se eligen valores **conservadores**: no se habilitan herramientas capaces de escribir o ejecutar comandos, no se carga MCP, no se cargan extensiones y no se persisten sesiones. Cuando aprendamos a manejar permisos, podremos permitir operaciones sensibles bajo controles reales.

Opcionalmente puede indicarse `model` y `provider`. Pi exige `--model` cuando se pasa `--provider`.

**Seguridad del origen de la configuración:** en este primer laboratorio, `harness.config.json` puede elegir la ruta del ejecutable (`pi.executable`), por lo que **debés revisar el archivo antes de ejecutar el harness en repositorios no confiables**. Una versión de producción separará preferencias confiables del usuario de configuración de proyecto no confiable.

**Por qué validar el JSON:** `JSON.parse` no verifica tipos ni restricciones. Nuestro `config.ts` comprueba valores, nombres de herramientas y timeout antes de crear un proceso. Evita errores confusos y mejora la experiencia de uso desde el comienzo.

### 5.2. Construcción de argumentos

El fragmento esencial de `src/runtime.ts` es:

```ts
export function buildPiArgs(prompt: string, config: HarnessConfig): string[] {
  const args = ['--print'];
  if (config.pi.noSession) args.push('--no-session');
  if (config.pi.disableMcp) args.push('--no-mcp');
  if (config.pi.disableExtensions) args.push('--no-extensions');
  args.push('--tools', config.pi.tools.join(','));
  if (config.pi.model) args.push('--model', config.pi.model);
  if (config.pi.provider) args.push('--provider', config.pi.provider);
  args.push('--', prompt);
  return args;
}
```

No concatenamos una cadena de shell: generamos un **array de argumentos** y usamos `spawn(..., {shell:false})`. Esto evita que el texto del prompt sea interpretado como un comando de shell en los entornos POSIX usados por el laboratorio. También colocamos `--` para separar los flags de un prompt que pueda comenzar por un guion.

### 5.3. Ejecutar el proceso

```ts
const child = spawn(config.pi.executable, args, {
  cwd,
  shell: false,
  stdio: 'inherit',
  env: process.env,
});
```

`cwd` determina qué proyecto inspecciona Pi; `stdio: 'inherit'` conecta stdout/stderr al terminal del usuario; `env` preserva variables de entorno que Pi pueda necesitar. El código completo implementa además manejo de error del proceso hijo, un timeout básico y propagación del código de salida.

**Límite relevante:** si un proceso hijo genera nietos, interrumpir solo el hijo no garantiza detener su árbol completo. Más adelante veremos políticas de procesos y cancelación fiable.

### 5.4. CLI de usuario

Nuestro `src/cli.ts` expone tres operaciones:

```bash
agent-lab doctor
agent-lab config
agent-lab run "Describe los componentes principales de este proyecto"
```

`doctor` ejecuta `pi --version` y detecta que el binario responde. **No prueba autenticación**; eso se verifica desde Pi.

`config` muestra el JSON efectivo y la ubicación del archivo leído. No guardamos secretos.

`run` valida que exista un prompt, prepara los argumentos y ejecuta Pi. También ofrece `--dry-run`:

```bash
agent-lab run "Describe los componentes" --dry-run
```

Esto muestra el comando y sus argumentos sin consultar al modelo. Es especialmente útil para depurar la configuración.

## 6. Ejecución guiada paso a paso

### Paso 1: instalar y compilar

Descomprimí el proyecto y situate en la carpeta raíz:

```bash
npm install
npm run build
```

### Paso 2: ejecutar tests sin credenciales

```bash
npm test
```

Los tests levantan un proceso falso llamado `fake-pi.mjs` para validar que nuestro programa construye correctamente los flags, pasa el prompt, reconoce la versión y propaga los errores.

Esto **no comprueba la calidad de las respuestas de un modelo real**. Comprueba el contrato de integración CLI↔proceso.

### Paso 3: ejecutar comandos del producto

```bash
node dist/cli.js --help
node dist/cli.js config
node dist/cli.js run "Analiza este repositorio" --dry-run
node dist/cli.js doctor
```

`doctor` requiere que Pi esté realmente instalado o que `pi.executable` apunte a un ejecutable disponible.

### Paso 4: ejecutar el primer prompt real

```bash
node dist/cli.js run "Identifica las responsabilidades de cli.ts, config.ts y runtime.ts. No modifiques archivos."
```

Este último paso requiere Pi con proveedor/modelo listo; puede consumir tokens o cuota de suscripción.

### Paso 5: instalar el comando localmente (opcional)

```bash
npm link
agent-lab --help
agent-lab config
```

`npm link` deja el comando disponible localmente apuntando al proyecto. **No publica** el paquete en npm ni lo convierte automáticamente en una distribución de producción.

## 7. Ejercicio obligatorio: `run-file`

### Historia US-LAB-001

Como usuario de Agent Harness Lab, quiero ejecutar un prompt almacenado en un archivo para reutilizar instrucciones sin copiar texto largo al terminal.

**Implementar:**

```bash
agent-lab run-file examples/prompts/architecture.md
agent-lab run-file examples/prompts/review.md --dry-run
```

### Criterios de aceptación

1. El comando recibe exactamente una ruta de archivo.
2. Lee el contenido UTF-8, elimina espacios al principio/final y verifica que no esté vacío.
3. Reutiliza `runPi()` en lugar de duplicar lógica de ejecución.
4. Si la ruta no existe, muestra un error claro y termina con código diferente de cero.
5. `--dry-run` también funciona con `run-file`.
6. Incorpora tests para un archivo válido y un archivo inexistente.

**Pistas, no solución:** `readFileSync`, `resolve(process.cwd(), input)`, `buildPiArgs()` y `runPi()` ya son utilidades que podés reutilizar. El archivo `solutions/modulo-01-leccion-01/src/cli.ts` incluye la solución completa. Encontrarás tests adicionales junto a ella.

## 8. Cómo interpretar lo aprendido

Preguntas de control:

1. ¿Por qué `runPi()` no necesita conocer los tokens de los modelos?
2. ¿Cuál es la diferencia entre nuestra configuración y la configuración propia de Pi?
3. ¿Por qué `--tools read,grep,find,ls` no equivale a un sandbox?
4. ¿Qué pierde el modo print frente a JSON, RPC y SDK?
5. ¿Qué riesgos aparecen si habilitamos `bash` antes de introducir aprobaciones efectivas?
6. ¿Por qué conviene usar `spawn` sin concatenar el prompt en un comando de shell?
7. ¿Qué ganamos con tests de integración contra un ejecutable simulado?

### Soluciones orientativas

1. Pi mantiene la conexión con el proveedor y resuelve la autenticación; nuestro CLI solo delega la ejecución.
2. Nuestra configuración define cómo *invocamos* Pi; la suya define modelos, recursos, sesiones y experiencia nativa.
3. Seleccionar tools controla lo disponible al modelo; no elimina los privilegios del proceso operativo.
4. No hay eventos intermedios estructurados, ni control bidireccional de una sesión persistente desde nuestro CLI.
5. Ejecución accidental de comandos sensibles o destructivos y mayor superficie de ataque.
6. Para no tratar texto de usuario como sintaxis shell.
7. Obtener pruebas rápidas, deterministas y sin costes de inferencia.

## 9. Definition of Done de esta lección

- [ ] Puedo iniciar Pi directamente y seleccionar un modelo.
- [ ] `npm run build` compila sin errores.
- [ ] `npm test` pasa sin credenciales de proveedor.
- [ ] `node dist/cli.js config` expone la configuración efectiva.
- [ ] `node dist/cli.js doctor` identifica la instalación de Pi.
- [ ] `run --dry-run` muestra los argumentos esperados.
- [ ] `run` invoca Pi con un prompt real.
- [ ] Implementé `run-file` y comprobé sus tests.
- [ ] Puedo explicar qué responsabilidades pertenecen a Pi y cuáles a Agent Harness Lab.

## 10. Revisión arquitectónica honesta

**Lo que está bien:** separación pequeña de responsabilidades; configuración explícita; tests reales del límite de proceso; no duplicamos el Agent Loop; no creamos un SDK alternativo de manera prematura.

**Lo que falta:** cancelación robusta, seguridad en Windows nativo, logs estructurados, streaming, sesiones gestionadas por nosotros, aprobaciones efectivas, distribución multiplataforma y control granular de recursos. **Esta entrega no es todavía un harness listo para producción**.

**Decisión para el siguiente módulo:** estudiar las alternativas de integración de Pi (print, JSON, RPC, SDK) y qué comportamiento queremos supervisar antes de elegir una interfaz definitiva.

## 11. Recursos oficiales recomendados

1. Inicio e instalación — https://pi.dev/docs/latest/quickstart
2. Referencia CLI y flags — https://pi.dev/docs/latest/cli
3. Integración por CLI — https://pi.dev/docs/latest/cli-integration
4. MCP incorporado — https://pi.dev/docs/latest/mcp
5. Sesiones y contexto — https://pi.dev/docs/latest/sessions
6. Repositorio oficial — https://github.com/earendil-works/pi

---

**Próxima entrega:** Módulo 1 · Lección 2 — Modos de ejecución, JSON, RPC y contratos de integración. **Nivel: Principiante–Intermedio; complejidad: Media.**
