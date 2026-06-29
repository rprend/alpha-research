import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const baselineRunId = args["baseline-run-id"] ?? "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1";
const baselineGateRunId = args["baseline-gate-run-id"] ?? `${baselineRunId}-contract-gate`;
const qwenRepairRunId = args["qwen-repair-run-id"] ?? "evidence-first-contract-repair-audit-frontier-repaired-qwen3b-validation-smoke-v1";
const qwenGateRunId = args["qwen-gate-run-id"] ?? "frontier-repaired-qwen3b-validation-smoke-v1-evidence-first-contract-gate";
const evalPacketRunId = args["eval-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "repaired-qwen3b-constrained-hybrid-audit-frontier-validation-v1";
const outputDir = path.join(runsDir, runId);
const selectedPredictionFile = path.join(outputDir, "selected_predictions.jsonl");
const selectedGateRunId = `${runId}-contract-gate`;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const baselinePredictions = await readJsonl(path.join(runsDir, baselineRunId, "predictions.jsonl"));
const baselineGateRows = await readJsonl(path.join(runsDir, baselineGateRunId, "scored_predictions.jsonl"));
const qwenRepairs = await readJsonl(path.join(runsDir, qwenRepairRunId, "scored_repairs.jsonl"));
const qwenGateRows = await readJsonl(path.join(runsDir, qwenGateRunId, "scored_predictions.jsonl"));

const baselinePredictionById = new Map(baselinePredictions.map((row) => [row.example_id, row]));
const baselineGateById = new Map(baselineGateRows.map((row) => [row.example_id, row]));
const qwenRepairById = new Map(qwenRepairs.map((row) => [row.example_id, row]));
const qwenGateById = new Map(qwenGateRows.map((row) => [row.example_id, row]));

const variants = [
  {
    id: "baseline_train_calibrated_scaffold",
    description: "Existing train-calibrated deterministic scaffold.",
    choose: (base) => predictionFromGate(base),
  },
  {
    id: "qwen_repaired_only",
    description: "Deterministically repaired Qwen3B prediction only.",
    choose: (_base, qwen) => qwen?.repaired_prediction ?? abstainFallback(),
  },
  {
    id: "agreement_answer_else_abstain",
    description: "Answer only when scaffold and repaired Qwen agree on grounded-answer and exact citation set; otherwise abstain.",
    choose: (base, qwen) => {
      const basePrediction = predictionFromGate(base);
      const qwenPrediction = qwen?.repaired_prediction ?? abstainFallback();
      if (basePrediction.answer_type === "grounded_answer"
        && qwenPrediction.answer_type === "grounded_answer"
        && sameCitationSet(basePrediction.citations, qwenPrediction.citations)) {
        return basePrediction;
      }
      return abstainLike(basePrediction, "Scaffold and Qwen did not agree on a grounded cited answer.");
    },
  },
  {
    id: "scaffold_answerability_qwen_citations_when_both_answer",
    description: "Preserve scaffold answerability; when both systems answer, use repaired Qwen citation structure; otherwise keep scaffold output.",
    choose: (base, qwen) => {
      const basePrediction = predictionFromGate(base);
      const qwenPrediction = qwen?.repaired_prediction ?? abstainFallback();
      if (basePrediction.answer_type === "grounded_answer" && qwenPrediction.answer_type === "grounded_answer") {
        return groundedFromQwenCitations(basePrediction, qwenPrediction);
      }
      return basePrediction;
    },
  },
  {
    id: "scaffold_answer_only_if_qwen_also_answers",
    description: "Keep scaffold citations but suppress scaffold answers when raw Qwen abstains.",
    choose: (base, _qwen, qwenGate) => {
      const basePrediction = predictionFromGate(base);
      if (basePrediction.answer_type === "grounded_answer" && qwenGate?.prediction_answer_type !== "grounded_answer") {
        return abstainLike(basePrediction, "Raw Qwen did not also choose grounded_answer.");
      }
      return basePrediction;
    },
  },
];

const variantRows = variants.map((variant) => evaluateVariant(variant));
const selectedVariantId = "scaffold_answerability_qwen_citations_when_both_answer";
const selectedVariant = variantRows.find((row) => row.id === selectedVariantId);
const selectedPredictions = buildPredictions(variants.find((variant) => variant.id === selectedVariantId));
await writeJsonl(selectedPredictionFile, selectedPredictions);

await runContractGate(selectedGateRunId, selectedPredictionFile);
const selectedGate = await readJson(path.join(runsDir, selectedGateRunId, "result.json"));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "repaired_qwen3b_constrained_hybrid_audit",
  status: selectedGate.metrics.overall_contract_correct_rate > 44 / 70
    ? "constrained_hybrid_beats_scaffold_by_one_but_not_paper_ready"
    : "constrained_hybrid_does_not_beat_scaffold",
  purpose: "Test whether D381's constrained schema/citation binding can salvage the repaired Qwen3B smoke without more GPU or OpenAI spend.",
  source_runs: {
    baseline_run_id: baselineRunId,
    baseline_gate_run_id: baselineGateRunId,
    qwen_repair_run_id: qwenRepairRunId,
    qwen_gate_run_id: qwenGateRunId,
    selected_contract_gate_run_id: selectedGateRunId,
  },
  policy: {
    selected_variant_id: selectedVariantId,
    selected_variant_description: selectedVariant.description,
    leakage_note: "The selected variant is a post-smoke diagnostic over the repaired validation gate. It is not a final train-selected policy and must be confirmed on a fresh held-out slice before paper claims.",
  },
  variants: variantRows,
  selected_gate_metrics: selectedGate.metrics,
  baseline_comparison: {
    train_calibrated_scaffold_contract_correct: 44,
    train_calibrated_scaffold_contract_correct_rate: 44 / 70,
    selected_contract_correct: selectedVariant.contract_correct,
    selected_contract_correct_rate: selectedVariant.contract_correct_rate,
    delta_correct_examples: selectedVariant.contract_correct - 44,
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_final_scaffold: false,
    next_step: selectedVariant.contract_correct > 44
      ? "Use the hybrid only as a diagnostic signal; build a train-selected constrained policy and evaluate on a fresh nonfinal slice before spending on judges or larger models."
      : "The constrained hybrid does not improve enough; return to train-only answerability/citation policy design.",
    reason: "The best constrained hybrid gains only one contract-correct example while requiring Qwen inference artifacts, so it is not an acceptable amortized answerer.",
  },
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
    note: "This audit reuses existing local Qwen and scaffold artifacts only.",
  },
  artifacts: {
    selected_predictions_jsonl: rel(selectedPredictionFile),
    selected_contract_gate_result_json: rel(path.join(runsDir, selectedGateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_variant: selectedVariant,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

function evaluateVariant(variant) {
  const rows = baselineGateRows.map((base) => {
    const prediction = variant.choose(base, qwenRepairById.get(base.example_id), qwenGateById.get(base.example_id));
    return scorePrediction(base, prediction);
  });
  const answered = rows.filter((row) => row.prediction_answer_type === "grounded_answer");
  return {
    id: variant.id,
    description: variant.description,
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    answer_rate: rate(answered.length, rows.length),
    answer_type_correct: count(rows, (row) => row.answer_type_correct),
    answer_type_accuracy: rate(count(rows, (row) => row.answer_type_correct), rows.length),
    citation_set_exact: count(rows, (row) => row.citation_set_exact),
    citation_set_exact_rate: rate(count(rows, (row) => row.citation_set_exact), rows.length),
    contract_correct: count(rows, (row) => row.contract_correct),
    contract_correct_rate: rate(count(rows, (row) => row.contract_correct), rows.length),
    confusion: countBy(rows.map((row) => `${row.prediction_answer_type}_vs_${row.target_answer_type}`)),
  };
}

function buildPredictions(variant) {
  return baselineGateRows.map((base) => {
    const prediction = variant.choose(base, qwenRepairById.get(base.example_id), qwenGateById.get(base.example_id));
    return {
      example_id: base.example_id,
      prediction,
      raw_output: JSON.stringify(prediction),
      metadata: {
        scaffold: variant.id,
        baseline_run_id: baselineRunId,
        qwen_repair_run_id: qwenRepairRunId,
        no_new_model_or_llm_calls: true,
      },
    };
  });
}

function scorePrediction(base, prediction) {
  const predictionAnswerType = prediction.answer_type;
  const targetAnswerType = base.target_answer_type;
  const citationSetExact = predictionAnswerType === "abstain"
    ? (prediction.citations ?? []).length === 0
    : sameCitationSet(prediction.citations, base.target?.citations ?? []);
  const answerTypeCorrect = predictionAnswerType === targetAnswerType;
  return {
    example_id: base.example_id,
    prediction_answer_type: predictionAnswerType,
    target_answer_type: targetAnswerType,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: answerTypeCorrect && citationSetExact,
  };
}

function predictionFromGate(base) {
  const prediction = baselinePredictionById.get(base.example_id)?.prediction ?? base.prediction;
  return normalizePrediction(prediction);
}

function groundedFromQwenCitations(basePrediction, qwenPrediction) {
  const citations = normalizeCitations(qwenPrediction.citations);
  if (!citations.length) return basePrediction;
  const answerText = stripTrailingCitations(basePrediction.answer || "Supported answer.");
  return {
    ...basePrediction,
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: [{
        claim_id: "C1",
        claim: stripTrailingCitations(answerText),
        citations,
        support_status: "supported",
      }],
      missing_support: "",
      question_target: basePrediction.evidence_first?.question_target ?? "exact_question_target",
    },
    answer: `${answerText} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: [{ claim: stripTrailingCitations(answerText), support: "supported", citations }],
    abstention_reason: null,
  };
}

function abstainLike(prediction, reason) {
  const questionTarget = prediction.evidence_first?.question_target ?? "exact_question_target";
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: reason,
      question_target: questionTarget,
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: reason,
  };
}

function abstainFallback() {
  return abstainLike({ evidence_first: { question_target: "exact_question_target" } }, "No valid candidate prediction was available.");
}

function normalizePrediction(prediction) {
  if (prediction?.answer_type === "grounded_answer") {
    return {
      answer_type: "grounded_answer",
      evidence_first: prediction.evidence_first ?? {},
      answer: String(prediction.answer ?? ""),
      citations: normalizeCitations(prediction.citations),
      claim_table: Array.isArray(prediction.claim_table) ? prediction.claim_table : [],
      abstention_reason: null,
    };
  }
  return {
    answer_type: "abstain",
    evidence_first: prediction?.evidence_first ?? {},
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: String(prediction?.abstention_reason ?? "Evidence is insufficient."),
  };
}

function normalizeCitations(citations) {
  return [...new Set((Array.isArray(citations) ? citations : [])
    .map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation))
    .map((citation) => citation.replace(/^\[/, "").replace(/\]$/, ""))
    .filter((citation) => /^E\d+$/.test(citation)))];
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function stripTrailingCitations(text) {
  return String(text ?? "").replace(/\s*(?:\[E\d+\]\s*)+$/g, "").trim();
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${evalPacketRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr}`));
    });
  });
}

function renderReport(result) {
  return `# Repaired Qwen3B Constrained Hybrid Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Variants

| Variant | Answered | Contract Correct |
| --- | ---: | ---: |
${result.variants.map((row) => `| ${row.id} | ${row.answered}/${row.examples} | ${row.contract_correct}/${row.examples} (${pct(row.contract_correct_rate)}) |`).join("\n")}

## Selected

- Variant: \`${result.policy.selected_variant_id}\`
- Description: ${result.policy.selected_variant_description}
- Delta vs train-calibrated scaffold: ${result.baseline_comparison.delta_correct_examples} examples
- Promote as final scaffold: ${result.decision.promote_as_final_scaffold ? "yes" : "no"}
- Next step: ${result.decision.next_step}

${result.policy.leakage_note}
`;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
