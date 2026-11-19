/** L17: diario local con encadenamiento de hashes. No es firma ni almacenamiento inmutable. */
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { sha256, POLICY_HASH } from "./governance.js";
const GENESIS = "0".repeat(64),
  MAX_LOG_BYTES = 256 * 1024,
  MAX_ARTIFACT_BYTES = 6000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STAGE = /^(specify|plan|propose|review)$/;
const HASH = /^[a-f0-9]{64}$/;
type Payload = Record<string, unknown>;
export interface EvidenceRecord {
  seq: number;
  at: string;
  type: string;
  data: Payload;
  previous: string;
  hash: string;
}
function directory(path: string) {
  const st = lstatSync(path);
  if (!st.isDirectory() || st.isSymbolicLink())
    throw new Error("Directorio de evidencia inválido");
}
function readBounded(path: string, max: number): Buffer {
  const st = lstatSync(path);
  if (!st.isFile() || st.isSymbolicLink() || st.size > max)
    throw new Error("Archivo de evidencia inválido");
  const b = readFileSync(path);
  if (b.length > max) throw new Error("Archivo excede límite");
  return b;
}
function root(cwd: string): string {
  return join(cwd, ".lab-evidence");
}
export class EvidenceJournal {
  readonly runId = randomUUID();
  readonly directory: string;
  private previous = GENESIS;
  private seq = 0;
  private bytes = 0;
  private failed = false;
  private ended = false;
  constructor(cwd: string) {
    const base = root(cwd);
    try {
      mkdirSync(base, { mode: 0o700 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    directory(base);
    this.directory = join(base, this.runId);
    mkdirSync(this.directory, { mode: 0o700 });
    writeFileSync(join(this.directory, "events.jsonl"), "", {
      flag: "wx",
      mode: 0o600,
    });
  }
  append(type: string, data: Payload): EvidenceRecord {
    if (this.failed || this.ended) throw new Error("Diario no disponible");
    try {
      const body = {
        seq: this.seq + 1,
        at: new Date().toISOString(),
        type,
        data,
        previous: this.previous,
      };
      const record = { ...body, hash: sha256(JSON.stringify(body)) };
      const line = JSON.stringify(record) + "\n";
      const size = Buffer.byteLength(line);
      if (this.bytes + size > MAX_LOG_BYTES)
        throw new Error("Diario excede límite");
      appendFileSync(join(this.directory, "events.jsonl"), line, {
        encoding: "utf8",
        flush: true,
      });
      this.previous = record.hash;
      this.seq++;
      this.bytes += size;
      if (type === "run-finished") this.ended = true;
      return record;
    } catch {
      this.failed = true;
      throw new Error("No se pudo persistir evidencia; ejecución bloqueada");
    }
  }
  artifact(stage: string, text: string): string {
    if (
      this.failed ||
      this.ended ||
      !STAGE.test(stage) ||
      typeof text !== "string" ||
      !text.trim() ||
      Buffer.byteLength(text) > MAX_ARTIFACT_BYTES
    )
      throw new Error("Artefacto inválido para evidencia");
    try {
      const digest = sha256(text);
      writeFileSync(join(this.directory, stage + ".txt"), text, {
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
      this.append("artifact", {
        stage,
        digest,
        bytes: Buffer.byteLength(text),
      });
      return digest;
    } catch {
      this.failed = true;
      throw new Error("No se pudo persistir artefacto; ejecución bloqueada");
    }
  }
}
export interface Verification {
  runId: string;
  records: number;
  head: string;
  status: string;
  mode: string;
}
export function verifyEvidence(cwd: string, runId: string): Verification {
  if (!ID.test(runId)) throw new Error("Identificador de ejecución inválido");
  const base = root(cwd);
  directory(base);
  const dir = join(base, runId);
  directory(dir);
  const raw = readBounded(join(dir, "events.jsonl"), MAX_LOG_BYTES).toString(
    "utf8",
  );
  if (!raw.endsWith("\n")) throw new Error("Diario incompleto");
  const lines = raw.slice(0, -1).split("\n");
  let previous = GENESIS;
  const artifacts = new Map<string, string>();
  const pending = new Map<string, { gate: string; digest: string }>();
  const seenRequests = new Set<string>();
  let mode = "",
    status = "",
    workflowStatus = "",
    qualityStatus = "";
  let qualityStarted = false;
  const approved = new Set<string>();
  let expectedGates: string[] = [];
  let policyHash = "";
  for (let i = 0; i < lines.length; i++) {
    const r = JSON.parse(lines[i]) as EvidenceRecord;
    if (
      !r ||
      typeof r !== "object" ||
      Object.keys(r).length !== 6 ||
      r.seq !== i + 1 ||
      r.previous !== previous ||
      typeof r.type !== "string" ||
      typeof r.at !== "string" ||
      !r.data ||
      typeof r.data !== "object" ||
      Array.isArray(r.data)
    )
      throw new Error("Registro inválido");
    const { hash, ...body } = r;
    if (!HASH.test(hash) || sha256(JSON.stringify(body)) !== hash)
      throw new Error("Hash de diario inválido");
    previous = hash;
    const d = r.data;
    if (i === 0) {
      if (
        r.type !== "run-started" ||
        d.runId !== runId ||
        !["simulate", "live"].includes(String(d.mode))
      )
        throw new Error("Inicio inválido");
      mode = String(d.mode);
      policyHash = String(d.policyHash);
      if (
        policyHash !== POLICY_HASH ||
        sha256(JSON.stringify(d.policy)) !== policyHash
      )
        throw new Error("Política inválida");
    } else if (r.type === "run-started") throw new Error("Inicio duplicado");
    if (r.type === "artifact") {
      const stage = String(d.stage),
        digest = String(d.digest);
      if (!STAGE.test(stage) || !HASH.test(digest) || artifacts.has(stage))
        throw new Error("Referencia a artefacto inválida");
      const content = readBounded(
        join(dir, stage + ".txt"),
        MAX_ARTIFACT_BYTES,
      );
      if (content.length !== d.bytes || sha256(content) !== digest)
        throw new Error("Artefacto alterado");
      artifacts.set(stage, digest);
    } else if (r.type === "approval-requested") {
      const id = String(d.requestId),
        stage = String(d.artifactStage),
        digest = String(d.digest);
      if (
        !ID.test(id) ||
        seenRequests.has(id) ||
        !artifacts.has(stage) ||
        artifacts.get(stage) !== digest ||
        d.runId !== runId ||
        d.policyHash !== policyHash ||
        typeof d.gate !== "string" ||
        !(
          {
            "approve-spec": "specify",
            "approve-plan": "plan",
            "approve-review": "review",
          } as Record<string, string>
        )[d.gate] ||
        (
          {
            "approve-spec": "specify",
            "approve-plan": "plan",
            "approve-review": "review",
          } as Record<string, string>
        )[d.gate] !== stage
      )
        throw new Error("Solicitud de aprobación inválida");
      seenRequests.add(id);
      pending.set(id, { gate: d.gate, digest });
    } else if (r.type === "approval-decided") {
      const id = String(d.requestId),
        p = pending.get(id);
      if (
        !p ||
        p.digest !== d.digest ||
        p.gate !== d.gate ||
        !["approved", "rejected", "cancelled"].includes(String(d.decision))
      )
        throw new Error("Decisión de aprobación inválida");
      pending.delete(id);
      if (d.decision === "approved") approved.add(p.gate);
    }
    if (r.type === "workflow-result") {
      if (
        workflowStatus ||
        !["completed", "rejected", "failed"].includes(String(d.status)) ||
        !["simple", "medium", "complex"].includes(String(d.classification))
      )
        throw new Error("Resultado de workflow inválido");
      workflowStatus = String(d.status);
      expectedGates =
        d.classification === "complex"
          ? ["approve-spec", "approve-plan"]
          : d.classification === "medium"
            ? ["approve-plan"]
            : [];
      if (
        workflowStatus === "completed" &&
        (!expectedGates.every((g) => approved.has(g)) ||
          !artifacts.has("propose") ||
          !artifacts.has("review"))
      )
        throw new Error("Workflow sin sus gates o artefactos");
    }
    if (r.type === "quality-started") {
      if (
        qualityStarted ||
        workflowStatus !== "completed" ||
        d.check !== "workflow-regression"
      )
        throw new Error("Inicio de calidad inválido");
      qualityStarted = true;
    }
    if (r.type === "quality-result") {
      if (
        !qualityStarted ||
        qualityStatus ||
        !["passed", "failed"].includes(String(d.status)) ||
        d.check !== "workflow-regression" ||
        !HASH.test(String(d.outputHash)) ||
        (d.status === "passed" && d.exitCode !== 0)
      )
        throw new Error("Evidencia de calidad inválida");
      qualityStatus = String(d.status);
    }
    if (r.type === "run-finished") {
      if (
        i !== lines.length - 1 ||
        pending.size ||
        !["completed", "rejected", "failed"].includes(String(d.status))
      )
        throw new Error("Cierre inválido");
      status = String(d.status);
      if (
        !workflowStatus ||
        d.quality !== (qualityStatus || "not-run") ||
        (status === "completed" &&
          (workflowStatus !== "completed" ||
            qualityStatus !== "passed" ||
            d.finalReview !== "approved" ||
            !approved.has("approve-review")))
      )
        throw new Error("Cierre sin controles requeridos");
    }
  }
  if (!status) throw new Error("Ejecución sin cierre verificable");
  return { runId, records: lines.length, head: previous, status, mode };
}
