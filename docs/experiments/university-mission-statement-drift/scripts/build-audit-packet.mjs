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
  if (page.source_layer === "wayback" && !page.archive_url) flags.push("missing-archive-url");
  return {
    institution: page.institution,
    source_layer: page.source_layer,
    year: page.year,
    words: page.words,
    total_terms: totalTerms,
    top_families: topFamilies,
    flags: flags.join("; "),
    url: page.archive_url || page.url,
    snippet_1: page.snippets?.[0] ?? "",
    snippet_2: page.snippets?.[1] ?? "",
  };
});

await writeText(
  path.join(reportsDir, "audit-packet.csv"),
  toCsv(auditRows, ["institution", "source_layer", "year", "words", "total_terms", "top_families", "flags", "url", "snippet_1", "snippet_2"]),
);

await writeJson(path.join(reportsDir, "audit-packet.json"), {
  generatedAt: new Date().toISOString(),
  pageCount: pages.length,
  rows: auditRows,
  reviewInstructions: [
    "Mark snippets as quote-safe only after opening the source URL and verifying the text is page content, not navigation or boilerplate.",
    "Treat short pages and template-heavy pages as requiring manual review before publication.",
    "Do not publish longitudinal claims from a year unless at least two institutions have audited evidence for that year.",
  ],
});

await writeText(
  path.join(reportsDir, "audit-packet.md"),
  [
    "# Mission Drift Audit Packet",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Pages requiring review: ${auditRows.length}`,
    "",
    "## Review Instructions",
    "",
    "- Verify snippets against the source URL before quoting.",
    "- Flag navigation/template text.",
    "- Require multiple audited institutions before making year-level trend claims.",
    "",
    "## Pages",
    "",
    ...auditRows.flatMap((row) => [
      `### ${row.institution} (${row.source_layer}, ${row.year})`,
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

console.log(`Built audit packet for ${auditRows.length} mission drift pages`);
