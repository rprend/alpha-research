import path from "node:path";
import {
  experimentDir,
  readJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const chartManifest = await readJson(path.join(reportsDir, "charts", "manifest.json"));
const audit = await readJson(path.join(reportsDir, "audit-packet.json"));

const topDepartments = result.departments.slice(0, 5);
const topCreationCenturies = result.creationCenturies.filter((row) => row.value !== "unknown").slice(0, 5);
const topAcquisitionDecades = result.acquisitionDecades.filter((row) => row.value !== "unknown").slice(0, 5);
const image = Object.fromEntries(result.imageAvailability.map((row) => [row.value, row]));
const charts = Object.fromEntries(chartManifest.charts.map((chart) => [chart.id, chart.path.replace(/^reports\//, "")]));

await writeText(path.join(reportsDir, "publication-draft.md"), [
  "# What A Museum Collection Looks Like When It Becomes Data",
  "",
  "A museum collection is usually encountered one object at a time: a painting on a wall, a sculpture in a gallery, a record in a search box. An open collection API changes the unit of attention. It lets the collection become a table: departments, dates, object types, rights, image availability, provenance coverage, and acquisition patterns can all be inspected at once.",
  "",
  "This essay uses a bounded sample from the Cleveland Museum of Art Open Access API to show what becomes visible when a museum collection is structured enough to analyze. The point is not that Cleveland stands for all museums. It does not. The point is that a public API turns a collection into a measurable cultural object, with both new possibilities and new caveats.",
  "",
  "## Corpus",
  "",
  `The current run sampled ${result.sampleRecords.toLocaleString()} artwork records from ${result.totalAvailable.toLocaleString()} total API records, or about ${(result.sampleShare * 100).toFixed(1)}% of the available collection metadata. Each row is one artwork metadata record.`,
  "",
  "The sample includes normalized fields for department, collection, object type, culture, creation dates, accession-number year, explicit accession date where present, license status, image availability, credit line, and provenance-entry count.",
  "",
  "## Finding 1: The Collection Has A Visible Department Shape",
  "",
  `In this sample, the largest department is ${topDepartments[0].value}, with ${topDepartments[0].count.toLocaleString()} records (${percent(topDepartments[0].share)} of the sample). The next largest departments are ${list(topDepartments.slice(1).map((row) => `${row.value} (${percent(row.share)})`))}.`,
  "",
  chartLine("departments", "Chart: top departments in the sampled records."),
  "",
  "Department counts are not a neutral measure of cultural importance. They reflect collection history, cataloging practice, department boundaries, and what is available through the API. But they are a useful first map of the dataset's internal structure.",
  "",
  "## Finding 2: Object Dates Cluster Across Very Different Time Horizons",
  "",
  `The largest creation-century bucket is ${topCreationCenturies[0].value}, with ${topCreationCenturies[0].count.toLocaleString()} records (${percent(topCreationCenturies[0].share)}). Other large buckets include ${list(topCreationCenturies.slice(1).map((row) => `${row.value} (${percent(row.share)})`))}.`,
  "",
  chartLine("creation-centuries", "Chart: creation-century distribution."),
  "",
  "A century chart is blunt. It hides uncertainty inside dates such as `circa`, ranges, dynastic periods, and catalog-specific conventions. Still, it gives a fast view of the temporal shape exposed by the metadata.",
  "",
  "## Finding 3: Accession Numbers Are Useful, But Risky",
  "",
  `The largest accession-year decade proxy in the sample is ${topAcquisitionDecades[0].value}, with ${topAcquisitionDecades[0].count.toLocaleString()} records (${percent(topAcquisitionDecades[0].share)}). The next largest proxy decades are ${list(topAcquisitionDecades.slice(1).map((row) => `${row.value} (${percent(row.share)})`))}.`,
  "",
  chartLine("acquisition-decades", "Chart: accession-number decade proxy."),
  "",
  `This is explicitly a proxy. The audit packet found ${audit.mismatchRows.toLocaleString()} records where the year extracted from the accession number differs from the explicit accession date year, plus ${audit.missingExplicitAccessionYearRows.toLocaleString()} record missing an explicit accession year. That does not make the proxy useless, but it means acquisition-decade claims need manual review before publication.`,
  "",
  "## Finding 4: Visual Availability Is Itself A Dataset Feature",
  "",
  `In the sample, ${image["has-image"]?.count.toLocaleString() ?? 0} records have an image (${percent(image["has-image"]?.share ?? 0)}), while ${image["no-image"]?.count.toLocaleString() ?? 0} do not (${percent(image["no-image"]?.share ?? 0)}).`,
  "",
  chartLine("image-availability", "Chart: image availability in the sampled records."),
  "",
  "For public humanities work, image availability is not just a convenience. It changes what can be shown, compared, and inspected by readers. A collection can be open as metadata while still uneven as a visual corpus.",
  "",
  "## What This Can Support",
  "",
  "This artifact can support a first public essay about what one open museum collection looks like as structured data. It can support claims about the sampled Cleveland Museum API records, the fields exposed by that API, and the methodological difference between object-by-object browsing and collection-level analysis.",
  "",
  "It should not support claims about museums in general. It should not treat the sample as the full Cleveland collection. It should not treat accession-number years as clean acquisition dates without the audit caveat.",
  "",
  "## What To Study Next",
  "",
  "- Fetch the full collection or a larger paginated corpus.",
  "- Compare the same field map against another open museum API.",
  "- Audit acquisition-year mismatches before making acquisition-history claims.",
  "- Use provenance-entry counts as a coverage signal, then design a separate provenance study.",
  "",
  "## Reproducibility",
  "",
  "- Source: Cleveland Museum of Art Open Access API.",
  "- Raw records: `data/raw/api/2026-06-12/`.",
  "- Processed records: `data/processed/artworks.json` and `data/processed/artworks.csv`.",
  "- Charts: `reports/charts/`.",
  "- Audit packet: `reports/audit-packet.md`.",
  "- Structured findings: `reports/result.json`.",
  "",
].join("\n"));

console.log("Built Cleveland publication draft");

function percent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function list(values) {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function chartLine(id, label) {
  const target = charts[id];
  return target ? `![${label}](${target})` : `_${label}_`;
}
