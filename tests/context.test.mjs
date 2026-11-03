import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const entry = join(root, "dist", "cli.js");
function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), "agent-lab-context-"));
  const pi = join(cwd, "fake-pi.mjs");
  writeFileSync(
    pi,
    `#!/usr/bin/env node
if (process.argv.includes('--version')) { console.log('fake'); process.exit(); }
console.log(JSON.stringify(process.argv.slice(2)));
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(cwd, "harness.config.json"),
    JSON.stringify({ pi: { executable: pi } }),
  );
  if (process.platform === "win32") {
    writeFileSync(
      join(cwd, "preload.cjs"),
      `
const cp = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const original = cp.spawn;
cp.spawn = (command, args, opts) => command === process.env.FAKE_PI_SCRIPT
  ? original(process.execPath, [command, ...args], opts) : original(command, args, opts);
syncBuiltinESMExports();`,
    );
  }
  return {
    cwd,
    pi,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}
function invoke(w, args) {
  const env = { ...process.env };
  if (process.platform === "win32") {
    env.FAKE_PI_SCRIPT = w.pi;
    env.NODE_OPTIONS =
      `${env.NODE_OPTIONS || ""} --require "${join(w.cwd, "preload.cjs").replaceAll("\\", "/")}"`.trim();
  }
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: w.cwd,
    env,
    encoding: "utf8",
  });
}

test("context informa sólo recursos del directorio actual sin revelar contenidos", () => {
  const w = workspace();
  try {
    writeFileSync(join(w.cwd, "AGENTS.md"), "INFORMACION_PRIVADA");
    mkdirSync(join(w.cwd, ".pi", "prompts"), { recursive: true });
    writeFileSync(
      join(w.cwd, ".pi", "APPEND_SYSTEM.md"),
      "INSTRUCCIONES_SECRETAS",
    );
    writeFileSync(join(w.cwd, ".pi", "prompts", "review.md"), "revision");
    const result = invoke(w, ["context"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.scope, "working-directory-only");
    assert.deepEqual(report.contextFiles, ["AGENTS.md"]);
    assert.equal(report.projectAppendSystemPrompt, ".pi/APPEND_SYSTEM.md");
    assert.deepEqual(report.promptTemplates, [".pi/prompts/review.md"]);
    assert.equal(report.requiresProjectTrust, true);
    assert.doesNotMatch(
      result.stdout,
      /INFORMACION_PRIVADA|INSTRUCCIONES_SECRETAS/,
    );
  } finally {
    w.cleanup();
  }
});

test("context conserva el nombre real sin duplicar variantes de mayúsculas", () => {
  const w = workspace();
  try {
    writeFileSync(join(w.cwd, "CLAUDE.MD"), "instrucciones");
    const result = invoke(w, ["context"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).contextFiles, ["CLAUDE.MD"]);
  } finally {
    w.cleanup();
  }
});
test("context sin recursos es válido", () => {
  const w = workspace();
  try {
    const r = invoke(w, ["context"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).requiresProjectTrust, false);
  } finally {
    w.cleanup();
  }
});

test("--append-instructions admite múltiples archivos; pasan como rutas absolutas", () => {
  const w = workspace();
  try {
    writeFileSync(join(w.cwd, "first.md"), "Primera");
    writeFileSync(join(w.cwd, "second.md"), "Segunda");
    const r = invoke(w, [
      "run",
      "Hola & | test",
      "--dry-run",
      "--append-instructions",
      "first.md",
      "--append-instructions",
      "second.md",
    ]);
    assert.equal(r.status, 0, r.stderr);
    const args = JSON.parse(r.stdout).args;
    assert.deepEqual(
      args.filter((arg) => arg === "--append-system-prompt"),
      ["--append-system-prompt", "--append-system-prompt"],
    );
    assert.ok(args.includes(join(w.cwd, "first.md")));
    assert.ok(args.includes(join(w.cwd, "second.md")));
    assert.deepEqual(args.slice(-2), ["--", "Hola & | test"]);
  } finally {
    w.cleanup();
  }
});

test("--no-context-files corresponde a flag nativo de Pi en print y JSON", () => {
  const w = workspace();
  try {
    for (const mode of ["print", "json"]) {
      const r = invoke(w, [
        "run",
        "Hola",
        "--mode",
        mode,
        "--no-context-files",
        "--dry-run",
      ]);
      assert.equal(r.status, 0, r.stderr);
      assert.ok(JSON.parse(r.stdout).args.includes("--no-context-files"));
    }
  } finally {
    w.cleanup();
  }
});

test("run real mantiene --append-system-prompt como argumentos y no usa shell", () => {
  const w = workspace();
  try {
    writeFileSync(join(w.cwd, "manual.md"), "Manual");
    const r = invoke(w, [
      "run",
      "No interpretar | && &",
      "--append-instructions",
      "manual.md",
    ]);
    assert.equal(r.status, 0, r.stderr);
    const args = JSON.parse(r.stdout);
    assert.ok(args.includes("--append-system-prompt"));
    assert.equal(args.at(-1), "No interpretar | && &");
  } finally {
    w.cleanup();
  }
});

test("no permite archivos inexistentes, vacíos, directorios o excesivos", () => {
  const w = workspace();
  try {
    writeFileSync(join(w.cwd, "empty.md"), "");
    writeFileSync(join(w.cwd, "large.md"), "X".repeat(65537));
    mkdirSync(join(w.cwd, "folder"));
    for (const name of ["missing.md", "empty.md", "large.md", "folder"]) {
      const r = invoke(w, [
        "run",
        "Hola",
        "--append-instructions",
        name,
        "--dry-run",
      ]);
      assert.equal(r.status, 1, `${name}: ${r.stderr}`);
      assert.match(r.stderr, /instrucciones|Archivo de instrucciones/i);
    }
  } finally {
    w.cleanup();
  }
});

test("flags de contexto requieren run o run-file y argumentos válidos", () => {
  const w = workspace();
  try {
    let r = invoke(w, ["context", "--no-context-files"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /sólo aplican a run/);
    r = invoke(w, ["run", "Hola", "--append-instructions"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /requiere un valor/);
    r = invoke(w, ["context", "unexpected"]);
    assert.equal(r.status, 1);
  } finally {
    w.cleanup();
  }
});

test("run-file conserva las opciones de contexto y de sesión", () => {
  const w = workspace();
  try {
    writeFileSync(join(w.cwd, "manual.md"), "instrucciones");
    writeFileSync(join(w.cwd, "prompt.md"), "investiga");
    const r = invoke(w, [
      "run-file",
      "prompt.md",
      "--persist",
      "--append-instructions",
      "manual.md",
      "--dry-run",
    ]);
    assert.equal(r.status, 0, r.stderr);
    const args = JSON.parse(r.stdout).args;
    assert.ok(args.includes("--append-system-prompt"));
    assert.ok(
      args.includes("--persist") ||
        args.includes("--session-dir") ||
        !args.includes("--no-session"),
    );
    assert.equal(args.at(-1), "investiga");
  } finally {
    w.cleanup();
  }
});
