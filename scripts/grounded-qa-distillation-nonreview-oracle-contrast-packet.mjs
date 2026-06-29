import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const fourSourceRunId = args["four-source-run-id"] ?? "four-source-router-audit-2026-06-29-v1";
const calibratedRunId = args["calibrated-run-id"] ?? "calibrated-target-packet-eval-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sources = ["structured_group", "teacher", "learned", "pattern"];

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const candidateRows = await readJsonl(path.join(runsDir, fourSourceRunId, "candidate_rows.jsonl"));
const calibratedTargets = await readJsonl(path.join(runsDir, calibratedRunId, "calibrated_targets.jsonl"));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const calibratedById = new Map(calibratedTargets.map((row) => [row.example_id, row]));

const packetRows = candidateRows.map(toPacketRow).filter(Boolean);
const trainRows = packetRows.filter((row) => row.router_split === "train_tune");
const validationRows = packetRows.filter((row) => row.router_split === "train_heldout");
const freshEvalRows = candidateRows
  .filter((row) => row.router_split === "fresh_validation" && !calibratedById.get(row.example_id)?.review_deferred)
  .map((row) => ({
    ...promptById.get(row.example_id),
    label_source: {
      type: "nonreview_eval_only",
      source_packet_run_id: packetRunId,
      four_source_run_id: fourSourceRunId,
      calibrated_run_id: calibratedRunId,
    },
  }));
const freshEvalTargets = freshEvalRows.map((row) => targetById.get(row.example_id)).filter(Boolean);

