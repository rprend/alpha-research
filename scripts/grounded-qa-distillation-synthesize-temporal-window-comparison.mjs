import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "temporal-window-comparison-321-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const directMini = await readResult("openai-student-direct-mini-extended-future-holdout-320-389-v1");
const citationRepair = await readResult("citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1");
const citationRepairJudge = await readResult("openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1");
const balancedGate = await readResult("risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1");
const balancedGateJudge = await readResult("openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1");
const miniVerifier = await readResult("mini-verifier-gate-balanced-risk-gate-160-389-v1");
const sequenceVerifier = await readResult("sequence-verifier-from-mini-negative-labels-160-389-v1");
const temporalScaffold = await readResult("temporal-packet-scaffold-mini-negative-161-320-to-321-389-v1");

const miniWindow = miniVerifier.windows.find((window) => window.label === "321-389");
const sequenceRows = sequenceVerifier.objectives.map((objective) => {
  const metrics = objective.folds.find((fold) => fold.eval_window === "321-389")?.eval_policy_metrics;
  if (!metrics) throw new Error(`Missing 321-389 fold for ${objective.id}.`);
  return supportOracleSystem({
    id: `sequence_verifier_${objective.id}`,
    label: `Frozen sequence verifier (${objective.label})`,
    source_run_id: sequenceVerifier.run_id,
    source_metric_family: "support_oracle",
    notes: "Leave-window-out local sequence verifier trained on two judged windows and evaluated on 321-389.",
    metrics,
  });
});

