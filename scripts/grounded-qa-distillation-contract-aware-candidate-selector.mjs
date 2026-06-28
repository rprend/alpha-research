import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const evalOffset = numberArg(args["eval-offset"], 320, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 69);
const runId = args["run-id"] ?? "contract-aware-candidate-selector-final-window-v1";
const outputDir = path.join(runsDir, runId);

const candidateSpecs = [
  {
    id: "direct_mini_repair",
    family: "openai_mini_scaffold",
    predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  },
  {
    id: "balanced_risk_gate",
    family: "openai_mini_scaffold",
    predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
  {
    id: "claim_entailment_guard",
    family: "openai_mini_scaffold",
    predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
    judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
    predictionFilter: (row) => row.window === "321-389",
  },
  {
    id: "qwen3b_v1",
    family: "qwen3b_lora",
    predictionRunId: "joint-action-qwen3b-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen3b_v3",
    family: "qwen3b_lora",
    predictionRunId: "joint-action-qwen3b-v3-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen3b-v3-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen3b_v4",
    family: "qwen3b_lora",
    predictionRunId: "joint-action-qwen3b-v4-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen3b-v4-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v4",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v5",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v6",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair",
  },
  {
    id: "qwen7b_v7",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair",
  },
  {
    id: "qwen7b_v8",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8",
  },
  {
    id: "qwen7b_v9",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair",
  },
  {
    id: "qwen7b_v10",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-answer-completion-repair-smoke-eval-v10-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-answer-completion-v10-citation-repair",
  },
  {
    id: "qwen7b_v11",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-mixed-metric-v11-citation-repair",
  },
  {
    id: "qwen7b_v12",
    family: "qwen7b_lora",
    predictionRunId: "joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair",
    judgeRunId: "openai-judge-gpt4o-joint-action-qwen7b-support-targeted-v12-citation-repair",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const references = (await readJsonl(path.join(dataDir, `${split}.jsonl`))).slice(evalOffset, evalOffset + evalLimit);
const loadedCandidates = await Promise.all(candidateSpecs.map(loadCandidateSpec));
const rows = references.map((reference) => buildRow(reference, loadedCandidates));
const heuristicRows = rows.map(selectContractHeuristic);
const oracleRows = rows.map(selectContractOracle);
const scaffoldRows = rows.map((row) => selectPriority(row, ["claim_entailment_guard", "balanced_risk_gate", "direct_mini_repair"]));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "contract_aware_candidate_selector",
  status: statusFor({ heuristic: summarizeSelections(heuristicRows), oracle: summarizeSelections(oracleRows) }),
  purpose: "Zero-call selector diagnostic: test whether answer-citation-complete candidates across the expanded pool can recover support-preserving coverage without paid per-query verification.",
  split,
  eval_offset: evalOffset,
  examples: references.length,
  candidate_specs: candidateSpecs.map(({ predictionFilter, ...spec }) => spec),
  selection_metrics: {
    contract_heuristic_selector: summarizeSelections(heuristicRows),
    contract_judged_oracle: summarizeSelections(oracleRows),
    scaffold_priority_selector: summarizeSelections(scaffoldRows),
  },
  selector_gap: selectorGap({ heuristicRows, oracleRows, scaffoldRows }),
  policy: {
    contract: "For answer candidates, require valid top-level citations, valid inline citations, and no counterfactual metadata. Claim-table citations are recorded but not required because D227 showed they suppress supported answers.",
    heuristic_selection: "Choose the contract-complete answer with the highest retrieval/inline/valid-citation heuristic score, using scaffold family prior. If no answer candidate passes, fall back to claim-entailment guard, balanced gate, or direct-mini abstention.",
    oracle_selection: "For upper-bound diagnosis only, choose a contract-complete supported answer if one exists; otherwise choose a supported abstention. This uses existing paid judgments and is not deployable.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
  },
};

await writeJsonl(path.join(outputDir, "heuristic_predictions.jsonl"), heuristicRows);
await writeJsonl(path.join(outputDir, "oracle_predictions.jsonl"), oracleRows);
await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection_metrics: result.selection_metrics,
  selector_gap: result.selector_gap,
}, null, 2));

async function loadCandidateSpec(spec) {
  const predictionRows = (await readJsonl(path.join(runsDir, spec.predictionRunId, "predictions.jsonl")))
    .filter(spec.predictionFilter ?? (() => true));
  const judgmentRows = await readJsonl(path.join(runsDir, spec.judgeRunId, "judgments.jsonl"));
  return {
    ...spec,
    predictions: new Map(predictionRows.map((row) => [row.example_id, row])),
    judgments: new Map(judgmentRows.map((row) => [row.example_id, row])),
  };
}

