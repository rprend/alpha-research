import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "broad-sufficiency-headroom-audit-frontier-repaired-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const routerRunId = args["router-run-id"] ?? "train-supervised-candidate-router-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const routerSelections = await readJsonl(path.join(runsDir, routerRunId, "validation_selections.jsonl"));
const routerResult = await readJson(path.join(runsDir, routerRunId, "result.json"));

const abstentionPrior = scoreAbstentionPrior(targets);
const narrowTransferRows = prompts.map((prompt) => {
  const prediction = narrowSufficiencyPrediction(prompt.input?.question ?? "", prompt.input?.compact_retrieved_evidence_pack ?? []);
  const target = targetById.get(prompt.example_id);
  return {
    example_id: prompt.example_id,
    prediction_answer_type: prediction.answer_type,
    target_answer_type: target?.answer_type ?? null,
    contract_correct: scorePrediction(prediction, target).contract_correct,
    answer_type_correct: scorePrediction(prediction, target).answer_type_correct,
    citation_set_exact: scorePrediction(prediction, target).citation_set_exact,
  };
});

const rows = routerSelections.map((row) => {
  const target = targetById.get(row.example_id);
  const prompt = promptById.get(row.example_id);
  const correctCandidates = row.candidates.filter((candidate) => candidate.contract_correct);
  const selected = row.candidates.find((candidate) => candidate.system_id === row.selected_system_id) ?? null;
  const oracleCandidate = correctCandidates[0] ?? selected;
  return {
    example_id: row.example_id,
    question: prompt?.input?.question ?? "",
    target_answer_type: target?.answer_type ?? row.target_answer_type,
    target_citations: target?.citations ?? [],
    selected_system_id: row.selected_system_id,
    selected_answer_type: selected?.prediction_answer_type ?? null,
    selected_contract_correct: Boolean(row.selected_contract_correct),
    selected_answer_type_correct: Boolean(row.selected_answer_type_correct),
    selected_citation_set_exact: Boolean(row.selected_citation_set_exact),
    correct_candidate_systems: correctCandidates.map((candidate) => candidate.system_id),
    oracle_system_id: oracleCandidate?.system_id ?? null,
    oracle_contract_correct: Boolean(oracleCandidate?.contract_correct),
    recoverable_by_rerouting: !row.selected_contract_correct && correctCandidates.length > 0,
    irrecoverable_in_pool: correctCandidates.length === 0,
    tags: tagsFor(row, selected, correctCandidates, target),
  };
});

