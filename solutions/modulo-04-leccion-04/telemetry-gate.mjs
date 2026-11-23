/** Solución US-LAB-020: quality gate independiente sobre métricas agregadas. */
export function evaluateTelemetryGate(summary, policy = {}) {
  const checkInt = (x, label) => {
    if (!Number.isSafeInteger(x) || x < 0 || x > 1000000) throw new Error(`Umbral inválido: ${label}`);
    return x;
  };
  if (!summary || typeof summary !== 'object' || Array.isArray(summary) || summary.schemaVersion !== 1) {
    throw new Error('Resumen de telemetría inválido');
  }
  const limits = {
    maxToolErrors: checkInt(policy.maxToolErrors ?? 0, 'maxToolErrors'),
    maxAbortedRuns: checkInt(policy.maxAbortedRuns ?? 0, 'maxAbortedRuns'),
    maxFailedMessages: checkInt(policy.maxFailedMessages ?? 0, 'maxFailedMessages'),
  };
  const metrics = ['toolErrors', 'abortedRuns', 'failedMessages', 'agentSettled'];
  for (const field of metrics) checkInt(summary[field], field);
  const reasons = [];
  if (summary.agentSettled < 1) reasons.push('No existe agent_settled: evidencia incompleta');
  if (summary.toolErrors > limits.maxToolErrors) reasons.push('Se excedió maxToolErrors');
  if (summary.abortedRuns > limits.maxAbortedRuns) reasons.push('Se excedió maxAbortedRuns');
  if (summary.failedMessages > limits.maxFailedMessages) reasons.push('Se excedió maxFailedMessages');
  return { status: reasons.length ? 'failed' : 'passed', reasons, limits };
}
