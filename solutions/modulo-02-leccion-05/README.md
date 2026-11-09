# Solución completa — US-LAB-010

**Módulo 2 · Lección 5 (global 10) · Nivel Intermedio–Avanzado · Complejidad Alta**

Ejercicio: incorporar `/lab-ui reset` que reinicie los contadores de ejecuciones, llamadas a herramientas y fallos, pero conserve la preferencia de posición del widget y su estado de activación.

Esta carpeta contiene una copia completa de la extensión, el helper que importa y los tests de la solución; no se carga automáticamente por Pi.

Para aplicar la solución al código principal, compará y copiá exclusivamente los cambios correspondientes de `.pi/extensions/operator-ui.ts`. Mantené el resto de tu laboratorio.

Ejecutá desde la raíz:

```bash
node --test solutions/modulo-02-leccion-05/tests/reset.test.mjs
```

La solución reusa el evento `session_start` del estado puro, que resetea los contadores pero no las opciones de presentación.