const systems = [
  referenceMetricSystem({
    id: "direct_mini_raw",
    label: "Direct gpt-4o-mini student",
    source_run_id: directMini.run_id,
    source_metric_family: "reference_overlap",
    notes: "Raw direct mini predictions before local citation-contract repair.",
    metrics: normalizeDirectMiniMetrics(directMini.metrics),
    cost: {
      openai_calls: directMini.calls_made,
      inference_cost_usd: directMini.estimated_cost_usd ?? directMini.run_cost_usd ?? null,
    },
  }),
  referenceMetricSystem({
    id: "citation_contract_repair",
    label: "Direct mini + citation repair",
    source_run_id: citationRepair.run_id,
    source_metric_family: "reference_overlap_and_gpt4o_judge",
    notes: "Zero-call local citation repair over direct mini outputs.",
    metrics: citationRepair.metrics,
    judge_metrics: citationRepairJudge.metrics,
    cost: {
      openai_calls: citationRepair.calls_made,
      inference_cost_usd: citationRepair.run_cost_usd,
      source_judge_calls: citationRepairJudge.calls_made,
      source_judge_cost_usd: citationRepairJudge.run_cost_usd,
    },
  }),
  referenceMetricSystem({
    id: "balanced_risk_gate",
    label: "Balanced claim-pruner-label risk gate",
    source_run_id: balancedGate.run_id,
    source_metric_family: "reference_overlap_and_gpt4o_judge",
    notes: "Zero-call local risk gate fitted on earlier claim-pruner labels and applied to repaired direct mini outputs.",
    metrics: balancedGate.eval_metrics,
    judge_metrics: balancedGateJudge.metrics,
    cost: {
      openai_calls: balancedGate.cost?.llm_calls ?? 0,
      inference_cost_usd: balancedGate.cost?.run_cost_usd ?? 0,
      source_judge_calls: balancedGateJudge.calls_made,
      source_judge_cost_usd: balancedGateJudge.run_cost_usd,
    },
  }),
  supportOracleSystem({
    id: "mini_negative_verifier_teacher",
    label: "Mini-negative verifier teacher",
    source_run_id: miniVerifier.run_id,
    source_metric_family: "support_oracle",
    notes: "Uses existing gpt-4o-mini negative judgments as a verifier signal; useful as a teacher, not as final amortized inference.",
    metrics: {
      examples: miniWindow.examples,
      answered: balancedGate.eval_metrics.answered - miniWindow.mini_suppressions.suppressions,
      support_oracle_correct: miniWindow.mini_verifier.correct,
      support_oracle_correct_rate: miniWindow.mini_verifier.correct_rate,
      gate_fired: miniWindow.mini_suppressions.suppressions,
      suppressed_unsupported: miniWindow.mini_suppressions.suppressed_unsupported,
      harmful_suppressed_supported: miniWindow.mini_suppressions.harmful_suppressed_supported,
      answer_support_rate: null,
    },
    cost: {
      openai_calls: 0,
      run_cost_usd: 0,
      source_teacher_calls: miniVerifier.source_mini_judge_calls,
      source_teacher_cost_usd: miniVerifier.source_mini_judge_cost_usd,
    },
  }),
  ...sequenceRows,
  referenceMetricSystem({
    id: "temporal_packet_extractive_scaffold",
    label: "Temporal packet extractive scaffold",
    source_run_id: temporalScaffold.run_id,
    source_metric_family: "reference_overlap",
    notes: "Zero-LLM local extractive scaffold trained only on the temporal SFT packet's 161-320 rows and evaluated on 321-389 prompts.",
    metrics: temporalScaffold.eval,
    cost: {
      openai_calls: temporalScaffold.cost?.llm_calls ?? 0,
      inference_cost_usd: temporalScaffold.cost?.estimated_inference_cost_usd ?? 0,
    },
  }),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  scope: "extended_temporal_future_holdout examples 321-389",
  purpose: "Compare same-window grounded-QA distillation candidates across reference-overlap metrics, GPT-4o support judgments, and inherited support-oracle metrics.",
  llm_calls: 0,
  run_cost_usd: 0,
  source_cost_note: "This synthesis makes no LLM calls. Some source systems were produced or judged by previously ledgered OpenAI calls.",
  comparability_note: "Reference-overlap metrics, GPT-4o judge metrics, and support-oracle metrics answer different questions and should not be averaged together.",
  systems,
  conclusions: [
    "Direct mini plus citation repair remains the strongest answer-quality baseline on 321-389, but GPT-4o support correctness is only 72.5%.",
    "The balanced local risk gate raises GPT-4o judged correctness to 79.7% and answer support to 70.5%, but reduces answered rows from 53 to 44 and lowers reference recall/F1.",
    "The mini-negative verifier teacher reaches 82.6% support-oracle correctness with two useful and zero harmful suppressions on this window, making it a strong label-construction signal but not yet amortized because the source verifier uses mini calls.",
    "Current learned/local verifier attempts fail to close that gap reliably; the best 321-389 sequence-verifier policy reaches 81.2% support-oracle correctness while the strong-support objective falls to 75.4%.",
    "The temporal extractive scaffold is a weak zero-call floor: 31.9% answer rate, 6.1% answer F1, and 21.6% citation recall.",
  ],
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  llm_calls: result.llm_calls,
  run_cost_usd: result.run_cost_usd,
}, null, 2));

function normalizeDirectMiniMetrics(metrics) {
  return {
    examples: metrics.examples_scored,
    answered: null,
    abstained: null,
    answer_type_accuracy: metrics.answer_type_accuracy,
    citation_precision: metrics.citation_precision,
    citation_recall: metrics.citation_recall,
    answer_token_f1: metrics.answer_token_f1,
    abstention_accuracy: metrics.abstention_accuracy,
    inline_citation_rate: metrics.inline_citation_rate,
  };
}

function referenceMetricSystem({ id, label, source_run_id, source_metric_family, notes, metrics, judge_metrics = null, cost = {} }) {
  return {
    id,
    label,
    source_run_id,
    source_metric_family,
    notes,
    examples: metrics.examples ?? metrics.examples_scored,
    answered: metrics.answered ?? null,
    abstained: metrics.abstained ?? null,
    answer_rate: Number.isFinite(metrics.answer_rate) ? metrics.answer_rate : rate(metrics.answered, metrics.examples),
    reference_metrics: {
      answer_type_accuracy: metrics.answer_type_accuracy,
      citation_precision: metrics.citation_precision,
      citation_recall: metrics.citation_recall,
      answer_token_f1: metrics.answer_token_f1,
      abstention_accuracy: metrics.abstention_accuracy,
      inline_citation_rate: metrics.inline_citation_rate,
    },
    gpt4o_judge_metrics: judge_metrics
      ? {
          answer_support_rate: judge_metrics.answer_support_rate,
          abstention_support_rate: judge_metrics.abstention_support_rate,
          overall_judged_correct_rate: judgeMetricsOverall(judge_metrics),
          examples_judged: judge_metrics.examples_judged,
        }
      : null,
    support_oracle_metrics: null,
    cost,
  };
}

