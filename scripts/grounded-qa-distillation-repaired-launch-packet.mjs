import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const repairPacketRunId = args["repair-packet-run"] ?? "frontier-full-nonfinal-repair-packet-2026-06-29-v1";
const evalPacketRunId = args["eval-packet-run"] ?? "frontier-target-repair-packet-gpt54-targeted-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const repairPacket = await readJson(path.join(runsDir, repairPacketRunId, "result.json"));
const evalPacket = await readJson(path.join(runsDir, evalPacketRunId, "result.json"));
const trainRows = await readJsonl(path.join(runsDir, repairPacketRunId, "dataset", "sft_train_repaired_sample.jsonl"));
const validationRows = await readJsonl(path.join(runsDir, repairPacketRunId, "dataset", "sft_validation_repaired_sample.jsonl"));
const evalPrompts = await readJsonl(path.join(runsDir, evalPacketRunId, "dataset", "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(runsDir, evalPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const dpoTrain = makeDpoRows(trainRows, "train");
const dpoValidation = makeDpoRows(validationRows, "validation");

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), trainRows);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), validationRows);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), dpoTrain);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), dpoValidation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), evalPrompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), evalTargets);

const checks = await runLocalChecks();
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_repaired_launch_packet",
  status: checks.every((row) => row.status === "pass") ? "repaired_launch_packet_ready_for_bounded_smoke" : "repaired_launch_packet_local_check_failed",
  purpose: "Package frontier/judge-repaired SFT labels with synthetic answerability-contrast DPO rows and repaired diagnostic eval targets.",
  source_runs: {
    full_nonfinal_repair_packet: repairPacketRunId,
    repaired_eval_packet: evalPacketRunId,
  },
  source_context: {
    repair_packet_status: repairPacket.status,
    eval_packet_status: evalPacket.status,
  },
  examples: {
    sft_train: trainRows.length,
    sft_validation: validationRows.length,
    dpo_train: dpoTrain.length,
    dpo_validation: dpoValidation.length,
    eval_prompts: evalPrompts.length,
    eval_targets: evalTargets.length,
    train_distribution: summarizeSft(trainRows),
    validation_distribution: summarizeSft(validationRows),
    eval_distribution: summarizeTargets(evalTargets),
  },
  local_checks: checks,
  decision: {
    run_zero_spend_scaffold_smoke_next: checks.every((row) => row.status === "pass"),
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    reason: "The packet is ready for bounded smoke testing; run a zero-spend scaffold baseline before renting GPU so Prime has a meaningful baseline to beat.",
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
    note: "Launch packet materialization is local and deterministic.",
  },
  artifacts: {
    dataset_dir: rel(datasetDir),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  decision: result.decision,
}, null, 2));

function makeDpoRows(rows, split) {
  return rows.map((row) => {
    const chosen = row.target;
    const rejected = makeRejected(row);
    return {
      example_id: `${row.example_id}:synthetic-answerability-dpo`,
      task: "citation_grounded_domain_qa_repaired_answerability_dpo",
      prompt: row.messages.filter((message) => message.role !== "assistant"),
      chosen: JSON.stringify(chosen),
      rejected: JSON.stringify(rejected),
      source_split: split,
      preference_source: {
        type: "synthetic_answerability_contrast_from_frontier_repaired_sft",
        repair_packet_run_id: repairPacketRunId,
        chosen_answer_type: chosen.answer_type,
        rejected_answer_type: rejected.answer_type,
      },
    };
  });
}

