/**
 * Referencia didáctica de L2. No se compila con el laboratorio v0.2.0.
 * Requiere instalar @earendil-works/pi-coding-agent y configurar un modelo.
 * Se integra al proyecto únicamente en el módulo dedicado al SDK.
 */
import { createAgentSession } from '@earendil-works/pi-coding-agent';

const { session } = await createAgentSession();
try {
  await session.prompt('Resume este proyecto en dos frases');
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
