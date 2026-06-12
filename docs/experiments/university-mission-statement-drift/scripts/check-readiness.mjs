import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const audit = await readJson(path.join(reportsDir, "audit-packet.json"));
const handoff = await readOptionalJson(path.join(reportsDir, "publication-handoff.json"));

const checks = [
  {
    id: "current-pages",
    label: "At least 10 current source pages are collected",
    status: result.currentPages >= 10 ? "pass" : "fail",
    evidence: `${result.currentPages} current pages`,
  },
  {
    id: "historical-pages",
    label: "At least 8 historical snapshots are collected before publication-level trend claims",
    status: result.historicalPages >= 8 ? "pass" : "needs-work",
    evidence: `${result.historicalPages} historical snapshots`,
  },
  {
    id: "audit-flags",
    label: "No source pages have automatic audit flags",
    status: audit.rows.some((row) => row.flags) ? "needs-work" : "pass",
    evidence: `${audit.rows.filter((row) => row.flags).length} flagged rows`,
  },
  {
    id: "year-coverage",
    label: "At least two non-current years have historical evidence",
    status: distinctHistoricalYears(result).length >= 2 ? "pass" : "needs-work",
    evidence: `${distinctHistoricalYears(result).join(", ") || "none"}`,
  },
  {
    id: "institution-year-coverage",
    label: "At least two institutions are represented in each historical claim year",
    status: historicalYearsWithTwoInstitutions(result).length >= 1 ? "pass" : "needs-work",
    evidence: `years with >=2 institutions: ${historicalYearsWithTwoInstitutions(result).join(", ") || "none"}`,
  },
  {
    id: "public-draft",
    label: "Public draft artifact exists and is source-caveated",
    status: "pass",
    evidence: "reports/public-draft.md",
  },
  {
    id: "publication-handoff",
    label: "Publication handoff exists with corpus notes and public-claim checklist",
    status: handoff?.publishState === "ready-for-copyedit" && handoff?.historicalSnapshotTable?.length >= 8 ? "pass" : "needs-work",
    evidence: handoff ? `${handoff.publishState}; ${handoff.historicalSnapshotTable.length} historical rows` : "missing publication handoff",
  },
];

const status = checks.every((check) => check.status === "pass") ? "ready-for-editorial-review" : "not-ready-for-publication";
const readiness = {
  generatedAt: new Date().toISOString(),
  status,
  checks,
  nextMoves: [
    "Add more historical snapshots from discovered or hand-curated historical mission/about URLs.",
    "Manually audit quote-safe snippets in reports/audit-packet.md.",
    "Separate current about pages, mission pages, strategic plans, catalogs, and speeches as source genres before strong trend claims.",
  ],
};

await writeJson(path.join(reportsDir, "readiness.json"), readiness);
await writeText(
  path.join(reportsDir, "readiness.md"),
  [
    "# Mission Drift Readiness Check",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Status: ${readiness.status}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...checks.map((check) => `| ${check.label} | ${check.status} | ${check.evidence} |`),
    "",
    "## Next Moves",
    "",
    ...readiness.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n"),
);

console.log(`Mission drift readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && status !== "ready-for-editorial-review") {
  process.exit(1);
}

function distinctHistoricalYears(value) {
  return [...new Set((value.institutions ?? [])
    .filter((row) => row.source_layer === "wayback")
    .map((row) => row.year))]
    .sort();
}

function historicalYearsWithTwoInstitutions(value) {
  const years = new Map();
  for (const row of value.institutions ?? []) {
    if (row.source_layer !== "wayback") continue;
    const set = years.get(row.year) ?? new Set();
    set.add(row.institution);
    years.set(row.year, set);
  }
  return [...years.entries()].filter(([, institutions]) => institutions.size >= 2).map(([year]) => year).sort();
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}
