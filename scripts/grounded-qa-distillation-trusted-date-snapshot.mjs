import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const split = args.split ?? "extended_temporal_future_holdout";
const runId = args["run-id"] ?? "trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const rows = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const paperMap = new Map();
for (const row of rows) {
  const metadata = row.input?.document_metadata ?? {};
  const paperId = metadata.paper_id;
  if (!paperId) continue;
  if (!paperMap.has(paperId)) {
    paperMap.set(paperId, {
      paper_id: paperId,
      title: metadata.title,
      inferred_publication_month: metadata.inferred_publication_month ?? null,
      inferred_publication_date: metadata.inferred_publication_date ?? null,
      temporal_source_before_snapshot: metadata.temporal_source ?? null,
      examples: 0,
      counterfactual_examples: 0,
    });
  }
  const paper = paperMap.get(paperId);
  paper.examples += 1;
  if (metadata.counterfactual) paper.counterfactual_examples += 1;
}

const papers = [...paperMap.values()].sort((a, b) => a.paper_id.localeCompare(b.paper_id));
const arxivRecords = new Map();
for (const batch of chunks(papers.map((paper) => paper.paper_id), 50)) {
  const xml = await fetchArxiv(batch);
  for (const record of parseArxivEntries(xml)) {
    arxivRecords.set(record.paper_id, record);
  }
}

const snapshotRows = papers.map((paper) => {
  const arxiv = arxivRecords.get(paper.paper_id) ?? null;
  const publishedDate = arxiv?.published?.slice(0, 10) ?? null;
  const publishedMonth = publishedDate?.slice(0, 7) ?? null;
  return {
    ...paper,
    trusted_temporal_source: arxiv ? "arxiv_api_published_date" : "missing_arxiv_api_record",
    trusted_publication_date: publishedDate,
    trusted_publication_month: publishedMonth,
    arxiv_updated_date: arxiv?.updated?.slice(0, 10) ?? null,
    arxiv_title: arxiv?.title ?? null,
    arxiv_url: arxiv?.url ?? null,
    inferred_matches_trusted_month: publishedMonth ? publishedMonth === paper.inferred_publication_month : false,
  };
});

const missing = snapshotRows.filter((row) => row.trusted_temporal_source === "missing_arxiv_api_record");
const mismatches = snapshotRows.filter((row) => row.trusted_publication_month && row.inferred_publication_month && row.trusted_publication_month !== row.inferred_publication_month);
const months = [...new Set(snapshotRows.map((row) => row.trusted_publication_month).filter(Boolean))].sort();

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  snapshot_type: "trusted_dated_kb_snapshot",
  split,
  trusted_temporal_source: "arxiv_api_published_date",
  source_api: "https://export.arxiv.org/api/query",
  rows_read: rows.length,
  papers_checked: papers.length,
  papers_with_trusted_dates: snapshotRows.length - missing.length,
  missing_arxiv_records: missing.length,
  inferred_month_mismatches: mismatches.length,
  trusted_months: {
    first: months[0] ?? null,
    last: months.at(-1) ?? null,
    distinct: months,
  },
  evaluation_relevance: {
    final_window_examples: "extended_temporal_future_holdout rows 321-389 are drawn from this dated snapshot.",
    leakage_boundary: "Dates are fetched from arXiv paper metadata only; no final-window answers or judgments are used.",
    claim_scope: "This upgrades the final future-holdout KB window from arXiv-id-prefix inference to a trusted dated arXiv API snapshot. It is still public arXiv metadata, not a private KB.",
  },
  artifacts: {
    paper_dates_jsonl: path.join("docs/experiments/grounded-qa-distillation/runs", runId, "paper_dates.jsonl"),
    result_json: path.join("docs/experiments/grounded-qa-distillation/runs", runId, "result.json"),
    report_md: path.join("docs/experiments/grounded-qa-distillation/runs", runId, "report.md"),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Uses arXiv metadata API only; no LLM calls and no GPU jobs.",
  },
};

await fs.writeFile(path.join(outputDir, "paper_dates.jsonl"), snapshotRows.map((row) => JSON.stringify(row)).join("\n") + "\n");
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result, snapshotRows, missing, mismatches));
console.log(JSON.stringify(result, null, 2));

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
}

function fetchArxiv(ids) {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(ids.join(","))}&max_results=${ids.length}`;
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`arXiv API returned ${response.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        resolve(body);
      });
    }).on("error", reject);
  });
}

function parseArxivEntries(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);
  return entries.map((entry) => {
    const idUrl = textBetween(entry, "id");
    const paperId = idUrl?.match(/abs\/([^<]+)/)?.[1]?.replace(/v\d+$/, "") ?? null;
    return {
      paper_id: paperId,
      url: idUrl,
      title: normalizeXmlText(textBetween(entry, "title")),
      published: textBetween(entry, "published"),
      updated: textBetween(entry, "updated"),
    };
  }).filter((entry) => entry.paper_id);
}

function textBetween(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : null;
}

function normalizeXmlText(value) {
  return value ? value.replace(/\s+/g, " ").trim() : null;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function chunks(values, size) {
  const out = [];
  for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size));
  return out;
}

function renderReport(result, rows, missing, mismatches) {
  const monthRows = result.trusted_months.distinct.map((month) => {
    const count = rows.filter((row) => row.trusted_publication_month === month).length;
    return `| ${month} | ${count} |`;
  }).join("\n");
  return `# Trusted Dated KB Snapshot

Split: \`${result.split}\`

This artifact verifies the final future-holdout KB window against arXiv API \`published\` dates rather than relying only on parsed arXiv id prefixes.

## Coverage

| Papers checked | Trusted arXiv dates | Missing records | Inferred-month mismatches |
| ---: | ---: | ---: | ---: |
| ${result.papers_checked} | ${result.papers_with_trusted_dates} | ${result.missing_arxiv_records} | ${result.inferred_month_mismatches} |

## Trusted Months

| Month | Papers |
| --- | ---: |
${monthRows}

## Evaluation Boundary

- ${result.evaluation_relevance.final_window_examples}
- ${result.evaluation_relevance.leakage_boundary}
- ${result.evaluation_relevance.claim_scope}

## Missing Records

${missing.length ? missing.map((row) => `- ${row.paper_id}`).join("\n") : "None."}

## Month Mismatches

${mismatches.length ? mismatches.map((row) => `- ${row.paper_id}: inferred ${row.inferred_publication_month}, trusted ${row.trusted_publication_month}`).join("\n") : "None."}

## Budget

No OpenAI calls, no GPU jobs, and no new spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
