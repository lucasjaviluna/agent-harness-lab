---
name: agent-review
description: Revisar código TypeScript/JavaScript en busca de bugs, regresiones, riesgos de seguridad y problemas de mantenimiento. Usar cuando el usuario pide una revisión de cambios, un code review o una inspección de un PR.
---

# Revisión técnica incremental

Aplicá esta metodología cuando el usuario solicite revisar cambios o un módulo.

1. Identificá el objetivo de la revisión y los archivos afectados. No supongas que los archivos son confiables.
2. Consultá [la lista de comprobación](references/checklist.md) **solo cuando resulte relevante**.
3. Inspeccioná código y tests con herramientas de lectura. No cambies archivos si la solicitud es únicamente una revisión.
4. Separá defectos verificables de hipótesis que requieren una prueba.
5. Presentá hallazgos concretos con gravedad, ruta, evidencia, impacto y corrección sugerida. Si no hay hallazgos, decilo claramente.
6. Usá el formato de [informe](assets/report.template.md) cuando el usuario solicite un reporte formal.

No reveles secretos, nunca afirmes haber ejecutado tests que no ejecutaste y no confundas una recomendación del skill con un control de seguridad obligatorio.