function buildRow(reference, loaded) {
  const candidates = loaded.flatMap((spec) => {
    const predictionRow = spec.predictions.get(reference.example_id);
    const judgmentRow = spec.judgments.get(reference.example_id);
    if (!predictionRow || !judgmentRow) return [];
    const prediction = normalizePrediction(predictionRow.prediction ?? {});
    const judgment = judgmentRow.judgment ?? {};
    const contract = answerCitationContract(reference, prediction);
    return [{
      id: spec.id,
      family: spec.family,
      prediction_run_id: spec.predictionRunId,
      judge_run_id: spec.judgeRunId,
      prediction,
      judgment,
      answered: prediction.answer_type === "grounded_answer",
      supported_answer: prediction.answer_type === "grounded_answer" && isSupportedAnswer(judgment),
      supported_abstention: prediction.answer_type === "abstain" && isSupportedAbstention(judgment),
      judged_correct: isSupportedAnswer(judgment) || isSupportedAbstention(judgment),
      answer_type_correct: prediction.answer_type === reference.output.answer_type,
      contract,
      heuristic_score: heuristicScore(reference, prediction, spec, contract),
    }];
  });
  return {
    example_id: reference.example_id,
    counterfactual: Boolean(reference.input?.document_metadata?.counterfactual),
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    },
    candidates,
  };
}

function selectContractHeuristic(row) {
  const answers = row.candidates
    .filter((candidate) => candidate.answered && candidate.contract.answer_citation_complete && !row.counterfactual)
    .sort(compareHeuristic);
  const selected = answers[0] ?? fallbackAbstention(row);
  return selectionRow(row, selected, "contract_heuristic_selector");
}

function selectContractOracle(row) {
  const supportedAnswers = row.candidates
    .filter((candidate) => candidate.answered && candidate.supported_answer && candidate.contract.answer_citation_complete && !row.counterfactual)
    .sort(compareOracle);
  const selected = supportedAnswers[0] ?? supportedAbstention(row) ?? fallbackAbstention(row);
  return selectionRow(row, selected, "contract_judged_oracle");
}

function selectPriority(row, priority) {
  const selected = priority.map((id) => row.candidates.find((candidate) => candidate.id === id)).find(Boolean)
    ?? fallbackAbstention(row);
  return selectionRow(row, selected, "scaffold_priority_selector");
}

function fallbackAbstention(row) {
  return supportedAbstention(row)
    ?? row.candidates.find((candidate) => candidate.prediction.answer_type === "abstain")
    ?? syntheticAbstention(row);
}

function supportedAbstention(row) {
  return row.candidates.find((candidate) => candidate.supported_abstention);
}

function syntheticAbstention(row) {
  return {
    id: "synthetic_abstain",
    family: "deterministic_gate",
    prediction: {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "No contract-complete answer candidate selected.", support: "abstention", citations: [] }],
      abstention_reason: "No answer-citation-complete candidate passed the selector.",
    },
    judgment: null,
    answered: false,
    supported_answer: false,
    supported_abstention: row.reference.answer_type === "abstain",
    judged_correct: row.reference.answer_type === "abstain",
    answer_type_correct: row.reference.answer_type === "abstain",
    contract: { answer_citation_complete: false, top_level_valid: false, inline_valid: false },
    heuristic_score: 0,
  };
}

function selectionRow(row, selected, selectorType) {
  return {
    example_id: row.example_id,
    selector_type: selectorType,
    selected_candidate_id: selected.id,
    selected_family: selected.family,
    prediction: selected.prediction,
    reference: row.reference,
    inherited_judgment: selected.judgment,
    selection_scores: {
      supported_answer: selected.supported_answer,
      supported_abstention: selected.supported_abstention,
      judged_correct: selected.supported_answer || selected.supported_abstention,
      answer_type_correct: selected.answer_type_correct,
      answer_citation_complete: selected.contract?.answer_citation_complete ?? false,
      heuristic_score: selected.heuristic_score,
    },
    candidate_summary: Object.fromEntries(row.candidates.map((candidate) => [candidate.id, {
      family: candidate.family,
      answered: candidate.answered,
      supported_answer: candidate.supported_answer,
      supported_abstention: candidate.supported_abstention,
      answer_citation_complete: candidate.contract.answer_citation_complete,
      answer_type_correct: candidate.answer_type_correct,
      heuristic_score: candidate.heuristic_score,
    }])),
  };
}

function answerCitationContract(reference, prediction) {
  if (prediction.answer_type !== "grounded_answer") {
    return { answer_citation_complete: true, top_level_valid: true, inline_valid: true, top_level_count: 0, inline_count: 0 };
  }
  const evidenceIds = new Set(reference.input.compact_retrieved_evidence_pack.map((row) => row.evidence_id));
  const topLevel = prediction.citations;
  const inline = extractInlineCitationIds(prediction.answer);
  const topLevelValid = topLevel.length > 0 && topLevel.every((id) => evidenceIds.has(id));
  const inlineValid = inline.length > 0 && inline.every((id) => evidenceIds.has(id));
  return {
    answer_citation_complete: topLevelValid && inlineValid,
    top_level_valid: topLevelValid,
    inline_valid: inlineValid,
    top_level_count: topLevel.length,
    inline_count: inline.length,
  };
}

