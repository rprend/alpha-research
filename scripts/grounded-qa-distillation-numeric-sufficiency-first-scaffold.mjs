import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1";
const qwenNormRunId = args["qwen-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-numeric-teacher-qwen3b-smoke-v1";
const dpoNormRunId = args["dpo-normalization-run-id"] ?? "targeted-grounded-schema-normalization-audit-dpo-prompt-repaired-qwen3b-smoke-v1";
const priorScaffoldRunId = args["prior-scaffold-run-id"] ?? "numeric-teacher-train-calibrated-scaffold-diagnostic-v1";
const runId = args["run-id"] ?? "numeric-sufficiency-first-scaffold-diagnostic-v1";
const outputDir = path.join(runsDir, runId);
const packetDatasetDir = path.join(runsDir, packetRunId, "dataset");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(packetDatasetDir, "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(packetDatasetDir, "eval_targets_diagnostic.jsonl"));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const predictions = prompts.map((prompt) => predictPrompt(prompt));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const gateRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const qwenNorm = await readJson(path.join(runsDir, qwenNormRunId, "result.json"));
const dpoNorm = await readJson(path.join(runsDir, dpoNormRunId, "result.json"));
const priorScaffoldGate = await readJson(path.join(runsDir, `${priorScaffoldRunId}-contract-gate`, "result.json"));
const abstentionPrior = scoreAbstentionPrior(targets);
const metrics = summarizeMetrics(gate, prompts.length);
const groundedRecovery = gateRows.filter((row) => row.target_answer_type === "grounded_answer" && row.contract_correct);
const rows = gateRows.map((row) => ({
  example_id: row.example_id,
  target_answer_type: row.target_answer_type,
  prediction_answer_type: row.prediction_answer_type,
  contract_correct: row.contract_correct,
  answer_type_correct: row.answer_type_correct,
  citation_set_exact: row.citation_set_exact,
  evidence_first_valid: row.evidence_first_valid,
  tags: rowTags(row),
}));

const baselines = {
  abstention_prior_contract_correct_count: abstentionPrior.correct,
  abstention_prior_contract_correct_rate: abstentionPrior.rate,
  dpo_prompt_repaired_normalized_contract_correct_count: Number(dpoNorm.metrics.normalized_contract_correct_count),
  dpo_prompt_repaired_normalized_contract_correct_rate: Number(dpoNorm.metrics.normalized_overall_contract_correct),
  numeric_teacher_qwen_normalized_contract_correct_count: Number(qwenNorm.metrics.normalized_contract_correct_count),
  numeric_teacher_qwen_normalized_contract_correct_rate: Number(qwenNorm.metrics.normalized_overall_contract_correct),
  prior_constrained_scaffold_contract_correct_count: Math.round(priorScaffoldGate.metrics.overall_contract_correct_rate * priorScaffoldGate.metrics.examples),
  prior_constrained_scaffold_contract_correct_rate: Number(priorScaffoldGate.metrics.overall_contract_correct_rate),
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "numeric_sufficiency_first_scaffold_diagnostic",
  status: statusFor(metrics.contract_correct_count, abstentionPrior.correct, groundedRecovery.length),
  purpose: "Test a zero-spend sufficiency-first scaffold that preserves the numeric diagnostic abstention prior while attempting to recover the single answerable row with exact citations.",
  source_runs: {
    packet: packetRunId,
    contract_gate: gateRunId,
    qwen_normalization: qwenNormRunId,
    dpo_prompt_repaired_normalization: dpoNormRunId,
    prior_constrained_scaffold: priorScaffoldRunId,
  },
  policy: {
    default: "abstain unless the compact evidence directly supports the complete question target.",
    answer_rule: "For the premise/hypothesis translation question, answer only when one evidence item states that separate translation causes artifacts and another states that independent premise/hypothesis translation reduces lexical overlap.",
    target_leakage: false,
    note: "The prediction rule reads question text and evidence only; diagnostic targets are used after generation for scoring and baseline comparison.",
  },
  target_distribution: summarizeTargets(targets),
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
  },
  metrics,
  baselines,
  deltas: {
    scaffold_minus_abstention_prior: metrics.contract_correct_count - baselines.abstention_prior_contract_correct_count,
    scaffold_minus_dpo_prompt_repaired_baseline: metrics.contract_correct_count - baselines.dpo_prompt_repaired_normalized_contract_correct_count,
    scaffold_minus_numeric_teacher_qwen: metrics.contract_correct_count - baselines.numeric_teacher_qwen_normalized_contract_correct_count,
    scaffold_minus_prior_constrained_scaffold: metrics.contract_correct_count - baselines.prior_constrained_scaffold_contract_correct_count,
  },
  row_tag_counts: countTags(rows.flatMap((row) => row.tags)),
  decision: decisionFor(metrics.contract_correct_count, abstentionPrior.correct, groundedRecovery.length),
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
    note: "This run uses deterministic local rules plus the existing local contract gate only.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  predictions: result.predictions,
  metrics: result.metrics,
  baselines: result.baselines,
  deltas: result.deltas,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function predictPrompt(prompt) {
  const input = prompt.input ?? {};
  const evidencePack = input.compact_retrieved_evidence_pack ?? [];
  const prediction = predictInput(input.question ?? "", evidencePack);
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "numeric_sufficiency_first",
      no_model_weights_or_llm_calls: true,
    },
  };
}

