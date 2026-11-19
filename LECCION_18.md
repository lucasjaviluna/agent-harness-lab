# Módulo 4 · Lección 2 — Spec-Driven Development e integración con OpenSpec

**Lección global:** 18/20 · **Nivel:** Avanzado · **Complejidad:** Muy alta
**Versión:** v0.17.0 → v0.18.0 · **Duración sugerida:** 180–240 minutos

## 1. Objetivo y alcance

Transformar requisitos ambiguos en cambios trazables. Aprender el ciclo Propose → Apply → Verify → Archive, separar la estructura de una spec de la corrección del producto, y vincular la aprobación de planificación a los archivos que se revisaron. No construir un sustituto de OpenSpec ni introducir SDD obligatoriamente en tareas triviales.

Esta entrega agrega un comando separado `sdd:run` y reutiliza `classify()` (L16) y `sha256()` (L17). La ruta SDD es una recomendación determinista; todavía no conecta automáticamente el Workflow Engine a cambios arbitrarios. El ejemplo trabaja únicamente sobre `examples/sdd/project`, un proyecto local ficticio, con un cambio fijo. Apply es manual (puede asistirse con Pi); Verify ejecuta pruebas reales; Archive es manual. No habilita shell ni escritura autónoma al agente. No hay conexión con Azure DevOps ni con stores corporativos. El modo de propuesta gobernada de L17 continúa funcionando.

## 2. Fundamentos de SDD

SDD significa que los requisitos de comportamiento son un artefacto de trabajo antes de escribir la implementación. Una especificación expresa qué debe suceder; el diseño explica cómo; las tareas descomponen el trabajo; los tests aportan evidencia. No confundir el documento con la realidad desplegada. Una spec válida sintácticamente puede describir mal una necesidad, y un test verde puede omitir casos importantes.

Ejemplo: "Agregar filtros" es insuficiente. Precisar si filtra por estado, orden, paginación y comportamiento sin filtro. El demo adopta sólo el filtro local de una colección (no UI ni paginación). Un escenario WHEN/THEN puede traducirse en una prueba automática. No se modifica la especificación para hacer pasar una prueba sin revisión del operador.

OpenSpec conserva specs de comportamiento en `openspec/specs/` y deltas temporales en `openspec/changes/<id>/`. La propuesta explica el porqué. El diseño documenta decisiones técnicas. `tasks.md` registra el trabajo. Archive integra los deltas y mueve el cambio al historial. La historia de usuario y el cambio OpenSpec son objetos distintos: una historia puede requerir varios cambios y un cambio puede relacionarse con varias historias.

## 3. Routing y selección

| Clasificación (L16) | Ruta | Control |
|---|---|---|
| simple | direct | Workflow pequeño, revisión y pruebas proporcionadas |
| medium | planned | Plan aprobado y revisión |
| complex | sdd | Propuesta, specs, diseño, tareas y gates |

```ts
const classification = classify(parseStory(story));
const route = classification.level === 'complex' ? 'sdd'
  : classification.level === 'medium' ? 'planned' : 'direct';
```

Los riesgos declarados y la heurística textual pueden elevar la complejidad. La ausencia de riesgo declarado no demuestra seguridad. Mantener rutas directas y planificadas de L16; para sus ejecuciones gobernadas se puede utilizar `workflow:run -- --governed` con las opciones de L17. `sdd:run -- route` sólo imprime la decisión, no inicia el agente ni crea cambios. El ejemplo de filtro es deliberadamente pequeño para enseñar el ciclo, aunque no exigiría SDD en trabajo real. `examples/workflows/complex.json` demuestra cómo se selecciona SDD para una historia transversal, pero no se aplica esa historia al ejemplo fijo de beneficios.

Diagrama:

```
Story → Classifier → Router
                       ├─ direct → workflow L16/L17
                       ├─ planned → workflow L16/L17
                       └─ sdd → OpenSpec planning → revisión humana
                               → Apply (operador) → Verify (tests)
                               → revisión final → Archive (operador)
```

## 4. OpenSpec: CLI y acciones del agente

