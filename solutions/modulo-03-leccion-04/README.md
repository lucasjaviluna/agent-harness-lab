# US-LAB-015 — umbral de relevancia

La solución modifica solamente `.pi/memory/memory.mjs`. Copiar el archivo sobre la base y `tests/memory-threshold.test.mjs` a `tests/`. Ejecutar `npm test`. Mantener la semilla original `.pi/memory/seed.json`.

`rank(query, records, { minScore: 0.5 })` mantiene sólo coincidencias de score mayor que cero y al menos 0.5. El valor por defecto es cero (compatibilidad); 0 y 1 son válidos. No confundir este score de cobertura léxica con probabilidad ni similitud de embeddings. `retrieve` reenvía el argumento opcional. El ejercicio no altera el hook ni el presupuesto. Una futura configuración podría proporcionar el umbral explícito al hook; no se introduce otro archivo para eso en esta etapa.

Los cuatro tests cubren límites, compatibilidad, inputs inválidos y propagación real con semilla.
