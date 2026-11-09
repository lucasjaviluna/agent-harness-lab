/**
 * Módulo 2 · Lección 5: estado efímero de presentación.
 * Intencionalmente fuera de .pi/extensions para que Pi no lo descubra como extensión.
 * No almacena prompts, parámetros ni resultados de herramientas.
 */
export function createOperatorState() {
  return { runs: 0, toolCalls: 0, failures: 0, working: false, enabled: false, footer: false, placement: 'aboveEditor' };
}

export function recordOperatorEvent(state, event) {
  switch (event.type) {
    case 'agent_start': state.runs += 1; state.working = true; break;
    case 'tool_execution_end':
      state.toolCalls += 1;
      if (event.isError === true) state.failures += 1;
      break;
    case 'agent_settled': state.working = false; break;
    case 'session_start':
      state.runs = 0; state.toolCalls = 0; state.failures = 0; state.working = false;
      break;
  }
  return state;
}

export function operatorStatus(state) {
  return `Agent Lab | ${state.working ? 'trabajando' : 'listo'} | turnos: ${state.runs} | tools: ${state.toolCalls} | fallos: ${state.failures}`;
}

export function operatorWidget(state) {
  return [
    'AGENT LAB - PANEL DE OPERADOR',
    `Estado: ${state.working ? 'ejecutando' : 'en reposo'} | Turnos: ${state.runs}`,
    `Herramientas: ${state.toolCalls} | Fallos: ${state.failures}`,
    'Comandos: /lab-panel  /lab-ui off  /lab-footer on',
  ];
}

export function fitAscii(input, width) {
  // Sólo ASCII generado internamente: no procesamos secuencias ANSI ni texto del LLM.
  const n = Number.isInteger(width) ? Math.max(0, width) : 0;
  return String(input).slice(0, n);
}
