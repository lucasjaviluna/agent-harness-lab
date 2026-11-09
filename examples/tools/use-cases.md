# Casos de prueba manual (Lección 8)

1. `directory: "src", limit: 5`: listar nombres de entradas visibles.
2. `directory: ".", limit: 3`: respuesta acotada con `omitted` >= 0.
3. `directory: "../", limit: 5`: error (intento de escapar del workspace).
4. `directory: ".git"`: error (directorio oculto).
5. `directory: "no-existe"`: error sin filtrar rutas del sistema.
6. `directory: "src", limit: 999`: error de schema antes del execute (Pi) y validación defensiva dentro de la función.
7. Si hay un symlink de `src` hacia afuera del repositorio, la inspección debe fallar.

Estos casos no demuestran sandboxing. Para ello se requiere aislamiento del proceso Pi.
