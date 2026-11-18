# Lección 14 — ejemplos RPC

Desde la raíz:

```powershell
npm run rpc:run -- "Mi proyecto ficticio se llama Atlas" "¿Cómo se llama?"
npm run rpc:run -- --reset-between "Mi proyecto ficticio se llama Atlas" "¿Cómo se llama?"
npm run rpc:run -- --stream --read-only "Lista los archivos de src"
```

El launcher reutiliza `pi.executable` de `harness.config.json`; el resto es un perfil cerrado propio. Requiere Pi instalado y autenticado. Los comandos pueden consumir tokens. No uses proyectos sensibles.

`protocol.example.jsonl` documenta el intercambio, no se envía completo a stdin. `tests/fixtures/fake-rpc.mjs` es un proceso simulado para los tests, no un agente real.

Para el cliente oficial, instala el SDK como en la lección 13. `examples/sdk/rpc-native.example.ts` recibe la ruta a un CLI JavaScript ejecutable de la misma versión del SDK (no `pi.cmd` ni un binario). Ejecuta desde la raíz:

```powershell
npm install --prefix examples/sdk --ignore-scripts
npm run sdk:typecheck
node --experimental-strip-types examples/sdk/rpc-native.example.ts "C:/ruta/al/cli.js" "Explica RPC en una frase"
```

Este ejemplo requiere verificación local contra el SDK real. En una instalación npm de Pi 1.5.2 se puede examinar `examples/sdk/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js` como ruta candidata. Verifica que exista; no es una ruta universal.
