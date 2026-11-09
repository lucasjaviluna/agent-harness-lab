Módulo 2 · Lección 3 (Lección 8)
Agent Harness Lab v0.7.0 -> v0.8.0

Base esperada: versión v0.7.0 de la Lección 7 (Módulo 2/Lección 2).
Esta actualización NO debe aplicarse directamente sobre v0.5.0 ni v0.6.0.

Cambios:
- .pi/extensions/workspace-inspector.ts: registra la Custom Tool lab_workspace_report.
- examples/config/harness.tools.example.json: allowlist explícito que incluye la Tool.
- examples/tools/*: prompt de prueba y casos manuales.
- tests/workspace-tool.test.mjs: pruebas de la Tool, límites, errores y CLI.
- solutions/modulo-02-leccion-03/: US-LAB-008 resuelto de manera separada.
- README.md, CHANGELOG.md, LECCION_08.md y package.json actualizados.

No se modificaron src/runtime.ts, src/cli.ts, src/config.ts, src/extension-options.ts
ni los tests anteriores de Windows. Se mantiene shell:false.

Aplicación recomendada:
1) Comprobar que el repositorio local está en v0.7.0 y sin cambios pendientes.
2) Crear una rama feature/module-02-lesson-03.
3) git apply --check <archivo.patch>
4) git apply <archivo.patch>
5) npm install && npm test && npm run typecheck
6) node dist/cli.js run-file examples/tools/workspace-inspection.md \
    --config examples/config/harness.tools.example.json \
    --extension .pi/extensions/workspace-inspector.ts \
    --mode json --view tools --dry-run

Para una ejecución real hace falta Pi instalado y autenticación configurada.
Los tests usan un simulador/mocks, no una sesión autenticada de Pi.
