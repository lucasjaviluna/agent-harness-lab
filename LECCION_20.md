# Agent Harness Lab — Módulo 4 · Lección 4 (global 20 de 20)

## Testing, observabilidad, seguridad y distribución de Agent Harness Lab

**Nivel:** Avanzado
**Complejidad:** Muy alta
**Versión:** v0.19.0 → v1.0.0 (laboratorio completo)
**Tiempo sugerido:** 180–240 min, más las comprobaciones manuales por sistema operativo.
**Repositorio:** https://github.com/lucasjaviluna/agent-harness-lab

> **Objetivo:** convertir un repositorio educativo de 19 lecciones en un artefacto instalable, con pruebas, telemetría agregada, controles sobre lo que distribuimos y una lista verificable de pendientes de producción. v1.0.0 **no certifica** seguridad ni preparación empresarial.

---

## 1. Prerrequisitos y estado observado

- La rama remota `main` consultada contenía `package.json` v0.19.0.
- El snapshot v0.19.0 usado como base pasó **287 tests**, **0 fallos**, **1 omitido** por depender de Windows.
- Usamos Node `v22.16.0` en el entorno de construcción, inferior al mínimo declarado `>=22.19.0`; hay que repetir en una versión admitida.
- El repositorio remoto conserva un `package-lock.json` cuyo campo de versión raíz estaba en `0.3.0`. Nuestro snapshot anterior no incluía ese archivo. Por seguridad **no se reemplaza** su lockfile con un archivo inventado; `npm install` en tu checkout actualizará su metadata y podrás revisar el diff.
- Conservamos las correcciones de Windows, RPC, memoria y el resto de runners; la integración nueva es incremental.

## 2. El problema de una «v1.0» prematura

Es fácil ver cientos de tests verdes y pensar que el harness está listo para producción. Pero hay cuatro estados diferentes:

1. **Validado en unidades:** funciones puras y dobles de procesos funcionan bajo condiciones simuladas.
2. **Validado como artefacto:** el paquete se crea, instala y ejecuta fuera del repositorio.
3. **Validado con dependencias reales:** Pi y, cuando proceda, OpenSpec/MCP, proveedores, sistema operativo y permisos de verdad.
4. **Apto para un entorno empresarial:** identidad, control de acceso, sandbox, cifrado, retención de evidencias, auditorías y respuesta a incidentes.

Esta lección entrega (1) y una comprobación local de (2). (3) y (4) son trabajo pendiente, documentado con honestidad.

## 3. Revisión arquitectónica final

```text
                          agent-lab (un único binario)
                                 │
              ┌──────────────────┼────────────────────┐
              ▼                  ▼                    ▼
           run/CLI            workflow               team
         Pi proceso           (L16/L17)              (L19)
              │                  │                    │
              └──────────────────┴────────────────────┘
                                 │
                           Pi RPC (L14)
                                 │
                        Agentes / Providers
                                 │
               ┌─────────────────┼──────────────────┐
               ▼                 ▼                  ▼
           Memory (L15)      OpenSpec (L18)      Evidence (L17)

       telemetry (L20) → agregados locales, sin contenido de prompts
       readiness (L20) → estado del entorno, NO certificado
```

*El SDK (L13) sigue siendo una integración adicional bajo `examples/sdk/` y requiere dependencias y validación propias.* El routing no habilita por sí solo permisos adicionales ni convierte los artefactos textuales en código implementado.

### Comparación de adaptadores

| Vía | Proceso separado | Estado reutilizable | Limitación pendiente |
|---|---:|---:|---|
| `run` (CLI print/JSON) | Sí | Por invocación | Sin sandbox OS |
| SDK (ejemplo aparte) | No | Sí | Dependencia real por instalar y verificar |
| RPC | Sí | Sí | Manejo de fallos y seguridad real por validar |
| `workflow` / `team` | Pi RPC por dentro | Según etapa/rol | Operaciones de desarrollo reales no automatizadas |

## 4. Verificación por capas

La matriz de pruebas que debemos mantener:

| Capa | Prueba | Aserción principal |
|---|---|---|
| Dominio | Story classifier, router, Memory Port | Contratos, validación, fallos cerrados |
| Componentes | Approval Guard, ExtensionAPI falsa | `deny/ask/allow`, rutas protegidas |
| Proceso | RPC con proceso de prueba | framing, ID, timeouts, cancelación |
| Producto ejemplo | Filter benefits (L18) | Comportamiento de la spec, no checkboxes |
| Artefacto | `release:smoke` | Tarball mínimo instalable y CLI funcional |
| Plataforma | CI Linux/Windows/macOS | Debe ejecutarse realmente en cada OS |
| Live | Pi autenticado, OpenSpec, MCP | Verificación manual/end-to-end pendiente |

