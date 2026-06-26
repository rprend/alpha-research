import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const exportDir = path.join(experimentDir, "exports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const pairs = listArg(args.pairs);
if (!pairs.length) throw new Error("Missing --pairs=<predictionRun:judgeRun,...>");
const prefix = args.prefix ?? "judge-support-direct-repair-future-holdout-v1";
const acceptedPath = path.join(exportDir, `${prefix}.sft.jsonl`);
const rejectedPath = path.join(exportDir, `${prefix}.rejected.jsonl`);
const manifestPath = path.join(exportDir, `${prefix}.manifest.json`);
const reportPath = path.join(experimentDir, "reports", `${prefix}.md`);

await fs.mkdir(exportDir, { recursive: true });
await fs.mkdir(path.dirname(reportPath), { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const seen = new Set();
const accepted = [];
const rejected = [];

for (const pair of pairs) {
  const [predictionRun, judgeRun] = pair.split(":");
  if (!predictionRun || !judgeRun) throw new Error(`Invalid pair ${pair}. Expected predictionRun:judgeRun.`);
  const predictions = await readJsonl(path.join(runDir, predictionRun, "predictions.jsonl"));
  const judgments = await readJsonl(path.join(runDir, judgeRun, "judgments.jsonl"));
  const judgmentsById = new Map(judgments.map((row) => [row.example_id, row]));
  for (const row of predictions) {
    const prediction = normalizePrediction(row.prediction ?? {});
    if (prediction.answer_type !== "grounded_answer") continue;
    const reference = referencesById.get(row.example_id);
    const judgmentRow = judgmentsById.get(row.example_id);
    if (!reference || !judgmentRow || seen.has(row.example_id)) continue;
    seen.add(row.example_id);
    const output = {
      example_id: row.example_id,
      split,
      source_prediction_run: predictionRun,
      source_judge_run: judgeRun,
      input: reference.input,
      teacher_output: prediction,
      judge: judgmentRow.judgment,
      label_source: "gpt4o_direct_repair_support_judgment",
    };
    if (isSupportedAnswer(judgmentRow.judgment)) accepted.push(output);
    else rejected.push({
      ...output,
      rejection_reason: rejectionReason(judgmentRow.judgment),
    });
  }
}

const manifest = {
  prefix,
  generated_at: new Date().toISOString(),
  split,
  pairs: pairs.map((pair) => {
    const [prediction_run, judge_run] = pair.split(":");
    return { prediction_run, judge_run };
  }),
  accepted_labels: accepted.length,
  rejected_labels: rejected.length,
  answered_labels: accepted.length + rejected.length,
  accepted_rate: ratio(accepted.length, accepted.length + rejected.length),
  llm_calls: 0,
  run_cost_usd: 0,
  note: "This export reuses existing prediction and judge artifacts. It makes no new model calls.",
};

await writeJsonl(acceptedPath, accepted);
await writeJsonl(rejectedPath, rejected);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(manifest));

console.log(JSON.stringify({
  accepted: path.relative(rootDir, acceptedPath),
  rejected: path.relative(rootDir, rejectedPath),
  manifest: path.relative(rootDir, manifestPath),
  report: path.relative(rootDir, reportPath),
  manifest_summary: manifest,
}, null, 2));

function renderReport(manifest) {
  return `# Judge Support Label Export

## Setup

- Prefix: \`${manifest.prefix}\`
- Split: \`${manifest.split}\`
- LLM calls: ${manifest.llm_calls}
- Run cost: $${manifest.run_cost_usd.toFixed(7)}

## Result

| Answered labels | Accepted | Rejected | Accepted rate |
| ---: | ---: | ---: | ---: |
| ${manifest.answered_labels} | ${manifest.accepted_labels} | ${manifest.rejected_labels} | ${pct(manifest.accepted_rate)} |

These labels reuse existing \`gpt-4o\` judgments over direct mini plus citation-repair predictions. Accepted rows are answered predictions judged fully supported; rejected rows are answered predictions judged partial, unsupported, invalid, or otherwise not fully supported.
`;
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function rejectionReason(judgment) {
  const verdict = String(judgment?.verdict ?? "unknown");
  const unsupported = Array.isArray(judgment?.unsupported_claims) ? judgment.unsupported_claims.length : 0;
  const missing = Array.isArray(judgment?.missing_citations) ? judgment.missing_citations.length : 0;
  return `${verdict}; unsupported_claims=${unsupported}; missing_citations=${missing}`;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: value.abstention_reason ? String(value.abstention_reason) : "",
  };
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function listArg(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
