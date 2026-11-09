# Solución US-LAB-007 — `extensions show`

**Módulo 2, Lección 2 — Nivel Intermedio · Complejidad Media–Alta**

El código principal no incorpora el ejercicio, para que puedas resolverlo.

## Aplicar la solución (opcional)

Desde la raíz de `agent-harness-lab`:

```bash
cp solutions/modulo-02-leccion-02/src/cli.ts src/cli.ts
cp solutions/modulo-02-leccion-02/tests/extensions-show.test.mjs tests/extensions-show.test.mjs
npm test
```

En Windows, podés copiar ambos archivos desde el explorador o PowerShell (`Copy-Item`).

### Decisiones

- Se utiliza `listProjectExtensions` y NO se ejecutan scripts.
- Se valida que el nombre exista, se exige exactamente un nombre y se informa el error.
- Se mantienen los flags de ejecución restringidos a `run` / `run-file`.
- Se incorpora test de éxito, ausencia y número de argumentos.
