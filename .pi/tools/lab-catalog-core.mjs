/** Utilidades de lectura del Módulo 2 · Lección 6.
 * Separadas de Pi para poder testear el comportamiento sin proveedor de IA.
 */
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

function safeString(value, max = 96) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

export async function readProjectFacts(cwd, signal) {
  signal?.throwIfAborted();
  const file = join(cwd, 'package.json');
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) {
    throw new Error('package.json no disponible o demasiado grande');
  }
  const contents = await readFile(file, 'utf8');
  signal?.throwIfAborted();
  const pkg = JSON.parse(contents);
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('package.json inválido');
  }
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
    ? Object.keys(pkg.scripts).filter(x => !x.startsWith('.')).sort().slice(0, 20).map(x => safeString(x, 64))
    : [];
  return {
    name: safeString(pkg.name),
    version: safeString(pkg.version),
    dependencies: pkg.dependencies && typeof pkg.dependencies === 'object' && !Array.isArray(pkg.dependencies)
      ? Object.keys(pkg.dependencies).length : 0,
    devDependencies: pkg.devDependencies && typeof pkg.devDependencies === 'object' && !Array.isArray(pkg.devDependencies)
      ? Object.keys(pkg.devDependencies).length : 0,
    scriptNames: scripts,
  };
}

export async function listTestInventory(cwd, signal) {
  signal?.throwIfAborted();
  const directory = join(cwd, 'tests');
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('tests/ no disponible');
  const files = await readdir(directory, { withFileTypes: true });
  signal?.throwIfAborted();
  const matches = files.filter(f => f.isFile() && !f.isSymbolicLink() && !f.name.startsWith('.') && /^[-a-zA-Z0-9_.]+\.test\.(mjs|cjs|js|ts)$/.test(f.name))
    .map(f=>f.name).sort();
  return { count: matches.length, files: matches.slice(0, 25), omitted: Math.max(0, matches.length - 25) };
}
