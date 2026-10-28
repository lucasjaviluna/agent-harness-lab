# Agent Harness Lab — v0.2.0

**Curso:** Pi.dev de cero a Agent Harness profesional  
**Módulo 1 — Fundamentos de Pi**  
**Lección 2 — Modos de ejecución de Pi y contratos de integración**  
**Nivel:** Principiante–Intermedio · **Complejidad:** Media

Este es un proyecto **independiente de pi-harness** que evoluciona por lecciones. No contiene todavía funcionalidades de producción como sandbox, approvals o sesiones RPC administradas.

## Requisitos

- Node.js 22.19 o superior para Pi instalado por npm.
- npm y TypeScript (instalado desde `devDependencies`).
- Pi: `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`.
- Proveedor/modelo configurado en Pi para ejecuciones reales (los tests no lo necesitan).

## Primera ejecución

```bash
npm install
npm test
npm run typecheck
node dist/cli.js --help
node dist/cli.js doctor
node dist/cli.js config
```

`doctor` sólo comprueba versión del binario; **no confirma autenticación**.

## Ejecución de prompts

```bash
# Print: salida final como texto, igual que Lección 1
node dist/cli.js run "Explica este proyecto" --dry-run
node dist/cli.js run "Explica este proyecto"

# JSON: resumen analítico
node dist/cli.js run "Explica este proyecto" --mode json

# JSON: eventos sin transformaciones (stdout JSONL)
node dist/cli.js run "Explica este proyecto" --mode json --view events > events.jsonl

# Ejecutar desde archivo Markdown
node dist/cli.js run-file examples/prompts/architecture.md --mode json
```

Puedes ejecutar `npm link` para disponer del ejecutable `agent-lab`. Ejecuta `pi` directamente si necesitas configurar `/login` o `/model`.

`--mode print` es el valor predeterminado. `--view summary|events` sólo existe para `--mode json`. RPC y SDK se estudian en `LECCION_02.md`, pero **no se incluyen en el binario actual**.

## Estructura

```text
src/cli.ts         Parsing de comandos y selección del modo
src/config.ts      Configuración de Lección 1, sin modificaciones
src/runtime.ts     Invocación de Pi como subprocess, print/JSON
src/json-events.ts Interpretación mínima de registros y resultado
examples/          Prompts de muestra y JSONL sintético
tests/             Pruebas de CLI con ejecutable Pi simulado
solutions/         Soluciones de ejercicios, no aplicadas al core
LECCION_01.md      Fundamentos y bootstrap
LECCION_02.md      Modos de ejecución, implementación y práctica
CHANGELOG.md       Evolución de versiones
```

## Seguridad y privacidad

- Las listas de herramientas expuestas al modelo no son un sandbox.
- `--no-mcp` y `--no-extensions` se activan por defecto en el ejemplo, pero **no constituyen una política universal de seguridad**.
- Un proyecto no confiable puede introducir instrucciones, configuraciones o recursos que requieran revisión.
- `harness.config.json` permite definir el ejecutable de Pi: verifica su valor antes de ejecutar repositorios de terceros.
- La salida JSONL puede revelar instrucciones, rutas, argumentos de herramientas o información privada. No subas archivos de eventos sin inspeccionarlos.
- No guardes claves en `harness.config.json`, prompts, fixtures ni logs.
- Los launchers `.cmd` de Windows pueden requerir tratamiento adicional; en esta etapa utiliza WSL o adapta el ejecutable de forma segura.

## Cómo evolucionar desde la Lección 1

Usa el **ZIP incremental** desde la raíz de tu repositorio. Contiene sólo los archivos creados/modificados. Si cambiaste archivos de la Lección 1, compara los cambios antes de copiarlos. El **ZIP completo** sirve como snapshot alternativo.

El ejercicio `run-file` de L1 fue incorporado a v0.2.0. Si ya lo implementaste, compara `src/cli.ts` para no perder cambios propios.

## Referencias

- https://pi.dev/docs/latest/cli
- https://pi.dev/docs/latest/cli-integration
- https://pi.dev/docs/latest/mcp
- https://pi.dev/docs/latest/sessions
- https://pi.dev/docs/latest/json
- https://pi.dev/docs/latest/rpc
- https://pi.dev/docs/latest/sdk
