/** Módulo 2 · Lección 6 — herramientas expuestas de dos maneras.
 * Pi proporciona codemode y tool_search, este archivo no los implementa.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readProjectFacts, listTestInventory } from '../tools/lab-catalog-core.mjs';

export default function labToolCatalog(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'lab_project_facts', label: 'Project Facts',
    description: 'Resumen acotado de package.json: nombre, versión, cantidades de dependencias y nombres de scripts. Sin leer comandos de scripts.',
    exposure: 'codemode',
    namespace: { name: 'agent-lab', description: 'Consultas locales y de solo lectura del laboratorio' },
    parameters: Type.Object({}, { additionalProperties: false }),
    async execute(_id, _params, signal, _update, ctx) {
      try {
        const facts = await readProjectFacts(ctx.cwd, signal);
        return { content: [{ type: 'text' as const, text: JSON.stringify(facts) }], details: { ok: true, facts } };
      } catch {
        return { content: [{ type: 'text' as const, text: 'No se pudo obtener el resumen del proyecto' }], details: { ok: false }, isError: true };
      }
    },
  });
  pi.registerTool({
    name: 'lab_test_inventory', label: 'Test Inventory',
    description: 'Lista los archivos *.test.mjs/js/ts/cjs de tests/ sin abrir su contenido. Útil para identificar los tests disponibles.',
    exposure: 'deferred',
    namespace: { name: 'agent-lab', description: 'Consultas locales y de solo lectura del laboratorio' },
    parameters: Type.Object({}, { additionalProperties: false }),
    async execute(_id, _params, signal, _update, ctx) {
      try {
        const inventory = await listTestInventory(ctx.cwd, signal);
        return { content: [{ type: 'text' as const, text: JSON.stringify(inventory) }], details: { ok: true, inventory } };
      } catch {
        return { content: [{ type: 'text' as const, text: 'No se pudo consultar el inventario de tests' }], details: { ok: false }, isError: true };
      }
    },
  });
}