function supportOracleSystem({ id, label, source_run_id, source_metric_family, notes, metrics, cost = { openai_calls: 0, run_cost_usd: 0 } }) {
  return {
    id,
    label,
    source_run_id,
    source_metric_family,
    notes,
    examples: metrics.examples,
    answered: metrics.answered ?? null,
    abstained: Number.isFinite(metrics.abstained) ? metrics.abstained : (Number.isFinite(metrics.answered) ? metrics.examples - metrics.answered : null),
    answer_rate: Number.isFinite(metrics.answer_rate) ? metrics.answer_rate : rate(metrics.answered, metrics.examples),
    reference_metrics: null,
    gpt4o_judge_metrics: null,
    support_oracle_metrics: {
      support_oracle_correct: metrics.support_oracle_correct,
      support_oracle_correct_rate: metrics.support_oracle_correct_rate,
      answer_support_rate: metrics.answer_support_rate,
      gate_fired: metrics.gate_fired,
      suppressed_unsupported: metrics.suppressed_unsupported,
      harmful_suppressed_supported: metrics.harmful_suppressed_supported,
    },
    cost,
  };
}

function renderReport(result) {
  const lines = [
    "# Temporal Window Comparison 321-389",
    "",
    `Scope: ${result.scope}`,
    "",
    "This synthesis makes no LLM calls. It reads existing run and judge artifacts to compare candidate amortization shapes on the same final temporal window.",
    "",
    `Comparability note: ${result.comparability_note}`,
    "",
    "## Reference and Judge Metrics",
    "",
    "| System | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citations | GPT-4o answer support | GPT-4o overall correct |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const system of result.systems.filter((entry) => entry.reference_metrics)) {
    lines.push(markdownRow([
      system.label,
      displayCount(system.answered),
      displayPct(system.answer_rate),
      displayPct(system.reference_metrics.citation_precision),
      displayPct(system.reference_metrics.citation_recall),
      displayPct(system.reference_metrics.answer_token_f1),
      displayPct(system.reference_metrics.inline_citation_rate),
      displayPct(system.gpt4o_judge_metrics?.answer_support_rate),
      displayPct(system.gpt4o_judge_metrics?.overall_judged_correct_rate),
    ]));
  }

  lines.push(
    "",
    "## Support-Oracle Metrics",
    "",
    "| System | Correct / examples | Answered | Answer rate | Answer support | Gate fired | Useful suppressions | Harmful suppressions |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const system of result.systems.filter((entry) => entry.support_oracle_metrics)) {
    const metrics = system.support_oracle_metrics;
    lines.push(markdownRow([
      system.label,
      `${metrics.support_oracle_correct} / ${system.examples} (${displayPct(metrics.support_oracle_correct_rate)})`,
      displayCount(system.answered),
      displayPct(system.answer_rate),
      displayPct(metrics.answer_support_rate),
      displayCount(metrics.gate_fired),
      displayCount(metrics.suppressed_unsupported),
      displayCount(metrics.harmful_suppressed_supported),
    ]));
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    ...result.conclusions.map((conclusion) => `- ${conclusion}`),
    "",
    "## Source Cost Boundary",
    "",
    `- Synthesis calls: ${result.llm_calls}`,
    `- Synthesis cost: $${result.run_cost_usd.toFixed(2)}`,
    `- ${result.source_cost_note}`,
  );

  return `${lines.join("\n")}\n`;
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function judgeMetricsOverall(metrics) {
  return metrics.overall_judged_correct_rate ?? metrics.overall_support_rate ?? null;
}

function rate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function displayCount(value) {
  return Number.isFinite(value) ? String(value) : "n/a";
}

function displayPct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function markdownRow(cells) {
  return `| ${cells.join(" | ")} |`;
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