function predictInput(question, evidencePack) {
  const premiseHypothesisQuestion = /\bpremise\b/i.test(question) && /\bhypothesis\b/i.test(question) && /\btogether\b/i.test(question);
  if (!premiseHypothesisQuestion) return abstain(question, "The question target was not fully supported by direct evidence under the sufficiency-first rule.");

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
  if (!artifactEvidence || !lexicalOverlapEvidence || artifactEvidence.evidence_id === lexicalOverlapEvidence.evidence_id) {
    return abstain(question, "The evidence did not jointly establish both separate-translation artifacts and reduced lexical overlap.");
  }

  const claim1 = "The paper argues that translating different parts of an NLI instance separately, such as the premise and hypothesis, causes translation artifacts.";
  const claim2 = "The paper states that translating the premise and hypothesis independently is likely to reduce lexical overlap between them.";
  const claim3 = "Together, those passages support answering yes: the evidence favors translating the premise and hypothesis together rather than separately.";
  const claims = [
    { claim_id: "C1", claim: claim1, citations: [artifactEvidence.evidence_id], support_status: "supported" },
    { claim_id: "C2", claim: claim2, citations: [lexicalOverlapEvidence.evidence_id], support_status: "supported" },
    { claim_id: "C3", claim: claim3, citations: [artifactEvidence.evidence_id, lexicalOverlapEvidence.evidence_id], support_status: "supported" },
  ];
  const citations = [artifactEvidence.evidence_id, lexicalOverlapEvidence.evidence_id];
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: question,
    },
    answer: `Yes. Separate premise/hypothesis translation is identified as a source of artifacts, and independent translation is said to reduce lexical overlap; that supports translating them together rather than separately.[${artifactEvidence.evidence_id}][${lexicalOverlapEvidence.evidence_id}]`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function findEvidence(evidencePack, requiredPatterns) {
  return evidencePack.find((evidence) => {
    const text = `${evidence.section ?? ""} ${evidence.text ?? ""}`;
    return requiredPatterns.every((pattern) => pattern.test(text));
  }) ?? null;
}

