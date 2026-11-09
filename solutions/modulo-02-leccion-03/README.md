# US-LAB-008 — solución completa

## Objetivo

Implementar `lab_package_summary` como segunda Custom Tool de solo lectura.
No se modifica el CLI ni el runtime del laboratorio; Pi la carga con `--extension`.

## Aplicación

1. Copiar `package-summary.ts` a `.pi/extensions/package-summary.ts`.
2. Ajustar `pi.tools` en la configuración para incluir `lab_package_summary`.
3. Ejecutar:

```bash
node dist/cli.js run "Resume el package.json con lab_package_summary" \
  --config examples/config/harness.tools.example.json \
  --extension .pi/extensions/package-summary.ts --dry-run
```

El config de ejemplo debe editarse antes: agregar `lab_package_summary` a la lista `pi.tools`.
El dry-run sólo muestra argumentos; para ejecutar de verdad hace falta una sesión Pi autenticada.

## Verificación

```bash
node --test solutions/modulo-02-leccion-03/tests/package-summary.test.mjs
npm test
```

La solución valida archivos, restringe tamaño, omite los **valores** de scripts
(pueden contener datos sensibles), devuelve `details` y un error controlado.
No equivale a un sandbox ni a una política de permisos completa.
