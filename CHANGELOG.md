# Changelog — Agent Harness Lab

## v0.3.0 — Módulo 1 · Lección 3 — 2026-10-28

**Nivel:** Principiante–Intermedio · **Complejidad:** Media

### Funcionalidades nuevas

- `models [filtro]`: invoca el catálogo propio de Pi sin parsear su salida.
- `profiles`: lista perfiles opcionales definidos por el usuario.
- Selección efectiva de `model`, `provider` y `thinking` en configuración, perfiles y flags.
- Reglas explícitas de precedencia con validación de contradicciones.
- Perfil de ejemplo **no activado** en `harness.config.json`: Pi conserva su selección nativa.
- Mismos comandos `run` y `run-file`, también en modo JSON, sin modificar Agent Loop.

### Compatibilidad y pruebas

- Todos los 22 tests de v0.2.0 continúan pasando.
- 14 tests nuevos sobre resolución, errores, CLI, delegación y compatibilidad.
- 36 tests en total, 38 después de aplicar la solución del ejercicio.
- Sólo pruebas con Pi simulado: no se verificó autenticación en vivo.

### Límites actuales

- Sin fallback automático entre modelos, enrutamiento por coste o discovery de capacidades propio.
- Pi comprueba modelo, credenciales y soporte real de thinking en tiempo de ejecución.
- Los perfiles no añaden políticas de seguridad ni sandbox.


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