Ejecutar:

```bash
npm run typecheck
npm test
npm run test:coverage
```

La cobertura automatizada mide rutas recorridas; **no demuestra que los oráculos de test sean correctos**. Recomendamos mantener tests que prueban también el *fallo esperado* del código incompleto (ejemplo de L18).

## 5. Reportar las regresiones de manera precisa

El contador global incluye pruebas con fakes. Para una decisión de despliegue separar:

- Pass/Fail/Skip y razón de los skips.
- Tests de proceso versus simulados.
- Tests sobre el producto real versus checks sobre el harness.
- Entorno: versión de Node, Windows/Linux/macOS, versión de Pi/OpenSpec, modelo/proveedor.
- No incluir prompts, tokens ni mensajes completos en un reporte distribuible de manera automática.

Un test omitido por falta de Windows no debe contabilizarse como éxito multiplataforma.

## 6. Observabilidad de bajo riesgo

El nuevo módulo `src/telemetry.ts` procesa un archivo Pi JSONL e informa **solamente agregados**.

```typescript
const summary = summarizeTelemetryJsonl(raw);
console.log(summary.agentSettled);
console.log(summary.toolErrors);
console.log(summary.tokens.input);
console.log(summary.costUsd);
```

El contrato de salida incluye: cantidad de eventos, ejecuciones iniciadas/asentadas/abortadas, herramientas invocadas/con error, mensajes fallidos, reintentos y, **sólo si Pi proporcionó `usage`**, tokens y costo reportado.

Ejemplo de archivo:

```jsonl
{"type":"agent_start","prompt":"NO DEBERÍA APARECER EN EL REPORTE"}
{"type":"tool_execution_start","toolName":"read","args":{"path":"secreto"}}
{"type":"tool_execution_end","toolName":"read","isError":false}
{"type":"agent_settled","aborted":false}
```

Ejecutar:

```bash
npm run build
node dist/lab-cli.js telemetry eventos.jsonl
# o: npm run telemetry -- eventos.jsonl
```

El resultado no contiene contenido de mensajes, rutas, prompts ni nombres de herramientas. El archivo **de entrada sí puede ser sensible**: debe almacenarse con políticas apropiadas y no enviarse por defecto a observabilidad externa.

Protecciones del procesador:

- Límite estricto de **4 MiB**, 25.000 registros.
- JSONL separado únicamente por LF, aceptando CRLF sin romper Unicode.
- Rechazo de archivos symlink o no regulares desde el CLI.
- Ignorar campos desconocidos y rechazar objetos inválidos.
- Métricas no numéricas/negativas no se suman; `costUsd: null` si no se reportó costo.
- No existe envío de red, upload automático ni persistencia nueva.

*Limitación:* no detecta secretos en el archivo fuente ni controla su retención; tampoco intenta deducir precios del proveedor sin `usage`.

## 7. Por qué un único CLI

Antes de L20 existían varias entradas npm (`workflow:run`, `team:run`, `rpc:run`, etc.). Son excelentes para aprender, pero una herramienta instalada en un equipo no debería obligarte a conocer rutas internas del repositorio.

Ahora el mismo binario ofrece comandos subrogados, conservando las implementaciones anteriores:

```bash
agent-lab --version
agent-lab workflow --mode plan "Refactorizar un handler"
agent-lab team --mode plan "Analizar módulo de beneficios"
agent-lab rpc --help
agent-lab sdd route examples/workflows/complex.json
agent-lab evidence verify RUN_ID
agent-lab telemetry events.jsonl
agent-lab readiness
```

El despachador `src/subcommand.ts` usa una **tabla de rutas estáticas** y `spawn(process.execPath, ...)` con `shell: false`. Nunca se forma un comando de shell a partir del prompt del usuario. Mantiene las rutinas internas y proporciona un único punto de entrada, sin reescribir todo el CLI.

Se presenta una nueva ayuda del comando instalable; la implementación CLI heredada mantiene su ayuda original sin tocarse: `src/lab-cli.ts` lee `package.json`; el CLI interno anterior conserva su código.

## 8. Creación de paquete mínimo con npm

`package.json` ahora incluye:

```json
{
  "version": "1.0.0",
  "private": true,
  "license": "UNLICENSED",
  "files": ["dist/", "README.md", "docs/RELEASE_READINESS.md", "docs/SECURITY.md"],
  "bin": {"agent-lab": "./dist/lab-cli.js"},
  "scripts": {"prepack": "npm run build"}
}
```

