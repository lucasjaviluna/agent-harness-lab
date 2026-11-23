# Solución US-LAB-020 — Quality Gate de telemetría

Archivo de solución: `telemetry-gate.mjs`. Esta solución se mantiene **fuera del motor base** para que puedas implementar el ejercicio antes de consultarla. No necesita Pi, conexión de red ni dependencias adicionales.

Ejecutar desde la raíz del repositorio:

```bash
node --test solutions/modulo-04-leccion-04/tests/*.test.mjs
```

Contrato: `evaluateTelemetryGate(summary, policy?)` retorna `{ status:'passed'|'failed', reasons, limits }`. Exige al menos un `agent_settled`; comprueba los contadores `toolErrors`, `abortedRuns` y `failedMessages`; valida los umbrales. No analiza prompts ni pretende detectar vulnerabilidades de las respuestas.

Para integrarlo después con un pipeline CI, construir primero el resumen mediante `summarizeTelemetryJsonl()` (del núcleo), después aplicar `evaluateTelemetryGate()`. La evidencia del evento debe originarse en un proceso Pi real o un test de integración confiable; una cuenta de eventos no prueba correcta implementación.