const sftTrain = trainRows.map(toSftRow);
const sftValidation = validationRows.map(toSftRow);
const dpoTrain = trainRows.map(toDpoRow).filter(Boolean);
const dpoValidation = validationRows.map(toDpoRow).filter(Boolean);
const oraclePredictions = [
  ...trainRows.map(toOraclePrediction),
  ...validationRows.map(toOraclePrediction),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_oracle_contrast_packet",
  status: statusFor({ trainRows, validationRows, dpoTrain, dpoValidation, freshEvalRows }),
  purpose: "Create a leakage-safe non-review post-training packet from four-source oracle-correct candidates, with SFT targets and DPO contrasts, while reserving fresh non-review rows for evaluation only.",
  source_runs: {
    packet: packetRunId,
    four_source_router: fourSourceRunId,
    calibrated_eval: calibratedRunId,
  },
  leakage_note: "Training rows come only from train_tune; validation rows come only from train_heldout. Fresh-validation non-review rows are exported only as eval prompts/targets and no fresh labels are used for training.",
  metrics: {
    sft_train: sftTrain.length,
    sft_validation: sftValidation.length,
    dpo_train: dpoTrain.length,
    dpo_validation: dpoValidation.length,
    fresh_eval_prompts: freshEvalRows.length,
    fresh_eval_targets: freshEvalTargets.length,
    train_oracle_coverage: coverage(trainRows, "train_tune"),
    validation_oracle_coverage: coverage(validationRows, "train_heldout"),
    chosen_source_distribution_train: countBy(trainRows.map((row) => row.chosen_source)),
    chosen_source_distribution_validation: countBy(validationRows.map((row) => row.chosen_source)),
    rejected_source_distribution_train: countBy(dpoTrain.map((row) => row.rejected_source)),
    rejected_source_distribution_validation: countBy(dpoValidation.map((row) => row.rejected_source)),
    chosen_answer_types_train: countBy(trainRows.map((row) => row.chosen_prediction.answer_type)),
    chosen_answer_types_validation: countBy(validationRows.map((row) => row.chosen_prediction.answer_type)),
  },
  decision: decisionFor({ sftTrain, sftValidation, dpoTrain, dpoValidation, freshEvalRows }),
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
    note: "This packet builder reads existing local candidate artifacts only.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    oracle_predictions_jsonl: rel(path.join(outputDir, "oracle_predictions.jsonl")),
    packet_rows_jsonl: rel(path.join(outputDir, "packet_rows.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), sftTrain);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), sftValidation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), dpoTrain);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), dpoValidation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), freshEvalRows);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), freshEvalTargets);
await writeJsonl(path.join(outputDir, "oracle_predictions.jsonl"), oraclePredictions);
await writeJsonl(path.join(outputDir, "packet_rows.jsonl"), packetRows);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function toPacketRow(row) {
  const calibrated = calibratedById.get(row.example_id);
  if (calibrated?.review_deferred) return null;
  if (!["train_tune", "train_heldout"].includes(row.router_split)) return null;
  const correctSources = sources.filter((source) => row.candidates[source]?.contract_correct);
  if (!correctSources.length) return null;
  const chosenSource = chooseSource(correctSources, row);
  const rejectedSource = chooseRejectedSource(row, chosenSource);
  const prompt = promptById.get(row.example_id);
  const target = targetById.get(row.example_id);
  if (!prompt || !target) throw new Error(`Missing prompt/target for ${row.example_id}`);
  return {
    example_id: row.example_id,
    source_split: row.source_split,
    router_split: row.router_split,
    target_answer_type: row.target_answer_type,
    target_citations: row.target_citations,
    calibrated_target: calibrated,
    correct_sources: correctSources,
    chosen_source: chosenSource,
    chosen_prediction: normalizePrediction(row.candidates[chosenSource].prediction),
    rejected_source: rejectedSource,
    rejected_prediction: rejectedSource ? normalizePrediction(row.candidates[rejectedSource].prediction) : null,
    prompt,
    target: target.target,
  };
}

function chooseSource(correctSources, row) {
  return [...correctSources].sort((left, right) =>
    sourcePriority(left) - sourcePriority(right)
    || citationDistance(row.candidates[left], row.target_citations) - citationDistance(row.candidates[right], row.target_citations)
    || left.localeCompare(right)
  )[0];
}

function chooseRejectedSource(row, chosenSource) {
  const wrong = sources.filter((source) => source !== chosenSource && !row.candidates[source]?.contract_correct);
  if (!wrong.length) return null;
  return wrong.sort((left, right) =>
    Number(row.candidates[right].predicted_correctness ?? 0) - Number(row.candidates[left].predicted_correctness ?? 0)
    || sourcePriority(left) - sourcePriority(right)
    || left.localeCompare(right)
  )[0];
}

function toSftRow(row) {
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_nonreview_oracle_sft",
    messages: [...row.prompt.messages, { role: "assistant", content: JSON.stringify(row.chosen_prediction) }],
    input: row.prompt.input,
    target: row.chosen_prediction,
    label_source: {
      type: "four_source_oracle_correct_nonreview_candidate",
      source_packet_run_id: packetRunId,
      four_source_run_id: fourSourceRunId,
      calibrated_run_id: calibratedRunId,
      router_split: row.router_split,
      chosen_source: row.chosen_source,
      correct_sources: row.correct_sources,
      target_answer_type: row.target_answer_type,
    },
  };
}

function toDpoRow(row) {
  if (!row.rejected_prediction) return null;
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_nonreview_oracle_dpo",
    prompt: row.prompt.messages,
    chosen: JSON.stringify(row.chosen_prediction),
    rejected: JSON.stringify(row.rejected_prediction),
    chosen_output: row.chosen_prediction,
    rejected_output: row.rejected_prediction,
    input: row.prompt.input,
    chosen_source: row.chosen_source,
    rejected_source: row.rejected_source,
    label_source: {
      type: "prefer_contract_correct_nonreview_candidate_over_incorrect_candidate",
      source_packet_run_id: packetRunId,
      four_source_run_id: fourSourceRunId,
      calibrated_run_id: calibratedRunId,
      router_split: row.router_split,
      correct_sources: row.correct_sources,
    },
  };
}

function toOraclePrediction(row) {
  return {
    example_id: row.example_id,
    prediction: row.chosen_prediction,
    raw_output: JSON.stringify(row.chosen_prediction),
    metadata: {
      scaffold: "nonreview_oracle_contrast_packet_fixture",
      chosen_source: row.chosen_source,
      router_split: row.router_split,
    },
  };
}

function normalizePrediction(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  return {
    answer_type: answerType,
    evidence_first: value?.evidence_first ?? {
      sufficiency: answerType === "abstain" ? "insufficient" : "sufficient",
      supported_claims: [],
      missing_support: "",
      question_target: "",
    },
    answer: answerType === "abstain" ? "" : String(value?.answer ?? ""),
    citations: answerType === "abstain" ? [] : normalizeCitations(value?.citations),
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value?.abstention_reason ?? value?.evidence_first?.missing_support ?? "Evidence is insufficient.") : null,
  };
}

