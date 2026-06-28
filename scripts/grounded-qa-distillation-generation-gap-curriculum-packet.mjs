import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const oracleGapRunId = args["oracle-gap-run-id"] ?? "oracle-gap-decomposition-calibrated-hybrid-final-window-2026-06-28-v1";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const trainStart = numberArg(args["train-start"], 0);
const trainEnd = numberArg(args["train-end"], 240);
const validationStart = numberArg(args["validation-start"], 240);
const validationEnd = numberArg(args["validation-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const allRows = (await readJsonl(path.join(dataDir, dataFile))).map(normalizeExample);
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const oracleGap = await readJson(path.join(runsDir, oracleGapRunId, "result.json"));
const gapRows = await readJsonl(path.join(runsDir, oracleGapRunId, "gap_rows.jsonl"));
const generationGapIds = new Set(gapRows.filter((row) => row.gap_bucket === "candidate_generation_gap").map((row) => row.example_id));
const byId = new Map(allRows.map((row) => [row.example_id, row]));

const evalRows = allRows.slice(evalStart, evalEnd);
const evalPaperIds = new Set(evalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
const trainRows = allRows.slice(trainStart, trainEnd).filter((row) => !evalPaperIds.has(row.input.document_metadata?.paper_id));
const validationCandidateRows = allRows.slice(validationStart, validationEnd);
const validationRows = validationCandidateRows.filter((row) => !evalPaperIds.has(row.input.document_metadata?.paper_id));
const validationDroppedRows = validationCandidateRows.filter((row) => evalPaperIds.has(row.input.document_metadata?.paper_id));
const finalGapRows = [...generationGapIds].map((id) => byId.get(id)).filter(Boolean);

const trainPacket = buildPacket(trainRows, "train");
const validationPacket = buildPacket(validationRows, "validation");
const evalPrompts = finalGapRows.map(evalPromptRow);
const evalTargets = finalGapRows.map(evalTargetRow);
const gapSummary = summarizeFinalGaps(finalGapRows, gapRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_curriculum_packet",
  status: deriveStatus(gapSummary, trainPacket, validationPacket),
  purpose: "Construct a leakage-safe post-training packet for the D320 no-supported-candidate final misses: generate concise supported answers when evidence is sufficient and preserve abstention when it is not.",
  source_runs: {
    oracle_gap_decomposition: oracleGapRunId,
  },
  source_data: {
    file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: { id: `${trainStart}-${trainEnd}`, candidate_examples: trainEnd - trainStart, examples_after_eval_paper_filter: trainRows.length },
    validation_window: {
      id: `${validationStart}-${validationEnd}`,
      candidate_examples: validationCandidateRows.length,
      examples_after_eval_paper_filter: validationRows.length,
      dropped_for_eval_paper_overlap: validationDroppedRows.length,
    },
    eval_window: { id: `${evalStart}-${evalEnd}`, examples: evalRows.length },
    final_gap_examples: finalGapRows.length,
  },
  final_gap_summary: gapSummary,
  train_counts: trainPacket.summary,
  validation_counts: validationPacket.summary,
  examples: {
    sft_train: trainPacket.sft.length,
    sft_validation: validationPacket.sft.length,
    dpo_train: trainPacket.dpo.length,
    dpo_validation: validationPacket.dpo.length,
    eval_prompts: evalPrompts.length,
    eval_targets_diagnostic_only: evalTargets.length,
  },
  quality_gates: {
    train_answerable_rows: trainPacket.summary.answerable_rows,
    validation_answerable_rows: validationPacket.summary.answerable_rows,
    train_abstention_rows: trainPacket.summary.abstention_rows,
    validation_abstention_rows: validationPacket.summary.abstention_rows,
    train_answer_over_abstain_contrasts: trainPacket.summary.answer_over_abstain_contrasts,
    validation_answer_over_abstain_contrasts: validationPacket.summary.answer_over_abstain_contrasts,
    train_abstention_over_unsupported_contrasts: trainPacket.summary.abstention_over_unsupported_contrasts,
    validation_abstention_over_unsupported_contrasts: validationPacket.summary.abstention_over_unsupported_contrasts,
    train_supported_over_unsupported_evidence_contrasts: trainPacket.summary.supported_over_unsupported_evidence_contrasts,
    validation_supported_over_unsupported_evidence_contrasts: validationPacket.summary.supported_over_unsupported_evidence_contrasts,
  },
  decision: {
    launch_gpu_now: false,
    buy_openai_labels_now: false,
    use_packet_for_next_bounded_generator_run: true,
    keep_final_gap_targets_diagnostic_only: true,
    next_step: "Run a small local/Prime preflight only after this packet passes dataset validation and has a fixed evaluation harness for the 10 D320 final gap prompts.",
    reason: "D320 showed selector-only headroom is small and 10 final misses lack supported answer candidates. This packet targets candidate creation and abstention preservation without using final labels for training.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_validation_selection: false,
    final_gap_eval_targets_training_use: "forbidden_diagnostic_only",
    eval_paper_ids_excluded_from_train_and_validation: true,
    oracle_gap_labels_used_for_training: false,
    nonfinal_reference_labels_used_for_training: true,
  },
  inherited_context: {
    d320_status: oracleGap.status,
    d320_oracle_net_correct_lift: oracleGap.aggregate?.oracle_net_correct_lift,
    d320_candidate_generation_gap_rows: oracleGap.gap_buckets?.candidate_generation_gap,
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
    prime_intellect_cost_usd: 0,
    note: "Packet construction is deterministic over existing local labels and D320 diagnostics.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), trainPacket.sft);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), validationPacket.sft);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), trainPacket.dpo);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), validationPacket.dpo);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), evalPrompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), evalTargets);
await fs.writeFile(path.join(datasetDir, "README.md"), renderReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  final_gap_summary: result.final_gap_summary,
  examples: result.examples,
  quality_gates: result.quality_gates,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function buildPacket(rows, split) {
  const sft = [];
  const dpo = [];
  const summary = emptySummary(rows.length);
  for (const row of rows) {
    const target = referenceTarget(row);
    sft.push({
      example_id: `${row.example_id}:generation-gap:${split}:sft`,
      task: "citation_grounded_domain_qa_generation_gap_sft",
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(row) },
        { role: "assistant", content: JSON.stringify(target) },
      ],
      input: row.input,
      target,
      label_source: labelSource(row, split, "reference_sft"),
    });
    summary.sft_rows += 1;
    if (target.answer_type === "abstain") {
      summary.abstention_rows += 1;
      const unsupported = plausibleUnsupportedAnswer(row);
      if (unsupported) {
        dpo.push(dpoRow(row, split, target, unsupported, "prefer_abstention_over_plausible_unsupported_answer"));
        summary.abstention_over_unsupported_contrasts += 1;
      }
      continue;
    }
    summary.answerable_rows += 1;
    const conservative = abstentionTarget("Conservative abstention despite sufficient evidence.");
    dpo.push(dpoRow(row, split, target, conservative, "prefer_supported_answer_over_conservative_abstention"));
    summary.answer_over_abstain_contrasts += 1;
    const wrongEvidence = unsupportedEvidenceAnswer(row);
    if (wrongEvidence) {
      dpo.push(dpoRow(row, split, target, wrongEvidence, "prefer_supported_answer_over_wrong_evidence_answer"));
      summary.supported_over_unsupported_evidence_contrasts += 1;
    }
  }
  summary.dpo_rows = dpo.length;
  return { sft, dpo, summary };
}

function dpoRow(row, split, chosen, rejected, contrastType) {
  return {
    example_id: `${row.example_id}:generation-gap:${split}:${contrastType}`,
    task: "citation_grounded_domain_qa_generation_gap_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: row.input,
    label_source: labelSource(row, split, contrastType),
  };
}

function summarizeFinalGaps(finalRows, gapRows) {
  const gapById = new Map(gapRows.map((row) => [row.example_id, row]));
  const answerable = finalRows.filter((row) => row.output.answer_type === "grounded_answer");
  const abstain = finalRows.filter((row) => row.output.answer_type === "abstain");
  const counterfactual = finalRows.filter((row) => row.input.document_metadata?.counterfactual === true || row.example_id.includes(":counterfactual-insufficient"));
  return {
    final_gap_rows: finalRows.length,
    answerable_rows: answerable.length,
    abstention_rows: abstain.length,
    counterfactual_abstention_rows: counterfactual.length,
    noncounterfactual_abstention_rows: abstain.length - counterfactual.length,
    rows_with_supported_abstention_candidate: finalRows.filter((row) => (gapById.get(row.example_id)?.candidate_landscape?.supported_abstention_candidates ?? 0) > 0).length,
    rows_with_unsupported_answer_candidates: finalRows.filter((row) => (gapById.get(row.example_id)?.candidate_landscape?.unsupported_answer_candidates ?? 0) > 0).length,
    paper_ids: [...new Set(finalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean))].sort(),
  };
}

function deriveStatus(gapSummary, trainPacket, validationPacket) {
  if (gapSummary.final_gap_rows !== 10) return "unexpected_gap_count_check_inputs";
  if (gapSummary.answerable_rows < 6 || gapSummary.abstention_rows < 2) return "gap_packet_missing_required_failure_mix";
  if (trainPacket.summary.answerable_rows < 100 || validationPacket.summary.answerable_rows < 30) return "nonfinal_training_packet_too_small";
  return "ready_for_generation_gap_preflight";
}

function evalPromptRow(row) {
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_generation_gap_eval_prompt",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row) },
    ],
    input: row.input,
    metadata: {
      final_gap_source: "d320_candidate_generation_gap",
      diagnostic_target_available_separately: true,
    },
  };
}

function evalTargetRow(row) {
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_generation_gap_eval_target_diagnostic_only",
    target: referenceTarget(row),
    reference_output: row.output,
    leakage_use: "diagnostic_only_not_training",
  };
}