Consultar la [documentación CLI oficial](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md), [contrato JSON](https://github.com/Fission-AI/OpenSpec/blob/main/docs/agent-contract.md) y [comandos del agente](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md). La referencia consultada describe las versiones actuales (incluye cambios de v1.16.0). El laboratorio usa el contrato JSON documentado y no presupone que todas las versiones anteriores sean compatibles. Confirmar `openspec --version` y `openspec --help` en el equipo. En particular no se garantiza el contrato JSON para 1.4.1 sin validar localmente.

| Necesidad | CLI | Acción del agente |
|---|---|---|
| Preparar un cambio | `openspec new change add-benefit-filter` | `/opsx:propose` si está instalado |
| Ver dependencias | `openspec status --change add-benefit-filter --json` | Consultar estado |
| Obtener instrucciones | `openspec instructions proposal --change add-benefit-filter --json` | Crear el artefacto correspondiente |
| Implementar | `openspec instructions apply --change add-benefit-filter --json` | `/opsx:apply` o skill equivalente |
| Validar estructura | `openspec validate add-benefit-filter --type change --strict --json --no-interactive` | Revisar problemas |
| Verificar producto | Ejecutar tests del proyecto | `/opsx:verify` si está disponible en el perfil |
| Archivar | `openspec archive add-benefit-filter` | `/opsx:archive` si instalado |

No asumir que existen `openspec propose`, `openspec apply` o `openspec verify` como subcomandos equivalentes. Los comandos de agente dependen de la instalación, perfil y herramienta soportada. En Pi es posible instruir al agente mediante un prompt o skills explícitamente instalados; no afirmar que `opsx` sea una extensión propia de Pi. Para instalar en un proyecto de prueba usar `openspec init` y elegir la herramienta disponible; no ejecutar init en el ejemplo ya preparado por este lab sin necesidad. Ver https://openspec.dev/ para instalación oficial y releases.

## 5. Proyecto conductor y artefactos

```
examples/sdd/project/
  openspec/config.yaml
  openspec/changes/add-benefit-filter/
    .openspec.yaml
    proposal.md
    design.md
    specs/benefits/spec.md
    tasks.md
  src/filter.mjs
  tests/filter.test.mjs
```

El directorio `openspec/specs` puede estar vacío antes de archivar (Git no conserva directorios vacíos). El delta utiliza `## ADDED Requirements`, `### Requirement:` y `#### Scenario:`. Leer los archivos completos antes de aprobar. Ejemplo de escenario: al solicitar `active`, retornar sólo activos en el orden original y no alterar la colección recibida. El requerimiento también exige una copia para `all` y error para un estado desconocido. Las pruebas del demo cubren los estados activo, inactivo, todos y desconocido.

## 6. Adaptador nativo

`src/sdd.ts` contiene `sddArgs`, `makeNative`, `checkStatus`, `checkValidation`, `snapshot`, `review`, `verify` y `persistReceipt`. `src/sdd-cli.ts` fija el workspace y los comandos disponibles. No se permite elegir comandos shell desde los datos recibidos del agente. Los subprocesos tienen timeout, tamaño máximo de salida, stdin cerrado y `shell:false`. El código diferencia fallo de inicio, salida no cero y JSON inválido. Los errores son deliberadamente acotados (para diagnóstico completo ejecutar el CLI directamente en el ejemplo confiable).

```ts
const report = makeNative(workspace)('status');
checkStatus(report);
```

Se exige el cambio esperado, schema `spec-driven`, los cuatro artefactos terminados, y un informe de validación estricto positivo para ese único cambio. `isPlanningComplete` (o alias `isComplete`) indica artefactos de planificación listos, no tareas implementadas. La respuesta `instructions` se imprime como información para el operador; no se ejecutan las instrucciones automáticamente.

Para Windows se recomienda el binario nativo `openspec.exe` accesible desde PATH. Si la instalación npm sólo expone un shim `.cmd`, configurar `OPENSPEC_CLI_JS` con la ruta absoluta al entrypoint JS real de esa instalación confiable (consultar el campo `bin` del package.json instalado). El adaptador lo invoca mediante `process.execPath`, sin shell. No usar `.cmd` como entrypoint JS. El launcher Pi de `src/runtime.ts` no cambia. No descargamos ni ejecutamos paquetes de forma automática.

## 7. Fase Propose y revisión del artefacto

En el ejemplo los artefactos se entregan preescritos para centrarse en integración. En un flujo real el agente redacta cada artefacto siguiendo `status` e `instructions`, y el operador lo revisa. La planificación del lab admite sólo un conjunto fijo de archivos, con tamaños acotados y sin enlaces simbólicos directos. La huella SHA-256 combina el identificador de cambio, el hash de config y las rutas y hashes ordenados de los archivos. En `tasks.md` se normaliza exclusivamente la marca `[x]` o `[X]` a `[ ]` en líneas con un checkbox del formato soportado. La descripción de cada tarea y cualquier otro cambio modifican la huella.

```ts
const plan = review(workspace, native);
// plan.digest es la huella del contenido que el operador debe leer y aprobar
```

El operador conserva el digest fuera de los archivos del cambio. Se vuelve a calcular antes y después de las validaciones. Cambiar el plan invalida la aprobación previa. El digest no es una firma, no identifica a un aprobador y no es un control de acceso: un agente con acceso al comando también podría fabricar uno. Por eso, introducirlo es un paso reservado al operador. Para producción se recomienda reutilizar recibos L17 autenticados, persistidos en un dominio de confianza distinto del workspace. No se implementa esa autorización de servicio aquí.

## 8. Fase Apply: práctica real

Implementar el código en `examples/sdd/project/src/filter.mjs`; el starter sólo copia la lista y falla en tres tests. Usar Pi como asistente sobre una copia de trabajo no sensible, leer las specs y revisar el diff. No pasarle el digest de aprobación ni habilitar escrituras indiscriminadas. El operador puede editar el código manualmente o copiar una propuesta revisada. El comando nuevo de laboratorio no escribe código; las autorizaciones de herramientas TUI de L9 siguen siendo independientes. En Windows:

```powershell
node --test examples/sdd/project/tests/filter.test.mjs
# completar la función (o copiar la solución después de practicar)
Copy-Item solutions/modulo-04-leccion-02/src/filter.mjs examples/sdd/project/src/filter.mjs
node --test examples/sdd/project/tests/filter.test.mjs
```

Después de obtener 4/4 tests y revisar el diff, marcar las tres tareas en `tasks.md` cambiando sólo `[ ]` por `[x]`. No tocar los textos ni la suite fija. Si se necesita cambiar requisitos, repetir revisión y obtener nueva huella. El archivo de tests está fijado por hash normalizando CRLF, para que las pruebas no se sustituyan inadvertidamente por otras que siempre pasen. Esto no impide código malicioso en el producto ni alteraciones al verificador.

## 9. Verify: evidencia real

`verify` exige la huella aprobada, el plan completo y todas las tareas marcadas. Ejecuta una prueba de producto con `process.execPath --test tests/filter.test.mjs`, argumentos fijos, sin shell, en el proyecto demo. Calcula hashes de los dos archivos del producto antes/después y revalida el plan. Se remueven `NODE_TEST_CONTEXT` y `NODE_OPTIONS` del proceso hijo de pruebas: Node podría omitir un test runner anidado y devolver 0 engañosamente. La misma corrección se incorpora al Quality Gate de L17.

Resultado: `status: verified` sólo cuando la comprobación acotada pasa; `status: failed` si los tests fallan. El recibo JSON `sdd-<uuid>.json` se escribe en `.lab-evidence/`, que ya está ignorado y protegido por el guard. Incluye digest del plan, digest del producto, progreso, código de salida, hash de salida de la prueba, alcance y fecha. No persiste el texto de salida ni una identidad autenticada. Errores anteriores a la prueba (p. ej., aprobación vencida) bloquean sin recibo. Este recibo es separado del diario encadenado L17; `evidence:verify` no lo verifica. No declarar que el cambio está listo para producción por la comprobación de un fixture. No hay sandbox: Node ejecuta código local con permisos del usuario; revisar previamente el código y usar un directorio confiable.

## 10. Archive: operación separada

El lab no archiva automáticamente. Antes de archivar, el operador debe ejecutar Verify otra vez si hubo cambios, revisar el recibo, `git diff` y el delta de spec. En el proyecto de ejemplo:

```powershell
Set-Location examples/sdd/project
openspec status --change add-benefit-filter
openspec validate add-benefit-filter --type change --strict
openspec archive add-benefit-filter
Set-Location ../../..
```

Confirmar cuando OpenSpec lo solicite. No usar `--skip-specs` o `--no-validate` para evitar errores del flujo. Archive actualiza las specs base y mueve la carpeta del cambio; revisar los diffs. No equivale a merge ni despliegue. Después de archivar, el comando `review` del ejemplo deja de funcionar hasta restaurar el fixture inicial desde Git; para curso y regresión trabajar en rama separada. Esta operación manual no está protegida por el verificador fuera de su CLI. Abrir una PR después de revisar, ejecutar CI y cumplir las políticas del repositorio.

## 11. Laboratorio paso a paso

Desde el root del harness:

```powershell
npm install
npm test
npm run typecheck
npm run sdd:run -- route examples/workflows/simple.json
npm run sdd:run -- route examples/workflows/medium.json
npm run sdd:run -- route examples/workflows/complex.json
openspec --version
npm run sdd:run -- review
npm run sdd:run -- instructions
```

`review` requiere OpenSpec instalado. Guardar el digest mostrado tras la revisión manual. Ejemplo PowerShell de introducción explícita:

```powershell
$approved = '<DIGEST_REAL_REVISADO>'
# Apply: resolver la función, ejecutar pruebas, marcar tareas.
npm run sdd:run -- verify --approved $approved
```

Si la implementación no está completa, comprobarás por qué falla. Si el plan ha cambiado, se requiere otro review. El digest mostrado en el ejemplo es un marcador, no uno válido. Los tests del lab se ejecutan en copias temporales: no modifican el fixture base.

## 12. Frontend, backend y multi-repo

En un sistema Angular + .NET, ejemplo: historia de negocio "filtrar beneficios por estado". La spec de comportamiento común describe qué ve el usuario. El contrato API debe declarar parámetros y semántica. El backend implementa queries/handlers CQRS y tests de API. El frontend implementa la UI, mantiene el contrato y ejecuta tests unitarios e2e. Si el contrato se acuerda primero y se dispone de mocks, pueden trabajar en paralelo; la integración e2e real depende de ambos. No compartir secretos ni copiar repos completos al contexto.

Con un repo de specs común, no confundir almacenamiento de specs con coordinación de cambios en repos. OpenSpec puede resolver stores y contextos compartidos según la versión; el orquestador tiene que seleccionar repos y permisos, relacionar PRs, manejar cambios concurrentes y comprobar un contrato versionado. No se implementan stores ni worksets en el demo. Propuesta de estados: `approved-spec`, `backend-ready`, `frontend-ready`, `e2e-passed`, `archive-approved`. Cada estado exige evidencia independiente; nunca marcar E2E aprobado basándose en un resumen del agente. La implementación de software complejo puede incluir prototipo UX opcional, pero no sustituye el test. Mantener el SDD proporcional al riesgo.

## 13. Ejercicio US-LAB-018 — Implementar el filtro

Criterios: `active` retorna sólo activos en orden; `inactive` retorna sólo inactivos; `all` devuelve copia de la lista; estado desconocido produce `RangeError`; no mutar el array; marcar tareas solamente tras ejecutar los tests. El digest de aprobación debe seguir siendo válido, y Verify debe producir recibo `verified`. Ensayar una modificación del texto de una tarea para ver el bloqueo. Revertir el cambio de prueba antes de archivar.

Solución separada: `solutions/modulo-04-leccion-02/src/filter.mjs`. Implementación completa:

```js
export function filterBenefits(benefits, state = 'all') {
  if (state === 'all') return benefits.slice();
  if (state !== 'active' && state !== 'inactive') throw new RangeError('Unknown benefit state');
  return benefits.filter(benefit => benefit.state === state);
}
```

Los tests de producto son los cuatro del fixture. La suite `tests/sdd.test.mjs` verifica automáticamente el starter rojo y la solución verde en copias temporales con OpenSpec simulado, más casos de validación y manipulación. El ejercicio no modifica la versión starter entregada. No hacer pasar los tests reescribiendo las expectativas.

## 14. Errores y troubleshooting

- `OpenSpec status falló`: confirmar instalación PATH, versión, usar binario o entrypoint JS en Windows. Ejecutar el comando original dentro de `examples/sdd/project` para diagnóstico.
- `Validación OpenSpec inválida`: la versión instalada puede presentar otro contrato JSON. Comparar con la documentación de esa versión. No convertir respuestas desconocidas en éxito.
- `Plan incompleto`: confirmar los cuatro artefactos y el schema. No saltar validación.
- `El plan cambió`: obtener nueva revisión humana; no copiar un digest sólo para desbloquear.
- `Tareas pendientes`: ejecutar Apply, pruebas, revisar y marcar las tareas completadas.
- `Suite de producto modificada`: restaurar la suite confiable, o diseñar un cambio formal del verificador y tests, no eludir el control.
- `failed`: reproducir `node --test examples/sdd/project/tests/filter.test.mjs`; revisar fallos reales.
- Después de archive: restaurar el proyecto de práctica desde Git cuando se necesite repetir el ejemplo.

## 15. Validación y limitaciones

Base v0.17.0: 251 tests pasados, un omitido. L18: 14 nuevos, total 265 pasados y uno omitido en Linux. Suite de producto ejecutada en proceso real: starter falla 3 de 4, solución pasa 4 de 4. Verificado TypeScript. Contrato OpenSpec simulado, incluyendo proceso Node real para probar el adaptador con JSON inválido/salida no cero. No hay instalación nativa de OpenSpec disponible en el entorno, por lo que el demo de OpenSpec real y archive requieren verificación local; Pi autenticado y Windows no ejecutados. Node del entorno 22.16 frente a mínimo del harness 22.19. No se ha modificado ni publicado el repo remoto. El patch se basa en el snapshot del curso, con hashes de los archivos centrales coincidentes con main en la revisión. El snapshot no contiene archivos privados/locales YTK ni el lockfile remoto. Usar el patch para conservarlos. Los tests de seguridad no representan un sandbox ni una garantía frente a procesos locales hostiles o cambios concurrentes (TOCTOU). Se admite un único operador/checkout confiable, sin identidad autenticada.

## 16. Siguiente lección

Módulo 4 · Lección 3 (global 19) — Subagentes, concurrencia y aislamiento. Mantener tareas independientes, limitar paralelismo, controlar cancelación y preservar contexto y evidencias. No añadir complejidad si un único agente puede resolver la tarea con claridad.
