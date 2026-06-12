import path from "node:path";
import {
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedPath = path.join(experimentDir, "data", "processed", "pages.json");
const reportsDir = path.join(experimentDir, "reports");
const pages = await readJson(processedPath);

const auditRows = pages.map((page) => {
  const totalTerms = Object.values(page.term_counts ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
  const topFamilies = Object.entries(page.term_counts ?? {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([family, count]) => `${family}:${count}`)
    .join("; ");
  const flags = [];
  if ((page.words ?? 0) < 150) flags.push("short-page");
  if ((page.words ?? 0) > 2500) flags.push("template-heavy-risk");
  if (!page.snippets?.length) flags.push("no-snippets");
  if (page.page_type === "about" && totalTerms === 0) flags.push("no-taxonomy-signal");
  return {
    museum: page.museum,
    page_type: page.page_type,
    source_layer: page.source_layer,
    year: page.year,
    words: page.words,
    total_terms: totalTerms,
    top_families: topFamilies,
    flags: flags.join("; "),
    url: page.url,
    snippet_1: page.snippets?.[0] ?? "",
    snippet_2: page.snippets?.[1] ?? "",
  };
});

await writeText(
  path.join(reportsDir, "audit-packet.csv"),
  toCsv(auditRows, ["museum", "page_type", "source_layer", "year", "words", "total_terms", "top_families", "flags", "url", "snippet_1", "snippet_2"]),
);

await writeJson(path.join(reportsDir, "audit-packet.json"), {
  generatedAt: new Date().toISOString(),
  pageCount: pages.length,
  flaggedRows: auditRows.filter((row) => row.flags).length,
  rows: auditRows,
  reviewInstructions: [
    "Open the source URL before quoting any snippet.",
    "Flag navigation/template text and pages where the extracted text is not the page body.",
    "Do not compare about pages, collection pages, exhibition pages, annual reports, and provenance pages as interchangeable genres.",
    "Do not publish temporal claims until historical snapshots have audited snippets.",
  ],
});

await writeText(
  path.join(reportsDir, "audit-packet.md"),
  [
    "# Museum Language Drift Audit Packet",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Pages requiring review: ${auditRows.length}`,
    `Flagged rows: ${auditRows.filter((row) => row.flags).length}`,
    "",
    "## Review Instructions",
    "",
    "- Verify snippets against the source URL before quoting.",
    "- Flag navigation/template text.",
    "- Keep source genres separate in interpretation.",
    "- Require audited historical snapshots before making trend claims.",
    "",
    "## Pages",
    "",
    ...auditRows.flatMap((row) => [
      `### ${row.museum} (${row.page_type}, ${row.source_layer}, ${row.year})`,
      "",
      `- Words: ${row.words}`,
      `- Top families: ${row.top_families || "none"}`,
      `- Flags: ${row.flags || "none"}`,
      `- URL: ${row.url}`,
      "",
      row.snippet_1 ? `> ${row.snippet_1}` : "_No snippet extracted._",
      "",
      row.snippet_2 ? `> ${row.snippet_2}` : "",
      "",
    ]),
  ].join("\n"),
);

console.log(`Built audit packet for ${auditRows.length} museum language pages`);