function makeRejected(row) {
  const target = row.target;
  if (target.answer_type === "abstain") {
    const evidence = row.input?.compact_retrieved_evidence_pack?.[0];
    const citation = evidence?.evidence_id ?? "E1";
    return {
      answer_type: "grounded_answer",
      evidence_first: {
        sufficiency: "sufficient",
        supported_claims: [{
          claim_id: "C1",
          claim: "The evidence is sufficient to answer the question.",
          citations: [citation],
          support_status: "unsupported_contrast",
        }],
        missing_support: "",
        question_target: target.evidence_first?.question_target ?? "exact_question_target",
      },
      answer: `The evidence is sufficient to answer the question. [${citation}]`,
      citations: [citation],
      claim_table: [{ claim: "The evidence is sufficient to answer the question.", support: "unsupported_contrast", citations: [citation] }],
      abstention_reason: null,
    };
  }
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: "Synthetic contrast: abstains despite a judged-supported repaired answer.",
      question_target: target.evidence_first?.question_target ?? "exact_question_target",
    },
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [],
    abstention_reason: "Synthetic contrast: abstains despite a judged-supported repaired answer.",
  };
}

async function runLocalChecks() {
  const checks = [];
  const files = [
    ["sft_train", "sft_train.jsonl", trainRows.length],
    ["sft_validation", "sft_validation.jsonl", validationRows.length],
    ["dpo_train", "dpo_train.jsonl", dpoTrain.length],
    ["dpo_validation", "dpo_validation.jsonl", dpoValidation.length],
    ["eval_prompts", "eval_prompts.jsonl", evalPrompts.length],
    ["eval_targets", "eval_targets_diagnostic.jsonl", evalTargets.length],
  ];
  for (const [id, file, expected] of files) {
    const rows = await readJsonl(path.join(datasetDir, file));
    checks.push({ id: `row_count_${id}`, status: rows.length === expected && rows.length > 0 ? "pass" : "fail", rows: rows.length, expected });
  }
  checks.push(validateSftRows("sft_train", trainRows));
  checks.push(validateSftRows("sft_validation", validationRows));
  checks.push(validateDpoRows("dpo_train", dpoTrain));
  checks.push(validateDpoRows("dpo_validation", dpoValidation));
  return checks;
}

function validateSftRows(id, rows) {
  const bad = rows.find((row) => {
    const assistant = row.messages?.at(-1);
    if (assistant?.role !== "assistant") return true;
    try {
      return JSON.parse(assistant.content).answer_type !== row.target?.answer_type;
    } catch {
      return true;
    }
  });
  return { id: `valid_${id}`, status: bad ? "fail" : "pass", bad_example_id: bad?.example_id ?? null };
}

function validateDpoRows(id, rows) {
  const bad = rows.find((row) => {
    try {
      const chosen = JSON.parse(row.chosen);
      const rejected = JSON.parse(row.rejected);
      return !Array.isArray(row.prompt) || row.prompt.length !== 2 || chosen.answer_type === rejected.answer_type;
    } catch {
      return true;
    }
  });
  return { id: `valid_${id}`, status: bad ? "fail" : "pass", bad_example_id: bad?.example_id ?? null };
}

function summarizeSft(rows) {
  return {
    examples: rows.length,
    grounded_answer: rows.filter((row) => row.target.answer_type === "grounded_answer").length,
    abstain: rows.filter((row) => row.target.answer_type === "abstain").length,
    answer_type_changed: rows.filter((row) => row.label_source?.answer_type_changed).length,
  };
}

function summarizeTargets(rows) {
  return {
    examples: rows.length,
    grounded_answer: rows.filter((row) => row.target.answer_type === "grounded_answer").length,
    abstain: rows.filter((row) => row.target.answer_type === "abstain").length,
  };
}

function renderReport(result) {
  return `# Frontier Repaired Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Examples

- SFT train: ${result.examples.sft_train}
- SFT validation: ${result.examples.sft_validation}
- DPO train: ${result.examples.dpo_train}
- DPO validation: ${result.examples.dpo_validation}
- Eval prompts: ${result.examples.eval_prompts}
- Eval targets: ${result.examples.eval_targets}

## Decision

- Run zero-spend scaffold smoke next: ${result.decision.run_zero_spend_scaffold_smoke_next ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
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

function rel(file) {
  return path.relative(rootDir, file);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
