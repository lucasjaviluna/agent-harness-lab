# Comparación: Pi directo vs Agent Harness Lab

## Pi directo

```bash
pi --no-session --no-mcp --no-extensions --tools read,grep,find,ls --print "Explica este repositorio"
```

## Usando nuestra herramienta

```bash
node dist/cli.js run "Explica este repositorio"
```

El resultado puede ser similar; la diferencia está en dónde declaramos las opciones y cómo podremos evolucionar la experiencia de ejecución.

## Punto importante
`--tools` selecciona herramientas expuestas al modelo. No es una sandbox ni un sistema completo de permisos.
