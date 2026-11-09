Lección 9 — Módulo 2 / Lección 4 — v0.8.0 -> v0.9.0

Base: v0.8.0 (Lección 8) de https://github.com/lucasjaviluna/agent-harness-lab

Cambios aditivos:
- .pi/extensions/approval-guard.ts y approval-policy.mjs
- .pi/policies/tool-approvals.json
- examples/config/harness.approvals.example.json
- examples/approvals/*
- tests/approval-guard.test.mjs
- solutions/modulo-02-leccion-04/ (solución US-LAB-009)
- LECCION_09.md, README, CHANGELOG y package.json

Se preservan TODOS los archivos src/, la configuración principal, y el mecanismo pi-launcher.js de Windows sin cambios.

Aplicar con:
  git switch -c feature/module-02-lesson-04
  git apply --check agent_harness_lab_modulo_02_leccion_04.patch
  git apply agent_harness_lab_modulo_02_leccion_04.patch
  npm install
  npm test
  npm run typecheck

No reemplazar package-lock.json, ni las Skills del usuario, ni configuraciones personales.
Una política de aprobación in-process NO es sandbox ni enforcement para código no confiable.
Para aprobación interactiva usar `pi` en modo TUI; el CLI `agent-lab run` usa print/JSON y deniega modificaciones sin UI.
