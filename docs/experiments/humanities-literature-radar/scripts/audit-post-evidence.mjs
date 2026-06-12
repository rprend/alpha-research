import path from "node:path";
import {
  experimentDir,
  normalizeWhitespace,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const processedDir = path.join(experimentDir, "data", "processed");
const works = await readJson(path.join(processedDir, "works.json"));

const citedRecords = [
  {
    id: "post-1",
    title: "AI-Produced Humanities Research: On the Dangers of Technical Incrementalism",
    source: "openalex",
    year: 2026,
    doi: "10.1007/s13347-026-01085-6",
    url: "https://doi.org/10.1007/s13347-026-01085-6",
    citedAs: "A direct humanities-theory critique of AI-produced scholarship.",
  },
  {
    id: "post-2",
    title: "AI Does Not Hallucinate - The Unverifying Human Does",
    source: "hcommons",
    year: 2026,
    doi: "10.17613/17py8-2kq58",
    url: "https://works.hcommons.org/records/17py8-2kq58",
    citedAs: "Treats generative AI as an epistemology and literacy problem.",
  },
  {
    id: "post-3",
    title: "AI-Driven Generation of Old English: A Framework for Low-Resource Languages",
    source: "doaj",
    year: 2026,
    doi: "10.3390/bdcc10050145",
    url: "https://www.mdpi.com/2504-2289/10/5/145",
    citedAs: "Connects LLM methods to historical language work.",
  },
  {
    id: "post-4",
    title: "Are We There Yet? Notes Towards Benchmarking an Experimental AI-Assisted Workflow for Humanities Data Cleaning and Reconciliation",
    source: "crossref",
    year: 2026,
    doi: "10.5334/johd.490",
    url: "https://doi.org/10.5334/johd.490",
    citedAs: "Treats AI as infrastructure for humanities data work.",
  },
];

const audited = citedRecords.map((citation) => {
  const matches = findMatches(citation);
  const best = matches[0] ?? null;
  const checks = best ? buildChecks(citation, best) : [
    {
      id: "record-found",
      status: "fail",
      evidence: "No processed works record matched the cited title, DOI, or URL.",
    },
  ];
  return {
    ...citation,
    status: checks.every((check) => check.status === "pass") ? "pass" : "needs-review",
    matchCount: matches.length,
    matchedWork: best ? {
      workId: best.work_id,
      sourceRecordId: best.source_record_id,
      title: best.title,
      source: best.source_name,
      year: best.year,
      publicationDate: best.publication_date,
      doi: best.doi,
      url: best.url,
      venue: best.venue_name,
      authors: best.authors,
      methods: best.methods,
      quantitativeSignals: best.quantitative_signals,
      rawPath: best.raw_path,
    } : null,
    checks,
  };
});

const audit = {
  generatedAt: new Date().toISOString(),
  postPath: "docs/experiments/humanities-literature-radar/reports/post.md",
  corpusPath: "docs/experiments/humanities-literature-radar/data/processed/works.json",
  status: audited.every((row) => row.status === "pass") ? "pass" : "needs-review",
  citationCount: citedRecords.length,
  passedCount: audited.filter((row) => row.status === "pass").length,
  audited,
  nextMoves: audited.every((row) => row.status === "pass")
    ? [
      "Keep the representative-record table in the post attached to source caveats.",
      "Before public release, review linked source pages for quote-level or argument-level claims.",
    ]
    : [
      "Resolve citations marked needs-review before public release.",
      "Do not publish representative-record claims until all cited records match processed works.",
    ],
};

await writeJson(path.join(reportsDir, "post-evidence-audit.json"), audit);
await writeText(path.join(reportsDir, "post-evidence-audit.md"), buildMarkdown(audit));

console.log(`Post evidence audit: ${audit.status} (${audit.passedCount}/${audit.citationCount} citations)`);
if (process.argv.includes("--strict") && audit.status !== "pass") {
  process.exit(1);
}

function findMatches(citation) {
  const normalizedTitle = titleKey(citation.title);
  const doi = String(citation.doi ?? "").toLowerCase();
  const url = String(citation.url ?? "").toLowerCase();
  return works
    .filter((work) => {
      const workTitle = titleKey(work.title);
      const workDoi = String(work.doi ?? "").toLowerCase();
      const workUrl = String(work.url ?? "").toLowerCase();
      return workTitle === normalizedTitle
        || (doi && workDoi === doi)
        || (url && workUrl === url);
    })
    .sort((a, b) => scoreMatch(b, citation) - scoreMatch(a, citation));
}

function scoreMatch(work, citation) {
  let score = 0;
  if (titleKey(work.title) === titleKey(citation.title)) score += 5;
  if (String(work.doi ?? "").toLowerCase() === String(citation.doi ?? "").toLowerCase()) score += 3;
  if (String(work.url ?? "").toLowerCase() === String(citation.url ?? "").toLowerCase()) score += 2;
  if (String(work.source_name ?? "").toLowerCase() === citation.source) score += 1;
  return score;
}

function buildChecks(citation, work) {
  return [
    {
      id: "record-found",
      status: "pass",
      evidence: work.work_id,
    },
    {
      id: "source-match",
      status: String(work.source_name ?? "").toLowerCase() === citation.source ? "pass" : "needs-review",
      evidence: `cited=${citation.source}; processed=${work.source_name}`,
    },
    {
      id: "year-match",
      status: Number(work.year) === citation.year ? "pass" : "needs-review",
      evidence: `cited=${citation.year}; processed=${work.year}`,
    },
    {
      id: "doi-match",
      status: lower(work.doi) === lower(citation.doi) ? "pass" : "needs-review",
      evidence: `cited=${citation.doi}; processed=${work.doi || "none"}`,
    },
    {
      id: "url-present",
      status: work.url ? "pass" : "needs-review",
      evidence: work.url || "missing processed URL",
    },
  ];
}

function buildMarkdown(audit) {
  return [
    "# Humanities Literature Radar Post Evidence Audit",
    "",
    `Generated at: ${audit.generatedAt}`,
    `Status: ${audit.status}`,
    `Citations passed: ${audit.passedCount}/${audit.citationCount}`,
    "",
    "| Citation | Status | Matched Work | Source | Year | DOI |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...audit.audited.map((row) => [
      row.title,
      row.status,
      row.matchedWork?.workId ?? "missing",
      row.matchedWork?.source ?? "",
      row.matchedWork?.year ?? "",
      row.matchedWork?.doi ?? "",
    ].map(markdownCell).join(" | ")).map((row) => `| ${row} |`),
    "",
    "## Next Moves",
    "",
    ...audit.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n");
}

function titleKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
