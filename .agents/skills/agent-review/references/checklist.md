# Checklist de code review

- **Correctitud:** condiciones límite, entradas vacías, tipos, contratos y errores.
- **Seguridad:** ejecución de comandos, acceso a archivos, filtrado de secretos, rutas y permisos.
- **Concurrencia:** reintentos, tareas duplicadas, timeout y cancelaciones.
- **Portabilidad:** rutas y comandos que funcionen en Windows, Linux y macOS.
- **Pruebas:** comportamiento observable, regresiones, casos negativos, falsos positivos.
- **Mantenibilidad:** responsabilidades claras y ausencia de abstracciones innecesarias.

No ejecutes scripts externos ni descargues herramientas a menos que la tarea lo requiera y el usuario lo autorice cuando corresponda.
