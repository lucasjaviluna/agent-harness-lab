# Agent Harness Lab · Módulo 1 / Lección 1

**Título:** Fundamentos de Pi y construcción del primer Agent Harness  
**Nivel:** Principiante · **Complejidad:** Baja  
**Estado:** Laboratorio inicial funcional, pensado para aprender (no listo para producción).

Este proyecto es **nuevo e independiente** de cualquier implementación previa de `pi-harness`.

## Requisitos

- Node.js **22.19 o superior** (requisito de Pi instalado por npm).
- npm y acceso a los paquetes de desarrollo para compilar TypeScript.
- Pi instalado globalmente para ejecuciones reales; un proveedor/modelo autenticado para prompts reales.

## Instalación

```bash
npm install
npm run build
npm test
```

Instalar Pi por separado:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version
pi
# Dentro de Pi: /login y /model
```

`npm test` utiliza un ejecutable falso y **no requiere credenciales ni consume tokens**. Para probar con el modelo real, es necesario autenticar Pi localmente.

## Utilización

```bash
node dist/cli.js --help
node dist/cli.js config
node dist/cli.js doctor
node dist/cli.js run "Describe la estructura de este repositorio" --dry-run
node dist/cli.js run "Describe la estructura de este repositorio"
```

También es posible enlazar el binario local:

```bash
npm link
agent-lab --help
agent-lab run "Revisa este proyecto"
```

Al terminar el ejercicio práctico, tendrás `run-file`:

```bash
agent-lab run-file examples/prompts/architecture.md
```

## Configuración mínima

El archivo `harness.config.json` es exclusivo del laboratorio. No sustituye ni modifica la configuración personal de Pi.

```json
{
  "pi": {
    "executable": "pi",
    "tools": ["read", "grep", "find", "ls"],
    "noSession": true,
    "disableMcp": true,
    "disableExtensions": true
  },
  "execution": { "timeoutMs": 120000 }
}
```

Puedes incorporar opcionalmente `"model": "proveedor/modelo"` y `"provider": "proveedor"` dentro de `pi`; en Pi actual, `--provider` requiere `--model`.

Para cambiar el archivo de configuración utiliza `--config otro.json`. La configuración predeterminada no ejecuta shell ni edita archivos a través de las herramientas **declaradas al modelo**, pero **no constituye un sandbox**: Pi, los módulos en Node y recursos externos mantienen sus propios permisos.

**No guardes claves API en `harness.config.json`.** Pi usa su gestión de autenticación o variables de entorno. **Trabajá únicamente en directorios de confianza:** el archivo local puede seleccionar `pi.executable` y nuestro CLI lo invoca como proceso; no abras ni ejecutes configuraciones de repositorios desconocidos sin revisarlas primero.

## Estructura

```
src/cli.ts       CLI y comandos mínimos
src/config.ts    Lectura, valores predeterminados y validación
src/runtime.ts   Argumentos y proceso externo de Pi
tests/           Tests de integración con Pi simulado
examples/        Prompts y comparaciones para practicar
solutions/       Solución completa del ejercicio run-file
AGENTS.md        Instrucciones del proyecto para agentes
```

## Limitaciones explícitas de esta versión

- Solo invocaciones de una sola ejecución en `--print`; no hay streaming estructurado.
- No se gestiona el ciclo de vida de sesiones persistentes.
- No hay controles de permisos obligatorios ni aislamiento de procesos.
- El proceso hijo usa `shell: false`. En Windows nativo, los wrappers `.cmd` de npm pueden requerir un adaptador específico; utilizar WSL para este laboratorio o adaptar `executable` a un launcher seguro antes de ejecutar en Windows.
- La detección de versión de `doctor` **no verifica autenticación**.
- Si el hijo lanza procesos propios, cancelar el hijo no garantiza cancelar todo el árbol de procesos.

Estas limitaciones son decisiones didácticas deliberadas: evolucionaremos después hacia SDK/RPC, políticas, permisos, sesiones y distribución.

## Documentación oficial

- https://pi.dev/docs/latest/quickstart
- https://pi.dev/docs/latest/cli
- https://pi.dev/docs/latest/cli-integration
- https://pi.dev/docs/latest/mcp
- https://pi.dev/docs/latest/sessions
