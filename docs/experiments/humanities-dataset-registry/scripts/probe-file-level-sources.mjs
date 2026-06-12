import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  experimentDir,
  readJson,
  slug,
  today,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const runDate = args["run-date"] ?? process.env.HUMANITIES_DATASET_RUN_DATE ?? today();
const timeoutMs = Number(args.timeout ?? 25000);
const probes = await readJson(path.join(experimentDir, "config", "file-level-probes.json"));
const rawDir = path.join(experimentDir, "data", "raw", "file-level-probes", runDate);
const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const manifest = {
  runDate,
  source: "humanities dataset file-level probes",
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};
const rows = [];

await fs.rm(rawDir, { recursive: true, force: true });
await ensureDir(rawDir);

for (const probe of probes) {
  const probeDir = path.join(rawDir, slug(probe.id));
  await ensureDir(probeDir);
  if (probe.probe_type === "met-object-detail") {
    rows.push(await probeMetDetails(probe, probeDir));
  } else if (probe.probe_type === "gutenberg-rdf") {
    rows.push(await probeGutenberg(probe, probeDir));
  } else {
    rows.push(await probeSimple(probe, probeDir));
  }
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = rows.filter((row) => row.access_status === "accessible").length;
await writeJson(path.join(rawDir, "manifest.json"), manifest);

const readiness = {
  generatedAt: new Date().toISOString(),
  status: rows.filter((row) => row.access_status === "accessible").length >= 4 ? "file-level-probed" : "needs-source-work",
  probes: rows.length,
  accessibleProbes: rows.filter((row) => row.access_status === "accessible").length,
  rows,
  readyForDerivedDataset: rows.filter((row) => row.access_status === "accessible" && !row.normalization_risk.includes("blocked")).map((row) => row.candidate_id),
  blockers: rows.filter((row) => row.access_status !== "accessible").map((row) => `${row.id}: ${row.access_status}`),
  nextActions: [
    "Promote one file-level-ready corpus into a derived dataset folder.",
    "Add item-level rights fields before publishing derived object/image claims.",
    "Keep OCR-quality and cataloging-bias caveats attached to newspaper and book metadata probes.",
  ],
};

await writeJson(path.join(processedDir, "file-level-probes.json"), rows);
await writeText(
  path.join(processedDir, "file-level-probes.csv"),
  toCsv(rows, ["id", "candidate_id", "name", "probe_type", "access_status", "http_status", "records_or_files", "sample_fields", "license_note", "redistribution", "normalization_risk", "raw_path"]),
);
await writeJson(path.join(reportsDir, "file-level-probes.json"), readiness);
await writeText(path.join(reportsDir, "file-level-probes.md"), buildMarkdown(readiness));

console.log(`File-level dataset probes: ${readiness.status} (${readiness.accessibleProbes}/${readiness.probes} accessible)`);
if (process.argv.includes("--strict") && readiness.status !== "file-level-probed") process.exit(1);

async function probeSimple(probe, probeDir) {
  const responsePath = path.join(probeDir, responseName(probe.url));
  const { status, body, error } = await fetchText(probe.url);
  manifest.requests.push({ id: probe.id, url: probe.url, status, responsePath: path.relative(experimentDir, responsePath) });
  if (error || Number(status) < 200 || Number(status) >= 300) {
    manifest.errors.push({ id: probe.id, url: probe.url, status, error, body: body.slice(0, 500) });
    return rowFor(probe, status, 0, "", probe.license_note, "blocked or inaccessible route", responsePath);
  }
  await writeText(responsePath, body);
  const parsed = parseBody(body, probe.probe_type);
  return rowFor(probe, status, parsed.count, parsed.fields.join("; "), probe.license_note, parsed.risk, responsePath);
}

async function probeMetDetails(probe, probeDir) {
  const listPath = path.join(probeDir, "objects.json");
  const { status, body, error } = await fetchText(probe.url);
  manifest.requests.push({ id: probe.id, requestType: "object-list", url: probe.url, status, responsePath: path.relative(experimentDir, listPath) });
  if (error || Number(status) < 200 || Number(status) >= 300) {
    manifest.errors.push({ id: probe.id, requestType: "object-list", status, error, body: body.slice(0, 500) });
    return rowFor(probe, status, 0, "", probe.license_note, "blocked or inaccessible object list", listPath);
  }
  await writeText(listPath, body);
  const json = JSON.parse(body);
  const ids = (json.objectIDs ?? []).slice(0, Number(probe.detail_limit ?? 10));
  const details = [];
  for (const id of ids) {
    const url = probe.detail_url_template.replace("{id}", String(id));
    const detailPath = path.join(probeDir, `object-${id}.json`);
    const detail = await fetchText(url);
    manifest.requests.push({ id: probe.id, requestType: "object-detail", objectId: id, url, status: detail.status, responsePath: path.relative(experimentDir, detailPath) });
    if (Number(detail.status) >= 200 && Number(detail.status) < 300) {
      await writeText(detailPath, detail.body);
      details.push(JSON.parse(detail.body));
    } else {
      manifest.errors.push({ id: probe.id, requestType: "object-detail", objectId: id, status: detail.status, error: detail.error, body: detail.body.slice(0, 500) });
    }
  }
  const fields = [...new Set(details.flatMap((item) => Object.keys(item)).slice(0, 40))];
  return rowFor(probe, status, Number(json.total ?? json.objectIDs?.length ?? 0), fields.join("; "), probe.license_note, "item fields are rich but object completeness and image rights vary", listPath);
}

async function probeGutenberg(probe, probeDir) {
  const sampleRows = [];
  for (const url of probe.sample_urls ?? []) {
    const file = path.join(probeDir, path.basename(new URL(url).pathname));
    const { status, body, error } = await fetchText(url);
    manifest.requests.push({ id: probe.id, requestType: "rdf-sample", url, status, responsePath: path.relative(experimentDir, file) });
    if (Number(status) >= 200 && Number(status) < 300) {
      await writeText(file, body);
      sampleRows.push({ url, fields: rdfFields(body), bytes: Buffer.byteLength(body) });
    } else {
      manifest.errors.push({ id: probe.id, requestType: "rdf-sample", url, status, error, body: body.slice(0, 500) });
    }
  }
  await writeJson(path.join(probeDir, "sample-summary.json"), sampleRows);
  return rowFor(
    probe,
    sampleRows.length ? 200 : "fetch-error",
    sampleRows.length,
    [...new Set(sampleRows.flatMap((row) => row.fields))].join("; "),
    probe.license_note,
    "RDF metadata is structured; text redistribution and edition representativeness need review",
    path.join(probeDir, "sample-summary.json"),
  );
}

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "alpha-research-humanities-dataset-file-probe/0.1",
        accept: "application/json,application/sparql-results+json,application/rdf+xml,text/xml,text/html,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, body: await response.text(), error: "" };
  } catch (error) {
    return { status: "fetch-error", body: "", error: error.message };
  }
}

