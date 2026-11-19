# Laboratorio 17 · Governance

Desde la raíz del proyecto, con Node >=22.19 y dependencias instaladas:

```sh
npm run workflow:run -- --story examples/workflows/medium.json --mode simulate --governed --decision approve
npm run workflow:run -- --story examples/workflows/complex.json --mode simulate --governed --decision deny
```

El primer comando genera propuestas ficticias, ejecuta la suite real `tests/workflow.test.mjs` y aprueba la revisión simuladamente. El segundo termina con exit code 2, registra el rechazo y omite la calidad si no termina el workflow textual. No hay consumo de tokens en ambos. Copiar el `runId` de la salida:

```sh
npm run evidence:verify -- <runId>
```

`<runId>` es un marcador, reemplazarlo por el UUID exacto sin los signos angulares. La salida muestra status, mode, head y cantidad de registros. `completed` no significa que se haya implementado una historia. Para explorar integridad, hacer una copia del directorio `.lab-evidence/<runId>` en otro workspace de laboratorio (no una evidencia de negocio) y modificar `plan.txt`: la verificación falla. No borrar evidencias reales.

Para live, se necesita Pi autenticado; usar sólo datos ficticios sin información confidencial. Requiere una terminal interactiva para aprobar y una etiqueta declarada (no verificada) de operador:

```sh
npm run workflow:run -- --story examples/workflows/medium.json --mode live --governed --operator operator-demo
```

La opción `--governed` implica almacenamiento local de artefactos de texto; no registra prompts completos, ni stdout/stderr de la suite (sólo su digest). Puede contener secretos en las respuestas del modelo, no es DLP. No se admite `--llm-classify` en este modo mientras ese análisis no esté auditado.

Los adaptadores CLI y SDK fuera de workflow gobernado mantienen el comportamiento anterior. El guard de tools, cuando está activo, bloquea write/edit sobre `.lab-evidence`; no es un sandbox. El modo gobernado real utiliza exclusivamente RPC sin tools ni descubrimiento. No autoriza cambios de archivos, merge o deploy.
