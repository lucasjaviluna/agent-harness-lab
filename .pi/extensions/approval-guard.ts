/**
 * Módulo 2 · Lección 4 (Lección 9) — Guard de aprobación (Pi ExtensionAPI).
 * Advertencia: este guard vive DENTRO del proceso Pi y NO reemplaza un sandbox.
 * Para garantías obligatorias se necesita una política fuera del proceso agente.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { decideToolCall, loadPolicy } from '../policies/approval-policy.mjs';

export default function approvalGuard(pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    let decision;
    try {
      const policy = loadPolicy(ctx.cwd);
      decision = decideToolCall(ctx.cwd, event.toolName, event.input, policy);
    } catch {
      return { block: true, reason: 'Política no disponible o inválida: ejecución bloqueada', terminate: true };
    }
    if (decision.action === 'allow') return;
    if (decision.action === 'deny') {
      return { block: true, reason: decision.reason, terminate: true };
    }
    // JSON/print no pueden mostrar diálogos; RPC necesita un cliente que responda.
    if (!ctx.hasUI || typeof ctx.ui?.confirm !== 'function') {
      return { block: true, reason: 'Operación requiere aprobación humana; no hay interfaz disponible', terminate: true };
    }
    // Bash puede afectar cualquier archivo. Mostrar el comando COMPLETO, no un resumen.
    let detail = `${decision.reason}\nDestino: ${decision.target ?? '(sin destino)'}`;
    if (event.toolName === 'bash') {
      const command = event.input?.command;
      if (typeof command !== 'string' || !command.trim() || command.length > 1200) {
        return { block: true, reason: 'Comando de shell inválido o demasiado largo para revisar', terminate: true };
      }
      detail += `\nComando completo: ${JSON.stringify(command)}`;
    }
    try {
      const approved = await ctx.ui.confirm(
        `Autorizar herramienta: ${event.toolName}`,
        `${detail}\n\nLa autorización se aplica sólo a esta llamada.\nRevisá también la solicitud original antes de aceptar.`,
      );
      if (approved === true) return;
      return { block: true, reason: 'Aprobación denegada o no recibida', terminate: true };
    } catch {
      return { block: true, reason: 'No se pudo obtener una aprobación: ejecución bloqueada', terminate: true };
    }
  });
}
