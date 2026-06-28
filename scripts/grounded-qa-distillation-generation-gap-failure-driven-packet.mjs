import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const sourceLaunchRunId = args["source-launch-run-id"] ?? "generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1";
const failureRunId = args["failure-run-id"] ?? "generation-gap-support-risk-gate-qwen3b-sft-dpo-smoke-d321-v1-shape-eval";
const runId = args["run-id"] ?? "generation-gap-failure-driven-packet-d329-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");
const sourceLaunchDir = path.join(runsDir, sourceLaunchRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const failureResult = await readJson(path.join(runsDir, failureRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
  eval_targets_diagnostic: await readJsonl(path.join(sourceDatasetDir, "eval_targets_diagnostic.jsonl")),
};

const hardenedRows = {
  sft_train: sourceRows.sft_train.map((row) => hardenSft(row)),
  sft_validation: sourceRows.sft_validation.map((row) => hardenSft(row)),
  dpo_train: sourceRows.dpo_train.map((row) => hardenDpo(row)),
  dpo_validation: sourceRows.dpo_validation.map((row) => hardenDpo(row)),
  eval_prompts: sourceRows.eval_prompts.map((row) => hardenEval(row)),
  eval_targets_diagnostic: sourceRows.eval_targets_diagnostic,
};

const addedTrainDpo = buildFailureDrivenDpo(sourceRows.sft_train, "train");
const addedValidationDpo = buildFailureDrivenDpo(sourceRows.sft_validation, "validation");
hardenedRows.dpo_train.push(...addedTrainDpo);
hardenedRows.dpo_validation.push(...addedValidationDpo);

for (const file of [
  "validate_joint_action_dataset_uv.py",
  "train_joint_action_lora_uv.py",
  "eval_joint_action_adapter_uv.py",
  "run_joint_action_smoke.sh",
]) {
  let text = await fs.readFile(path.join(sourceLaunchDir, file), "utf8");
  if (file === "train_joint_action_lora_uv.py") {
    text = text
      .replace(
        'MAX_DPO_STEPS = int(os.environ.get("MAX_DPO_STEPS", "0"))\n',
        'MAX_DPO_STEPS = int(os.environ.get("MAX_DPO_STEPS", "0"))\nMAX_LENGTH = int(os.environ.get("MAX_LENGTH", "2048"))\nMAX_PROMPT_LENGTH = int(os.environ.get("MAX_PROMPT_LENGTH", "1536"))\n',
      )
      .replace("        max_length=1536,\n", "        max_length=MAX_LENGTH,\n")
      .replace('        "max_length": 1536,\n', '        "max_length": MAX_LENGTH,\n')
      .replace('        "max_prompt_length": 1280,\n', '        "max_prompt_length": MAX_PROMPT_LENGTH,\n');
  }
  await fs.writeFile(path.join(outputDir, file), text);
}
await fs.chmod(path.join(outputDir, "run_joint_action_smoke.sh"), 0o755);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_failure_driven_packet",
  status: "ready_for_local_dataset_validation",
  purpose: "Turn the D329 support-risk gate failure into a leakage-safe train/validation packet for the next bounded generation-gap model smoke.",
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  hub_model_id: null,
  estimated_gpu_cost_usd: 1,
  source_packet_run_id: sourcePacketRunId,
  source_launch_run_id: sourceLaunchRunId,
  failure_run_id: failureRunId,
  failure_signal: {
    shape_status: failureResult.status,
    metrics: failureResult.metrics,
    interpretation: "The gate recovers abstention but suppresses answerable non-boolean rows, so the next packet must pair support-risk negatives with evidence-sufficient answer construction positives.",
  },
  curriculum: {
    hardened_prompt: true,
    soft_answerability_hints: true,
    leakage_guard: {
      final_diagnostic_targets_used_for_training: false,
      train_validation_rows_only_for_new_preferences: true,
      eval_example_ids_unchanged: sameList(sourceRows.eval_prompts.map((row) => row.example_id), hardenedRows.eval_prompts.map((row) => row.example_id)),
      eval_targets_diagnostic_preserved_for_eval_only: JSON.stringify(sourceRows.eval_targets_diagnostic) === JSON.stringify(hardenedRows.eval_targets_diagnostic),
    },
    added_preference_types: countBy([...addedTrainDpo, ...addedValidationDpo], (row) => row.label_source.type),
  },
  examples: {
    source: summarizeRows(sourceRows),
    current: summarizeRows(hardenedRows),
    added_dpo_train: addedTrainDpo.length,
    added_dpo_validation: addedValidationDpo.length,
  },
  quality_gates: qualityGates(hardenedRows, addedTrainDpo, addedValidationDpo),
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: "Run the copied dataset validator and a packet-quality audit. Launch a bounded Prime smoke only if the packet validates and remains under the $100 spend cap.",
    reason: "This packet changes the learning objective, but the current action is zero-cost materialization and validation, not GPU training.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), hardenedRows.sft_train);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), hardenedRows.sft_validation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), hardenedRows.dpo_train);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), hardenedRows.dpo_validation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), hardenedRows.eval_prompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), hardenedRows.eval_targets_diagnostic);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  quality_gates: result.quality_gates,
  decision: result.decision,
  budget: result.budget,
}, null, 2));

