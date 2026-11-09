# Práctica de TUI - Lección 10

Abrí Pi **interactivo** desde la raíz del proyecto:

```bash
pi --no-extensions --extension .pi/extensions/operator-ui.ts
```

En el prompt interactivo de Pi ejecutá estos **comandos de extensión** (no son comandos de shell):

```text
/lab-ui status
/lab-ui on
/lab-panel
/lab-widget below
/lab-footer on
/lab-footer off
/lab-ui off
```

Para observar contadores, activá `/lab-ui on` y pedile a Pi una tarea simple que use una herramienta de lectura. El panel acumula solamente número de turnos, herramientas y errores: no almacena prompts ni contenido.

**Advertencia:** `/lab-footer on` reemplaza el footer original de Pi y puede ocultar información de modelos, tokens y costes. Restablecé con `/lab-footer off`.

**Diferencia de modos:** en print y JSON no hay TUI, y en RPC las UI disponibles son diferentes. Los comandos con panel integrado no se ejecutan fuera de modo `tui`.

**Recomendación:** antes de probarlo con una tarea que modifique archivos, combiná con el guard de Lección 9 y entendé sus límites. La interfaz visual NO es un mecanismo de autorización.
