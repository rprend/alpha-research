import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const predictionRunId = args["prediction-run"] ?? "joint-action-qwen7b-nonfinal-frontier-candidates-v1-citation-repair";
const judgeRunId = args["judge-run"] ?? "openai-judge-gpt4o-joint-action-qwen7b-nonfinal-frontier-candidates-v1-citation-repair";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1";
const runId = args["run-id"] ?? "qwen-nonfinal-support-label-packet-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const predictions = await readJsonl(path.join(runsDir, predictionRunId, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl"));
const evalPrompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const predictionResult = await readJson(path.join(runsDir, predictionRunId, "result.json"));
const judgeResult = await readJson(path.join(runsDir, judgeRunId, "result.json"));
const promptById = new Map(evalPrompts.map((row) => [row.example_id, row]));
const judgmentById = new Map(judgments.map((row) => [row.example_id, row]));

const labels = [];
for (const row of predictions) {
  const prompt = promptById.get(row.example_id);
  const judgment = judgmentById.get(row.example_id);
  if (!prompt || !judgment || judgment.skipped) continue;
  const verdict = judgment.judgment?.verdict ?? "invalid";
  const answerType = row.prediction?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  labels.push({
    example_id: row.example_id,
    source_prediction_run_id: predictionRunId,
    source_judge_run_id: judgeRunId,
    training_use: "allowed_nonfinal_support_supervision",
    final_window: false,
    source_index: prompt.metadata?.source_index,
    paper_id: prompt.input?.document_metadata?.paper_id,
    question: prompt.input?.question,
    evidence_pack: prompt.input?.compact_retrieved_evidence_pack ?? [],
    candidate: row.prediction,
    reference: row.reference,
    judge: {
      model: judgment.model,
      verdict,
      all_claims_supported: judgment.judgment?.all_claims_supported ?? false,
      citation_ids_valid: judgment.judgment?.citation_ids_valid ?? false,
      abstention_supported: judgment.judgment?.abstention_supported ?? false,
      unsupported_claims: judgment.judgment?.unsupported_claims ?? [],
      missing_citations: judgment.judgment?.missing_citations ?? [],
    },
    labels: {
      answer_type: answerType,
      supported_answer: answerType === "grounded_answer" && verdict === "supported",
      unsupported_answer: answerType === "grounded_answer" && verdict !== "supported",
      supported_abstention: answerType === "abstain" && verdict === "correct_abstention",
      invalid_or_partial_answer: answerType === "grounded_answer" && ["partial", "invalid"].includes(verdict),
    },
    features: answerFeatures(row.prediction),
  });
}

const answered = labels.filter((row) => row.labels.answer_type === "grounded_answer");
const abstained = labels.filter((row) => row.labels.answer_type === "abstain");
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_nonfinal_support_label_packet",
  status: answered.filter((row) => row.labels.supported_answer).length >= 20 && answered.filter((row) => row.labels.unsupported_answer).length >= 20
    ? "nonfinal_qwen_support_labels_ready"
    : "nonfinal_qwen_support_labels_sparse",
  prediction_run_id: predictionRunId,
  judge_run_id: judgeRunId,
  packet_run_id: packetRunId,
  split: judgeResult.split,
  counts: {
    rows: labels.length,
    answered: answered.length,
    abstained: abstained.length,
    supported_answers: answered.filter((row) => row.labels.supported_answer).length,
    unsupported_answers: answered.filter((row) => row.labels.unsupported_answer).length,
    supported_abstentions: abstained.filter((row) => row.labels.supported_abstention).length,
    invalid_or_partial_answers: answered.filter((row) => row.labels.invalid_or_partial_answer).length,
  },
  source_metrics: {
    prediction_eval: predictionResult.eval,
    judge_metrics: judgeResult.metrics,
  },
  leakage_guard: {
    final_window_labels_used: false,
    final_window_rows: labels.filter((row) => row.final_window !== false).length,
    training_use: "allowed_nonfinal_support_supervision",
    source_index_min: Math.min(...labels.map((row) => Number(row.source_index)).filter(Number.isFinite)),
    source_index_max: Math.max(...labels.map((row) => Number(row.source_index)).filter(Number.isFinite)),
  },
  cost: {
    openai_calls_inherited: judgeResult.calls_made,
    openai_cost_usd_inherited: judgeResult.run_cost_usd,
    packet_materialization_openai_calls: 0,
    packet_materialization_cost_usd: 0,
    external_compute_cost_usd_inherited: 0.27,
  },
  next_step: "Merge these non-final labels into support-ranker/verifier training only with source-window provenance retained, then validate on disjoint final diagnostic rows.",
};

await writeJsonl(path.join(outputDir, "support_labels.jsonl"), labels);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: runId, status: result.status, counts: result.counts }, null, 2));

function answerFeatures(prediction) {
  const answer = String(prediction?.answer ?? "");
  const citations = Array.isArray(prediction?.citations) ? prediction.citations : [];
  const claims = Array.isArray(prediction?.claim_table) ? prediction.claim_table : [];
  return {
    answer_chars: answer.length,
    answer_tokens: answer.split(/\s+/).filter(Boolean).length,
    citation_count: citations.length,
    claim_count: claims.length,
    inline_complete: citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`)),
  };
}

function renderReport(result) {
  return `# Qwen Non-Final Support Label Packet

Run: \`${result.run_id}\`

Status: \`${result.status}\`

| Rows | Answered | Supported answers | Unsupported answers | Supported abstentions | Invalid/partial answers |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.counts.rows} | ${result.counts.answered} | ${result.counts.supported_answers} | ${result.counts.unsupported_answers} | ${result.counts.supported_abstentions} | ${result.counts.invalid_or_partial_answers} |

These are leakage-safe non-final Qwen-style support labels. Packet materialization made no OpenAI calls and launched no GPU jobs; it inherits the recorded judge and Prime costs from the source runs.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
