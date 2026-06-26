import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const exportDir = path.join(experimentDir, "exports");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const split = args.split ?? "extended_temporal_future_holdout";
const outputPrefix = args["output-prefix"] ?? "teacher-combined-mini-det-guard-future-holdout-240-389-v1";
const miniVerifierRun = args["mini-verifier-run"] ?? "mini-verifier-gate-balanced-risk-gate-240-389-v1";

await fs.mkdir(exportDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const sourceExamples = keyed(await readJsonl(path.join(exportDir, `${split}.sft.jsonl`)));
const verifierRows = await readJsonl(path.join(runDir, miniVerifierRun, "examples.jsonl"));
const miniResult = JSON.parse(await fs.readFile(path.join(runDir, miniVerifierRun, "result.json"), "utf8"));
const sourcePredictions = keyed([
  ...await readJsonl(path.join(runDir, "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1", "predictions.jsonl")),
  ...await readJsonl(path.join(runDir, "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1", "predictions.jsonl")),
]);

const accepted = [];
const rejected = [];
const verifierLabels = [];

for (const row of verifierRows) {
  const source = sourceExamples.get(row.example_id);
  if (!source) throw new Error(`Missing source SFT row for ${row.example_id}`);
  const sourcePrediction = normalizePrediction(sourcePredictions.get(row.example_id)?.prediction ?? {});
  const combinedSuppresses = row.combined_suppresses === true;
  const teacherOutput = combinedSuppresses ? abstainPrediction(row) : sourcePrediction;
  const combinedCorrect = row.combined_correct_against_strong === true;
  const label = {
    example_id: row.example_id,
    source_split: split,
    task: "citation_grounded_domain_qa_combined_verifier_teacher_label_sft",
    label_source: {
      source_policy_run_id: miniVerifierRun,
      base_policy: "balanced_support_risk_gate",
      mini_verifier: row.mini_suppresses === true,
      deterministic_claim_guard: row.deterministic_suppresses === true,
      combined_suppression: combinedSuppresses,
      strong_verdict: row.strong_verdict,
      mini_verdict: row.mini_verdict,
      quality_tier: combinedCorrect ? "support_oracle_accepted" : "support_oracle_rejected",
      quality_note: combinedSuppresses
        ? "Suppressed answer accepted when existing strong judge marked the original answer unsupported; abstention itself was not freshly judged."
        : "Kept answer accepted when existing strong judge marked the original answer supported, or kept abstention was already judged correct.",
    },
    messages: [
      source.messages[0],
      source.messages[1],
      { role: "assistant", content: JSON.stringify(teacherOutput) },
    ],
    input: source.input,
    teacher_output: teacherOutput,
    original_target: source.target,
    teacher_trace: {
      source_policy: row,
      original_teacher_trace: source.teacher_trace,
    },
  };
  const verifierLabel = {
    example_id: row.example_id,
    source_split: split,
    task: "citation_grounded_answer_support_verifier",
    input: {
      question: source.input.question,
      document_metadata: source.input.document_metadata,
      compact_retrieved_evidence_pack: source.input.compact_retrieved_evidence_pack,
      candidate_answer: sourcePrediction,
    },
    output: {
      label: row.strong_correct ? "keep" : "suppress",
      combined_policy_action: combinedSuppresses ? "suppress" : "keep",
      strong_support_label: row.strong_correct ? "supported_or_correct_abstention" : "unsupported_or_incorrect",
      mini_negative: row.mini_suppresses === true,
      deterministic_guard_negative: row.deterministic_suppresses === true,
      combined_policy_correct_against_strong: combinedCorrect,
    },
    metadata: {
      window: row.window,
      support_score: row.support_score,
      mini_verdict: row.mini_verdict,
      strong_verdict: row.strong_verdict,
    },
  };
  verifierLabels.push(verifierLabel);
  if (combinedCorrect) accepted.push(label);
  else rejected.push({ ...label, rejection_reason: rejectionReason(row) });
}

accepted.sort((a, b) => a.example_id.localeCompare(b.example_id));
rejected.sort((a, b) => a.example_id.localeCompare(b.example_id));
verifierLabels.sort((a, b) => a.example_id.localeCompare(b.example_id));

const acceptedPath = path.join(exportDir, `${outputPrefix}.sft.jsonl`);
const rejectedPath = path.join(exportDir, `${outputPrefix}.rejected.jsonl`);
const verifierPath = path.join(exportDir, `${outputPrefix}.verifier.jsonl`);
const manifestPath = path.join(exportDir, `${outputPrefix}.manifest.json`);
const reportPath = path.join(reportDir, `${outputPrefix}.md`);

const summary = {
  output_prefix: outputPrefix,
  generated_at: new Date().toISOString(),
  split,
  source_run_id: miniVerifierRun,
  examples_seen: verifierRows.length,
  accepted_labels: accepted.length,
  rejected_labels: rejected.length,
  acceptance_rate: ratio(accepted.length, verifierRows.length),
  accepted_answered: accepted.filter((row) => row.teacher_output.answer_type === "grounded_answer").length,
  accepted_abstained: accepted.filter((row) => row.teacher_output.answer_type === "abstain").length,
  rejected_answered: rejected.filter((row) => row.teacher_output.answer_type === "grounded_answer").length,
  rejected_abstained: rejected.filter((row) => row.teacher_output.answer_type === "abstain").length,
  verifier_keep_labels: verifierLabels.filter((row) => row.output.label === "keep").length,
  verifier_suppress_labels: verifierLabels.filter((row) => row.output.label === "suppress").length,
  combined_policy_keep_actions: verifierLabels.filter((row) => row.output.combined_policy_action === "keep").length,
  combined_policy_suppress_actions: verifierLabels.filter((row) => row.output.combined_policy_action === "suppress").length,
  source_mini_judge_cost_usd: miniResult.source_mini_judge_cost_usd,
  source_mini_judge_calls: miniResult.source_mini_judge_calls,
  strong_baseline_correct_rate: miniResult.aggregate.baseline.correct_rate,
  mini_verifier_correct_rate: miniResult.aggregate.mini_verifier_gate.correct_rate,
  combined_verifier_correct_rate: miniResult.aggregate.combined_verifier_gate.correct_rate,
  artifacts: {
    accepted_sft_jsonl: path.relative(rootDir, acceptedPath),
    rejected_jsonl: path.relative(rootDir, rejectedPath),
    verifier_jsonl: path.relative(rootDir, verifierPath),
    manifest: path.relative(rootDir, manifestPath),
    report: path.relative(rootDir, reportPath),
  },
  caveats: [
    "Suppressed unsupported answers are accepted by support-oracle conversion, not by a fresh abstention judge.",
    "The combined policy uses per-query mini verifier calls; this packet is for distillation or verifier training.",
  ],
};

await writeJsonl(acceptedPath, accepted);
await writeJsonl(rejectedPath, rejected);
await writeJsonl(verifierPath, verifierLabels);
await fs.writeFile(manifestPath, `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(summary, rejected));

console.log(JSON.stringify(summary, null, 2));

function abstainPrediction(row) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{
      claim: "A verifier rejected the generated answer as insufficiently supported.",
      support: "combined_mini_negative_or_claim_guard",
      citations: [],
    }],
    abstention_reason: [
      row.mini_suppresses ? "mini verifier negative" : null,
      row.deterministic_suppresses ? "deterministic claim-entailment guard" : null,
    ].filter(Boolean).join("; "),
  };
}

function rejectionReason(row) {
  if (row.combined_suppresses && row.strong_correct) return "combined_policy_harmful_suppression";
  if (!row.combined_suppresses && !row.strong_correct) return "combined_policy_retained_unsupported";
  return "combined_policy_not_support_oracle_correct";
}

function renderReport(summary, rejected) {
  return `# Combined Mini/Deterministic Guard Teacher Export

## Setup

- Source policy run: \`${summary.source_run_id}\`
- Split: \`${summary.split}\`
- Accepted SFT labels: \`${summary.artifacts.accepted_sft_jsonl}\`
- Rejected audit rows: \`${summary.artifacts.rejected_jsonl}\`
- Verifier labels: \`${summary.artifacts.verifier_jsonl}\`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained | Verifier keep targets | Verifier suppress targets | Combined suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${summary.examples_seen} | ${summary.accepted_labels} | ${summary.rejected_labels} | ${pct(summary.acceptance_rate)} | ${summary.accepted_answered} | ${summary.accepted_abstained} | ${summary.verifier_keep_labels} | ${summary.verifier_suppress_labels} | ${summary.combined_policy_suppress_actions} |

The combined policy improves strong support-oracle correctness from ${pct(summary.strong_baseline_correct_rate)} for the balanced risk gate to ${pct(summary.combined_verifier_correct_rate)} by combining rare \`gpt-4o-mini\` verifier negatives with the deterministic claim-entailment guard.

## Cost

The source mini verifier runs made ${summary.source_mini_judge_calls} calls and cost $${summary.source_mini_judge_cost_usd.toFixed(8)}. This export makes no additional LLM calls.

## Caveats

${summary.caveats.map((item) => `- ${item}`).join("\n")}

## Rejections

${rejected.length ? rejected.map((row) => `- \`${row.example_id}\`: ${row.rejection_reason}`).join("\n") : "No rejected labels."}
`;
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

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
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
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
