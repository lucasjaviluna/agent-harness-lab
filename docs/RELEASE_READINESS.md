# Agent Harness Lab v1.0.0 — release y límites de producción

**Alcance:** paquete local, *no publicado* en npm. La propiedad `private: true` impide una publicación accidental. La licencia es `UNLICENSED` por defecto: **la persona titular del proyecto decide si y cómo desea licenciarlo**. No se incluye código de Pi en el paquete.

## Capacidades demostradas

- CLI con comandos `run`, `doctor`, `config`, `models`, `workflow`, `team`, `rpc`, `sdd`, `evidence verify`, `telemetry`, `readiness`.
- CLI Pi por subproceso; SDK optativo en `examples/sdk/`; RPC con proceso persistente; no se reimplementa Pi.
- Story Classifier, workflow gobernado, confirmaciones de artefactos, evidencias hash-chain locales, verificador SDD, equipos de agentes RPC sin herramientas y memoria didáctica local.
- Tests unitarios y de procesos simulados. Los ejemplos `simulate`, `plan` y `dry-run` no consumen tokens. Las ejecuciones `live` sí requieren Pi y credenciales válidas.

## Preparar una versión local

Requisitos: Node >=22.19, npm, Git; para `live`, Pi instalado y autenticado. Tras aplicar el patch a la rama actual y preservar el lockfile del repositorio:

```bash
npm install
npm run typecheck
npm test
npm run test:coverage
npm run release:smoke
npm run release:verify
node dist/lab-cli.js readiness --enforce
```

`release:smoke` genera un `.tgz` fuera del repositorio, comprueba la allowlist del paquete, lo instala en una carpeta temporal offline y ejecuta la versión, ayuda, workflow plan y telemetría. No publica ni requiere una cuenta npm.

Para crear un tarball que puedas conservar:

```bash
npm pack
# El archivo agent-harness-lab-1.0.0.tgz queda en el directorio actual
npm install -g ./agent-harness-lab-1.0.0.tgz
agent-lab --version
agent-lab workflow --mode plan 'Revisar una API'
```

La instalación global expone el binario `agent-lab`. Las funciones dependientes de `examples/` o `.pi/` necesitan el repositorio de laboratorio, no forman parte del paquete mínimo. No distribuir archivos `.lab-memory/`, `.lab-evidence/`, bases de datos ni credenciales.

## Contratos no equivalentes

- **CLI**: proceso efímero, herramientas configurables. `--tools` / `--no-extensions` no son controles OS. La política de aprobación no es universal en los tres adaptadores.
- **SDK**: dependencia separada y validación real pendiente; `examples/sdk/` no se distribuye.
- **RPC**: sesiones persistentes, aprobaciones RPC sin operador se cancelan; capacidad de leer/escribir de acuerdo con herramientas que selecciones.
- **Memory**: recuperador léxico local single-writer, sin cifrado, permisos de acceso ni transacciones multi-proceso.
- **SDD**: ejemplo con suite real y OpenSpec simulado; no valida cualquier implementación empresarial ni automatiza merge.
- **Multi-Agent**: sesiones separadas, pero comparten permisos, archivos, recursos y proveedores de modelos.
- **Auditoría**: hash-chain local sin firma ni almacenamiento WORM, sin SSO, sin RBAC, sin garantía de inmutabilidad.
- **CI**: matriz Linux, Windows y macOS declarada; su éxito en GitHub Actions requiere ejecución real y no se afirma aquí.

## Checklist de producción (todavía NO completada)

- [ ] Pi autenticado en la versión utilizada y comparativa CLI/SDK/RPC end-to-end.
- [ ] Instalación y permisos revisados en Windows PowerShell, Linux y macOS.
- [ ] Controles externos de acceso, sandbox y límites de procesos/recursos/tokens.
- [ ] Secret scanning, SCA/npm audit, SBOM, provenance y firma del paquete.
- [ ] Identidad del operador (SSO/RBAC), aprobaciones firmadas y almacenamiento de evidencia inmutable.
- [ ] Protección de datos: clasificación, DLP, retención, cifrado, derecho de borrado, redacción de logs.
- [ ] Resiliencia: reintentos seguros, reanudación tras caída y tests de procesos concurrentes reales.
- [ ] Tests end-to-end de un producto real, incluidos frontend automation E2E donde corresponda.
- [ ] Costos, límites, cuotas y manejo de rate limits con proveedores reales.
- [ ] Política de publicación/licenciamiento y revisión legal.

## Política de versionado

`v1.0.0` **marca el cierre del curso y un contrato reproducible de laboratorio**; no certifica preparación empresarial. Si la organización desea publicar o distribuir este CLI, revisar licencia, nombre del paquete, dependencias, permisos y calidad antes de quitar `private: true`.