function hardenSft(row) {
  return {
    ...row,
    messages: hardenMessages(row.messages, row.input),
    curriculum_metadata: {
      ...(row.curriculum_metadata ?? {}),
      d329_failure_driven_prompt: true,
    },
  };
}

function hardenDpo(row) {
  return {
    ...row,
    prompt: hardenMessages(row.prompt, row.input),
    curriculum_metadata: {
      ...(row.curriculum_metadata ?? {}),
      d329_failure_driven_prompt: true,
    },
  };
}

function hardenEval(row) {
  return {
    ...row,
    messages: hardenMessages(row.messages, row.input),
    curriculum_metadata: {
      ...(row.curriculum_metadata ?? {}),
      d329_failure_driven_prompt: true,
    },
  };
}

function hardenMessages(messages, input) {
  return messages.map((message, index) => {
    if (index === 0) return { ...message, content: hardenedSystemPrompt() };
    if (index === 1) return { ...message, content: appendAnswerabilityHints(message.content, input) };
    return message;
  });
}

function hardenedSystemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "First decide whether cited evidence directly supports the requested answer target.",
    "For grounded_answer, every factual claim must be entailed by cited evidence and every citation id must appear inline in answer.",
    "Use concise answer spans copied or tightly paraphrased from the cited evidence.",
    "Do not output empty answers, one-token non-boolean answers, generic claim_table entries, or citation-only answers.",
    "Do not cite more evidence ids than the compact answer actually needs.",
    "If evidence is insufficient, answer_type must be abstain, citations must be empty, and abstention_reason must name the missing support.",
    "When evidence directly answers the question, do not abstain by default.",
  ].join(" ");
}

function appendAnswerabilityHints(content, input) {
  const hints = answerabilityHints(input);
  return [
    String(content ?? ""),
    "",
    "Local answerability hints:",
    `decision=${hints.decision}; max_question_overlap=${hints.max_question_overlap.toFixed(3)}; direct_signal_count=${hints.direct_signal_count}; risky_question=${hints.risky_question ? "yes" : "no"}`,
    `top_evidence=${hints.top_evidence.map((item) => `${item.evidence_id}:overlap=${item.question_overlap.toFixed(3)}:direct=${item.direct_signal ? "yes" : "no"}`).join("; ") || "none"}`,
    "Hints are routing features only. They are not citations and do not replace direct evidence support.",
  ].join("\n");
}

