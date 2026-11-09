Módulo 2 · Lección 5 (global 10) | Actualización v0.9.0 -> v0.10.0

1. Verificá que `package.json` del repositorio indique 0.9.0.
2. Creá una rama y ejecutá `git apply --check <patch>`.
3. Aplicá el patch o copiá los archivos del ZIP incremental a la raíz.
4. Ejecutá `npm install`, `npm test`, `npm run typecheck`.
5. Desde la raíz ejecutá Pi interactivo: `pi --no-extensions --extension .pi/extensions/operator-ui.ts`.
6. En la TUI: `/lab-ui on`, `/lab-panel`, `/lab-widget below`, `/lab-footer on`, `/lab-footer off`, `/lab-ui off`.

No se modificaron src/runtime.ts, src/cli.ts ni tests previos de Windows.
El snapshot ZIP completo es una REFERENCIA; puede no incluir archivos propios que agregaste al repo.
Para no perder configuraciones propias ni package-lock.json, preferí aplicar el PATCH.
No es necesario modificar el CLI para que la extensión interactiva se cargue: la opción --extension ya existe desde la Lección 7.
