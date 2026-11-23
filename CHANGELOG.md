## v1.0.0 — Módulo 4 · Lección 4 (global 20)

- Cierre del programa de 20 lecciones; se entrega v1.0.0 **como laboratorio instalable, no certificado para producción**.
- CLI unificado con subcomandos `workflow`, `team`, `rpc`, `sdd`, `evidence verify`, `telemetry`, `readiness`, preservando la lógica de los ejecutables anteriores.
- Versión de la ayuda y `--version` sincronizados con `package.json` en el nuevo binario `src/lab-cli.ts` (CLI interno anterior intacto).
- Telemetría agregada (`src/telemetry.ts`) con presupuesto de archivo y sin emitir contenido del prompt, rutas ni tool names.
- Comprobación `readiness` de Node y ejecutable; `productionVerified=false` explícito.
- `npm pack` restringido mediante `files`, `private:true`, `UNLICENSED`, `prepack` y smoke de instalación offline en una carpeta temporal.
- CI declarada para Linux, Windows y macOS con Node 22.19.0, pendiente de ejecución remota.
- Guías `docs/RELEASE_READINESS.md` y `docs/SECURITY.md`. Tests de regresión y ejercicio US-LAB-020 separados.
- Sin modificar `src/cli.ts`, `src/runtime.ts`, `src/rpc-client.ts`, `src/sdk-runner.ts`, herramientas existentes ni los fixes de Windows.

## v0.19.0 — Módulo 4 · Lección 3 (global 19) — Subagentes

- Orquestador optativo `team:run`: plan offline, simulate y live RPC. Tres especialistas, fan-in con revisor, concurrencia 1–2, cancelación, validación de informes y hashes.
- Sesión y proceso por rol, sin herramientas ni MCP/discovery; el modelo no modifica código ni aprueba operaciones. No se sustituye el workflow gobernado ni se persiste evidencia automáticamente.
- 22 tests nuevos; 287 superados y 1 omitido. US-LAB-019: especialista de riesgos sólo para historias complejas, solución separada con 4 pruebas adicionales.
- Snapshot 0.18.0, remoto consultado 0.18.0. Launcher Windows, CLI, SDK, RPC, memoria y SDD anteriores intactos. Node 22.16 (mínimo 22.19); Pi real y Windows pendientes. Worktrees manuales; sin aislamiento OS.

## v0.17.0 — Módulo 4 · Lección 1 (global 17) — Governance

- Política `proposal-only`, aprobaciones correlacionadas a UUID y digest SHA-256, gate final obligatorio en modo gobernado.
- Diario JSONL, artefactos persistentes, hash chain, verificador de cierre, referencias y controles. Protección de `.lab-evidence` cuando guard activo; no certifica identidad ni inmutabilidad.
- Control de calidad real acotado a `tests/workflow.test.mjs`, no verifica una implementación propuesta. Distingue simulate y live; no `--llm-classify` en modo gobernado.
- 251 pruebas superadas, 1 omitida; 254 con solución anclada. Base snapshot v0.16.0, main remoto consultado v0.16.0. Node 22.16 inferior al mínimo 22.19. Pi autenticado/Windows pendientes. No se altera launcher, CLI principal, SDK ni cliente RPC.

## v0.16.0 — Módulo 3 · Lección 5 (global 16) — Workflows

- Story Classifier determinista: señales declaradas, incertidumbre y escalamiento conservador; sugerencia LLM sólo puede elevar.
- Router secuencial con tres rutas y gates de especificación/plan obligatorios. Configuración adicional de instrucciones, sin alterar invariantes.
- CLI opt-in `workflow:run`: plan/simulate offline, live con Pi RPC sin herramientas, nueva sesión por etapa y autorizaciones TTY; no realiza cambios de código reales.
- Recuperación acotada de memoria L15 por opt-in, sin escritura; perfiles de modelo reutilizados en live.
- Resultados en memoria, estados y pasos omitidos; no auditoría durable. US-LAB-016: aprobación final opcional y solución separada.
- 227 tests superados, 1 omitido; 231 superados con solución. Node 22.16 (mínimo declarado 22.19), Pi autenticado y Windows nativo pendientes. Snapshot v0.15.0, main remoto v0.15.0; no tocar CLI, launcher ni memoria propia del usuario.

## v0.15.0 — Módulo 3 · Lección 4 (global 15) — Context Engineering y memoria

- Proveedor local de memoria léxica: top-k, presupuesto UTF-8, fuentes, deduplicación, almacenamiento acotado single-writer y semilla ficticia.
- Extensión opt-in `memory-context.ts`: precarga en `before_agent_start`; captura explícita tras `agent_before_settle` / `agent_settled`, sin aprobar automáticamente herramientas. Escritura deshabilitada por defecto.
- `.lab-memory` se ignora en Git y se protege contra `write`/`edit` cuando el guard está activo. No es sandbox ni DLP.
- Ejemplo CLI offline `memory:search`, configuración con MCP y discovery apagados, guía de futura integración externa sin red en el lab.
- US-LAB-015: umbral de relevancia; solución y tests separados. CLI/SDK y launcher Windows sin cambios. Corrección puntual de carrera RPC: esperar ACK de abort antes de invalidar cliente; test de regresión con ACK tardío.
- 205 pruebas aprobadas, una omitida por plataforma; 209 aprobadas con solución. Base snapshot v0.14.0; main remoto v0.13.0. Verificación Pi real/Windows pendiente.