function coverage(rows, split) {
  const denominator = candidateRows.filter((row) => row.router_split === split && !calibratedById.get(row.example_id)?.review_deferred).length;
  return {
    usable_oracle_rows: rows.length,
    denominator_nonreview_rows: denominator,
    coverage_rate: denominator ? rows.length / denominator : 0,
  };
}

function statusFor({ trainRows, validationRows, dpoTrain, dpoValidation, freshEvalRows }) {
  if (trainRows.length >= 100 && validationRows.length >= 40 && dpoTrain.length >= 80 && dpoValidation.length >= 30 && freshEvalRows.length >= 60) return "nonreview_oracle_contrast_packet_ready";
  return "nonreview_oracle_contrast_packet_small_or_incomplete";
}

function decisionFor({ sftTrain, sftValidation, dpoTrain, dpoValidation, freshEvalRows }) {
  const ready = sftTrain.length >= 100 && sftValidation.length >= 40 && dpoTrain.length >= 80 && dpoValidation.length >= 30 && freshEvalRows.length >= 60;
  return {
    train_student_now: false,
    rent_prime_gpu_now: false,
    buy_more_openai_labels_now: false,
    keep_packet_for_next_student: ready,
    reason: ready
      ? `Packet has ${sftTrain.length} SFT train rows, ${dpoTrain.length} DPO train rows, and ${freshEvalRows.length} fresh eval prompts.`
      : "Packet is too small for a useful next student run.",
    next_step: ready
      ? "Run a local/cheap preflight that checks fixture contract correctness and prompt length before deciding whether a bounded GPU smoke is justified."
      : "Mine additional non-review oracle-correct rows before training.",
  };
}

function renderDatasetReadme(result) {
  return `# Non-Review Oracle Contrast Packet

This packet converts four-source oracle-correct non-review candidates into post-training rows for grounded QA distillation.

- Source packet: \`${result.source_runs.packet}\`
- Four-source candidates: \`${result.source_runs.four_source_router}\`
- Calibrated non-review overlay: \`${result.source_runs.calibrated_eval}\`
- SFT train rows: ${result.metrics.sft_train}
- SFT validation rows: ${result.metrics.sft_validation}
- DPO train rows: ${result.metrics.dpo_train}
- DPO validation rows: ${result.metrics.dpo_validation}
- Fresh eval prompts: ${result.metrics.fresh_eval_prompts}

Fresh-validation rows are eval-only. Training rows come only from non-review train-tune examples; validation rows come only from non-review train-heldout examples.
`;
}

function renderReport(result) {
  return `# Non-Review Oracle Contrast Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet is a post-training data artifact, not a model run. It packages four-source oracle-correct non-review candidates as SFT targets and DPO preferences while preserving fresh non-review rows for evaluation only.

## Metrics

- SFT train: ${result.metrics.sft_train}
- SFT validation: ${result.metrics.sft_validation}
- DPO train: ${result.metrics.dpo_train}
- DPO validation: ${result.metrics.dpo_validation}
- Fresh eval prompts: ${result.metrics.fresh_eval_prompts}
- Train oracle coverage: ${result.metrics.train_oracle_coverage.usable_oracle_rows}/${result.metrics.train_oracle_coverage.denominator_nonreview_rows}
- Validation oracle coverage: ${result.metrics.validation_oracle_coverage.usable_oracle_rows}/${result.metrics.validation_oracle_coverage.denominator_nonreview_rows}

## Decision

- Keep packet for next student: ${result.decision.keep_packet_for_next_student ? "yes" : "no"}
- Train student now: ${result.decision.train_student_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function sourcePriority(source) {
  return { structured_group: 0, teacher: 1, learned: 2, pattern: 3 }[source] ?? 9;
}

function citationDistance(candidate, targetCitations) {
  const candidateSet = new Set(normalizeCitations(candidate.citations));
  const targetSet = new Set(normalizeCitations(targetCitations));
  const union = new Set([...candidateSet, ...targetSet]);
  const intersection = [...candidateSet].filter((id) => targetSet.has(id)).length;
  return union.size - intersection;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value ?? "none"] = (out[value ?? "none"] ?? 0) + 1;
  return out;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
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

function rel(file) {
  return path.relative(rootDir, file);
}
