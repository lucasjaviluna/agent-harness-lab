## Context

Aplicación de ejemplo Node sin dependencias, aislada del runtime del harness.

## Goals / Non-Goals

- Filtrar sin mutar la colección.
- No implementar UI, red ni almacenamiento.

## Decisions

Usar Array.filter para estados válidos; retornar una copia si se solicita all. Rechazar estados desconocidos con RangeError.

## Risks / Trade-offs

Los estados son un conjunto cerrado. Agregar nuevos estados requiere actualizar el contrato y tests.