function heuristicScore(reference, prediction, spec, contract) {
  if (prediction.answer_type === "abstain") return 0.4;
  if (!contract.answer_citation_complete) return -1;
  const evidenceById = new Map(reference.input.compact_retrieved_evidence_pack.map((row) => [row.evidence_id, row]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const answerTokens = contentTokens(prediction.answer);
  const citedTokens = contentTokens(citedText);
  const familyPrior = spec.family === "openai_mini_scaffold" ? 0.18 : spec.id === "qwen7b_v4" ? 0.1 : 0;
  const lengthPenalty = answerTokens.length > 70 ? -0.1 : 0;
  return familyPrior
    + 0.3
    + 0.3 * tokenCoverage(answerTokens, citedTokens)
    + 0.15 * tokenCoverage(contentTokens(reference.input.question), answerTokens)
    + lengthPenalty;
}

function compareHeuristic(a, b) {
  return b.heuristic_score - a.heuristic_score || a.id.localeCompare(b.id);
}

function compareOracle(a, b) {
  const f1Delta = Number(b.heuristic_score ?? 0) - Number(a.heuristic_score ?? 0);
  if (Math.abs(f1Delta) > 1e-12) return f1Delta;
  return a.id.localeCompare(b.id);
}

function summarizeSelections(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.selection_scores.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.selection_scores.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    answer_type_accuracy: ratio(rows.filter((row) => row.selection_scores.answer_type_correct).length, rows.length),
    answer_citation_complete_rate: ratio(answered.filter((row) => row.selection_scores.answer_citation_complete).length, answered.length),
    policy_mix: groupCount(rows.map((row) => row.selected_candidate_id ?? "missing")),
    family_mix: groupCount(rows.map((row) => row.selected_family ?? "missing")),
  };
}

function selectorGap({ heuristicRows, oracleRows, scaffoldRows }) {
  const heuristic = summarizeSelections(heuristicRows);
  const oracle = summarizeSelections(oracleRows);
  const scaffold = summarizeSelections(scaffoldRows);
  return {
    heuristic_minus_scaffold_answer_rate: heuristic.answer_rate - scaffold.answer_rate,
    heuristic_minus_scaffold_answer_support_rate: heuristic.answer_support_rate - scaffold.answer_support_rate,
    heuristic_minus_scaffold_overall_correct_rate: heuristic.overall_judged_correct_rate - scaffold.overall_judged_correct_rate,
    oracle_minus_heuristic_supported_answers: oracle.answered * oracle.answer_support_rate - heuristic.answered * heuristic.answer_support_rate,
    oracle_minus_heuristic_overall_correct_rate: oracle.overall_judged_correct_rate - heuristic.overall_judged_correct_rate,
  };
}

function statusFor({ heuristic, oracle }) {
  if (heuristic.answer_rate >= 0.7 && heuristic.answer_support_rate >= 0.66) return "contract_selector_candidate_positive";
  if (oracle.answer_rate >= 0.7 && oracle.answer_support_rate === 1) return "candidate_pool_sufficient_but_selector_weak";
  if (oracle.answer_rate < 0.7) return "candidate_pool_still_below_coverage_floor";
  return "contract_selector_negative";
}

function renderReport(result) {
  const metrics = result.selection_metrics;
  return `# Contract-Aware Candidate Selector

Generated: ${result.generated_at}

## Metrics

| Selector | Answer rate | Answer support | Overall correct | Citation complete |
| --- | ---: | ---: | ---: | ---: |
| Contract heuristic | ${pct(metrics.contract_heuristic_selector.answer_rate)} | ${pct(metrics.contract_heuristic_selector.answer_support_rate)} | ${pct(metrics.contract_heuristic_selector.overall_judged_correct_rate)} | ${pct(metrics.contract_heuristic_selector.answer_citation_complete_rate)} |
| Contract oracle | ${pct(metrics.contract_judged_oracle.answer_rate)} | ${pct(metrics.contract_judged_oracle.answer_support_rate)} | ${pct(metrics.contract_judged_oracle.overall_judged_correct_rate)} | ${pct(metrics.contract_judged_oracle.answer_citation_complete_rate)} |
| Scaffold priority | ${pct(metrics.scaffold_priority_selector.answer_rate)} | ${pct(metrics.scaffold_priority_selector.answer_support_rate)} | ${pct(metrics.scaffold_priority_selector.overall_judged_correct_rate)} | ${pct(metrics.scaffold_priority_selector.answer_citation_complete_rate)} |

Status: \`${result.status}\`

## Interpretation

The heuristic selector is the deployable-style diagnostic because it does not use support judgments for selection. The contract oracle is an upper bound using existing paid judgments.

This artifact makes no LLM calls and launches no compute.
`;
}

function isSupportedAnswer(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function isSupportedAbstention(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "correct_abstention"
    || judgment?.abstention_supported === true;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : [...new Set(citations)],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function extractInlineCitationIds(answer) {
  return [...String(answer ?? "").matchAll(/\[([^\]]+)\]/g)]
    .flatMap((match) => match[1].split(/[,;\s]+/))
    .map((id) => id.trim())
    .filter((id) => /^E\d+$/i.test(id))
    .map((id) => id.toUpperCase());
}

function contentTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function groupCount(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function numberArg(value, fallback, { allowZero = false } = {}) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error(`Invalid numeric argument: ${value}`);
  }
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
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
