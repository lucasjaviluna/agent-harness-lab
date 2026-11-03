import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Informe LOCAL y orientativo: no reemplaza el descubrimiento de Pi. */
export interface ProjectContextReport {
  scope: 'working-directory-only';
  cwd: string;
  contextFiles: string[];
  projectSystemPrompt: string | null;
  projectAppendSystemPrompt: string | null;
  promptTemplates: string[];
  requiresProjectTrust: boolean;
  notes: string[];
}

const CONTEXT_NAMES = ['AGENTS.override.md', 'AGENTS.md', 'AGENTS.MD', 'CLAUDE.md', 'CLAUDE.MD'];

function fileExists(path: string): boolean {
  try { return statSync(path).isFile(); }
  catch { return false; }
}

export function inspectProjectContext(cwd: string): ProjectContextReport {
  const root = resolve(cwd);
  let directoryNames: Set<string>;
  try { directoryNames = new Set(readdirSync(root)); }
  catch { directoryNames = new Set(); }
  const contextFiles = CONTEXT_NAMES.filter(name => directoryNames.has(name) && fileExists(join(root, name)));
  const piDir = join(root, '.pi');
  const systemFile = join(piDir, 'SYSTEM.md');
  const appendFile = join(piDir, 'APPEND_SYSTEM.md');
  const promptsDir = join(piDir, 'prompts');
  let promptTemplates: string[] = [];
  if (existsSync(promptsDir)) {
    try {
      promptTemplates = readdirSync(promptsDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
        .map(entry => `.pi/prompts/${entry.name}`)
        .sort();
    } catch { /* Ausente o ilegible: el informe no intenta cargar recursos. */ }
  }
  const projectSystemPrompt = fileExists(systemFile) ? '.pi/SYSTEM.md' : null;
  const projectAppendSystemPrompt = fileExists(appendFile) ? '.pi/APPEND_SYSTEM.md' : null;
  return {
    scope: 'working-directory-only',
    cwd: root,
    contextFiles,
    projectSystemPrompt,
    projectAppendSystemPrompt,
    promptTemplates,
    requiresProjectTrust: Boolean(projectSystemPrompt || projectAppendSystemPrompt || promptTemplates.length),
    notes: [
      'Informe sólo del directorio actual; Pi también puede cargar instrucciones de padres y del agent-dir.',
      'La carga efectiva de .pi depende de trust y de la configuración de Pi; este informe NO confirma la carga.',
      'AGENTS.md orienta al modelo, pero no impone seguridad ni autorizaciones.',
    ],
  };
}
