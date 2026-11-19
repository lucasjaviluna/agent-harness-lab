import { verifyEvidence } from "./evidence.js";
try {
  if (process.argv.length !== 3)
    throw new Error("Uso: evidence:verify -- <runId>");
  console.log(
    JSON.stringify(verifyEvidence(process.cwd(), process.argv[2]), null, 2),
  );
} catch {
  console.error("[evidence] Evidencia inválida, incompleta o inaccesible");
  process.exitCode = 1;
}