function buildFailureDrivenDpo(rows, split) {
  const emitted = [];
  for (const row of rows) {
    const target = parseAssistantTarget(row);
    if (!target) continue;
    const prompt = hardenMessages(row.messages.slice(0, 2), row.input);
    if (target.answer_type === "grounded_answer") {
      emitted.push(dpoRow(row, split, "prefer_supported_answer_over_conservative_abstention_when_hints_sufficient", target, conservativeAbstention(row), prompt));
      emitted.push(dpoRow(row, split, "prefer_supported_answer_over_too_short_non_boolean_answer", target, tooShortAnswer(target), prompt));
      emitted.push(dpoRow(row, split, "prefer_supported_answer_over_overcited_generic_claim_table", target, overcitedGenericAnswer(target, row), prompt));
    } else {
      emitted.push(dpoRow(row, split, "prefer_abstention_over_spurious_cited_short_answer", target, spuriousCitedShortAnswer(row), prompt));
    }
  }
  return emitted;
}

function dpoRow(source, split, type, chosen, rejected, prompt) {
  return {
    example_id: `${source.example_id}:d329:${type}`,
    task: "citation_grounded_domain_qa_generation_gap_dpo",
    prompt,
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: {
      ...source.input,
      local_answerability_hints: answerabilityHints(source.input),
    },
    label_source: {
      type,
      source_example_id: source.example_id,
      source_packet_run_id: sourcePacketRunId,
      failure_run_id: failureRunId,
      uses_final_diagnostic_target: false,
    },
    curriculum_metadata: {
      source_example_id: source.example_id,
      split,
      d329_failure_driven_preference: true,
    },
  };
}

function conservativeAbstention(row) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: `Conservative abstention despite ${answerabilityHints(row.input).decision} local evidence hints.`,
  };
}

function tooShortAnswer(target) {
  const citation = target.citations?.[0] ?? "E1";
  return {
    answer_type: "grounded_answer",
    answer: `Yes. [${citation}]`,
    citations: [citation],
    claim_table: [{ claim: "Yes", support: "model_predicted", citations: [citation] }],
    abstention_reason: null,
  };
}

function overcitedGenericAnswer(target, row) {
  const citations = [...new Set([...(target.citations ?? []), ...((row.input?.compact_retrieved_evidence_pack ?? []).slice(0, 4).map((item) => item.evidence_id))])].slice(0, 5);
  const inline = citations.map((id) => `[${id}]`).join(" ");
  return {
    answer_type: "grounded_answer",
    answer: `${stripCitations(target.answer)} ${inline}`.trim(),
    citations,
    claim_table: [{ claim: "model answer", support: "model_predicted", citations }],
    abstention_reason: null,
  };
}

function spuriousCitedShortAnswer(row) {
  const citation = row.input?.compact_retrieved_evidence_pack?.[0]?.evidence_id ?? "E1";
  return {
    answer_type: "grounded_answer",
    answer: `ROOT [${citation}]`,
    citations: [citation],
    claim_table: [{ claim: "ROOT", support: "model_predicted", citations: [citation] }],
    abstention_reason: null,
  };
}

function answerabilityHints(input) {
  const question = String(input?.question ?? "");
  const questionTokens = contentTokens(question);
  const topEvidence = (input?.compact_retrieved_evidence_pack ?? []).map((evidence) => {
    const tokens = new Set(contentTokens(`${evidence.section ?? ""} ${evidence.text ?? ""}`));
    const questionOverlap = overlapRate(questionTokens, tokens);
    return {
      evidence_id: evidence.evidence_id,
      question_overlap: questionOverlap,
      direct_signal: directSignal(question, `${evidence.section ?? ""} ${evidence.text ?? ""}`),
    };
  }).filter((item) => item.evidence_id).sort((a, b) => b.question_overlap - a.question_overlap || Number(b.direct_signal) - Number(a.direct_signal)).slice(0, 3);
  const maxOverlap = topEvidence[0]?.question_overlap ?? 0;
  const directCount = topEvidence.filter((item) => item.direct_signal).length;
  const riskyQuestion = /\b(why|how|compare|compared|improve|better|worse|state-of-the-art|main|overall|if)\b/i.test(question);
  return {
    decision: maxOverlap >= 0.32 || directCount >= 1 ? "sufficient_candidate" : riskyQuestion ? "risky_partial" : "weak",
    max_question_overlap: maxOverlap,
    direct_signal_count: directCount,
    risky_question: riskyQuestion,
    top_evidence: topEvidence,
  };
}

