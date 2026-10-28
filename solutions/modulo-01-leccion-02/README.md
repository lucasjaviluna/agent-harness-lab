# Solución — Módulo 1 · Lección 2 · Nivel Principiante–Intermedio · Complejidad Media

La práctica propone `--view tools`: filtrar en stdout sólo el inicio/fin de herramientas, sin emitir sus argumentos ni resultados (pueden contener datos privados).

**Aplicar:** copiar los archivos `src/cli.ts` y `src/runtime.ts` de este directorio sobre los correspondientes en la raíz del proyecto. Copiar `tests/tools.test.mjs` a la carpeta `tests/`, compilar y correr los tests.

```bash
npm run build
npm test
node dist/cli.js run 'Inspecciona README' --mode json --view tools
```

Cada registro en stdout será un JSON por línea con `type`, `toolName` y `isError` cuando corresponda. El proceso sigue evaluando todos los eventos para detectar fallos, incluso cuando muestra sólo herramientas.

Esta solución es **opcional** y no está aplicada al código base v0.2.0 para que puedas resolverla antes de mirar el resultado. En la siguiente lección elegiremos qué ejercicios promover al código principal.
