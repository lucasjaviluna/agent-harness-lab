/**
 * Módulo 2 · Lección 4 (Lección 9)
 * Política pura y comprobable fuera de Pi. NO es un sandbox del sistema operativo.
 * La política del proyecto puede ENDURECER las reglas, nunca convertir un
 * write/edit en allow sin aprobación.
 */
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { join, isAbsolute, relative, resolve, sep, win32 } from 'node:path';

export const POLICY_FILE = '.pi/policies/tool-approvals.json';
const SAFE_TOOLS = new Set(['read', 'ls', 'find', 'grep', 'lab_workspace_report']);
const CHANGING_TOOLS = new Set(['write', 'edit']);
const PROTECTED = new Set(['.git', '.pi', '.agents', 'node_modules', 'dist']);
const TOOL_NAME = /^[a-z][a-z0-9_-]{0,79}$/;

export function parsePolicy(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La política debe ser un objeto JSON');
  }
  const keys = Object.keys(value);
  if (keys.some(key => !['version', 'bash', 'denyTools', 'askTools', 'denyWriteExtensions'].includes(key))) {
    throw new Error('La política contiene campos desconocidos');
  }
  if (value.version !== 1) throw new Error('version debe ser 1');
  if (value.bash !== 'deny' && value.bash !== 'ask') {
    throw new Error('bash debe ser deny o ask');
  }
  const asSet = (name) => {
    const entries = value[name];
    if (!Array.isArray(entries) || entries.length > 32 || !entries.every(x => typeof x === 'string' && TOOL_NAME.test(x))) {
      throw new Error(`${name} debe ser una lista de nombres de herramientas válidos`);
    }
    return new Set(entries);
  };
  const denyTools = asSet('denyTools');
  const askTools = asSet('askTools');
  const suffixes = value.denyWriteExtensions ?? [];
  if (!Array.isArray(suffixes) || suffixes.length > 20 || !suffixes.every(x => typeof x === 'string' && /^\.[a-z0-9]{1,12}$/.test(x))) {
    throw new Error('denyWriteExtensions debe ser una lista de extensiones .abc en minúsculas');
  }
  const denyWriteExtensions = new Set(suffixes);
  if (['read', 'ls', 'find', 'grep', 'write', 'edit', 'bash'].some(n => askTools.has(n))) {
    throw new Error('askTools sólo admite herramientas adicionales; las integradas tienen reglas fijas');
  }
  return { bash: value.bash, denyTools, askTools, denyWriteExtensions };
}

export function loadPolicy(cwd) {
  let data;
  try {
    data = readFileSync(join(cwd, POLICY_FILE), 'utf8');
  } catch (error) {
    // Ausencia de la política: mantener reglas seguras por defecto;
    // otros errores de lectura bloquean todo.
    if (error?.code !== 'ENOENT') throw new Error('No se pudo leer la política');
    return parsePolicy({ version: 1, bash: 'deny', denyTools: [], askTools: [] });
  }
  try { return parsePolicy(JSON.parse(data)); }
  catch { throw new Error('Política inválida'); }
}

/**
 * Verifica rutas de escritura. Los enlaces simbólicos existentes se rechazan,
 * así como los destinos fuera de cwd y las carpetas protegidas.
 * No sustituye controles OS: existe TOCTOU entre esta comprobación y el write.
 */
export function validateWritePath(cwd, requestedPath) {
  if (typeof requestedPath !== 'string' || !requestedPath.trim() || requestedPath.includes('\0') || requestedPath.length > 4096) {
    return { ok: false, reason: 'Ruta de escritura inválida' };
  }
  if (process.platform !== 'win32' && win32.isAbsolute(requestedPath)) {
    return { ok: false, reason: 'Ruta fuera del workspace' };
  }
  if (requestedPath.includes('\\') && process.platform !== 'win32') {
    return { ok: false, reason: 'Separadores de ruta incompatibles' };
  }
  let root;
  try { root = realpathSync(cwd); }
  catch { return { ok: false, reason: 'Workspace inaccesible' }; }
  const target = resolve(root, requestedPath);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) {
    return { ok: false, reason: 'Ruta fuera del workspace' };
  }
  const segments = relativePath.split(sep);
  if (segments.some(segment => {
    const name = process.platform === 'win32' ? segment.toLowerCase() : segment;
    return PROTECTED.has(name) || name === '.env' || name.startsWith('.env.');
  })) return { ok: false, reason: 'Ruta protegida' };
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return { ok: false, reason: 'No se permiten enlaces simbólicos' };
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      return { ok: false, reason: 'No se puede verificar la ruta' };
    }
  }
  return { ok: true, display: relativePath.split(sep).join('/') };
}

/** Retorna allow | deny | ask; ninguna rama autoriza silenciosamente cambios. */
export function decideToolCall(cwd, toolName, input, policy) {
  if (typeof toolName !== 'string' || !TOOL_NAME.test(toolName)) {
    return { action: 'deny', reason: 'Herramienta inválida' };
  }
  if (policy.denyTools.has(toolName)) return { action: 'deny', reason: 'Herramienta bloqueada por la política' };
  if (CHANGING_TOOLS.has(toolName)) {
    const check = validateWritePath(cwd, input?.path);
    if (!check.ok) return { action: 'deny', reason: check.reason };
    const target = check.display.toLowerCase();
    if ([...policy.denyWriteExtensions].some(suffix => target.endsWith(suffix))) {
      return { action: 'deny', reason: 'Extensión de archivo protegida' };
    }
    return { action: 'ask', target: check.display, reason: 'Modificación de archivo' };
  }
  if (toolName === 'bash') {
    return policy.bash === 'ask'
      ? { action: 'ask', target: 'Comando de terminal', reason: 'Ejecución de shell: revisar el comando completo en la solicitud del agente' }
      : { action: 'deny', reason: 'Shell deshabilitado en esta política' };
  }
  if (policy.askTools.has(toolName)) return { action: 'ask', target: toolName, reason: 'Herramienta adicional' };
  if (SAFE_TOOLS.has(toolName)) return { action: 'allow' };
  return { action: 'deny', reason: 'Herramienta desconocida: no incluida en la política' };
}
