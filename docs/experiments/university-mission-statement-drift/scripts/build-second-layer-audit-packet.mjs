import path from "node:path";
import {
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedPath = path.join(experimentDir, "data", "processed", "second-layer-pages.json");
const reportsDir = path.join(experimentDir, "reports");
const pages = await readJson(processedPath);
const historicalPages = pages.filter((page) => page.source_layer !== "current");
const rows = historicalPages.map((page, index) => {
  const totalTerms = Object.values(page.term_counts ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
  const topFamilies = Object.entries(page.term_counts ?? {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([family, count]) => `${family}:${count}`)
    .join("; ");
  const flags = [];
  if ((page.words ?? 0) < 300) flags.push("short-page-review");
  if ((page.words ?? 0) > 2500) flags.push("long-page-sample-review");
  if (!page.snippets?.length) flags.push("no-snippets");
  if (page.source_layer === "wayback" && !page.archive_url) flags.push("missing-archive-url");
  if (page.source_layer === "historical-current") flags.push("live-historical-page");
  return {
    review_id: `university-second-layer-${String(index + 1).padStart(3, "0")}`,
    review_status: "pending",
    quote_safe: "pending",
    institution: page.institution,
    source_layer: page.source_layer,
    source_genre: page.source_genre,
    year: page.year,
    words: page.words,
    total_terms: totalTerms,
    top_families: topFamilies,
    flags: flags.join("; "),
    source_url: page.url,
    review_url: page.archive_url || page.url,
    raw_path: page.raw_path,
    snippet_1: page.snippets?.[0] ?? "",
    snippet_2: page.snippets?.[1] ?? "",
    snippet_3: page.snippets?.[2] ?? "",
  };
});

const coverage = {
  rowCount: rows.length,
  sourceLayerCounts: countBy(rows, "source_layer"),
  sourceGenreCounts: countBy(rows, "source_genre"),
  yearCounts: countBy(rows, "year"),
  institutionCounts: countBy(rows, "institution"),
  flaggedRows: rows.filter((row) => row.flags).length,
  pendingRows: rows.filter((row) => row.review_status === "pending").length,
};

await writeText(
  path.join(reportsDir, "second-layer-audit-packet.csv"),
  toCsv(rows, [
    "review_id",
    "review_status",
    "quote_safe",
    "institution",
    "source_layer",
    "source_genre",
    "year",
    "words",
    "total_terms",
    "top_families",
    "flags",
    "source_url",
    "review_url",
    "raw_path",
    "snippet_1",
    "snippet_2",
    "snippet_3",
  ]),
);

await writeJson(path.join(reportsDir, "second-layer-audit-packet.json"), {
  generatedAt: new Date().toISOString(),
  status: rows.length ? "pending-review" : "no-historical-pages",
  coverage,
  rows,
  reviewInstructions: [
    "Open review_url and verify each quoted snippet is source content, not navigation, legal boilerplate, or extracted template text.",
    "For Wayback pages, use the archive URL as the review URL and preserve the timestamp in any published citation.",
    "For historical-current pages, confirm the page date and institutional context before treating the page as historical evidence.",
    "Keep catalog, strategic-plan, president-message, and commencement-speech rows separate in claims.",
    "Set quote_safe to yes only after human review; pending rows are artifact-ready but not publication-ready.",
  ],
});

await writeText(path.join(reportsDir, "second-layer-audit-packet.md"), buildMarkdown({ coverage, rows }));

console.log(`Built second-layer audit packet for ${rows.length} historical university pages`);

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

function buildMarkdown({ coverage, rows }) {
  return [
    "# University Second-Layer Audit Packet",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Status: ${rows.length ? "pending-review" : "no-historical-pages"}`,
    `Rows requiring review: ${coverage.rowCount}`,
    "",
    "## Coverage",
    "",
    `- Source layers: ${formatCounts(coverage.sourceLayerCounts)}`,
    `- Source genres: ${formatCounts(coverage.sourceGenreCounts)}`,
    `- Years: ${formatCounts(coverage.yearCounts)}`,
    `- Institutions: ${formatCounts(coverage.institutionCounts)}`,
    `- Flagged rows: ${coverage.flaggedRows}`,
    "",
    "## Review Instructions",
    "",
    "- Open the review URL and verify each snippet before quoting.",
    "- Preserve Wayback timestamps in citations.",
    "- Treat live historical pages as historical only after confirming the page date and institutional context.",
    "- Keep catalogs, strategic plans, president messages, and commencement speeches separate in public claims.",
    "- Pending rows are artifact-ready but not publication-ready.",
    "",
    "## Rows",
    "",
    ...rows.flatMap((row) => [
      `### ${row.review_id}: ${row.institution} (${row.source_layer}, ${row.source_genre}, ${row.year})`,
      "",
      `- Review status: ${row.review_status}`,
      `- Quote safe: ${row.quote_safe}`,
      `- Words: ${row.words}`,
      `- Top families: ${row.top_families || "none"}`,
      `- Flags: ${row.flags || "none"}`,
      `- Review URL: ${row.review_url}`,
      `- Raw path: ${row.raw_path}`,
      "",
      row.snippet_1 ? `> ${row.snippet_1}` : "_No snippet extracted._",
      "",
      row.snippet_2 ? `> ${row.snippet_2}` : "",
      "",
      row.snippet_3 ? `> ${row.snippet_3}` : "",
      "",
    ]),
  ].join("\n");
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([key, count]) => `${key}: ${count}`).join("; ") : "none";
}