function parseBody(body, probeType) {
  if (probeType.includes("json") || probeType.includes("sparql")) {
    try {
      const json = JSON.parse(body);
      const rows = json.results?.bindings ?? json.results ?? json.items ?? json.collections ?? json.data ?? [];
      return {
        count: Number(json.pagination?.total ?? json.total ?? json.totalResults ?? json.count ?? (Array.isArray(rows) ? rows.length : Object.keys(json).length)),
        fields: inferFields(json),
        risk: "structured JSON route; inspect pagination, rights fields, and schema stability before full harvest",
      };
    } catch {
      return { count: 0, fields: [], risk: "json parse failed" };
    }
  }
  return { count: body.length ? 1 : 0, fields: [], risk: "non-json route; inspect manually" };
}

function inferFields(value, prefix = "", out = new Set()) {
  if (!value || typeof value !== "object") return [...out].slice(0, 40);
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 3)) inferFields(item, prefix, out);
    return [...out].slice(0, 40);
  }
  for (const [key, child] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    out.add(name);
    if (out.size < 40 && child && typeof child === "object") inferFields(child, name, out);
  }
  return [...out].slice(0, 40);
}

function rdfFields(body) {
  return [...String(body).matchAll(/<(?:[^:\s>]+:)?([A-Za-z][A-Za-z0-9_-]+)(?:\s|>)/g)]
    .map((match) => match[1])
    .filter((field) => !["RDF", "Description"].includes(field))
    .slice(0, 40);
}

function rowFor(probe, status, records, fields, licenseNote, risk, file) {
  return {
    id: probe.id,
    candidate_id: probe.candidate_id,
    name: probe.name,
    probe_type: probe.probe_type,
    access_status: Number(status) >= 200 && Number(status) < 300 ? "accessible" : String(status),
    http_status: status,
    records_or_files: records,
    sample_fields: fields,
    license_note: licenseNote,
    redistribution: probe.redistribution,
    normalization_risk: risk,
    raw_path: path.relative(experimentDir, file),
  };
}

function responseName(url) {
  return /json|sparql|format=json|fo=json/i.test(url) ? "response.json" : "response.txt";
}

function buildMarkdown(readiness) {
  return [
    "# Humanities Dataset Registry File-Level Probes",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Status: ${readiness.status}`,
    `Accessible probes: ${readiness.accessibleProbes}/${readiness.probes}`,
    "",
    "| Probe | Candidate | Access | Records/Files | Redistribution | Risk |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...readiness.rows.map((row) => `| ${row.name} | ${row.candidate_id} | ${row.access_status} | ${row.records_or_files} | ${row.redistribution} | ${String(row.normalization_risk).replaceAll("|", "\\|")} |`),
    "",
    "## Next Actions",
    "",
    ...readiness.nextActions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}
