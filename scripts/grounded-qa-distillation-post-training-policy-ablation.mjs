import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "post-training-policy-ablation-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const families = [
  await family("direct_compact_rag_student_with_citation_repair", "Generic compact-evidence RAG student plus citation-contract repair.", [
    ["0-80", "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1"],
    ["80-160", "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1"],
    ["160-240", "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1"],
    ["240-320", "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1"],
    ["320-389", "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1"],
  ], {
    data_policy: "Direct small-model answers from compact evidence packs with local citation repair.",
    interpretation: "Strongest coverage baseline; it answers many rows but leaves too many unsupported answers for the target paper claim.",
  }),
  await family("claim_pruned_rubric_labels", "Claim-pruned rubric teacher labels judged on the first fresh holdout block.", [
    ["0-80", "openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-0-80-v1"],
    ["80-160", "openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-80-160-v1"],
  ], {
    data_policy: "Teacher labels with claim pruning and rubric structure before citation repair.",
    interpretation: "Does not clearly beat direct compact-RAG labels on the judged 0-160 slice; claim pruning alone is insufficient.",
  }),
  await family("claim_pruner_mini_labels", "Mini-label claim pruner over direct repair on the first fresh holdout block.", [
    ["0-80", "openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1"],
    ["80-160", "openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1"],
  ], {
    data_policy: "A cheap claim-pruner label source applied before citation repair.",
    interpretation: "Improves the second 80-row block, but available evidence is too narrow to support the final paper claim by itself.",
  }),
  await family("support_risk_gated_labels", "Support-aware risk gates over direct repair on later future blocks.", [
    ["160-240", "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1"],
    ["240-320", "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1"],
    ["320-389", "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1"],
  ], {
    data_policy: "Support-risk labels that force abstention when the direct answer is likely unsupported.",
    interpretation: "Best existing support/correctness aggregate, but gains are coupled to lower answer coverage and must be compared against Qwen3B joint-action training.",
  }),
  await family("local_span_or_tiny_sft_scaffolds", "Zero-call local/tiny-model scaffolds on the final 69-row window.", [
    ["321-389_span", "openai-judge-gpt4o-temporal-span-scaffold-mini-negative-161-320-to-321-389-v1"],
    ["321-389_qwen05b", "openai-judge-gpt4o-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1"],
  ], {
    data_policy: "Local span selector and Qwen 0.5B SFT anchors trained from distilled labels.",
    interpretation: "Confirms tiny/local distillation can learn surface citation behavior but not reliable support; this motivates using a stronger Qwen3B joint-action student.",
  }),
];

