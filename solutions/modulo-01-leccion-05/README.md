# Ejercicio US-LAB-005 — Solución completa

Objetivo: incorporar `agent-lab context check` para validar únicamente los
prompt templates locales. La solución es optativa y está separada del código base.

## Cómo aplicar la solución

Desde la raíz del proyecto, copia:

- `solutions/modulo-01-leccion-05/src/context-check.ts` → `src/context-check.ts`
- `solutions/modulo-01-leccion-05/src/cli.ts` → `src/cli.ts` (reemplaza el CLI v0.5.0)

Con la solución aplicada, ejecuta `npm test`, `npm run typecheck` y
`agent-lab context check`. La solución no modifica el adaptador de Windows.

## Criterios

1. Acepta `context check`; `context` sigue mostrando informe JSON.
2. Comprueba frontmatter delimitado `---` y `description` no vacía.
3. Comprueba cuerpo de template no vacío.
4. Exit 0 si todos cumplen; exit 2 si hay plantillas inválidas.
5. Sin cambiar autenticación, contexto global ni trust de Pi.

Limitación intencional: no es un parser YAML genérico, sino una validación
mínima de una convención local del laboratorio.
