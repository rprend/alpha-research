import path from "node:path";
import {
  experimentDir,
  listFiles,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const rawDir = path.join(experimentDir, "data", "raw");

const works = await readJson(path.join(processedDir, "works.json"));
const topics = await readJson(path.join(processedDir, "topics.json"));
const manifests = await Promise.all(
  (await listFiles(rawDir, (file) => file.endsWith("manifest.json"))).map(async (file) => ({
    path: path.relative(experimentDir, file),
    manifest: await readJson(file),
  })),
);

const sourceRows = manifests.map(({ path: manifestPath, manifest }) => ({
  source: manifest.source,
  runDate: manifest.runDate,
  records: manifest.recordCount,
  requests: manifest.requestCount,
  errors: manifest.errors?.length ?? 0,
  manifestPath,
}));

const sourceInventoryMd = [
  "# Source Inventory",
  "",
  "| Source | Run date | Records | Requests | Errors | Manifest |",
  "| --- | --- | ---: | ---: | ---: | --- |",
  ...sourceRows.map((row) => `| ${row.source} | ${row.runDate} | ${row.records} | ${row.requests} | ${row.errors} | \`${row.manifestPath}\` |`),
  "",
].join("\n");

await writeText(path.join(reportsDir, "source-inventory.md"), sourceInventoryMd);
await writeText(path.join(reportsDir, "source-inventory.csv"), toCsv(sourceRows, ["source", "runDate", "records", "requests", "errors", "manifestPath"]));

const bySource = countBy(works, (work) => work.source_name);
const byYear = countBy(works, (work) => work.year || "unknown");
const quantitativeCandidates = works.filter((work) => work.is_quantitative_humanities_candidate);
const recentWorks = works.filter((work) => Number(work.year) >= 2024);
const topTopics = topics.slice(0, 20);
const representative = works
  .filter((work) => work.title)
  .sort((a, b) => Number(b.cited_by_count ?? 0) - Number(a.cited_by_count ?? 0))
  .slice(0, 15);

const result = {
  generatedAt: new Date().toISOString(),
  strongestFinding: "The v1 literature radar is large enough for a field-map essay about AI, computational methods, and quantitative humanities signals, but source coverage remains uneven.",
  corpus: {
    works: works.length,
    recentWorks2024Present: recentWorks.length,
    quantitativeHumanitiesCandidates: quantitativeCandidates.length,
    sources: bySource,
    years: byYear,
  },
  topTopics,
  representativeWorks: representative.map((work) => ({
    title: work.title,
    year: work.year,
    venue: work.venue_name,
    source: work.source_name,
    url: work.url,
    cited_by_count: work.cited_by_count,
    methods: work.methods,
    quantitative_signals: work.quantitative_signals,
  })),
  nextEssays: [
    {
      title: "The Rise Of AI And The Humanities",
      format: "field-map",
      why: "The corpus already tracks AI, LLM, computational, and digital-humanities records across scholarly sources.",
    },
    {
      title: "Canon Drift",
      format: "moving-canon",
      why: "Canon, reception, citation, syllabi, and translation records can seed a broader corpus about cultural memory.",
    },
    {
      title: "What Changed In University Mission Statements?",
      format: "what-changed",
      why: "This should be run as a separate longitudinal web corpus because it needs institution pages and historical snapshots, not only publication metadata.",
    },
  ],
  caveats: [
    "This first artifact uses public metadata and abstracts where available, not full-text scholarship.",
    "Open indexes underrepresent books, chapters, non-English work, and paywalled humanities journals.",
    "Trend claims require source-coverage checks and manual review of representative works before publication.",
  ],
  files: {
    sourceInventory: "reports/source-inventory.md",
    works: "data/processed/works.json",
    topics: "data/processed/topics.json",
    representativeWorks: "data/processed/representative-works.csv",
  },
};

await writeJson(path.join(reportsDir, "result.json"), result);

const reportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Cultural Observatory Field Map</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 980px; color: #1f2933; }
    h1, h2 { line-height: 1.15; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; padding: 10px 12px; margin: 0 8px 8px 0; border-radius: 6px; }
    .muted { color: #52606d; }
  </style>
</head>
<body>
  <h1>Cultural Observatory Field Map</h1>
  <p class="muted">Generated ${escapeHtml(result.generatedAt)} from public source metadata.</p>
  <h2>Corpus</h2>
  <p>
    <span class="stat"><strong>${works.length}</strong> deduped works</span>
    <span class="stat"><strong>${recentWorks.length}</strong> works from 2024-present</span>
    <span class="stat"><strong>${quantitativeCandidates.length}</strong> quantitative-humanities candidates</span>
  </p>
  <h2>Source Coverage</h2>
  ${table(sourceRows, ["source", "runDate", "records", "requests", "errors"])}
  <h2>Top Labels</h2>
  ${table(topTopics, ["label", "kind", "count", "representative_titles"])}
  <h2>Representative Works</h2>
  ${table(result.representativeWorks, ["title", "year", "venue", "source", "cited_by_count"])}
  <h2>Article Argument</h2>
  <p>
    This first field map is evidence that the project should be framed as a cultural-observatory publication rather than as a narrow technical demo.
    The corpus can support essays about field formation, method diffusion, and the movement of topics across disciplines, but publishable trend claims need larger backfills and source-coverage audits.
  </p>
  <h2>Next Essays</h2>
  <ol>
    ${result.nextEssays.map((essay) => `<li><strong>${escapeHtml(essay.title)}</strong>: ${escapeHtml(essay.why)}</li>`).join("\n")}
  </ol>
  <h2>Caveats</h2>
  <ul>${result.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("\n")}</ul>
</body>
</html>
`;
await writeText(path.join(reportsDir, "report.html"), reportHtml);

const publicDraft = [
  "# The First Cultural Observatory Field Map",
  "",
  "This draft is generated from the first runnable metadata corpus. It should not be published as-is until the source backfill is expanded and the representative works are reviewed.",
  "",
  "## Thesis",
  "",
  "A public research site about cultural change should lead with inspectable findings, not with the label `quantitative humanities`.",
  "",
  "## Corpus Note",
  "",
  `The current corpus contains ${works.length} deduped records from ${Object.keys(bySource).join(", ")}. ${recentWorks.length} records are dated 2024-present.`,
  "",
  "## Findings To Develop",
  "",
  `- ${quantitativeCandidates.length} records currently show quantitative, computational, corpus, citation, AI, or method signals.`,
  `- The highest-count labels are ${topTopics.slice(0, 5).map((topic) => topic.label).join(", ")}.`,
  "- The strongest near-term essay is a field map of AI and the humanities, followed by canon drift and institutional-language drift.",
  "",
  "## Limitations",
  "",
  ...result.caveats.map((caveat) => `- ${caveat}`),
  "",
  "## What To Study Next",
  "",
  ...result.nextEssays.map((essay) => `- ${essay.title}: ${essay.why}`),
  "",
].join("\n");
await writeText(path.join(reportsDir, "public-draft.md"), publicDraft);

const workMd = [
  "# Work Log",
  "",
  `Generated at: ${result.generatedAt}`,
  "",
  "## Inputs",
  "",
  ...sourceRows.map((row) => `- ${row.source}: ${row.records} records, ${row.requests} requests, manifest \`${row.manifestPath}\``),
  "",
  "## Outputs",
  "",
  "- `reports/source-inventory.md`",
  "- `reports/source-inventory.csv`",
  "- `reports/report.html`",
  "- `reports/result.json`",
  "- `reports/public-draft.md`",
  "- `data/processed/works.json`",
  "- `data/processed/works.csv`",
  "- `data/processed/topics.json`",
  "- `data/processed/representative-works.csv`",
  "- `data/processed/quantitative-humanities-opportunities.csv`",
  "",
  "## Validation Notes",
  "",
  "- This is a runnable v1 artifact, not a final publication corpus.",
  "- Source manifests preserve request URLs and response paths.",
  "- Classification is heuristic and must be audited before public claims.",
  "",
].join("\n");
await writeText(path.join(reportsDir, "work.md"), workMd);

console.log(`Built reports for ${works.length} works in ${path.relative(process.cwd(), reportsDir)}`);

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = String(fn(item) ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function table(rows, columns) {
  if (!rows.length) return "<p>No rows.</p>";
  return `<table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(formatCell(row[col]))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function formatCell(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
