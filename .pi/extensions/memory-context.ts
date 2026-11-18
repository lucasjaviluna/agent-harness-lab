/** Opt-in local memory, no model-controlled write tool and no network. */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { buildContext, candidate, remember, retrieve } from '../memory/memory.mjs';

export default function memoryContext(pi: ExtensionAPI) {
  if (process.env.AGENT_LAB_MEMORY !== '1') return;
  const writeEnabled = process.env.AGENT_LAB_MEMORY_WRITE === '1';
  let pending: { cwd: string; text: string } | undefined;
  let completed = false;
  const clear = () => {pending=undefined; completed=false;};
  // Never log prompts, chunks, or raw filesystem errors. stdout stays protocol-only.
  const warn = (message: string) => process.stderr.write(`[lab-memory] ${message}\n`);
  pi.on('session_start', clear);
  pi.on('session_shutdown', clear);
  pi.on('before_agent_start', (event,ctx) => {
    clear();
    if(event.messageType !== 'user') return;
    const text = writeEnabled && !event.images?.length ? candidate(event.prompt) : null;
    if(text) pending={cwd:ctx.cwd,text};
    try {
      const context=buildContext(retrieve(ctx.cwd,event.prompt));
      if(context) return {message:{customType:'lab-memory-context',content:context.content,display:true,details:{ids:context.ids}}};
    } catch {warn('Recuperación no disponible; continuando sin contexto adicional.');}
  });
  // A low-level agent_end is NOT final. Each new run invalidates the previous outcome.
  pi.on('agent_start', () => {completed=false;});
  pi.on('agent_before_settle', (event) => {completed=event.outcome==='completed';});
  pi.on('agent_settled', (event,ctx) => {
    const item=pending;
    const allowed=completed && event.aborted===false && item?.cwd===ctx.cwd;
    clear();
    if(!item||!allowed)return;
    try{const result=remember(item.cwd,item.text);warn(`Persistencia: ${result.status}.`);}
    catch{warn('Persistencia rechazada o no disponible.');}
  });
}
