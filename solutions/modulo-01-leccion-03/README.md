# Módulo 1 · Lección 3 — Solución del ejercicio

**Ejercicio:** ampliar `agent-lab profiles` con `agent-lab profiles show <nombre>`.

## Aplicación

1. Copia `src/cli.ts` de este directorio encima de `src/cli.ts` en una **rama de práctica**.
2. Copia `tests/profile-show.test.mjs` a `tests/` en la raíz del proyecto.
3. Ejecuta `npm test`.

El ejercicio se deja fuera del código principal para que puedas resolverlo por tu cuenta.

## Qué aprender

- Reutilizar `resolveModelSelection` en lugar de duplicar lógica.
- Mantener un contrato JSON estable para integraciones.
- Rechazar perfiles desconocidos antes de invocar Pi.
- Probar el CLI sin credenciales ni llamadas al proveedor.
