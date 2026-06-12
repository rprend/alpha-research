import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { experimentDir, readJson, writeJson } from "./lib.mjs";

const sessionPath = path.join(process.env.HOME ?? "", ".research", "session.json");
const verificationPath = path.join(experimentDir, "registration", "control-plane-verification.json");
const datasetId = "humanities-literature-radar";

const origin = readOrigin();
const token = process.env.ALPHA_RESEARCH_ADMIN_TOKEN?.trim();
if (!token) {
  throw new Error("Missing ALPHA_RESEARCH_ADMIN_TOKEN. Use the hidden secret helper before running this script.");
}

const response = await fetch(`${origin}/api/admin/datasets/prebuilt-ready`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    datasetId,
    volumeMountPath: `/data/datasets/${datasetId}`,
    manifestPath: `/data/datasets/${datasetId}/manifest.json`,
  }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(`Prebuilt dataset promotion failed (${response.status}): ${JSON.stringify(body)}`);
}

const existingVerification = existsSync(verificationPath)
  ? await readJson(verificationPath)
  : {};
const verification = {
  ...existingVerification,
  promotedAt: new Date().toISOString(),
  promotionEndpoint: "/api/admin/datasets/prebuilt-ready",
  dataset: {
    ...(existingVerification.dataset ?? {}),
    id: body.dataset?.id ?? datasetId,
    name: body.dataset?.name ?? existingVerification.dataset?.name ?? "Humanities Literature Radar",
    status: body.dataset?.status ?? null,
    deploymentStatus: body.dataset?.deploymentStatus ?? null,
    manifestPath: body.dataset?.manifestPath ?? null,
    volume: body.dataset?.volume ?? null,
    mode: body.dataset?.mode ?? existingVerification.dataset?.mode ?? null,
    sourceType: body.dataset?.sourceType ?? existingVerification.dataset?.sourceType ?? null,
  },
};
await writeJson(verificationPath, verification);

console.log(JSON.stringify({
  datasetId,
  status: verification.dataset.status,
  deploymentStatus: verification.dataset.deploymentStatus,
  manifestPath: verification.dataset.manifestPath,
}, null, 2));

function readOrigin() {
  if (process.env.ALPHA_RESEARCH_ORIGIN) return process.env.ALPHA_RESEARCH_ORIGIN;
  if (!existsSync(sessionPath)) return "https://alpharesearch.nyc";
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  return typeof session.origin === "string" ? session.origin : "https://alpharesearch.nyc";
}
