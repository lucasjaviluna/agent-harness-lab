import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  routeStory,
  review,
  verify,
  makeNative,
  persistReceipt,
} from "./sdd.js";
import { parseStory } from "./story-classifier.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const cwd = join(root, "examples/sdd/project");
try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "route" && args.length === 1) {
    console.log(
      JSON.stringify(
        routeStory(parseStory(JSON.parse(readFileSync(args[0], "utf8")))),
        null,
        2,
      ),
    );
  } else if (command === "review" && args.length === 0) {
    console.log(
      JSON.stringify(
        review(cwd, makeNative(cwd, process.env.OPENSPEC_CLI_JS)),
        null,
        2,
      ),
    );
  } else if (command === "instructions" && args.length === 0) {
    console.log(
      JSON.stringify(
        makeNative(cwd, process.env.OPENSPEC_CLI_JS)("instructions"),
        null,
        2,
      ),
    );
  } else if (
    command === "verify" &&
    args.length === 2 &&
    args[0] === "--approved"
  ) {
    const result = verify(
      cwd,
      args[1],
      makeNative(cwd, process.env.OPENSPEC_CLI_JS),
    );
    const receipt = persistReceipt(root, result);
    console.log(JSON.stringify({ ...result, receipt }, null, 2));
    if (result.status !== "verified") process.exitCode = 1;
  } else
    throw new Error(
      "Uso: sdd:run -- route <story.json> | review | instructions | verify --approved <sha256>",
    );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Error SDD");
  process.exitCode = 1;
}
