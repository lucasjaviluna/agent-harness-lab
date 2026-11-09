/**
 * Módulo 2 / Lección 2 — extensión observadora, sin herramientas propias.
 * Pi ejecuta este archivo mediante jiti, sin compilarlo con el CLI del lab.
 * No persiste secretos, no intercepta prompts, ni bloquea operaciones.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function lifecycleObserver(pi: ExtensionAPI) {
  let lowLevelRuns = 0;
  let finishedTools = 0;
  let lastAborted = false;

  pi.on('session_start', (_event, ctx) => {
    lowLevelRuns = 0;
    finishedTools = 0;
    lastAborted = false;
    if (ctx.hasUI) ctx.ui.setStatus('agent-lab', 'Extensión lista');
  });

  pi.on('agent_start', () => { lowLevelRuns += 1; });
  pi.on('tool_execution_end', () => { finishedTools += 1; });

  // agent_end no indica necesariamente que terminó todo: puede haber reintentos.
  pi.on('agent_settled', (event, ctx) => {
    lastAborted = event.aborted === true;
    if (ctx.hasUI) {
      ctx.ui.setStatus('agent-lab', `Runs: ${lowLevelRuns} · Tools: ${finishedTools}${lastAborted ? ' · abortado' : ''}`);
    }
  });

  pi.on('session_shutdown', (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setStatus('agent-lab', undefined);
  });

  pi.registerCommand('lab-stats', {
    description: 'Muestra los contadores de ejecución del laboratorio',
    handler: async (_args, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify(`Runs: ${lowLevelRuns}, herramientas terminadas: ${finishedTools}, abortado: ${lastAborted}`, 'info');
      }
    },
  });
}