function referenceTarget(row) {
  if (row.output.answer_type === "abstain") return abstentionTarget(row.output.abstention_reason ?? "Evidence is insufficient.");
  return {
    answer_type: "grounded_answer",
    answer: row.output.answer,
    citations: (row.output.citations ?? []).map((citation) => citation.evidence_id ?? citation),
    claim_table: row.output.claim_table ?? [],
    abstention_reason: null,
  };
}

function abstentionTarget(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason,
  };
}

function plausibleUnsupportedAnswer(row) {
  const evidence = row.input.compact_retrieved_evidence_pack?.[0];
  if (!evidence) return null;
  const sentence = firstSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer: `${sentence} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    claim_table: [{ claim: sentence, support: "plausible_but_not_sufficient", citations: [evidence.evidence_id] }],
    abstention_reason: null,
  };
}

function unsupportedEvidenceAnswer(row) {
  const goldIds = new Set((row.output.citations ?? []).map((citation) => citation.evidence_id ?? citation));
  const evidence = (row.input.compact_retrieved_evidence_pack ?? []).find((item) => !goldIds.has(item.evidence_id));
  if (!evidence) return null;
  const sentence = firstSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer: `${sentence} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    claim_table: [{ claim: sentence, support: "wrong_evidence", citations: [evidence.evidence_id] }],
    abstention_reason: null,
  };
}

