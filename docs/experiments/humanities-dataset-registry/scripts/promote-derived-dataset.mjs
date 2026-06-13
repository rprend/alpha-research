import path from "node:path";
import {
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const datasetId = "wikidata-humanities-authors";
const runDate = "2026-06-12";
const rawPath = path.join(experimentDir, "data", "raw", "file-level-probes", runDate, datasetId, "response.json");
const outDir = path.join(experimentDir, "derived-datasets", datasetId);
const raw = await readJson(rawPath);
const bindings = raw.results?.bindings ?? [];
const records = bindings.map((row) => {
  const entity_uri = row.author?.value ?? "";
  const qid = entity_uri.split("/").at(-1) ?? "";
  const birth_date = row.birth?.value ?? "";
  return {
    qid,
    entity_uri,
    label: row.authorLabel?.value ?? "",
    label_language: row.authorLabel?.["xml:lang"] ?? "",
    birth_date,
    birth_year: extractYear(birth_date),
    source_dataset: "Wikidata",
    source_query: "Wikidata humanities author SPARQL sample",
    rights: "CC0 metadata; source contributor and ontology-bias caveats required",
  };
});

const schema = {
  datasetId,
  title: "Wikidata Humanities Authors Derived Dataset",
  fields: [
    { name: "qid", type: "string", description: "Wikidata entity identifier." },
    { name: "entity_uri", type: "url", description: "Canonical Wikidata entity URI." },
    { name: "label", type: "string", description: "English label when available, otherwise Wikidata fallback label." },
    { name: "label_language", type: "string", description: "Label language code when provided by Wikidata." },
    { name: "birth_date", type: "dateTime|string", description: "Raw Wikidata birth date value from the probe." },
    { name: "birth_year", type: "integer|string", description: "Year parsed from birth_date, including BCE signed years where present." },
    { name: "source_dataset", type: "string", description: "Source corpus name." },
    { name: "source_query", type: "string", description: "Probe/query description used to create this derived sample." },
    { name: "rights", type: "string", description: "Redistribution and caveat note attached to each record." },
  ],
};

const manifest = {
  datasetId,
  generatedAt: new Date().toISOString(),
  status: "artifact-ready",
  sourceProbe: "reports/file-level-probes.json#wikidata-humanities-authors",
  rawInput: path.relative(experimentDir, rawPath),
  recordCount: records.length,
  source: {
    name: "Wikidata",
    accessRoute: "SPARQL JSON sample",
    license: "CC0",
    sourceUrl: "https://query.wikidata.org/",
    redistribution: "derived-metadata-ok",
  },
  rightsAndCaveats: [
    "Wikidata data is CC0, but contributor attention and ontology coverage are uneven.",
    "This is a bounded file-level sample from the registry probe, not a full Wikidata author dump.",
    "Labels can fall back to QIDs when English labels are missing.",
    "Birth dates are source metadata and may need calendar, precision, and BCE handling before analysis.",
  ],
  files: {
    recordsJson: "records.json",
    recordsCsv: "records.csv",
    schema: "schema.json",
    sampleRows: "sample_rows.json",
    rights: "rights.md",
  },
};

await writeJson(path.join(outDir, "manifest.json"), manifest);
await writeJson(path.join(outDir, "schema.json"), schema);
await writeJson(path.join(outDir, "records.json"), records);
await writeText(path.join(outDir, "records.csv"), toCsv(records, schema.fields.map((field) => field.name)));
await writeJson(path.join(outDir, "sample_rows.json"), records.slice(0, 10));
await writeText(path.join(outDir, "rights.md"), buildRights(manifest));

console.log(`Promoted ${records.length} Wikidata records into ${path.relative(process.cwd(), outDir)}`);

function extractYear(value) {
  const match = String(value ?? "").match(/^-?\d{4,}/);
  return match ? match[0] : "";
}

function buildRights(manifest) {
  return [
    "# Wikidata Humanities Authors Rights And Caveats",
    "",
    `Generated at: ${manifest.generatedAt}`,
    "",
    "## Source",
    "",
    `- Source: ${manifest.source.name}`,
    `- License: ${manifest.source.license}`,
    `- Redistribution: ${manifest.source.redistribution}`,
    `- Source URL: ${manifest.source.sourceUrl}`,
    "",
    "## Caveats",
    "",
    ...manifest.rightsAndCaveats.map((note) => `- ${note}`),
    "",
  ].join("\n");
}
