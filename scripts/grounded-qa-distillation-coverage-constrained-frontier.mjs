import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "coverage-constrained-support-frontier-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

const windows = [
  {
    id: "160-240",
    gateRun: "risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
  },
  {
    id: "240-320",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    id: "320-389",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    directJudge: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

const coverageTargets = [0.75, 0.7, 0.65, 0.6, 0.575];
const thresholds = [0, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65];
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

await fs.mkdir(outputDir, { recursive: true });

const loadedWindows = [];
for (const window of windows) {
  loadedWindows.push(await loadWindow(window));
}

const thresholdRows = thresholds.map((threshold) => aggregateThreshold(threshold, loadedWindows));
const feasibleRows = thresholdRows.filter((row) => row.inherited_missing === 0);
const coverageConstrained = coverageTargets.map((target) => ({
  min_answer_rate: target,
  selected: selectForCoverage(feasibleRows, target),
}));
const frontier = feasibleRows.filter((candidate) => !feasibleRows.some((other) => dominates(other, candidate)));

const directRow = thresholdRows.find((row) => row.threshold === 0);
const currentGateRow = thresholdRows.find((row) => row.threshold === 0.65);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "coverage_constrained_support_frontier",
  status: "historical_judgment_replay_not_final_qwen3b_result",
  purpose: "Replay existing risk-gate scores against existing judge labels to find support/correctness tradeoffs at useful answer coverage.",
  scope: "extended future-holdout windows 160-389 with inherited direct/gate judgments",
  inherited_judgment_policy: "For each threshold, kept source predictions inherit direct-judge labels. Newly forced abstentions inherit the already-paid gate-judge labels. Thresholds are bounded by the source gate threshold, so every forced abstention is covered by an existing gate judgment.",
  windows: loadedWindows.map((row) => row.summary),
  thresholds: thresholdRows,
  coverage_constrained_operating_points: coverageConstrained,
  pareto_frontier_thresholds: frontier.map((row) => row.threshold),
  qwen3b_acceptance_target: {
    direct_baseline: pickSummary(directRow),
    current_gate_floor: pickSummary(currentGateRow),
    recommended_minimum: "Beat the direct baseline on answer support and overall judged correctness while keeping answer rate above 70%; if that is not possible, report the exact coverage/support frontier instead of claiming support-preserving distillation.",
    rationale: "The current support-risk gate can raise correctness, but the 70% coverage-constrained replay shows how much support can be gained before the system becomes mostly an abstention policy.",
  },
  conclusions: [
    "The answer-rate constraint is binding: higher support comes from suppressing direct answers.",
    "A 70% answer-rate operating point is the minimum useful target for a trained student because it preserves most direct-student coverage while still testing support gains.",
    "The current hard gate at threshold 0.65 is a support-first scaffold, not a satisfactory final model behavior target by itself.",
    "The Qwen3B joint-action student should be judged against both the direct baseline and the 70% coverage-constrained frontier.",
  ],
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This frontier replays existing predictions and judge artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: runId,
  thresholds: thresholdRows.map(pickSummary),
  coverage_constrained_operating_points: coverageConstrained,
}, null, 2));

async function loadWindow(spec) {
  const gateResult = await readJson(path.join(runDir, spec.gateRun, "result.json"));
  const sourceThreshold = Number(gateResult.risk_gate?.threshold);
  const predictions = await readJsonl(path.join(runDir, spec.gateRun, "predictions.jsonl"));
  const directJudgments = await readJudgments(spec.directJudge);
  const gateJudgments = await readJudgments(spec.gateJudge);
  return {
    spec,
    sourceThreshold,
    predictions,
    directJudgments,
    gateJudgments,
    summary: {
      id: spec.id,
      gate_run_id: spec.gateRun,
      direct_judge_run_id: spec.directJudge,
      gate_judge_run_id: spec.gateJudge,
      source_threshold: sourceThreshold,
      examples: predictions.length,
    },
  };
}

function aggregateThreshold(threshold, loaded) {
  const perWindow = loaded.map((window) => evaluateThreshold(window, Math.min(threshold, window.sourceThreshold)));
  const examples = sum(perWindow.map((row) => row.judged));
  const answered = sum(perWindow.map((row) => row.answered));
  const abstained = sum(perWindow.map((row) => row.abstained));
  const gateFired = sum(perWindow.map((row) => row.gate_fired));
  const supportedAnswers = sum(perWindow.map((row) => row.supported_answers));
  const supportedAbstentions = sum(perWindow.map((row) => row.supported_abstentions));
  const correct = supportedAnswers + supportedAbstentions;
  return {
    threshold,
    judged: examples,
    answered,
    abstained,
    gate_fired: gateFired,
    inherited_missing: sum(perWindow.map((row) => row.inherited_missing)),
    answer_rate: ratio(answered, examples),
    answer_support_rate: ratio(supportedAnswers, answered),
    abstention_support_rate: ratio(supportedAbstentions, abstained),
    overall_judged_correct_rate: ratio(correct, examples),
    unsupported_answers: sum(perWindow.map((row) => row.unsupported_answers)),
    unsupported_abstentions: sum(perWindow.map((row) => row.unsupported_abstentions)),
    windows: perWindow.map((row) => ({
      window: row.window,
      threshold: row.threshold,
      answered: row.answered,
      answer_support_rate: row.answer_support_rate,
      overall_judged_correct_rate: row.overall_judged_correct_rate,
    })),
  };
}

