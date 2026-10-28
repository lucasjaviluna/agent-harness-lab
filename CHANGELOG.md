# Changelog — Agent Harness Lab

## v0.2.0 — Módulo 1 · Lección 2 — 2026-10-27

**Nivel:** Principiante–Intermedio · **Complejidad:** Media

### Funciones nuevas

- `agent-lab run "..." --mode json`: stream JSONL de Pi con salida resumida.
- `--view events`: conserva cada registro JSONL en stdout para consumidores externos.
- `src/json-events.ts`: parseo mínimo de eventos y seguimiento de estado semántico.
- `src/runtime.ts`: decodificación UTF-8 y split estricto LF; detección de registros dañados e incompletos.
- `run-file`: incorpora al núcleo la solución de referencia del ejercicio de Lección 1.
- Fixture `examples/pi-json-session.jsonl` (datos sintéticos) y tests JSON.

### Compatibilidad

- `doctor`, `config`, `run` y `--dry-run` continúan funcionando como en la Lección 1.
- `run` usa modo print por defecto; no necesita migración de configuración.
- `harness.config.json` y `src/config.ts` no cambian.
- La solución de la práctica `--view tools` se guarda por separado en `solutions/`.

### Verificación

- 22 tests automatizados sobre la versión base v0.2.0, incluidos 9 de regresión.
- 24 tests al instalar la solución del ejercicio sobre una copia para validación.
- Sin autenticación en vivo contra Pi. La configuración de ejemplo no guarda credenciales.

### Límites

- No hay sandbox, control de herramientas obligatorio ni RPC/SDK integrados.
- JSON es una ejecución única; `agent_settled` se usa como indicador de completitud.
- Cancelación del proceso hijo, no de árboles de procesos completos.

## v0.1.0 — Módulo 1 · Lección 1 — 2026-10-27

- CLI inicial `doctor`, `config`, `run` (print).
- Configuración JSON validada, adaptador de proceso Pi y tests.
- Ejercicio `run-file` incluido como solución separada.
