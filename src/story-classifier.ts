/** L16: clasificación explicable. Las señales son declaradas, no un análisis de impacto real. */
export type Complexity = 'simple' | 'medium' | 'complex';
export type Scope = 'localized' | 'feature' | 'cross-cutting' | 'unknown';
export interface Story {
  id: string;
  description: string;
  scope: Scope;
  acceptanceCriteria: string[];
  risks: { security: boolean; dataMigration: boolean; breakingChange: boolean; crossRepo: boolean } | null;
}
export interface Classification { level: Complexity; reasons: string[]; }
const levels: Complexity[] = ['simple','medium','complex'];
const riskKeys = ['security','dataMigration','breakingChange','crossRepo'] as const;
const scopes: Scope[] = ['localized','feature','cross-cutting','unknown'];
function record(v: unknown): Record<string,unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Se requiere un objeto JSON');
  return v as Record<string,unknown>;
}
function text(v: unknown, max: number): v is string {
  return typeof v === 'string' && !!v.trim() && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
}
export function parseStory(raw: unknown): Story {
  const r = record(raw);
  if (Object.keys(r).some(k=>!['id','description','scope','acceptanceCriteria','risks'].includes(k))) throw new Error('Campos de historia desconocidos');
  if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.id) || !text(r.description,4000) || !scopes.includes(r.scope as Scope)) throw new Error('Historia inválida');
  if (!Array.isArray(r.acceptanceCriteria) || r.acceptanceCriteria.length>12 || !r.acceptanceCriteria.every(x=>text(x,400))) throw new Error('Criterios de aceptación inválidos');
  let risks: Story['risks'] = null;
  if (r.risks !== null) {
    const rr = record(r.risks);
    if(Object.keys(rr).length!==4 || !riskKeys.every(k=>typeof rr[k]==='boolean')) throw new Error('Declarar explícitamente los cuatro riesgos, o null si son desconocidos');
    risks = Object.fromEntries(riskKeys.map(k=>[k,rr[k]])) as NonNullable<Story['risks']>;
  }
  return {id:r.id,description:r.description.trim(),scope:r.scope as Scope,acceptanceCriteria:r.acceptanceCriteria.map(x=>x.trim()),risks};
}
export function storyFromPrompt(prompt: string): Story {
  return parseStory({id:'PROMPT',description:prompt,scope:'unknown',acceptanceCriteria:[],risks:null});
}
export function classify(story: Story): Classification {
  const s = parseStory(story);
  const reasons: string[]=[];
  if(s.scope==='cross-cutting') reasons.push('Alcance transversal');
  for(const k of riskKeys) if(s.risks?.[k]) reasons.push(`Riesgo declarado: ${k}`);
  // Heurística conservadora: palabras sensibles sólo elevan, nunca reducen.
  const content = [s.description,...s.acceptanceCriteria].join(' ').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
  if(/\b(auth|oauth|jwt|autenticacion|autorizacion|credenciales|credentials|security|seguridad|migracion|migration|breaking|pagos|payments)\b/.test(content)) reasons.push('Señal textual sensible (requiere revisar impacto)');
  if(reasons.length) return {level:'complex',reasons};
  if(s.scope!=='localized') reasons.push('Alcance no localizado o desconocido');
  if(!s.risks) reasons.push('Riesgos no evaluados');
  if(!s.acceptanceCriteria.length) reasons.push('Sin criterios de aceptación');
  return reasons.length?{level:'medium',reasons}:{level:'simple',reasons:['Alcance localizado, riesgos declarados negativos y criterios presentes']};
}
export function escalate(base: Classification, proposed: Complexity, source: string): Classification {
  if(!levels.includes(proposed)) throw new Error('Complejidad inválida');
  return {level: levels[Math.max(levels.indexOf(base.level),levels.indexOf(proposed))],reasons:[...base.reasons,`${source}: ${proposed} (sólo puede elevar)`]};
}
/** El JSON del modelo no decide gates, comandos ni permisos. Si no respeta el contrato, escalar. */
export function applyModelHint(base: Classification, raw: string): Classification {
  try {
    if(raw.length>1000) throw new Error('hint largo');
    const v=record(JSON.parse(raw));
    if(Object.keys(v).length!==1 || !levels.includes(v.level as Complexity)) throw new Error('hint inválido');
    return escalate(base,v.level as Complexity,'Clasificador LLM');
  } catch { return escalate(base,'complex','Clasificador LLM inválido'); }
}
