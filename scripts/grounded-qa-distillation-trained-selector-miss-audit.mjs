import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const selectorRunId = args["selector-run"] ?? "trained-contract-selector-240-320-to-321-389-v1";
const runId = args["run-id"] ?? `trained-selector-miss-audit-${selectorRunId}`;
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const selectedRows = await readJsonl(path.join(runsDir, selectorRunId, "predictions.jsonl"));
const oracleRows = await readJsonl(path.join(runsDir, selectorRunId, "oracle_predictions.jsonl"));
const selectedById = new Map(selectedRows.map((row) => [row.example_id, row]));
const misses = oracleRows
  .filter((oracle) => oracle.prediction?.answer_type === "grounded_answer" && oracle.selection_scores?.supported_answer === true)
  .map((oracle) => auditMiss(oracle, selectedById.get(oracle.example_id)))
  .filter((row) => row.missed_supported_answer);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "trained_selector_miss_audit",
  status: statusFor(misses),
  selector_run_id: selectorRunId,
  missed_supported_answers: misses.length,
  tag_counts: counts(misses.flatMap((row) => row.tags)),
  selected_family_counts: counts(misses.map((row) => row.selected_family ?? "missing")),
  oracle_family_counts: counts(misses.map((row) => row.oracle_family ?? "missing")),
  mean_score_gap_selected_minus_oracle: mean(misses.map((row) => row.score_gap_selected_minus_oracle).filter(Number.isFinite)),
  rows: misses,
  interpretation: {
    cost: "No LLM calls and no compute. This audit compares existing selector and oracle artifacts.",
    next_step: "Use this to decide whether the next selector needs semantic entailment features, calibrated answer-vs-abstain scoring, or candidate-family balancing.",
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), misses);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  missed_supported_answers: result.missed_supported_answers,
  tag_counts: result.tag_counts,
  selected_family_counts: result.selected_family_counts,
  oracle_family_counts: result.oracle_family_counts,
}, null, 2));

function auditMiss(oracle, selected) {
  const selectedSupported = selected?.prediction?.answer_type === "grounded_answer" && selected?.selection_scores?.supported_answer === true;
  const missedSupportedAnswer = !selectedSupported;
  if (!missedSupportedAnswer) return { missed_supported_answer: false };
  const oracleCandidate = oracle.candidate_summary?.[oracle.selected_candidate_id] ?? {};
  const selectedCandidate = selected?.candidate_summary?.[selected?.selected_candidate_id] ?? {};
  const supportedCandidates = Object.entries(oracle.candidate_summary ?? {})
    .filter(([, candidate]) => candidate.supported_answer === true && candidate.answer_citation_complete === true);
  const unsupportedHigher = Object.entries(selected?.candidate_summary ?? {})
    .filter(([, candidate]) => candidate.supported_answer !== true && candidate.answer_citation_complete === true)
    .filter(([, candidate]) => Number(candidate.verifier_score ?? -Infinity) > Number(oracleCandidate.verifier_score ?? -Infinity));
  const tags = [];
  if (selected?.prediction?.answer_type === "abstain") tags.push("selected_abstention_over_supported_answer");
  if (selected?.prediction?.answer_type === "grounded_answer" && selected.selection_scores?.supported_answer !== true) tags.push("selected_unsupported_answer_over_supported_answer");
  if (unsupportedHigher.length) tags.push("unsupported_candidate_scored_above_oracle");
  if ((selected?.selected_family ?? "").startsWith("qwen") && oracle.selected_family === "openai_mini_scaffold") tags.push("qwen_over_supported_scaffold");
  if (oracle.selected_family?.startsWith("qwen")) tags.push("missed_qwen_supported_answer");
  if (supportedCandidates.length >= 3) tags.push("many_supported_candidates_available");
  if (Number(oracleCandidate.verifier_score ?? 0) < 0.75) tags.push("oracle_candidate_low_score");
  if (selectedCandidate.answer_citation_complete === false) tags.push("selected_contract_incomplete_candidate");
  if (!tags.length) tags.push("other_selector_miss");
  return {
    example_id: oracle.example_id,
    missed_supported_answer: true,
    selected_candidate_id: selected?.selected_candidate_id ?? null,
    selected_family: selected?.selected_family ?? null,
    selected_answer_type: selected?.prediction?.answer_type ?? null,
    selected_supported_answer: selected?.selection_scores?.supported_answer ?? false,
    selected_supported_abstention: selected?.selection_scores?.supported_abstention ?? false,
    selected_verifier_score: selected?.selection_scores?.verifier_score ?? null,
    selected_heuristic_score: selected?.selection_scores?.heuristic_score ?? null,
    oracle_candidate_id: oracle.selected_candidate_id,
    oracle_family: oracle.selected_family,
    oracle_verifier_score: oracleCandidate.verifier_score ?? null,
    oracle_heuristic_score: oracle.selection_scores?.heuristic_score ?? null,
    score_gap_selected_minus_oracle: Number(selected?.selection_scores?.verifier_score ?? NaN) - Number(oracleCandidate.verifier_score ?? NaN),
    supported_candidate_count: supportedCandidates.length,
    unsupported_higher_scored_count: unsupportedHigher.length,
    unsupported_higher_scored_candidates: unsupportedHigher.map(([id, candidate]) => ({
      id,
      family: candidate.family,
      verifier_score: candidate.verifier_score,
      heuristic_score: candidate.heuristic_score,
      answered: candidate.answered,
    })),
    tags: [...new Set(tags)],
    oracle_answer_preview: preview(oracle.prediction?.answer),
    selected_answer_preview: preview(selected?.prediction?.answer),
  };
}

function statusFor(rows) {
  const tagCounts = counts(rows.flatMap((row) => row.tags));
  if ((tagCounts.unsupported_candidate_scored_above_oracle ?? 0) >= rows.length / 2) return "verifier_score_miscalibration_dominates";
  if ((tagCounts.selected_abstention_over_supported_answer ?? 0) >= rows.length / 2) return "answer_abstention_calibration_dominates";
  if ((tagCounts.qwen_over_supported_scaffold ?? 0) >= rows.length / 3) return "family_shift_miscalibration_dominates";
  return "mixed_selector_failure_modes";
}

function renderReport(result) {
  const tagRows = Object.entries(result.tag_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`);
  const examples = result.rows.slice(0, 8)
    .map((row) => `- \`${row.example_id}\` (${row.tags.join(", ")}): selected \`${row.selected_candidate_id}\`, oracle \`${row.oracle_candidate_id}\`.`);
  return `# Trained Selector Miss Audit

Generated: ${result.generated_at}

Selector run: \`${result.selector_run_id}\`

## Summary

| Missed supported answers | Status | Mean selected-oracle score gap |
| ---: | --- | ---: |
| ${result.missed_supported_answers} | \`${result.status}\` | ${result.mean_score_gap_selected_minus_oracle.toFixed(3)} |

## Tag Counts

| Tag | Count |
| --- | ---: |
${tagRows.join("\n")}

## Examples

${examples.join("\n")}

This audit makes no LLM calls and launches no compute.
`;
}

function counts(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : 0;
}

function preview(value, length = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
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
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
