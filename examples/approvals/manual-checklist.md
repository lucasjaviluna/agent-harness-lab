# Pruebas manuales de la Lección 9

1. Iniciar Pi interactivo desde la raíz del repositorio, con la extensión de guard cargada explícitamente.
2. Solicitar leer `src/cli.ts`: no debe pedir aprobación.
3. Solicitar escribir `examples/sample-approval.txt`: debe aparecer diálogo; probar "No" y luego "Sí".
4. Solicitar modificar `.env` o `.pi/extensions/approval-guard.ts`: debe bloquear incluso con TUI.
5. Solicitar ejecutar `bash`: la política por defecto lo bloquea.
6. Ejecutar `agent-lab run-file examples/approvals/change-request.md --config examples/config/harness.approvals.example.json --extension .pi/extensions/approval-guard.ts --mode json`: debe rechazar el write al no existir UI para autorizar.
7. Confirmar que al omitir `--extension` **no existe guard obligatorio**: una limitación que abordaremos fuera del proceso agente.

Nota: un `tool_execution_start` en eventos no demuestra que el comando corrió; Pi emite la intención de ejecutar antes del hook `tool_call`. Confirmar mediante el resultado y el sistema de archivos.