- `private:true` evita publicación accidental. No presupone que el titular haya elegido una licencia pública.
- `files` controla qué entra al tarball; `dist/` es el runtime compilado.
- `prepack` compila TypeScript antes del empaquetado.
- **No** se envían `node_modules`, sesiones, configuraciones locales, `.pi`, `.agents`, SQLite, `.lab-memory`, `.lab-evidence`, fuentes del laboratorio ni soluciones. Los ejemplos que dependen de esos archivos requieren el checkout fuente.

Estos campos siguen las reglas de empaquetado de npm: https://docs.npmjs.com/files/package.json/ y https://docs.npmjs.com/using-npm/scripts/.

Para inspeccionar el contenido:

```bash
npm pack --dry-run
npm run release:smoke
```

El smoke de la lección hace un paquete real en una carpeta temporal, revisa la allowlist y lo instala **offline** en un directorio aislado con `--ignore-scripts`. Verifica `--version`, ayuda, workflow plan y telemetría.

### Instalación local

```bash
npm pack
npm install -g ./agent-harness-lab-1.0.0.tgz
agent-lab --version
agent-lab workflow --mode plan "Analizar módulo"
```

No necesita publicarse en npm. Si en el futuro se publica, primero decidir nombre, licencia, permisos y política de release.

## 9. Diagnóstico de entorno

`agent-lab readiness` emite JSON con el cumplimiento del Node mínimo y la presencia del ejecutable compilado. **No ejecuta comandos externos ni prueba acceso al proveedor**.

```bash
agent-lab readiness
agent-lab readiness --enforce
```

Con `--enforce`, devuelve código `2` cuando el runtime no cumple los requisitos. `productionVerified` devuelve **siempre `false`**: sólo una verificación de seguridad, identidad, sistemas operativos y dependencias reales puede justificar afirmar preparación productiva.

## 10. CI mínima con tres plataformas

Se incorpora `.github/workflows/ci.yml`, con un job sobre `ubuntu-latest`, `windows-latest` y `macos-latest` usando Node **22.19.0**. Ejecuta:

```bash
npm ci --ignore-scripts
npm run release:verify
node dist/lab-cli.js readiness --enforce
```

`release:verify` encadena typecheck, tests y smoke de empaquetado. No afirma que esta matriz esté verde en GitHub Actions: debe pushearse y comprobarse. **Antes de commitear** reconciliar el `package-lock.json` remoto mediante `npm install`, revisando los cambios, porque el snapshot educativo no contiene el lockfile que mantuviste en GitHub.

## 11. Seguridad: lo que no puede resolver el harness por sí solo

Nuestro Approval Guard vive dentro de Pi: es una política de aplicación, no un sandbox ni un mecanismo suficiente contra un plugin malicioso con ejecución directa de Node.

Peligros que deben tratarse fuera del modelo:

1. **Identidad:** distinguir solicitante, operador aprobador y cuenta de servicio; RBAC/SSO, no etiquetas libres.
2. **Contención:** ejecución sin privilegios, filesystem restringido, red saliente controlada, aislamiento de procesos y límites de memoria/CPU.
3. **MCP y Skills:** allowlist de servidores confiables, autenticación y controles de suministro/actualizaciones.
4. **Datos sensibles:** clasificación, redacción, políticas de retención, cifrado, DLP y borrado.
5. **Evidencia:** storage externo append-only/WORM, firmas y anclaje verificable de hashes.
6. **Supply chain:** lockfile correcto, escaneo de secretos y dependencias, SBOM, revisión de licencias y provenance.
7. **Presupuesto:** límites de prompts, iteraciones, tokens, costos, concurrencia y reintentos.
8. **Producto:** tests verdaderamente ejecutados sobre el cambio propuesto y gates de E2E donde corresponda.

El archivo `docs/SECURITY.md` hace explícita la configuración segura del laboratorio y el `RELEASE_READINESS.md` enumera lo que falta.

## 12. Observabilidad empresarial futura

El resumen JSONL es la primera capa de visibilidad. Una arquitectura de producción podría agregar **OpenTelemetry** y métricas por ejecución, pero requiere una política de privacidad:

- Spans: `workflow.run`, `stage.start/end`, `approval.wait`, `pi.prompt`, `tool.call` (sin argumentos sensibles).
- Atributos acotados: `run_id` no identificador personal, `workflow_type`, `stage_id`, estado, duración, contador de herramientas.
- Métricas: tasa de éxito/error, latencia por etapa, uso reportado de tokens y costo reportado, rechazos, cancelaciones.
- Eventos de auditoría separados del tracing; no mezclar logs detallados con datos de cumplimiento.

**No** incorporamos un exportador remoto ni un servidor de telemetría. La API de agregación local es deliberada para no introducir más infraestructura en el cierre del curso.

