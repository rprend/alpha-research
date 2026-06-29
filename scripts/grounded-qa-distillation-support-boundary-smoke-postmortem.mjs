import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const baselineSmokeRunId = args["baseline-smoke-run-id"] ?? "targeted-grounded-construction-dpo-prompt-repaired-qwen3b-smoke-v1";
const baselineNormRunId = args["baseline-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-dpo-prompt-repaired-qwen3b-smoke-v1";
const candidateSmokeRunId = args["candidate-smoke-run-id"] ?? "support-boundary-schema-qwen3b-smoke-v1";
const candidateNormRunId = args["candidate-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-support-boundary-schema-qwen3b-smoke-v1";
const runId = args["run-id"] ?? "support-boundary-schema-smoke-postmortem-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const baselineSmoke = await readJson(path.join(runsDir, baselineSmokeRunId, "result.json"));
const candidateSmoke = await readJson(path.join(runsDir, candidateSmokeRunId, "result.json"));
const baselineNorm = await readJson(path.join(runsDir, baselineNormRunId, "result.json"));
const candidateNorm = await readJson(path.join(runsDir, candidateNormRunId, "result.json"));
const baselineScored = await readJsonl(path.join(runsDir, baselineNormRunId, "scored_predictions.jsonl"));
const candidateScored = await readJsonl(path.join(runsDir, candidateNormRunId, "scored_predictions.jsonl"));
const baselinePredictions = await readJsonl(path.join(runsDir, baselineSmokeRunId, "predictions.jsonl"));
const candidatePredictions = await readJsonl(path.join(runsDir, candidateSmokeRunId, "predictions.jsonl"));

const baselineById = new Map(baselineScored.map((row) => [row.example_id, row]));
const candidateById = new Map(candidateScored.map((row) => [row.example_id, row]));
const baselinePredictionById = new Map(baselinePredictions.map((row) => [row.example_id, row]));
const candidatePredictionById = new Map(candidatePredictions.map((row) => [row.example_id, row]));
const exampleIds = [...baselineById.keys()];
const rows = exampleIds.map((exampleId) => compareExample(exampleId));
const summary = summarize(rows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_boundary_schema_smoke_postmortem",
  status: statusFor(summary),
  purpose: "Compare the D403 support-boundary schema smoke against the earlier D397 DPO-prompt-repaired targeted smoke on the same 10-row diagnostic surface.",
  source_runs: {
    baseline_smoke: baselineSmokeRunId,
    baseline_normalization: baselineNormRunId,
    candidate_smoke: candidateSmokeRunId,
    candidate_normalization: candidateNormRunId,
  },
  summary,
  baseline_metrics: {
    raw_eval: baselineSmoke.eval,
    normalized: baselineNorm.metrics,
  },
  candidate_metrics: {
    raw_eval: candidateSmoke.eval,
    normalized: candidateNorm.metrics,
  },
  conclusion: conclusionFor(summary),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This postmortem compares existing local prediction and normalization artifacts only.",
  },
  artifacts: {
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    regressions_jsonl: rel(path.join(outputDir, "regressions.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await writeJsonl(path.join(outputDir, "regressions.jsonl"), rows.filter((row) => row.bucket.includes("regression")));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  conclusion: result.conclusion,
  llm_budget: result.llm_budget,
}, null, 2));

function compareExample(exampleId) {
  const baseline = baselineById.get(exampleId);
  const candidate = candidateById.get(exampleId);
  const baselineRaw = baselinePredictionById.get(exampleId);
  const candidateRaw = candidatePredictionById.get(exampleId);
  const baselineCorrect = Boolean(baseline?.normalized_contract?.contract_correct);
  const candidateCorrect = Boolean(candidate?.normalized_contract?.contract_correct);
  const baselineAnswerType = baseline?.normalized_contract?.answer_type_correct === true;
  const candidateAnswerType = candidate?.normalized_contract?.answer_type_correct === true;
  const baselineCitation = baseline?.normalized_contract?.citation_set_exact === true;
  const candidateCitation = candidate?.normalized_contract?.citation_set_exact === true;
  const baselineEf = baseline?.normalized_contract?.evidence_first_valid === true;
  const candidateEf = candidate?.normalized_contract?.evidence_first_valid === true;
  return {
    example_id: exampleId,
    target_answer_type: baseline?.target?.answer_type ?? candidate?.target?.answer_type ?? null,
    bucket: bucketFor({ baselineCorrect, candidateCorrect, baselineAnswerType, candidateAnswerType, baselineCitation, candidateCitation, baselineEf, candidateEf }),
    baseline: {
      raw_answer_type: baselineRaw?.prediction?.answer_type ?? null,
      normalized_answer_type: baseline?.normalized_prediction?.answer_type ?? null,
      normalized_contract_correct: baselineCorrect,
      answer_type_correct: baselineAnswerType,
      citation_set_exact: baselineCitation,
      evidence_first_valid: baselineEf,
      raw_parse_error: baselineRaw?.parse_error ?? null,
      raw_answer_preview: preview(baselineRaw?.prediction?.answer),
      raw_citations: normalizeCitations(baselineRaw?.prediction?.citations),
    },
    candidate: {
      raw_answer_type: candidateRaw?.prediction?.answer_type ?? null,
      normalized_answer_type: candidate?.normalized_prediction?.answer_type ?? null,
      normalized_contract_correct: candidateCorrect,
      answer_type_correct: candidateAnswerType,
      citation_set_exact: candidateCitation,
      evidence_first_valid: candidateEf,
      raw_parse_error: candidateRaw?.parse_error ?? null,
      raw_answer_preview: preview(candidateRaw?.prediction?.answer),
      raw_citations: normalizeCitations(candidateRaw?.prediction?.citations),
    },
    tags: tagsFor({ baselineRaw, candidateRaw, baseline, candidate }),
  };
}

function bucketFor({ baselineCorrect, candidateCorrect, baselineAnswerType, candidateAnswerType, baselineCitation, candidateCitation, baselineEf, candidateEf }) {
  if (baselineCorrect && candidateCorrect) return "both_contract_correct";
  if (!baselineCorrect && candidateCorrect) return "candidate_recovery";
  if (baselineCorrect && !candidateCorrect) return "candidate_regression_from_baseline";
  const regressions = [];
  if (baselineAnswerType && !candidateAnswerType) regressions.push("answer_type_regression");
  if (baselineCitation && !candidateCitation) regressions.push("citation_regression");
  if (baselineEf && !candidateEf) regressions.push("evidence_first_regression");
  return regressions.length ? `both_wrong_with_${regressions.join("_")}` : "both_wrong";
}

function tagsFor({ baselineRaw, candidateRaw, baseline, candidate }) {
  const tags = new Set();
  if (candidateRaw?.parse_error && !baselineRaw?.parse_error) tags.add("candidate_new_parse_error");
  if (!candidateRaw?.parse_error && baselineRaw?.parse_error) tags.add("candidate_parse_recovered");
  if (baseline?.normalized_contract?.answer_type_correct && !candidate?.normalized_contract?.answer_type_correct) tags.add("candidate_answer_type_regression");
  if (baseline?.normalized_contract?.citation_set_exact && !candidate?.normalized_contract?.citation_set_exact) tags.add("candidate_citation_regression");
  if (baseline?.normalized_contract?.evidence_first_valid && !candidate?.normalized_contract?.evidence_first_valid) tags.add("candidate_evidence_first_regression");
  if ((candidateRaw?.prediction?.answer_type === "grounded_answer") && baselineRaw?.prediction?.answer_type === "abstain") tags.add("candidate_over_answers_vs_baseline");
  if ((candidateRaw?.prediction?.answer_type === "abstain") && baselineRaw?.prediction?.answer_type === "grounded_answer") tags.add("candidate_more_conservative_than_baseline");
  if (candidateRaw?.prediction?.answer_type === "abstain" && Array.isArray(candidateRaw?.prediction?.evidence_first?.supported_claims) && candidateRaw.prediction.evidence_first.supported_claims.length) tags.add("candidate_cited_abstention_rationale");
  if (candidateRaw?.prediction?.answer_type === "grounded_answer" && !Array.isArray(candidateRaw?.prediction?.evidence_first?.supported_claims)) tags.add("candidate_empty_grounded_evidence_first");
  return [...tags].sort();
}

function summarize(rows) {
  const baselineCorrect = rows.filter((row) => row.baseline.normalized_contract_correct).length;
  const candidateCorrect = rows.filter((row) => row.candidate.normalized_contract_correct).length;
  const regressions = rows.filter((row) => row.bucket.includes("regression"));
  return {
    examples: rows.length,
    baseline_normalized_contract_correct: baselineCorrect,
    candidate_normalized_contract_correct: candidateCorrect,
    delta_candidate_minus_baseline: candidateCorrect - baselineCorrect,
    both_contract_correct: rows.filter((row) => row.bucket === "both_contract_correct").length,
    candidate_recoveries: rows.filter((row) => row.bucket === "candidate_recovery").length,
    candidate_regressions_from_baseline: rows.filter((row) => row.bucket === "candidate_regression_from_baseline").length,
    both_wrong: rows.filter((row) => row.bucket === "both_wrong").length,
    any_regression_bucket: regressions.length,
    bucket_counts: countBy(rows, (row) => row.bucket),
    tag_counts: countTags(rows.flatMap((row) => row.tags)),
    target_answer_type_counts: countBy(rows, (row) => row.target_answer_type),
  };
}

function statusFor(summary) {
  if (summary.delta_candidate_minus_baseline < 0 && summary.candidate_regressions_from_baseline > summary.candidate_recoveries) return "support_boundary_schema_regresses_targeted_smoke";
  if (summary.delta_candidate_minus_baseline > 0) return "support_boundary_schema_improves_targeted_smoke";
  return "support_boundary_schema_ties_targeted_smoke";
}

function conclusionFor(summary) {
  if (summary.delta_candidate_minus_baseline < 0) {
    return {
      launch_prime_now: false,
      buy_openai_judgments_now: false,
      keep_support_boundary_packet: false,
      next_step: "Stop adding synthetic schema/boundary DPO rows to this small-model branch. Revert to the smaller DPO-prompt-repaired packet for any future bounded smoke, or change the candidate construction mechanism with a simpler answerability objective.",
      reason: `The support-boundary packet loses ${Math.abs(summary.delta_candidate_minus_baseline)} normalized contract-correct rows versus the earlier repaired-targeted smoke and introduces ${summary.candidate_regressions_from_baseline} direct regressions with only ${summary.candidate_recoveries} recoveries.`,
    };
  }
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    keep_support_boundary_packet: false,
    next_step: "Do not spend from this tie without a fresh heldout or stronger candidate construction rationale.",
    reason: "The support-boundary packet does not provide a clear improvement over the cheaper prior packet.",
  };
}

function renderReport(result) {
  const bucketRows = Object.entries(result.summary.bucket_counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([bucket, count]) => `| \`${bucket}\` | ${count} |`);
  const tagRows = Object.entries(result.summary.tag_counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`);
  return `# Support-Boundary Schema Smoke Postmortem

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute.

## Summary

| Metric | Count |
| --- | ---: |
| Examples | ${result.summary.examples} |
| Baseline normalized correct | ${result.summary.baseline_normalized_contract_correct} |
| Candidate normalized correct | ${result.summary.candidate_normalized_contract_correct} |
| Candidate - baseline | ${result.summary.delta_candidate_minus_baseline} |
| Candidate recoveries | ${result.summary.candidate_recoveries} |
| Candidate regressions from baseline | ${result.summary.candidate_regressions_from_baseline} |

## Buckets

| Bucket | Count |
| --- | ---: |
${bucketRows.join("\n")}

## Tags

| Tag | Count |
| --- | ---: |
${tagRows.join("\n") || "| none | 0 |"}

## Conclusion

- Launch Prime now: ${result.conclusion.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.conclusion.buy_openai_judgments_now ? "yes" : "no"}
- Keep support-boundary packet: ${result.conclusion.keep_support_boundary_packet ? "yes" : "no"}
- Reason: ${result.conclusion.reason}
- Next step: ${result.conclusion.next_step}
`;
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row) ?? "missing";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function preview(value, length = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