## v0.14.0 — Módulo 3 · Lección 3 (global 14) — RPC

- Cliente RPC didáctico, framing UTF-8/JSONL, correlación por UUID, un prompt activo, estado/reinicio/abort y cierre acotado.
- Runner optativo `rpc:run`, sesión efímera, herramientas deshabilitadas por defecto; ejemplo del cliente oficial de Pi.
- Diálogos RPC cancelados por defecto, sin aprobación automática. El cliente no implementa sandbox ni ejecuta comandos RPC arbitrarios.
- 22 pruebas nuevas y ejercicio de estadísticas con tres tests separados. Reutiliza `piCommand()` sin cambiar su cuerpo; CLI y SDK previos sin cambios.
- Base snapshot v0.13.0, main remoto v0.13.0. Validación real con Pi/Windows pendiente.

## v0.13.0 — Módulo 3 · Lección 2 (global 13) — Pi SDK

- Runner TypeScript con sesiones reutilizables, streaming opt-in, contadores y cancelación cooperativa.
- Paquete de ejemplo independiente con Pi SDK 1.5.2; modelo exacto y tool allowlist sin escritura por defecto.
- Demostración de Custom Tool vía SDK y referencia de extensiones inline/MCP; MCP desactivado en runner.
- Doce tests nuevos y ejercicio con dos tests separados. CLI y Windows launcher intactos.
- Base snapshot v0.12.0; main remoto consultado en v0.11.0. SDK real pendiente por DNS/npm y Node local inferior al mínimo.

## v0.12.0 — Módulo 3 · Lección 1 (global 12) — MCP

- Servidor stdio didáctico de historias ficticias con protocolo clásico; probe sin tokens y variante SDK oficial optativa.
- Configuración MCP de ejemplo, prompt y opt-in explícito de policy `allowMcpTools` (default deny, nombres exactos, deny/ask ganan).
- MCP y extensiones siguen deshabilitados en configuración base. Sin cliente MCP nuevo ni cambios a `src/runtime.ts` o al launcher de Windows.
- Once pruebas nuevas; ejercicio `list_stories` con tres tests separados. Pi real, SDK y Windows pendientes de comprobación.
- Base: snapshot v0.11.0 de la Lección 11; main remoto revisado aún en v0.10.0.

## v0.11.0 — Módulo 2 · Lección 6 (Lección global 11) — Codemode y Tool Search

- CLI `--tools <csv>` por ejecución, con validación de allowlist explícita y sin cambios de defaults.
- Config de ejemplo optativa para activar extensiones integradas `codemode` y `tool_search`.
- Custom Tools `lab_project_facts` (exposure `codemode`) y `lab_test_inventory` (exposure `deferred`).
- Núcleo puro de solo lectura y pruebas contra una API simulada de Pi.
- Política del guard ampliada para permitir estas herramientas mientras mantiene bloqueo de escrituras peligrosas y shell.
- Ejercicio US-LAB-011 (`--exclude-tools`) con solución y tests separados.
- Compatibilidad de Windows: `piCommand()` y `shell:false` preservados; tests previos intactos.
- No es un sandbox: codemode puede solicitar herramientas anidadas, sujetas a políticas y permisos del proceso.

## v0.10.0 — Módulo 2 · Lección 5 (Lección global 10) — TUI

- Extensión `.pi/extensions/operator-ui.ts`: dashboard opt-in, encabezado, estado, widget, footer opcional y panel interactivo.
- Estado efímero puro en `.pi/ui/operator-state.mjs`; no guarda prompts, credenciales ni resultados.
- Comandos interactivos `/lab-ui`, `/lab-widget`, `/lab-footer`, `/lab-panel`.
- No reemplaza la interfaz original hasta ejecutar `/lab-ui on`; footer alternativo es explícito y restaurable.
- Manejo correcto de modos: operaciones TUI se omiten en print/JSON/RPC.
- Tests nuevos sin tokens, ejercicio US-LAB-010 con solución separada.
- `src/`, tests antiguos y resolución Windows con `pi-launcher.js` + `shell: false` se mantienen intactos.
- La personalización visual NO equivale a sandbox ni a aprobación humana.

## v0.9.0 — Módulo 2 · Lección 4 (Lección 9)

