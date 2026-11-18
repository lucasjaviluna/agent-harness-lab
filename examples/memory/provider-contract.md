# Frontera para integrar memoria externa (diseño, no API implementada)

```ts
interface MemoryQuery { workspaceId: string; query: string; topK: number; }
interface MemoryHit { id: string; source: string; text: string; score: number; }
interface MemoryCandidate { workspaceId: string; text: string; origin: string; idempotencyKey: string; }
interface MemoryPort {
  retrieve(query: MemoryQuery, signal: AbortSignal): Promise<MemoryHit[]>;
  remember(candidate: MemoryCandidate, signal: AbortSignal): Promise<{status: 'stored'|'duplicate'|'rejected'}>;
}
```

El adaptador local de esta lección es síncrono, y los parámetros de identidad del port conceptual deben derivarse del host autenticado, jamás del modelo. El port remoto debe validar autorizaciones, tipos, presupuestos y tiempos de espera; no reenviar prompts completos por defecto. Usar `topK` limitado y deduplicar por identificador estable. `score` no es comparable entre proveedores sin calibración; documentar cada significado. El almacenamiento remoto necesita transacciones, índices únicos y control de concurrencia. Un timeout no garantiza que un commit remoto no se haya efectuado; usar clave idempotente y consultas de estado.

## Memoria operacional y RAG documental
- `your-team-knowledge`: candidato conceptual para memoria operacional de agentes (decisiones verificadas, convenciones, aprendizajes). El consumo real exige comprobar contrato, autenticación, scopes y disponibilidad del servidor de ese proyecto.
- `your-rag-platform`: candidato conceptual para recuperación documental (especificaciones, arquitectura, documentación de negocio). Puede combinar embeddings, búsqueda léxica y reranking; no se presume que esos endpoints ya existan.
- MCP: integración natural para búsquedas decididas por el agente. Reusar cliente nativo de Pi y allowlist exacta de Lección 12. Los nombres reales deben verificarse con `tools/list` y el origen confiable. Las lecturas automáticas desde hooks requieren un adaptador host con su propio control (no pasan necesariamente por `tool_call` de Pi). No registrar un nombre genérico de escritura que dé acceso a cualquier dato. La política de persistencia debe imponerse en el servicio receptor.
- HTTP: alternativa para recuperación determinista antes del primer request; mantener credenciales fuera de prompts. Limitar hosts a servicios aprobados, controlar redirecciones, validar respuesta, cancelar por plazo y registrar sólo métricas/códigos, no texto sensible.

No hay dependencia ni integración en vivo con ninguno de esos repositorios, ni endpoint inventado. Para esta lección, la semilla y el archivo local sustituyen a ambos servicios.
