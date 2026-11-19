/** L18: integración local y acotada de OpenSpec. No ejecuta código generado por el LLM. */
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { sha256 } from "./governance.js";
import { classify, parseStory, type Story } from "./story-classifier.js";
export const CHANGE = "add-benefit-filter";
const LIMIT = 64 * 1024;
const files = [
  ".openspec.yaml",
  "design.md",
  "proposal.md",
  "specs/benefits/spec.md",
  "tasks.md",
];
export function routeStory(input: Story) {
  const classification = classify(parseStory(input));
  return {
    classification,
    route:
      classification.level === "complex"
        ? "sdd"
        : classification.level === "medium"
          ? "planned"
          : "direct",
  };
}
export function sddArgs(
  kind: "status" | "instructions" | "validate",
  change = CHANGE,
): string[] {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(change) ||
    change.length > 80 ||
    change === "archive"
  )
    throw new Error("Cambio inválido");
  if (kind === "status") return ["status", "--change", change, "--json"];
  if (kind === "instructions")
    return ["instructions", "apply", "--change", change, "--json"];
  if (kind === "validate")
    return [
      "validate",
      change,
      "--type",
      "change",
      "--strict",
      "--json",
      "--no-interactive",
    ];
  throw new Error("Operación no permitida");
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Respuesta OpenSpec inválida");
  return v as Record<string, unknown>;
}
export function checkStatus(value: unknown, change = CHANGE) {
  const r = object(value);
  if (
    r.changeName !== change ||
    r.schemaName !== "spec-driven" ||
    (r.isPlanningComplete ?? r.isComplete) !== true ||
    !Array.isArray(r.artifacts)
  )
    throw new Error("Plan incompleto o schema inesperado");
  const artifacts = r.artifacts.map(object);
  if (
    artifacts.length !== 4 ||
    !["proposal", "specs", "design", "tasks"].every((id) =>
      artifacts.some((a) => a.id === id && a.status === "done"),
    )
  )
    throw new Error("Artefactos requeridos incompletos");
}
export function checkValidation(value: unknown, change = CHANGE) {
  const r = object(value);
  if (!Array.isArray(r.items) || r.items.length !== 1)
    throw new Error("Validación OpenSpec inválida");
  const a = object(r.items[0]);
  if (
    a.id !== change ||
    a.type !== "change" ||
    a.valid !== true ||
    !Array.isArray(a.issues) ||
    a.issues.some((x) => object(x).level !== "INFO")
  )
    throw new Error("Validación estricta no superada");
}
export type Native = (kind: "status" | "instructions" | "validate") => unknown;
export function makeNative(cwd: string, entry?: string): Native {
  // Entrada JS local, seleccionada por el operador, o binario nativo en PATH. Nunca shell:true ni npx automático.
  return (kind) => {
    const args = sddArgs(kind);
    const r = spawnSync(
      entry ? process.execPath : "openspec",
      entry ? [resolve(entry), ...args] : args,
      {
        cwd,
        shell: false,
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (r.error || r.status !== 0)
      throw new Error(
        `OpenSpec ${kind} falló (exit=${r.status ?? "none"}); verifica instalación y ejecuta el comando directamente para diagnóstico`,
      );
    try {
      return JSON.parse(r.stdout);
    } catch {
      throw new Error("OpenSpec no devolvió JSON válido");
    }
  };
}
function directory(p: string) {
  const s = lstatSync(p);
  if (!s.isDirectory() || s.isSymbolicLink())
    throw new Error("Directorio inválido");
}
function read(p: string): Buffer {
  const s = lstatSync(p);
  if (!s.isFile() || s.isSymbolicLink() || s.size > LIMIT)
    throw new Error("Archivo inválido");
  const b = readFileSync(p);
  if (b.length > LIMIT) throw new Error("Archivo demasiado grande");
  return b;
}
function walk(p: string, prefix = ""): string[] {
  directory(p);
  const result: string[] = [];
  for (const n of readdirSync(p)) {
    const child = join(p, n);
    const s = lstatSync(child);
    if (s.isSymbolicLink()) throw new Error("No se permiten enlaces");
    if (s.isDirectory()) {
      if (prefix.split("/").length > 4) throw new Error("Profundidad excedida");
      result.push(...walk(child, prefix + n + "/"));
    } else if (s.isFile()) result.push(prefix + n);
    else throw new Error("Entrada inválida");
    if (result.length > 20) throw new Error("Demasiados archivos");
  }
  return result.sort();
}
export function taskProgress(text: string) {
  const lines = text.split(/\r?\n/);
  const tasks = lines.filter((x) => /^\s*- \[[ xX]\] \S/.test(x));
  if (
    !tasks.length ||
    lines.some((x) => /^\s*[-*+]\s*\[/.test(x) && !/^\s*- \[[ xX]\] \S/.test(x))
  )
    throw new Error("Formato de tasks no admitido");
  return {
    total: tasks.length,
    complete: tasks.filter((x) => /^\s*- \[[xX]\]/.test(x)).length,
  };
}
export function snapshot(cwd: string) {
  directory(cwd);
  const os = join(cwd, "openspec");
  directory(os);
  const changes = join(os, "changes");
  directory(changes);
  const root = join(changes, CHANGE);
  const config = read(join(os, "config.yaml"));
  const list = walk(root);
  if (JSON.stringify(list) !== JSON.stringify(files))
    throw new Error("Conjunto de artefactos inesperado");
  const hashes = files.map((p) => {
    const b = read(join(root, p));
    return {
      path: p,
      digest: sha256(
        p === "tasks.md"
          ? b.toString("utf8").replace(/^(\s*- \[)[xX](\] \S)/gm, "$1 $2")
          : b,
      ),
    };
  });
  const progress = taskProgress(read(join(root, "tasks.md")).toString("utf8"));
  return {
    digest: sha256(
      JSON.stringify({
        schema: "lab-sdd-v1",
        change: CHANGE,
        configHash: sha256(config),
        files: hashes,
      }),
    ),
    files: hashes,
    progress,
  };
}
export function review(cwd: string, native: Native) {
  const before = snapshot(cwd);
  checkStatus(native("status"));
  checkValidation(native("validate"));
  const after = snapshot(cwd);
  if (
    before.digest !== after.digest ||
    JSON.stringify(before.progress) !== JSON.stringify(after.progress)
  )
    throw new Error("Plan cambió durante revisión");
  return after;
}
export interface CheckResult {
  status: "passed" | "failed";
  exitCode: number | null;
  outputHash: string;
}
export function productDigest(cwd: string) {
  directory(join(cwd, "src"));
  directory(join(cwd, "tests"));
  if (
    sha256(
      read(join(cwd, "tests/filter.test.mjs"))
        .toString("utf8")
        .replace(/\r\n/g, "\n"),
    ) !== "c2c44755a06fcc8b2fa9fbdae7a9f2b6cda08501f0890227c80374a966fc1a3f"
  )
    throw new Error("Suite de producto modificada");
  return sha256(
    JSON.stringify(
      ["src/filter.mjs", "tests/filter.test.mjs"].map((p) => ({
        path: p,
        digest: sha256(read(join(cwd, p))),
      })),
    ),
  );
}
export function executeProductTest(cwd: string): CheckResult {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ["--test", "tests/filter.test.mjs"], {
    cwd,
    env,
    shell: false,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: !r.error && r.status === 0 ? "passed" : "failed",
    exitCode: r.status,
    outputHash: sha256(
      JSON.stringify([
        r.stdout?.toString("base64") ?? "",
        r.stderr?.toString("base64") ?? "",
      ]),
    ),
  };
}
export function verify(
  cwd: string,
  approved: string,
  native: Native,
  test: () => CheckResult = () => executeProductTest(cwd),
) {
  if (!/^[a-f0-9]{64}$/.test(approved))
    throw new Error("Se requiere hash aprobado por operador");
  const plan = review(cwd, native);
  if (plan.digest !== approved)
    throw new Error("El plan cambió: requiere nueva aprobación");
  if (plan.progress.total !== plan.progress.complete)
    throw new Error("Tareas pendientes");
  const before = productDigest(cwd);
  const quality = test();
  if (
    !quality ||
    !["passed", "failed"].includes(quality.status) ||
    !/^[a-f0-9]{64}$/.test(quality.outputHash) ||
    (quality.status === "passed" && quality.exitCode !== 0)
  )
    throw new Error("Evidencia de test inválida");
  const after = review(cwd, native);
  if (
    after.digest !== plan.digest ||
    after.progress.total !== after.progress.complete ||
    before !== productDigest(cwd)
  )
    throw new Error("Archivos cambiaron durante verificación");
  return {
    version: 1,
    change: CHANGE,
    approvedDigest: approved,
    productDigest: before,
    progress: after.progress,
    quality,
    status: quality.status === "passed" ? "verified" : "failed",
    scope: "fixed-example-product-test",
    at: new Date().toISOString(),
  } as const;
}
export function persistReceipt(lab: string, result: ReturnType<typeof verify>) {
  const dir = join(realpathSync(lab), ".lab-evidence");
  try {
    mkdirSync(dir, { mode: 0o700 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  directory(dir);
  const name = `sdd-${randomUUID()}.json`;
  writeFileSync(join(dir, name), JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
    flush: true,
  });
  return name;
}
