/** Puente real: sólo este laboratorio requiere el paquete Pi instalado localmente. */
import {
  createAgentSession, DefaultResourceLoader, getAgentDir, ModelRuntime,
  SessionManager, SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { parseSdkArgs, runSdkSession } from '../../src/sdk-runner.ts';

async function main() {
  const options = parseSdkArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true,
    noThemes: true, noContextFiles: true,
    disabledBuiltinExtensions: ['mcp', 'codemode', 'tool_search'],
    systemPromptOverride: () => 'Eres un asistente de laboratorio. Responde con precisión. No solicites datos sensibles.',
    appendSystemPromptOverride: () => [],
  });
  const modelRuntime = await ModelRuntime.create();
  const model = options.model ? (() => {
    const slash = options.model!.indexOf('/');
    const found = modelRuntime.getModel(options.model!.slice(0, slash), options.model!.slice(slash + 1));
    if (!found) throw new Error('Modelo exacto no encontrado en Pi');
    return found;
  })() : undefined;
  await resourceLoader.reload();
  const result = await runSdkSession(async () => {
    const { session } = await createAgentSession({
      cwd, agentDir, settingsManager, resourceLoader, modelRuntime, model,
      thinkingLevel: options.thinking,
      sessionManager: SessionManager.inMemory(cwd),
      tools: options.readOnly ? ['read', 'grep', 'find', 'ls'] : [],
    });
    try {
      // Aunque no tenemos extensiones, explicitamos el inicio de su ciclo de vida.
      await session.bindExtensions({});
      const allowed = new Set(options.readOnly ? ['read','grep','find','ls'] : []);
      if (session.getActiveToolNames().some(name => !allowed.has(name))) throw new Error('Herramienta inesperada al iniciar SDK');
      return session;
    } catch (error) { session.dispose(); throw error; }
  }, options, delta => { process.stderr.write(delta); });
  if (options.stream) process.stderr.write('\n');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(error => {
  // Errores de proveedor pueden contener información sensible: no imprimir stack ni payloads.
  const message = error instanceof Error ? error.message : '';
  const code = message.startsWith('SDK_TIMEOUT:') ? 124 : 1;
  process.stderr.write(`[agent-lab SDK] ${code === 124 ? 'Tiempo máximo excedido' : 'Ejecución fallida; revisa argumentos, instalación, modelo y autenticación.'}\n`);
  process.exitCode = code;
});
