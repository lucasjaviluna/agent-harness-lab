#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import {
  parseThinkingLevel,
  resolveModelSelection,
} from "./model-selection.js";
import type { ModelOverrides } from "./model-selection.js";
import {
  buildPiArgs,
  getPiVersion,
  listPiModels,
  runPi,
  runPiJson,
} from "./runtime.js";
import type { JsonView, PiMode } from "./runtime.js";
import type { SessionOptions } from "./session-options.js";

const HELP = `Agent Harness Lab v0.4.0 — Módulo 1 / Lección 4

Uso:
  agent-lab doctor [--config archivo.json]
  agent-lab config [--config archivo.json]
  agent-lab profiles [--config archivo.json]
  agent-lab models [filtro] [--config archivo.json]
  agent-lab run "prompt" [--mode print|json] [--view summary|events|tools]
            [--profile nombre] [--model id] [--provider id] [--thinking nivel] [--dry-run]
  agent-lab run-file archivo.md [opciones de run]
  Opciones de sesión (run / run-file):
    --persist | --ephemeral (default: efímero)
    --continue | --session <ruta|id> | --fork <ruta|id>
    --session-dir <directorio>  --name <nombre>
  agent-lab --help

Niveles thinking: off, minimal, low, medium, high, xhigh, max.
Precedencia: pi config < defaultProfile < --profile < flags de run.
La selección de modelo no valida credenciales; Pi resuelve su catálogo.
--view sólo es válido con --mode json. --dry-run no inicia Pi.
ADVERTENCIA: sesiones pueden contener prompts, resultados y archivos sensibles.
Los flags de herramientas NO equivalen a un sandbox.`;

interface ParsedArgs {
  command: string;
  rest: string[];
  configFile?: string;
  mode: PiMode;
  view?: JsonView;
  dryRun: boolean;
  overrides: ModelOverrides;
  runOnlyFlags: string[];
  session: SessionOptions;
}

function parseArgs(argv: string[]): ParsedArgs {
  const rest: string[] = [];
  let configFile: string | undefined;
  let mode: PiMode = "print";
  let view: JsonView | undefined;
  let dryRun = false;
  const overrides: ModelOverrides = {};
  const runOnlyFlags: string[] = [];
  const session: SessionOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (
      [
        "--config",
        "--mode",
        "--view",
        "--profile",
        "--model",
        "--provider",
        "--thinking",
        "--session",
        "--fork",
        "--session-dir",
        "--name",
      ].includes(token)
    ) {
      const value = argv[++i];
      if (!value || value.startsWith("--"))
        throw new Error(`${token} requiere un valor`);
      if (token === "--config") configFile = value;
      else if (token === "--mode") {
        if (value !== "print" && value !== "json")
          throw new Error("--mode debe ser print o json");
        mode = value;
        runOnlyFlags.push(token);
      } else if (token === "--view") {
        if (value !== "summary" && value !== "events" && value !== "tools")
          throw new Error("--view debe ser summary, events o tools");
        view = value;
        runOnlyFlags.push(token);
      } else if (
        token === "--session" ||
        token === "--fork" ||
        token === "--session-dir" ||
        token === "--name"
      ) {
        runOnlyFlags.push(token);
        if (token === "--session") session.session = value;
        if (token === "--fork") session.fork = value;
        if (token === "--session-dir") session.sessionDir = value;
        if (token === "--name") session.name = value;
      } else {
        runOnlyFlags.push(token);
        if (token === "--profile") overrides.profile = value;
        if (token === "--model") overrides.model = value;
        if (token === "--provider") overrides.provider = value;
        if (token === "--thinking")
          overrides.thinking = parseThinkingLevel(value, "--thinking");
      }
    } else if (
      token === "--persist" ||
      token === "--ephemeral" ||
      token === "--continue"
    ) {
      runOnlyFlags.push(token);
      if (token === "--persist") session.persist = true;
      if (token === "--ephemeral") session.ephemeral = true;
      if (token === "--continue") session.continue = true;
    } else if (token === "--dry-run") {
      dryRun = true;
      runOnlyFlags.push(token);
    } else rest.push(token);
  }
  return {
    command: rest.shift() ?? "--help",
    rest,
    configFile,
    mode,
    view,
    dryRun,
    overrides,
    runOnlyFlags,
    session,
  };
}

async function main(argv: string[]): Promise<number> {
  const {
    command,
    rest,
    configFile,
    mode,
    view,
    dryRun,
    overrides,
    runOnlyFlags,
    session,
  } = parseArgs(argv);
  if (["--help", "-h", "help"].includes(command)) {
    console.log(HELP);
    return 0;
  }
  if (
    !["run", "run-file", "config", "doctor", "models", "profiles"].includes(
      command,
    )
  ) {
    throw new Error(`Comando desconocido: ${command}. Usa --help.`);
  }
  if (view && mode !== "json")
    throw new Error("--view sólo se permite con --mode json");
  if (!["run", "run-file"].includes(command) && runOnlyFlags.length) {
    throw new Error(
      `Las opciones ${runOnlyFlags.join(", ")} sólo aplican a run y run-file`,
    );
  }

  const { config, path } = loadConfig(process.cwd(), configFile);
  if (command === "config") {
    if (rest.length) throw new Error("config no acepta otros argumentos");
    console.log(JSON.stringify({ path, config }, null, 2));
    return 0;
  }
  if (command === "profiles") {
    if (rest.length) throw new Error("profiles no acepta argumentos");
    console.log(
      JSON.stringify(
        {
          defaultProfile: config.defaultProfile ?? null,
          profiles: config.modelProfiles,
        },
        null,
        2,
      ),
    );
    return 0;
  }
  if (command === "models") {
    if (rest.length > 1) throw new Error("models acepta como máximo un filtro");
    return listPiModels(config, process.cwd(), rest[0]);
  }
  if (command === "doctor") {
    if (rest.length) throw new Error("doctor no acepta otros argumentos");
    const version = await getPiVersion(config, process.cwd());
    console.log(`Pi encontrado: ${version}`);
    console.log("La autenticación debe verificarse desde Pi.");
    return 0;
  }

  const selection = resolveModelSelection(config, overrides);
  let prompt: string;
  if (command === "run-file") {
    if (rest.length !== 1)
      throw new Error("run-file requiere una sola ruta de archivo");
    try {
      prompt = readFileSync(resolve(process.cwd(), rest[0]), "utf8").trim();
    } catch (error) {
      throw new Error(
        `No se pudo leer el archivo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else prompt = rest.join(" ").trim();
  if (!prompt) throw new Error(`${command} requiere un prompt no vacío`);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          command: config.pi.executable,
          args: buildPiArgs(prompt, config, mode, selection, session),
          cwd: process.cwd(),
        },
        null,
        2,
      ),
    );
    return 0;
  }
  return mode === "print"
    ? runPi(prompt, config, process.cwd(), selection, session)
    : runPiJson(
        prompt,
        config,
        process.cwd(),
        view ?? "summary",
        selection,
        session,
      );
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(
      `[agent-lab] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
