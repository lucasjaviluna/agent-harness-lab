/** Diagnóstico del entorno, NO certificación de producción. Sin llamadas de red. */
export function meetsNodeRequirement(nodeVersion: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(nodeVersion);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 22 || major === 22 && (minor > 19 || minor === 19 && patch >= 0);
}

export function readiness(nodeVersion: string, packagedEntry: boolean) {
  const nodeOk = meetsNodeRequirement(nodeVersion);
  return {
    schemaVersion: 1,
    scope: 'lab-installation',
    checks: { nodeEngine: { passed: nodeOk, required: '>=22.19.0' }, executablePresent: { passed: packagedEntry } },
    canRunLab: nodeOk && packagedEntry,
    productionVerified: false,
    pending: ['Pi autenticado', 'Windows/macOS en entorno real', 'sandbox externo y controles de identidad', 'revisión de dependencias y seguridad', 'tests E2E sobre productos reales'],
  };
}
