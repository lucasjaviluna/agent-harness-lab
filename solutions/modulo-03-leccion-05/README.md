# Solución US-LAB-016 — aprobación final opcional

La solución incorpora `finalReviewGate: true` en el JSON de configuración.
Esta opción sólo **añade** una aprobación del artefacto `review`; no altera los gates preexistentes.
No constituye verificación automatizada de código o autorización para aplicar cambios.

Desde la raíz del repositorio (en una rama de ejercicio):

```powershell
Copy-Item solutions/modulo-03-leccion-05/src/workflow.ts src/workflow.ts
Copy-Item solutions/modulo-03-leccion-05/tests/final-review.test.mjs tests/final-review.test.mjs
npm test
npm run typecheck
```

En Bash, reemplazar `Copy-Item` por `cp`.

Crear un archivo `examples/workflows/final-review.config.json`:

```json
{"finalReviewGate":true}
```

```bash
npm run workflow:run -- --story examples/workflows/simple.json --workflow-config examples/workflows/final-review.config.json --mode simulate --decision approve
```

El CLI original no requiere cambios: usa el parser de configuración y el método de aprobación genérico.
Los tests verifican el orden, compatibilidad, rechazo final y que no se llegue al último gate si uno anterior se rechaza.