- Guard `approval-guard.ts`: intercepta `tool_call` y aplica decisiones `allow`, `deny`, `ask`.
- Evaluador puro `approval-policy.mjs`, configuración JSON validada y política fail-closed ante errores.
- Escrituras y ediciones con aprobación por llamada en TUI/RPC; rechazadas en print/JSON sin UI.
- Bloqueo mínimo de rutas protegidas, traversal y symlinks; `bash` denegado por defecto.
- Ejemplos de CLI y guía manual; tests mock sin tokens; ejercicio US-LAB-009 con solución separada.
- Sin modificar `src/`, `piCommand()` o los tests Windows. No es un sandbox de producción.

## v0.8.0 — Módulo 2 · Lección 3 (Lección 8)

- Custom Tool `lab_workspace_report` mediante extensión Pi de solo lectura.
- Schema de parámetros TypeBox y validaciones defensivas de rutas y límites.
- Integración mediante configuración `examples/config/harness.tools.example.json` y flags de extensión existentes.
- Tests nuevos de schema declarativo, paths, symlink, aborto, resultados y allowlist de CLI.
- Ejercicio US-LAB-008 con solución `lab_package_summary`, separada del código principal.
- No se alteraron la ejecución de Pi en Windows, los procesos sin shell, ni el Agent Loop.

## v0.7.0 — Módulo 2 / Lección 2 — Extensiones TypeScript
- `agent-lab extensions list`: inventario read-only de extensiones locales `.pi/extensions`.
- `--extension` repetible y `--no-extensions` en `run` / `run-file`. Pi conserva carga y confianza.
- `lifecycle-observer.ts` registra eventos (`session_start`, `agent_start`, `tool_execution_end`, `agent_settled`, `session_shutdown`) y el comando `/lab-stats`.
- `extension-options.ts`: validación de rutas explícitas, sin importar ni ejecutar código.
- Tests de CLI, rutas, eventos, sesión y compatibilidad con UI ausente.
- Ejercicio US-LAB-007: `extensions show <nombre>` con solución separada.
- Sin cambios a la resolución Windows `piCommand()`, `shell:false`, ni a Skills previas.
- El main publicado se encontró en v0.5.0; el patch se entrega sobre el snapshot v0.6.0.

## v0.6.0 — Módulo 2 / Lección 1 — Skills
- `agent-lab skills list`: informe read-only de Skills locales del proyecto (`.agents/skills`, `.pi/skills`), sin sustituir el descubrimiento de Pi.
- `--skill` repetible y `--no-skills` en `run` y `run-file`, delegados a los flags nativos de Pi.
- Validación de rutas explícitas (directorio con `SKILL.md` o archivo `SKILL.md`).
- Ejemplos `agent-review` (selección automática posible) y `test-triage` (sólo invocación explícita), referencias, assets y script Node portátil.
- 12 tests adicionales (75 superados + 1 omitido en Linux); 3 tests adicionales en la solución opcional (78 + 1 omitido).
- Preservados Windows `pi-launcher.js`, `shell:false`, `session-options`, contexto, JSONL y configuración previa.
- Ejercicio US-LAB-006: `skills check` con solución completa separada.

## v0.5.0 — Módulo 1 / Lección 5 — Context Engineering

- `agent-lab context`: diagnóstico del cwd (AGENTS, `.pi/SYSTEM.md`, `.pi/APPEND_SYSTEM.md`, prompt templates). No duplica ni reemplaza descubrimiento de Pi.
- `--append-instructions <archivo>` repetible en `run` y `run-file`, validado y pasado como `--append-system-prompt` a Pi.
- `--no-context-files` para deshabilitar descubrimiento AGENTS/CLAUDE por ejecución.
- Ejemplos de instrucciones, `.pi/APPEND_SYSTEM.md`, `/review` y `/plan`.
- Tests de casos válidos, límites, errores y preservación del comportamiento anterior.
- Ejercicio opcional US-LAB-005 con solución separada.
- Preservada la ejecución Windows basada en `pi-launcher.js` y `shell:false`.

# Changelog

## v0.4.0 — Módulo 1 / Lección 4 — Sesiones y contexto

- Composición validada de flags de sesión: `--persist`, `--ephemeral`, `--continue`, `--session`, `--fork`, `--session-dir`, `--name`.
- Persistencia **optativa**: no cambia el modo efímero que existía en v0.3.0.
- Se reutiliza el SessionManager y almacenamiento JSONL de Pi sin implementar otro gestor.
-  Nuevos tests de regresión, conflictos, JSON/print, prompts especiales y compatibilidad de CLI.
- Se **preservan** los cambios Windows: `pi-launcher.js`, `pi.cmd`, preload de tests y `shell:false`.
- No se incorpora todavía compaction programática: se aprende mediante `/compact` en Pi.

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

## v0.18.0 — Lección 18

- Routing con clasificador L16 y adaptador OpenSpec acotado.
- Revisión por digest del plan, validación estricta, suite de producto y recibo local.
- Práctica Propose/Apply/Verify/Archive y solución de filtro de beneficios.
- Corrección Quality Gate L17: eliminar NODE_TEST_CONTEXT y NODE_OPTIONS en proceso de tests hijo.
- 14 tests nuevos, 265 aprobados, 1 omitido. OpenSpec real pendiente.