const metrics = {
  examples: rows.length,
  target_distribution: summarizeTargets(targets),
  abstention_prior_contract_correct: abstentionPrior.correct,
  abstention_prior_contract_correct_rate: abstentionPrior.rate,
  narrow_sufficiency_transfer_contract_correct: count(narrowTransferRows, (row) => row.contract_correct),
  narrow_sufficiency_transfer_contract_correct_rate: rate(count(narrowTransferRows, (row) => row.contract_correct), narrowTransferRows.length),
  router_contract_correct: count(rows, (row) => row.selected_contract_correct),
  router_contract_correct_rate: rate(count(rows, (row) => row.selected_contract_correct), rows.length),
  router_answer_type_correct: count(rows, (row) => row.selected_answer_type_correct),
  router_citation_set_exact: count(rows, (row) => row.selected_citation_set_exact),
  candidate_pool_oracle_contract_correct: count(rows, (row) => row.oracle_contract_correct),
  candidate_pool_oracle_contract_correct_rate: rate(count(rows, (row) => row.oracle_contract_correct), rows.length),
  recoverable_by_rerouting: count(rows, (row) => row.recoverable_by_rerouting),
  irrecoverable_in_pool: count(rows, (row) => row.irrecoverable_in_pool),
  grounded_irrecoverable_in_pool: count(rows, (row) => row.irrecoverable_in_pool && row.target_answer_type === "grounded_answer"),
  abstain_irrecoverable_in_pool: count(rows, (row) => row.irrecoverable_in_pool && row.target_answer_type === "abstain"),
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "broad_sufficiency_headroom_audit",
  status: statusFor(metrics),
  purpose: "Check whether the D411 sufficiency-first diagnostic transfers to the full repaired-validation gate and quantify whether remaining gains are routing headroom or candidate-construction headroom.",
  source_runs: {
    validation_packet: validationPacketRunId,
    router: routerRunId,
  },
  leakage_note: "The narrow sufficiency transfer predicts from question/evidence only. Router and oracle labels are report-only audits over existing validation selections; the oracle is not deployable.",
  metrics,
  selected_system_counts: countBy(rows.map((row) => row.selected_system_id)),
  correct_candidate_system_counts: countBy(rows.flatMap((row) => row.correct_candidate_systems)),
  row_tag_counts: countBy(rows.flatMap((row) => row.tags)),
  deltas: {
    narrow_sufficiency_minus_abstention_prior: metrics.narrow_sufficiency_transfer_contract_correct - metrics.abstention_prior_contract_correct,
    router_minus_abstention_prior: metrics.router_contract_correct - metrics.abstention_prior_contract_correct,
    oracle_minus_router: metrics.candidate_pool_oracle_contract_correct - metrics.router_contract_correct,
    oracle_minus_abstention_prior: metrics.candidate_pool_oracle_contract_correct - metrics.abstention_prior_contract_correct,
  },
  prior_router_summary: {
    status: routerResult.status,
    validation_contract_correct: routerResult.metrics?.repaired_validation_gate?.contract_correct,
    validation_pool_oracle_contract_correct: routerResult.oracle?.repaired_validation_gate?.contract_correct,
  },
  decision: decisionFor(metrics),
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
    note: "This audit reads existing local predictions, targets, and contract labels only.",
  },
  artifacts: {
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    narrow_transfer_rows_jsonl: rel(path.join(outputDir, "narrow_sufficiency_transfer_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await writeJsonl(path.join(outputDir, "narrow_sufficiency_transfer_rows.jsonl"), narrowTransferRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  deltas: result.deltas,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function narrowSufficiencyPrediction(question, evidencePack) {
  const premiseHypothesisQuestion = /\bpremise\b/i.test(question) && /\bhypothesis\b/i.test(question) && /\btogether\b/i.test(question);
  if (!premiseHypothesisQuestion) return abstain(question);
  const artifactEvidence = findEvidence(evidencePack, [
    /\btranslating different parts\b/i,
    /\bseparately\b/i,
    /\btranslation process itself\b/i,
    /\bartifacts\b/i,
  ]);
  const lexicalOverlapEvidence = findEvidence(evidencePack, [
    /\btranslating the premise and hypothesis independently\b/i,
    /\blikely to reduce the lexical overlap\b/i,
  ]);
  if (!artifactEvidence || !lexicalOverlapEvidence || artifactEvidence.evidence_id === lexicalOverlapEvidence.evidence_id) return abstain(question);
  const citations = [artifactEvidence.evidence_id, lexicalOverlapEvidence.evidence_id];
  return {
    answer_type: "grounded_answer",
    citations,
  };
}

function findEvidence(evidencePack, requiredPatterns) {
  return evidencePack.find((evidence) => {
    const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`;
    return requiredPatterns.every((pattern) => pattern.test(text));
  }) ?? null;
}

function abstain() {
  return { answer_type: "abstain", citations: [] };
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction?.answer_type === target?.answer_type;
  const citationSetExact = prediction?.answer_type === "abstain"
    ? (prediction?.citations ?? []).length === 0
    : setEqual(new Set(prediction?.citations ?? []), new Set(target?.citations ?? []));
  return {
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: answerTypeCorrect && citationSetExact,
  };
}

function scoreAbstentionPrior(targets) {
  const correct = targets.filter((row) => row.target?.answer_type === "abstain").length;
  return { correct, rate: rate(correct, targets.length) };
}

function summarizeTargets(targets) {
  return {
    grounded_answer: targets.filter((row) => row.target?.answer_type === "grounded_answer").length,
    abstain: targets.filter((row) => row.target?.answer_type === "abstain").length,
  };
}

function tagsFor(row, selected, correctCandidates, target) {
  const tags = [];
  if (row.selected_contract_correct) tags.push("router_correct");
  if (!row.selected_contract_correct && correctCandidates.length > 0) tags.push("recoverable_by_rerouting");
  if (correctCandidates.length === 0) tags.push("irrecoverable_in_pool");
  if (!row.selected_answer_type_correct) tags.push("selected_answerability_error");
  if (row.selected_answer_type_correct && !row.selected_citation_set_exact) tags.push("selected_citation_error");
  if (target?.answer_type === "grounded_answer" && correctCandidates.length === 0) tags.push("grounded_candidate_construction_gap");
  if (target?.answer_type === "abstain" && correctCandidates.length === 0) tags.push("abstention_candidate_construction_gap");
  if (selected?.prediction_answer_type === "grounded_answer" && target?.answer_type === "abstain") tags.push("over_answered_insufficient_evidence");
  if (selected?.prediction_answer_type === "abstain" && target?.answer_type === "grounded_answer") tags.push("false_abstention");
  return tags;
}

function statusFor(metrics) {
  if (metrics.narrow_sufficiency_transfer_contract_correct <= metrics.abstention_prior_contract_correct && metrics.irrecoverable_in_pool > metrics.recoverable_by_rerouting) {
    return "sufficiency_diagnostic_does_not_transfer_candidate_construction_gap_dominates";
  }
  if (metrics.candidate_pool_oracle_contract_correct > metrics.router_contract_correct) return "routing_headroom_remains";
  return "no_broad_headroom_in_existing_pool";
}

function decisionFor(metrics) {
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_narrow_sufficiency_rule: false,
    promote_router_only_work: false,
    candidate_construction_required: metrics.irrecoverable_in_pool > metrics.recoverable_by_rerouting,
    reason: `The D411-style narrow sufficiency rule scores ${metrics.narrow_sufficiency_transfer_contract_correct}/${metrics.examples} on the broad repaired-validation gate, tying the abstention prior, while the current router is ${metrics.router_contract_correct}/${metrics.examples} and the existing candidate-pool oracle is only ${metrics.candidate_pool_oracle_contract_correct}/${metrics.examples}.`,
    next_step: "Build a broader sufficiency-first constructor that creates new grounded candidates from evidence, then evaluate it against the 70-row gate before spending on Prime or paid judging.",
  };
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function renderReport(result) {
  return `# Broad Sufficiency Headroom Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy | Contract correct | Rate |
| --- | ---: | ---: |
| Abstention prior | ${result.metrics.abstention_prior_contract_correct} / ${result.metrics.examples} | ${pct(result.metrics.abstention_prior_contract_correct_rate)} |
| D411 narrow sufficiency transfer | ${result.metrics.narrow_sufficiency_transfer_contract_correct} / ${result.metrics.examples} | ${pct(result.metrics.narrow_sufficiency_transfer_contract_correct_rate)} |
| Current train-supervised router | ${result.metrics.router_contract_correct} / ${result.metrics.examples} | ${pct(result.metrics.router_contract_correct_rate)} |
| Existing candidate-pool oracle | ${result.metrics.candidate_pool_oracle_contract_correct} / ${result.metrics.examples} | ${pct(result.metrics.candidate_pool_oracle_contract_correct_rate)} |

## Headroom

- Recoverable by rerouting existing candidates: ${result.metrics.recoverable_by_rerouting}
- Irrecoverable inside current candidate pool: ${result.metrics.irrecoverable_in_pool}
- Grounded candidate-construction gaps: ${result.metrics.grounded_irrecoverable_in_pool}
- Abstention candidate-construction gaps: ${result.metrics.abstain_irrecoverable_in_pool}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote narrow sufficiency rule: ${result.decision.promote_narrow_sufficiency_rule ? "yes" : "no"}
- Candidate construction required: ${result.decision.candidate_construction_required ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
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
