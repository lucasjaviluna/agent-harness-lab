// Datos sintéticos: no hay acceso a Azure, disco arbitrario ni red.
const stories = Object.freeze({
  'US-101': Object.freeze({ id: 'US-101', title: 'Agregar perfil de ejecución', state: 'Ready', priority: 2, acceptanceCriteria: Object.freeze(['El perfil se selecciona por nombre.', 'La configuración no contiene secretos.']) }),
  'US-102': Object.freeze({ id: 'US-102', title: 'Validar resultados de tests', state: 'Active', priority: 1, acceptanceCriteria: Object.freeze(['Mostrar el resultado de los tests.', 'Informar errores sin exponer credenciales.']) }),
});
export const storyTool = {
  name: 'get_story', description: 'Recupera una historia de usuario ficticia por ID, por ejemplo US-101.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^US-[0-9]{3}$' } }, required: ['id'], additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};
export function failure(text) { return { content: [{type:'text',text}], isError: true }; }
export function success(value) { return { content: [{type:'text',text:JSON.stringify(value)}], structuredContent: value }; }
export function getStory(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1 || !Object.hasOwn(args,'id') || typeof args.id !== 'string' || !/^US-[0-9]{3}$/.test(args.id)) return failure('ID inválido. Usá US-NNN.');
  const value = stories[args.id];
  return value ? success(value) : failure('Historia no encontrada.');
}

export const listTool = {
  name:'list_stories',description:'Lista historias ficticias por estado (Ready o Active).',
  inputSchema:{type:'object',properties:{state:{type:'string',enum:['Ready','Active']}},required:['state'],additionalProperties:false},
  annotations:storyTool.annotations,
};
export function listStories(args) {
  if (!args || typeof args!=='object' || Array.isArray(args) || Object.keys(args).length!==1 || !Object.hasOwn(args,'state') || !['Ready','Active'].includes(args.state)) return failure('Estado inválido.');
  return success({stories:Object.values(stories).filter(s=>s.state===args.state).map(({id,title,state})=>({id,title,state}))});
}
