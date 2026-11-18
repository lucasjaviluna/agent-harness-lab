/** Ejemplo opcional: pasar una herramienta propia al SDK sin una extensión en disco. */
import { createAgentSession, DefaultResourceLoader, defineTool, getAgentDir, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { runSdkSession } from '../../src/sdk-runner.ts';

const cwd = process.cwd(), agentDir = getAgentDir();
const settingsManager = SettingsManager.inMemory();
const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager,
  noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true, noThemes: true,
  disabledBuiltinExtensions: ['mcp','codemode','tool_search'],
  systemPromptOverride: () => 'Eres un asistente de laboratorio.', appendSystemPromptOverride: () => [],
});
const labStatus = defineTool({
  name: 'lab_sdk_status', label: 'SDK Status', description: 'Devuelve únicamente el estado fijo del laboratorio',
  parameters: Type.Object({}, { additionalProperties: false }),
  async execute(_id, _params, signal) {
    signal?.throwIfAborted();
    return { content: [{ type: 'text', text: 'SDK lab: listo' }], details: { ready: true } };
  },
});
await loader.reload();
const result = await runSdkSession(async () => {
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd), customTools: [labStatus], tools: ['lab_sdk_status'] });
  try {
    await session.bindExtensions({});
    if (session.getActiveToolNames().some(n => n !== 'lab_sdk_status')) throw new Error('Herramienta inesperada');
    return session;
  } catch (e) { session.dispose(); throw e; }
}, { prompts: ['Usa lab_sdk_status y resume su resultado.'], readOnly: false, stream: false, timeoutMs: 120000 });
console.log(JSON.stringify(result, null, 2));