function systemPrompt() {
  return "You answer domain questions only from the provided evidence pack. Produce compact JSON with answer_type, answer, citations, claim_table, and abstention_reason. Use inline citations like [E2] for every factual claim. Abstain when the evidence is insufficient.";
}

function userPrompt(row) {
  const evidence = (row.input.compact_retrieved_evidence_pack ?? [])
    .map((item) => `[${item.evidence_id}] ${item.section ?? "Evidence"}: ${item.text}`)
    .join("\n\n");
  const metadata = row.input.document_metadata ?? {};
  return `Question: ${row.input.question}

Document metadata:
- paper_id: ${metadata.paper_id}
- title: ${metadata.title}
- inferred_publication_date: ${metadata.inferred_publication_date}
- knowledge_base_version: ${metadata.knowledge_base_version}

Evidence pack:
${evidence}

Return only JSON.`;
}

function labelSource(row, split, type) {
  return {
    type,
    split,
    source: "nonfinal_reference_distillation_label",
    paper_id: row.input.document_metadata?.paper_id,
    answer_type: row.output.answer_type,
  };
}

function emptySummary(sourceRows) {
  return {
    source_rows: sourceRows,
    sft_rows: 0,
    dpo_rows: 0,
    answerable_rows: 0,
    abstention_rows: 0,
    answer_over_abstain_contrasts: 0,
    abstention_over_unsupported_contrasts: 0,
    supported_over_unsupported_evidence_contrasts: 0,
  };
}

function renderReadme(result) {
  return `# Generation Gap Curriculum Packet

This dataset targets D320 final rows where the current candidate pool lacks a supported answer candidate.

- Train SFT rows: ${result.examples.sft_train}
- Train DPO rows: ${result.examples.dpo_train}
- Validation SFT rows: ${result.examples.sft_validation}
- Validation DPO rows: ${result.examples.dpo_validation}
- Final diagnostic eval prompts: ${result.examples.eval_prompts}

Final eval targets are diagnostic-only and must not be used for training or model selection.
`;
}

function renderReport(result) {
  return `# Generation Gap Curriculum Packet

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## D320 Gap Mix

| Final gap rows | Answerable | Abstention | Counterfactual abstention | Supported-abstention candidate present |
| ---: | ---: | ---: | ---: | ---: |
| ${result.final_gap_summary.final_gap_rows} | ${result.final_gap_summary.answerable_rows} | ${result.final_gap_summary.abstention_rows} | ${result.final_gap_summary.counterfactual_abstention_rows} | ${result.final_gap_summary.rows_with_supported_abstention_candidate} |

## Packet Counts

| Split | SFT | DPO | Answerable | Abstention | Answer over abstain | Abstention over unsupported | Supported over wrong evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} | ${result.train_counts.answerable_rows} | ${result.train_counts.abstention_rows} | ${result.train_counts.answer_over_abstain_contrasts} | ${result.train_counts.abstention_over_unsupported_contrasts} | ${result.train_counts.supported_over_unsupported_evidence_contrasts} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} | ${result.validation_counts.answerable_rows} | ${result.validation_counts.abstention_rows} | ${result.validation_counts.answer_over_abstain_contrasts} | ${result.validation_counts.abstention_over_unsupported_contrasts} | ${result.validation_counts.supported_over_unsupported_evidence_contrasts} |

## Decision

- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Use packet for next bounded generator run: ${result.decision.use_packet_for_next_bounded_generator_run ? "yes" : "no"}
- Keep final gap targets diagnostic-only: ${result.decision.keep_final_gap_targets_diagnostic_only ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function normalizeExample(row) {
  return row;
}

function firstSentence(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/)[0]?.trim().slice(0, 240) || "The evidence discusses related context.";
}

function rel(file) {
  return path.relative(rootDir, file);
}

function numberArg(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
