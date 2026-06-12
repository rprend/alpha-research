import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { experimentDir, readJson, writeJson } from "./lib.mjs";

const sessionPath = path.join(process.env.HOME ?? "", ".research", "session.json");
const registrationPath = path.join(experimentDir, "registration", "control-plane-registration.json");
const verificationPath = path.join(experimentDir, "registration", "control-plane-verification.json");

if (!existsSync(sessionPath)) {
  throw new Error(`Missing RESEARCH CLI session at ${sessionPath}. Run research login first.`);
}

const session = JSON.parse(readFileSync(sessionPath, "utf8"));
if (typeof session.origin !== "string" || !session.origin.startsWith("https://")) {
  throw new Error("Research CLI session origin is missing or invalid.");
}
if (typeof session.accessToken !== "string" || !session.accessToken) {
  throw new Error("Research CLI session access token is missing.");
}

const registration = await readJson(registrationPath);
const datasetPayload = await api(session, "/api/cli/datasets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(toCliDatasetPayload(registration.dataset)),
});
const profilePayload = await api(session, `/api/cli/datasets/${encodeURIComponent(registration.dataset.datasetId)}/profile`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(registration.profile),
});
const verifiedDatasetPayload = await api(session, `/api/cli/datasets/${encodeURIComponent(registration.dataset.datasetId)}`);
const verifiedProfilePayload = await api(session, `/api/cli/datasets/${encodeURIComponent(registration.dataset.datasetId)}/profile`);

const verification = {
  verifiedAt: new Date().toISOString(),
  origin: session.origin,
  datasetId: registration.dataset.datasetId,
  dataset: summarizeDataset(verifiedDatasetPayload.dataset ?? datasetPayload.dataset),
  profile: summarizeProfile(verifiedProfilePayload.profile ?? profilePayload.profile),
  dashboardUrl: `${session.origin.replace("https://alpharesearch.nyc", "https://dashboard.alpharesearch.nyc")}/datasets/${registration.dataset.datasetId}`,
};

await writeJson(verificationPath, verification);
console.log(JSON.stringify({
  datasetId: verification.datasetId,
  status: verification.dataset.status,
  deploymentStatus: verification.dataset.deploymentStatus,
  profileReady: verification.profile.profileReady,
  briefingMarkdownChars: verification.profile.briefingMarkdownChars,
  schemaFields: verification.profile.schemaFields,
  sampleRows: verification.profile.sampleRows,
  dashboardUrl: verification.dashboardUrl,
}, null, 2));

async function api(session, apiPath, init = {}) {
  const response = await fetch(`${session.origin}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API ${apiPath} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function toCliDatasetPayload(dataset) {
  return {
    datasetId: dataset.datasetId,
    name: dataset.name,
    sourceType: dataset.sourceType,
    sourceFilename: dataset.sourceFilename,
    mode: dataset.mode,
    description: dataset.description,
  };
}

function summarizeDataset(dataset) {
  return {
    id: dataset?.id ?? null,
    name: dataset?.name ?? null,
    status: dataset?.status ?? null,
    deploymentStatus: dataset?.deploymentStatus ?? null,
    manifestPath: dataset?.manifestPath ?? null,
    mode: dataset?.mode ?? null,
    sourceType: dataset?.sourceType ?? null,
  };
}

function summarizeProfile(profile) {
  return {
    profileReady: Boolean(profile?.briefingMarkdown && profile?.schema && profile?.sampleRows),
    briefingMarkdownChars: String(profile?.briefingMarkdown ?? "").length,
    schemaFields: Array.isArray(profile?.schema?.fields) ? profile.schema.fields.length : 0,
    sampleRows: Array.isArray(profile?.sampleRows) ? profile.sampleRows.length : 0,
    updatedAt: profile?.updatedAt ?? null,
  };
}