function directSignal(question, evidenceText) {
  const q = contentTokens(question);
  const e = new Set(contentTokens(evidenceText));
  if (!q.length) return false;
  const overlap = overlapRate(q, e);
  return overlap >= 0.28 || /\b(result|results|show|find|found|report|outperform|improve|significant|dataset|model)\b/i.test(evidenceText);
}

function qualityGates(rows, addedTrainDpo, addedValidationDpo) {
  const allAdded = [...addedTrainDpo, ...addedValidationDpo];
  const answerableAdded = allAdded.filter((row) => row.chosen_output.answer_type === "grounded_answer");
  const abstainAdded = allAdded.filter((row) => row.chosen_output.answer_type === "abstain");
  return {
    has_added_train_preferences: addedTrainDpo.length > 0,
    has_added_validation_preferences: addedValidationDpo.length > 0,
    has_answer_construction_preferences: answerableAdded.length > 0,
    has_abstention_hard_negatives: abstainAdded.length > 0,
    eval_prompts_unchanged_count: rows.eval_prompts.length === sourceRows.eval_prompts.length,
    every_grounded_chosen_has_inline_citation: answerableAdded.every((row) => (row.chosen_output.citations ?? []).every((id) => String(row.chosen_output.answer ?? "").includes(`[${id}]`))),
    no_model_or_api_calls: true,
  };
}

function summarizeRows(rows) {
  return Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length]));
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) counts[fn(row)] = (counts[fn(row)] ?? 0) + 1;
  return counts;
}

function parseAssistantTarget(row) {
  if (row.target) return row.target;
  const assistant = row.messages?.findLast?.((message) => message.role === "assistant") ?? row.messages?.[2];
  if (!assistant?.content) return null;
  try {
    return JSON.parse(assistant.content);
  } catch {
    return null;
  }
}

function stripCitations(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, " ").trim();
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "did", "they"]);
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function overlapRate(left, rightSet) {
  if (!left.length) return 0;
  return left.filter((token) => rightSet.has(token)).length / new Set(left).size;
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function renderDatasetReadme(result) {
  return `# ${result.run_id}

Failure-driven generation-gap packet from D329.

- Source packet: \`${result.source_packet_run_id}\`
- Failure signal: \`${result.failure_run_id}\`
- Added DPO train rows: ${result.examples.added_dpo_train}
- Added DPO validation rows: ${result.examples.added_dpo_validation}
- OpenAI calls: 0
- Prime spend: 0

Final diagnostic targets are not used for training. Eval prompts are preserved for the downstream shape harness.
`;
}

function renderReport(result) {
  return `# Generation-Gap Failure-Driven Packet

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no Prime job.

## Source Signal

D329 shape status: \`${result.failure_signal.shape_status}\`

Overall shape: ${fmt(result.failure_signal.metrics.overall_shape_correct_rate)}
Answerable supported shape: ${fmt(result.failure_signal.metrics.answerable_supported_shape_rate)}
Abstention shape: ${fmt(result.failure_signal.metrics.abstention_shape_rate)}

## Rows

| Split | Source | Current | Added |
| --- | ---: | ---: | ---: |
| SFT train | ${result.examples.source.sft_train} | ${result.examples.current.sft_train} | 0 |
| SFT validation | ${result.examples.source.sft_validation} | ${result.examples.current.sft_validation} | 0 |
| DPO train | ${result.examples.source.dpo_train} | ${result.examples.current.dpo_train} | ${result.examples.added_dpo_train} |
| DPO validation | ${result.examples.source.dpo_validation} | ${result.examples.current.dpo_validation} | ${result.examples.added_dpo_validation} |
| Eval prompts | ${result.examples.source.eval_prompts} | ${result.examples.current.eval_prompts} | 0 |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function fmt(value) {
  return value == null ? "n/a" : Number(value).toFixed(3);
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return parsed;
}
