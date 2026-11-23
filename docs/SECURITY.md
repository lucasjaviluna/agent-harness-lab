# Seguridad y privacidad — Agent Harness Lab

- El contexto de modelos y las respuestas de herramientas son datos no confiables. No concederles autoridad de ejecución ni capacidad de modificar políticas.
- Configuración por defecto sin MCP, extensiones ni persistencia de sesión. La allowlist de herramientas no constituye aislamiento OS; los adaptadores tienen capacidades diferentes.
- Las aprobaciones del modo gobernado son locales; no proporcionan autenticación criptográfica del operador. Una cadena SHA-256 sólo detecta alteraciones **si su ancla se conserva separadamente**.
- No cargar Skills o servidores MCP de proyectos no confiables. Mantener herramientas de escritura, shell, red y credenciales fuera de perfiles experimentales.
- `agent-lab telemetry <events.jsonl>` lee un archivo local con máximo 4 MiB y emite únicamente agregados numéricos; no imprime prompts, tool names, rutas ni mensajes. El archivo de entrada sigue conteniendo potencialmente información sensible y no se elimina automáticamente.
- `npm pack` usa una allowlist explícita: sólo `dist`, README, docs y el `package.json` necesario. Nunca incluir `.pi/`, `.agents/`, `examples`, `tests`, `.lab-memory`, `.lab-evidence`, `.env` o `harness.config.json`.
- Mantener tokens en el proveedor/almacén de credenciales adecuado. No incluir credenciales ni bases de memoria en Git o el artefacto distribuido.
- Ejecutar escaneo de dependencias y pruebas en CI con una versión admitida de Node; el paquete local no ha sido sometido a auditoría de seguridad externa.

**Estado:** laboratorio educativo, no sandbox ni producto certificado. Ver [RELEASE_READINESS.md](RELEASE_READINESS.md).