const completeFamilies = families.filter((row) => row.windows.every((win) => win.present));
const rankedByCorrectness = [...completeFamilies].sort((a, b) => b.aggregate.overall_judged_correct_rate - a.aggregate.overall_judged_correct_rate);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "post_training_data_policy_ablation",
  status: "historical_judged_ablation_not_final_qwen3b_result",
  purpose: "Compare existing post-training data/scaffold policies by support, abstention, coverage, and judged correctness without making new LLM calls.",
  scope_notes: [
    "This is a historical ablation over already-judged windows, not a new randomized experiment.",
    "Families cover different windows, so the result is for policy direction and paper risk control rather than a definitive leaderboard.",
    "The missing Qwen3B joint-action student must still be trained and judged on the final future window before any NeurIPS-ready claim.",
  ],
  families,
  ranking_by_weighted_overall_judged_correctness: rankedByCorrectness.map((row) => row.id),
  conclusions: [
    "Direct compact-RAG/citation-repair labels are a necessary baseline but do not preserve enough support.",
    "Claim pruning alone is not a robust paper-worthy data-construction answer.",
    "Support-risk gated labels are the strongest existing direction, but they trade away answer coverage.",
    "Tiny/local SFT anchors are too weak to serve as the final smaller-model result despite good citation formatting.",
    "The Qwen3B joint-action run should prioritize support-risk contrast and answer/abstain joint supervision, then report coverage alongside support.",
  ],
  qwen3b_training_implication: {
    required_design: "Use joint-action SFT/DPO examples that encode answer synthesis, citation placement, abstention, and support-risk contrast rather than generic citation-only SFT.",
    acceptance_metric: "The trained Qwen3B student must improve support/correctness over direct compact-RAG labels without collapsing answer coverage to the zero-call gate floor.",
    still_missing: [
      "Qwen3B joint-action smoke predictions.",
      "Prediction integrity gate ready_for_paid_judge.",
      "Paid grounded-correctness judge on the final future window.",
      "Pareto table update including Qwen3B.",
    ],
  },
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
    note: "This ablation reads existing judge result files only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function family(id, description, specs, extra) {
  const windows = [];
  for (const [window, runId] of specs) {
    const file = path.join(runDir, runId, "result.json");
    let result = null;
    try {
      result = await readJson(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    windows.push({
      window,
      run_id: runId,
      present: Boolean(result),
      model: result?.model ?? null,
      examples_judged: result?.metrics?.examples_judged ?? 0,
      answered_predictions: result?.metrics?.answered_predictions ?? 0,
      abstained_predictions: result?.metrics?.abstained_predictions ?? 0,
      answer_support_rate: numberOrNull(result?.metrics?.answer_support_rate),
      abstention_support_rate: numberOrNull(result?.metrics?.abstention_support_rate),
      overall_judged_correct_rate: numberOrNull(result?.metrics?.overall_judged_correct_rate),
      invalid_judgment_rate: numberOrNull(result?.metrics?.invalid_judgment_rate),
      historical_judge_cost_usd: numberOrNull(result?.run_cost_usd) ?? 0,
    });
  }
  return {
    id,
    description,
    data_policy: extra.data_policy,
    windows,
    aggregate: aggregate(windows.filter((row) => row.present)),
    interpretation: extra.interpretation,
  };
}

function aggregate(windows) {
  const examples = sum(windows.map((row) => row.examples_judged));
  const answered = sum(windows.map((row) => row.answered_predictions));
  const abstained = sum(windows.map((row) => row.abstained_predictions));
  const supportedAnswers = sum(windows.map((row) => row.answered_predictions * (row.answer_support_rate ?? 0)));
  const supportedAbstentions = sum(windows.map((row) => row.abstained_predictions * (row.abstention_support_rate ?? 0)));
  const correct = sum(windows.map((row) => row.examples_judged * (row.overall_judged_correct_rate ?? 0)));
  return {
    windows: windows.length,
    examples_judged: examples,
    answered_predictions: answered,
    abstained_predictions: abstained,
    answer_rate: ratio(answered, examples),
    answer_support_rate: ratio(supportedAnswers, answered),
    abstention_support_rate: ratio(supportedAbstentions, abstained),
    overall_judged_correct_rate: ratio(correct, examples),
    historical_judge_cost_usd: sum(windows.map((row) => row.historical_judge_cost_usd)),
  };
}

function renderReport(result) {
  const rows = result.families.map((row) => `| ${row.id} | ${row.aggregate.windows} | ${row.aggregate.examples_judged} | ${pct(row.aggregate.answer_rate)} | ${pct(row.aggregate.answer_support_rate)} | ${pct(row.aggregate.abstention_support_rate)} | ${pct(row.aggregate.overall_judged_correct_rate)} | ${row.interpretation} |`).join("\n");
  const windowRows = result.families.flatMap((family) => family.windows.map((row) => `| ${family.id} | ${row.window} | \`${row.run_id}\` | ${row.present ? "yes" : "no"} | ${row.examples_judged} | ${pct(row.answer_support_rate)} | ${pct(row.overall_judged_correct_rate)} |`)).join("\n");
  return `# Post-Training Data Policy Ablation

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Aggregate Policy Families

| Family | Windows | Examples | Answer rate | Answer support | Abstention support | Overall judged correctness | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Source Windows

| Family | Window | Judge run | Present | Examples | Answer support | Overall judged correctness |
| --- | --- | --- | --- | ---: | ---: | ---: |
${windowRows}

## Conclusions

${result.conclusions.map((item) => `- ${item}`).join("\n")}

## Qwen3B Implication

- Required design: ${result.qwen3b_training_implication.required_design}
- Acceptance metric: ${result.qwen3b_training_implication.acceptance_metric}

Still missing:
${result.qwen3b_training_implication.still_missing.map((item) => `- ${item}`).join("\n")}

## Budget

No new OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $${result.budget.actual_total_spend_usd.toFixed(4)}.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}
