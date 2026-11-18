// Alternativa recomendada para producción: SDK oficial v2.
// Requiere instalar @modelcontextprotocol/server@2 y zod@4 en un proyecto separado.
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { getStory, storyTool } from './stories.mjs';
serveStdio(() => {
  const server = new McpServer({name:'lab-stories',version:'0.12.0'});
  server.registerTool(storyTool.name, {
    description:storyTool.description,
    inputSchema:z.object({id:z.string().regex(/^US-[0-9]{3}$/)}).strict(),
    annotations:storyTool.annotations,
  }, async args => getStory(args));
  return server;
});