function evaluateThreshold(window, threshold) {
  let answered = 0;
  let abstained = 0;
  let supportedAnswers = 0;
  let supportedAbstentions = 0;
  let unsupportedAnswers = 0;
  let unsupportedAbstentions = 0;
  let inheritedMissing = 0;
  let gateFired = 0;
  for (const row of window.predictions) {
    const sourcePrediction = row.source_prediction ?? row.prediction ?? {};
    const sourceAnswerType = sourcePrediction.answer_type === "grounded_answer" ? "grounded_answer" : "abstain";
    const score = Number(row.metadata?.support_score);
    const forcedAbstain = sourceAnswerType === "grounded_answer" && Number.isFinite(score) && score < threshold;
    const judgment = forcedAbstain ? window.gateJudgments.get(row.example_id) : window.directJudgments.get(row.example_id);
    if (!judgment) {
      inheritedMissing += 1;
      continue;
    }
    if (forcedAbstain) {
      gateFired += 1;
      abstained += 1;
      if (isCorrectAbstention(judgment)) supportedAbstentions += 1;
      else unsupportedAbstentions += 1;
    } else if (sourceAnswerType === "abstain") {
      abstained += 1;
      if (isCorrectAbstention(judgment)) supportedAbstentions += 1;
      else unsupportedAbstentions += 1;
    } else {
      answered += 1;
      if (isSupportedAnswer(judgment)) supportedAnswers += 1;
      else unsupportedAnswers += 1;
    }
  }
  const judged = answered + abstained;
  return {
    window: window.spec.id,
    threshold,
    judged,
    answered,
    abstained,
    gate_fired: gateFired,
    inherited_missing: inheritedMissing,
    supported_answers: supportedAnswers,
    supported_abstentions: supportedAbstentions,
    unsupported_answers: unsupportedAnswers,
    unsupported_abstentions: unsupportedAbstentions,
    answer_support_rate: ratio(supportedAnswers, answered),
    abstention_support_rate: ratio(supportedAbstentions, abstained),
    overall_judged_correct_rate: ratio(supportedAnswers + supportedAbstentions, judged),
  };
}

function selectForCoverage(rows, minAnswerRate) {
  const eligible = rows.filter((row) => row.answer_rate >= minAnswerRate);
  if (!eligible.length) return null;
  return pickSummary(eligible.reduce((best, row) => {
    if (!best) return row;
    if (row.overall_judged_correct_rate !== best.overall_judged_correct_rate) return row.overall_judged_correct_rate > best.overall_judged_correct_rate ? row : best;
    if (row.answer_support_rate !== best.answer_support_rate) return row.answer_support_rate > best.answer_support_rate ? row : best;
    if (row.answer_rate !== best.answer_rate) return row.answer_rate > best.answer_rate ? row : best;
    return row.threshold < best.threshold ? row : best;
  }, null));
}

function dominates(a, b) {
  const weak =
    a.overall_judged_correct_rate >= b.overall_judged_correct_rate &&
    a.answer_support_rate >= b.answer_support_rate &&
    a.answer_rate >= b.answer_rate;
  const strict =
    a.overall_judged_correct_rate > b.overall_judged_correct_rate ||
    a.answer_support_rate > b.answer_support_rate ||
    a.answer_rate > b.answer_rate;
  return weak && strict;
}

function pickSummary(row) {
  if (!row) return null;
  return {
    threshold: row.threshold,
    answer_rate: row.answer_rate,
    answer_support_rate: row.answer_support_rate,
    abstention_support_rate: row.abstention_support_rate,
    overall_judged_correct_rate: row.overall_judged_correct_rate,
    answered: row.answered,
    abstained: row.abstained,
    unsupported_answers: row.unsupported_answers,
    unsupported_abstentions: row.unsupported_abstentions,
  };
}

function renderReport(result) {
  return `# Coverage-Constrained Support Frontier

Generated: ${result.generated_at}

Status: \`${result.status}\`

${result.inherited_judgment_policy}

## Threshold Replay

| Threshold | Answer rate | Answer support | Abstention support | Overall judged correct | Answered | Unsupported answers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${result.thresholds.map((row) => `| ${row.threshold.toFixed(2)} | ${pct(row.answer_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.overall_judged_correct_rate)} | ${row.answered} | ${row.unsupported_answers} |`).join("\n")}

## Coverage-Constrained Operating Points

| Min answer rate | Selected threshold | Answer rate | Answer support | Overall judged correct |
| ---: | ---: | ---: | ---: | ---: |
${result.coverage_constrained_operating_points.map((row) => `| ${pct(row.min_answer_rate)} | ${row.selected ? row.selected.threshold.toFixed(2) : "n/a"} | ${pct(row.selected?.answer_rate)} | ${pct(row.selected?.answer_support_rate)} | ${pct(row.selected?.overall_judged_correct_rate)} |`).join("\n")}

## Qwen3B Acceptance Target

${result.qwen3b_acceptance_target.recommended_minimum}

## Conclusions

${result.conclusions.map((item) => `- ${item}`).join("\n")}

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $${result.budget.actual_total_spend_usd.toFixed(4)}.
`;
}

async function readJudgments(runId) {
  const rows = await readJsonl(path.join(runDir, runId, "judgments.jsonl"));
  return new Map(rows.map((row) => [row.example_id, row.judgment]));
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase()) || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase()) || judgment?.abstention_supported === true;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}