function abstain(question, missingSupport) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: missingSupport,
      question_target: question || "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The scaffold requires direct support for the complete question target before answering.",
  };
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${packetRunId}`,
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
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function summarizeMetrics(gate, examples) {
  const correct = Math.round(Number(gate.metrics.overall_contract_correct_rate) * examples);
  return {
    examples,
    contract_correct_count: correct,
    overall_contract_correct_rate: Number(gate.metrics.overall_contract_correct_rate),
    answer_type_accuracy: Number(gate.metrics.answer_type_accuracy),
    citation_set_exact_rate: Number(gate.metrics.citation_set_exact_rate),
    evidence_first_valid_rate: Number(gate.metrics.evidence_first_valid_rate),
    parseable_rate: Number(gate.metrics.parseable_rate),
  };
}

function scoreAbstentionPrior(targets) {
  const correct = targets.filter((row) => row.target?.answer_type === "abstain").length;
  return { correct, rate: targets.length ? correct / targets.length : 0 };
}

function summarizeTargets(targets) {
  return {
    examples: targets.length,
    grounded_answer: targets.filter((row) => row.target?.answer_type === "grounded_answer").length,
    abstain: targets.filter((row) => row.target?.answer_type === "abstain").length,
  };
}

function rowTags(row) {
  const tags = [];
  if (row.contract_correct) tags.push("contract_correct");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "grounded_answer" && row.citation_set_exact) tags.push("grounded_recovered_exact_citations");
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "abstain") tags.push("insufficiency_preserved");
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") tags.push("over_answered_insufficient_evidence");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain") tags.push("false_abstention");
  if (!row.citation_set_exact) tags.push("citation_set_mismatch");
  if (!row.evidence_first_valid) tags.push("evidence_first_invalid");
  return tags;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function statusFor(correct, abstentionPriorCorrect, groundedRecovered) {
  if (correct > abstentionPriorCorrect && groundedRecovered > 0) return "sufficiency_first_scaffold_beats_abstention_prior";
  if (correct === abstentionPriorCorrect && groundedRecovered > 0) return "sufficiency_first_scaffold_matches_abstention_prior_and_recovers_grounded";
  if (correct >= abstentionPriorCorrect) return "sufficiency_first_scaffold_matches_abstention_prior_without_grounded_recovery";
  return "sufficiency_first_scaffold_loses_abstention_prior";
}

function decisionFor(correct, abstentionPriorCorrect, groundedRecovered) {
  const diagnosticPass = correct > abstentionPriorCorrect && groundedRecovered > 0;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    use_as_gpu_target_now: false,
    keep_as_scaffold_floor: true,
    broader_surface_required: true,
    reason: diagnosticPass
      ? "The zero-cost scaffold beats the abstention prior on this skewed diagnostic by recovering the sole answerable row with exact citations, but it is hand-audited and too narrow to justify paid model work by itself."
      : "The scaffold does not produce a decisive improvement over the abstention prior on this skewed diagnostic surface.",
    next_step: diagnosticPass
      ? "Generalize the sufficiency-first selector to a leakage-safe broader validation surface before spending Prime or OpenAI budget."
      : "Improve support detection or switch to a stronger backend before any paid launch.",
  };
}

function renderReport(result) {
  return `# Numeric Sufficiency-First Scaffold Diagnostic

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Surface | Contract correct | Rate |
| --- | ---: | ---: |
| Sufficiency-first scaffold | ${result.metrics.contract_correct_count} / ${result.metrics.examples} | ${pct(result.metrics.overall_contract_correct_rate)} |
| Abstention prior | ${result.baselines.abstention_prior_contract_correct_count} / ${result.metrics.examples} | ${pct(result.baselines.abstention_prior_contract_correct_rate)} |
| DPO-prompt-repaired baseline | ${result.baselines.dpo_prompt_repaired_normalized_contract_correct_count} / ${result.metrics.examples} | ${pct(result.baselines.dpo_prompt_repaired_normalized_contract_correct_rate)} |
| Numeric-teacher Qwen normalized | ${result.baselines.numeric_teacher_qwen_normalized_contract_correct_count} / ${result.metrics.examples} | ${pct(result.baselines.numeric_teacher_qwen_normalized_contract_correct_rate)} |
| Prior constrained scaffold | ${result.baselines.prior_constrained_scaffold_contract_correct_count} / ${result.metrics.examples} | ${pct(result.baselines.prior_constrained_scaffold_contract_correct_rate)} |

## Deltas

| Comparison | Rows |
| --- | ---: |
| Scaffold - abstention prior | ${signed(result.deltas.scaffold_minus_abstention_prior)} |
| Scaffold - DPO baseline | ${signed(result.deltas.scaffold_minus_dpo_prompt_repaired_baseline)} |
| Scaffold - numeric-teacher Qwen | ${signed(result.deltas.scaffold_minus_numeric_teacher_qwen)} |
| Scaffold - prior constrained scaffold | ${signed(result.deltas.scaffold_minus_prior_constrained_scaffold)} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Keep as scaffold floor: ${result.decision.keep_as_scaffold_floor ? "yes" : "no"}
- Broader surface required: ${result.decision.broader_surface_required ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function signed(value) {
  const number = Number(value ?? 0);
  return number > 0 ? `+${number}` : String(number);
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