## 13. Ejercicio práctico US-LAB-020

**Crear un Quality Gate basado en telemetría agregada.**

Implementar:

```typescript
function evaluateTelemetryGate(summary, policy) {
  // status:'passed'|'failed'; reasons:string[]
}
```

**Criterios de aceptación:**

1. Fallar si `agentSettled` es cero (evidencia incompleta).
2. Fallar si `toolErrors` excede `maxToolErrors`.
3. Fallar si `abortedRuns` excede `maxAbortedRuns`.
4. Fallar si `failedMessages` excede `maxFailedMessages`.
5. Los límites son enteros no negativos; datos inválidos deben rechazarse.
6. No inspeccionar ni exponer textos de prompts o argumentos.
7. Cubrir éxito, fallo, ausencia de `agent_settled` y límites configurables mediante tests.

**Solución separada:** `solutions/modulo-04-leccion-04/telemetry-gate.mjs`.

**Tests de solución:**

```bash
node --test solutions/modulo-04-leccion-04/tests/*.test.mjs
```

Este gate es una señal complementaria: un test puede pasar con métricas limpias aunque el producto esté defectuoso. Nunca sustituye pruebas de comportamiento.

## 14. Procedimiento de verificación final

```bash
# Desde la raíz, después de aplicar el patch a la v0.19.0:
npm install
npm run typecheck
npm test
npm run test:coverage
npm run release:smoke
npm run release:verify
node dist/lab-cli.js readiness
node --test solutions/modulo-04-leccion-04/tests/*.test.mjs
```

Para código real y credenciales, efectuar *una validación explícitamente autorizada* con un workspace de prueba y un modelo de Pi. No ejecutarla sobre repositorios corporativos sensibles ni habilitar herramientas de modificación sin controles OS y permisos de acceso.

## 15. Resultados y limitaciones de esta entrega

- Snapshot base: **287 pass, 1 skip**.
- Tests principales con L20: **303 pass, 1 skip**.
- Ejercicio resuelto: **4 pass adicionales**.
- Smoke real de empaquetado e instalación offline: **38 archivos** en el tarball generado; se validaron comandos versión, ayuda, workflow y telemetría.
- `npm run typecheck` y build TypeScript: correctos.
- Pendiente: pruebas reales con Pi autenticado, SDK instalado, OpenSpec instalado, workflows con código de producto, Windows/macOS y CI remota.
- Node del entorno de prueba: `v22.16.0` (mínimo declarado `>=22.19.0`), una limitación que debe corregirse en la validación posterior.

## 16. Roadmap posterior al curso

**Prioridad P0 — operación real y controlada:** resolver dependencias reales, someter el CLI a pruebas de proceso y permisos en sistemas objetivo, integración genuina Pi/OpenSpec/MCP y pruebas E2E.

**Prioridad P1 — seguridad y compliance:** identidad/RBAC, sandbox externo, gestión de secretos, aprobaciones firmadas, auditoría protegida y políticas de datos.

**Prioridad P2 — capacidad empresarial:** workflows con implementaciones reales y pruebas de producto, orquestación multi-repo, CI/CD, límites de costo, recuperación tras fallos, versionado de agentes y evaluación agéntica reproducible.

**Prioridad P3 — ergonomía:** TUI unificada con gates, dashboard de ejecuciones, perfiles por rol y distribución controlada entre desarrolladores, analistas y negocio.

No iniciar el siguiente bloque agregando frameworks «por si acaso»: reforzar primero la capacidad operativa y los puntos de fallo medidos.

## 17. Recursos oficiales

- Pi, SDK y RPC: https://github.com/earendil-works/pi
- Pi subagents: https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent
- npm package.json: https://docs.npmjs.com/files/package.json/
- npm pack: https://docs.npmjs.com/cli/pack/
- npm scripts/prepack: https://docs.npmjs.com/using-npm/scripts/
- Node test runner: https://nodejs.org/api/test.html
- Node test coverage: https://nodejs.org/api/cli.html
- OpenSpec: https://openspec.dev/
- OpenTelemetry JS: https://opentelemetry.io/docs/languages/js/
- OWASP logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## 18. Cierre del programa de 20 lecciones

El resultado tiene CLI, SDK/RPC, extensibilidad, memoria, workflows, gobernanza, OpenSpec, agentes y comprobación de empaquetado, siempre con ejercicios reproducibles. El objetivo del laboratorio no es declarar un producto empresarial terminado, sino disponer de una **base técnica explicable y evaluable** para tomar decisiones posteriores sin sobreingeniería.

**Checkpoint final:** versión académica **v1.0.0**, con riesgos pendientes visibles en `docs/RELEASE_READINESS.md`.
