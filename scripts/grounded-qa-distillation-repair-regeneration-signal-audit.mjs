import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "repair-regeneration-signal-audit-joint-action-qwen3b-2026-06-27-v1";
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const oracleRunId = args["oracle-run-id"] ?? "candidate-pool-oracle-final-window-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);
const datasetDir = path.join(packetDir, "dataset");

await fs.mkdir(outputDir, { recursive: true });

const packet = await readJson(path.join(packetDir, "result.json"));
const oracle = await readJson(path.join(runsDir, oracleRunId, "result.json"));
const unsupportedRepairability = await readOptionalResult("unsupported-answer-repairability-audit-final-window-2026-06-27-v1");
const datasets = {
  dpo_train: await readJsonl(path.join(datasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(datasetDir, "dpo_validation.jsonl")),
  sft_train: await readJsonl(path.join(datasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(datasetDir, "sft_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(datasetDir, "eval_prompts.jsonl")),
};

const dpoTrain = summarizeDpo(datasets.dpo_train);
const dpoValidation = summarizeDpo(datasets.dpo_validation);
const sftTrain = summarizeSft(datasets.sft_train);
const sftValidation = summarizeSft(datasets.sft_validation);
const splitIntegrity = summarizeSplitIntegrity(datasets);
const oracleGap = Number(oracle.oracle?.examples_without_supported_answer_candidate ?? 0);
const trainRepairRows = dpoTrain.repair_grounded_chosen_rows;
const allRepairRows = dpoTrain.repair_grounded_chosen_rows + dpoValidation.repair_grounded_chosen_rows;

const checks = [
  check("packet_is_joint_action_qwen3b", packetRunId === packet.run_id && packet.objective?.actions?.includes("repair_or_regenerate_when_answerable"), "Packet objective includes repair/regeneration action."),
  check("oracle_requires_repair_regeneration", oracle.training_implication?.selection_only_sufficient === false && oracleGap > 0, `Candidate-pool oracle reports ${oracleGap} examples with no supported-answer candidate.`),
  check("unsupported_answers_need_repair_regeneration", unsupportedRepairability ? unsupportedRepairability.training_implication?.citation_repair_alone_sufficient === false && unsupportedRepairability.aggregate?.answer_repair_or_regeneration_needed_rows > unsupportedRepairability.aggregate?.citation_repair_candidate_rows : true, unsupportedRepairability ? `${unsupportedRepairability.aggregate.answer_repair_or_regeneration_needed_rows} unsupported direct answers need answer repair/regeneration versus ${unsupportedRepairability.aggregate.citation_repair_candidate_rows} citation-repair candidates.` : "Unsupported-answer repairability audit not present; relying on candidate-pool oracle."),
  check("dpo_has_repair_contrasts", dpoTrain.repair_grounded_chosen_rows >= oracleGap, `${dpoTrain.repair_grounded_chosen_rows} train repair DPO rows versus ${oracleGap} oracle missing-supported-candidate examples.`),
  check("dpo_has_abstention_contrasts", dpoTrain.abstain_chosen_rows > 0 && dpoValidation.abstain_chosen_rows > 0, `${dpoTrain.abstain_chosen_rows} train and ${dpoValidation.abstain_chosen_rows} validation abstention DPO rows.`),
  check("grounded_chosen_outputs_are_cited", dpoTrain.grounded_missing_inline_citation_rows === 0 && dpoValidation.grounded_missing_inline_citation_rows === 0, "Every grounded DPO chosen output has non-empty citations and inline citation markers."),
  check("grounded_chosen_citations_in_evidence_pack", dpoTrain.invalid_citation_rows === 0 && dpoValidation.invalid_citation_rows === 0, "Every grounded DPO chosen citation id appears in its evidence pack."),
  check("repair_contrasts_are_not_identical_selection", dpoTrain.identical_answer_text_repair_rows === 0 && dpoValidation.identical_answer_text_repair_rows === 0, "No repair-labeled DPO row has identical chosen and rejected answer text."),
  check("sft_contains_joint_actions", sftTrain.repair_rows > 0 && sftTrain.abstain_rows > 0 && sftTrain.supported_answer_rows > 0, `${sftTrain.supported_answer_rows} supported-answer, ${sftTrain.repair_rows} repair, and ${sftTrain.abstain_rows} abstention SFT train rows.`),
  check("eval_is_disjoint_from_train_validation_papers", splitIntegrity.train_eval_paper_overlap.length === 0 && splitIntegrity.validation_eval_paper_overlap.length === 0, "Eval prompts are paper-disjoint from train and validation rows."),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "repair_regeneration_signal_audit",
  status: checks.every((row) => row.status === "pass") ? "repair_regeneration_signal_present_but_untested" : "repair_regeneration_signal_insufficient",
  purpose: "Check whether the Qwen 3B joint-action packet contains enough explicit repair/regeneration supervision to respond to the final-window candidate-pool oracle gap before spending GPU budget.",
  inputs: {
    packet_run_id: packetRunId,
    oracle_run_id: oracleRunId,
    split: packet.split,
    base_model: packet.base_model,
    hub_model_id: packet.hub_model_id,
  },
  oracle_gap: {
    examples: Number(oracle.oracle?.examples ?? 0),
    examples_without_supported_answer_candidate: oracleGap,
    selection_only_sufficient: oracle.training_implication?.selection_only_sufficient === true,
    implication: oracle.training_implication?.next_data_change ?? null,
  },
  unsupported_answer_repairability: unsupportedRepairability ? {
    run_id: unsupportedRepairability.run_id,
    unsupported_answer_rows: unsupportedRepairability.aggregate.unsupported_answer_rows,
    citation_repair_candidate_rows: unsupportedRepairability.aggregate.citation_repair_candidate_rows,
    answer_repair_or_regeneration_needed_rows: unsupportedRepairability.aggregate.answer_repair_or_regeneration_needed_rows,
    reference_insufficient_rows: unsupportedRepairability.aggregate.reference_insufficient_rows,
    recommendation: unsupportedRepairability.training_implication.recommendation,
  } : null,
  aggregate: {
    dpo_train: dpoTrain,
    dpo_validation: dpoValidation,
    sft_train: sftTrain,
    sft_validation: sftValidation,
    split_integrity: splitIntegrity,
  },
  checks,
  interpretation: {
    enough_signal_for_bounded_qwen_smoke: checks.every((row) => row.status === "pass"),
    train_repair_rows_vs_oracle_gap: {
      train_repair_rows: trainRepairRows,
      validation_repair_rows: dpoValidation.repair_grounded_chosen_rows,
      total_repair_rows: allRepairRows,
      oracle_gap: oracleGap,
      train_rows_cover_gap: trainRepairRows >= oracleGap,
    },
    caveat: "This audit checks label signal, final-window repairability pressure, and split integrity only. It does not prove that Qwen 3B will learn repair/regeneration or preserve grounded correctness after LoRA training.",
    next_step: checks.every((row) => row.status === "pass")
      ? "When remote auth is repaired, run the bounded Qwen 3B smoke and the paid grounded-correctness judge; do not spend budget adding selection-only routing data first."
      : "Repair the joint-action packet before launching a GPU smoke.",
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads local packet/oracle artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  oracle_gap: result.oracle_gap,
  train_repair_rows_vs_oracle_gap: result.interpretation.train_repair_rows_vs_oracle_gap,
  checks: result.checks.map(({ id, status }) => ({ id, status })),
  llm_budget: result.llm_budget,
}, null, 2));

function summarizeDpo(rows) {
  const summary = {
    rows: rows.length,
    repair_grounded_chosen_rows: 0,
    abstain_chosen_rows: 0,
    chosen_grounded_answer_rows: 0,
    chosen_abstain_rows: 0,
    rejected_grounded_answer_rows: 0,
    invalid_json_rows: 0,
    invalid_citation_rows: 0,
    grounded_missing_inline_citation_rows: 0,
    identical_answer_text_repair_rows: 0,
    label_source_counts: {},
  };

  for (const row of rows) {
    const labelType = row.label_source?.type ?? "unknown";
    summary.label_source_counts[labelType] = (summary.label_source_counts[labelType] ?? 0) + 1;
    const chosen = outputObject(row.chosen_output, row.chosen);
    const rejected = outputObject(row.rejected_output, row.rejected);
    if (!chosen || !rejected) {
      summary.invalid_json_rows += 1;
      continue;
    }
    if (chosen.answer_type === "grounded_answer") summary.chosen_grounded_answer_rows += 1;
    if (chosen.answer_type === "abstain") summary.chosen_abstain_rows += 1;
    if (rejected.answer_type === "grounded_answer") summary.rejected_grounded_answer_rows += 1;
    if (labelType === "prefer_reference_repair_over_unsupported_answer" && chosen.answer_type === "grounded_answer") {
      summary.repair_grounded_chosen_rows += 1;
      if (normalizeAnswer(chosen.answer) === normalizeAnswer(rejected.answer)) {
        summary.identical_answer_text_repair_rows += 1;
      }
    }
    if (chosen.answer_type === "abstain") summary.abstain_chosen_rows += 1;
    if (chosen.answer_type === "grounded_answer") {
      const citations = Array.isArray(chosen.citations) ? chosen.citations : [];
      const evidenceIds = evidenceIdSet(row.input?.compact_retrieved_evidence_pack);
      if (!citations.length || citations.some((citation) => !String(chosen.answer ?? "").includes(`[${citation}]`))) {
        summary.grounded_missing_inline_citation_rows += 1;
      }
      if (citations.some((citation) => !evidenceIds.has(citation))) {
        summary.invalid_citation_rows += 1;
      }
    }
  }

  summary.repair_grounded_chosen_rate = ratio(summary.repair_grounded_chosen_rows, rows.length);
  summary.abstain_chosen_rate = ratio(summary.abstain_chosen_rows, rows.length);
  return summary;
}

function summarizeSft(rows) {
  const summary = {
    rows: rows.length,
    supported_answer_rows: 0,
    repair_rows: 0,
    abstain_rows: 0,
    grounded_answer_rows: 0,
    invalid_json_rows: 0,
    invalid_citation_rows: 0,
    grounded_missing_inline_citation_rows: 0,
    label_source_counts: {},
  };
  for (const row of rows) {
    const labelType = row.label_source?.type ?? "unknown";
    summary.label_source_counts[labelType] = (summary.label_source_counts[labelType] ?? 0) + 1;
    if (labelType === "supported_answer_sft") summary.supported_answer_rows += 1;
    if (labelType === "repair_unsupported_answer_with_reference") summary.repair_rows += 1;
    if (labelType === "abstain_on_insufficient_evidence") summary.abstain_rows += 1;
    const output = outputObject(row.target, row.messages?.at(-1)?.content);
    if (!output) {
      summary.invalid_json_rows += 1;
      continue;
    }
    if (output.answer_type === "grounded_answer") {
      summary.grounded_answer_rows += 1;
      const citations = Array.isArray(output.citations) ? output.citations : [];
      const evidenceIds = evidenceIdSet(row.input?.compact_retrieved_evidence_pack);
      if (!citations.length || citations.some((citation) => !String(output.answer ?? "").includes(`[${citation}]`))) {
        summary.grounded_missing_inline_citation_rows += 1;
      }
      if (citations.some((citation) => !evidenceIds.has(citation))) {
        summary.invalid_citation_rows += 1;
      }
    }
  }
  return summary;
}

function summarizeSplitIntegrity(datasets) {
  const trainPapers = paperIds([...datasets.sft_train, ...datasets.dpo_train]);
  const validationPapers = paperIds([...datasets.sft_validation, ...datasets.dpo_validation]);
  const evalPapers = paperIds(datasets.eval_prompts);
  return {
    train_papers: trainPapers.size,
    validation_papers: validationPapers.size,
    eval_papers: evalPapers.size,
    train_validation_paper_overlap: intersection(trainPapers, validationPapers),
    train_eval_paper_overlap: intersection(trainPapers, evalPapers),
    validation_eval_paper_overlap: intersection(validationPapers, evalPapers),
  };
}

function outputObject(value, fallbackJson) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(fallbackJson);
  } catch {
    return null;
  }
}

function evidenceIdSet(pack) {
  const ids = new Set();
  for (const item of pack ?? []) {
    if (item?.evidence_id) ids.add(String(item.evidence_id));
    if (item?.id) ids.add(String(item.id));
  }
  return ids;
}

function paperIds(rows) {
  const ids = new Set();
  for (const row of rows) {
    const id = row.input?.document_metadata?.paper_id ?? row.reference?.document_metadata?.paper_id;
    if (id) ids.add(id);
  }
  return ids;
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value)).sort();
}

function normalizeAnswer(value) {
  return String(value ?? "").toLowerCase().replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
}

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * value).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Repair/Regeneration Signal Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-cost audit checks whether the Qwen 3B joint-action packet has explicit repair/regeneration supervision, not just abstention or selection pressure.

## Oracle Gap

The candidate-pool oracle found ${result.oracle_gap.examples_without_supported_answer_candidate} of ${result.oracle_gap.examples} final-window examples with no supported-answer candidate. Selection-only routing is therefore marked sufficient: \`${result.oracle_gap.selection_only_sufficient}\`.

## Signal Summary

| Split | Rows | Repair chosen | Abstain chosen | Grounded missing inline citations | Invalid citations |
| --- | ---: | ---: | ---: | ---: | ---: |
| DPO train | ${result.aggregate.dpo_train.rows} | ${result.aggregate.dpo_train.repair_grounded_chosen_rows} | ${result.aggregate.dpo_train.abstain_chosen_rows} | ${result.aggregate.dpo_train.grounded_missing_inline_citation_rows} | ${result.aggregate.dpo_train.invalid_citation_rows} |
| DPO validation | ${result.aggregate.dpo_validation.rows} | ${result.aggregate.dpo_validation.repair_grounded_chosen_rows} | ${result.aggregate.dpo_validation.abstain_chosen_rows} | ${result.aggregate.dpo_validation.grounded_missing_inline_citation_rows} | ${result.aggregate.dpo_validation.invalid_citation_rows} |

| Split | Rows | Supported-answer SFT | Repair SFT | Abstain SFT | Invalid citations |
| --- | ---: | ---: | ---: | ---: | ---: |
| SFT train | ${result.aggregate.sft_train.rows} | ${result.aggregate.sft_train.supported_answer_rows} | ${result.aggregate.sft_train.repair_rows} | ${result.aggregate.sft_train.abstain_rows} | ${result.aggregate.sft_train.invalid_citation_rows} |
| SFT validation | ${result.aggregate.sft_validation.rows} | ${result.aggregate.sft_validation.supported_answer_rows} | ${result.aggregate.sft_validation.repair_rows} | ${result.aggregate.sft_validation.abstain_rows} | ${result.aggregate.sft_validation.invalid_citation_rows} |

Train repair rows cover oracle gap: \`${result.interpretation.train_repair_rows_vs_oracle_gap.train_rows_cover_gap}\` (${result.interpretation.train_repair_rows_vs_oracle_gap.train_repair_rows} train repair rows vs. ${result.interpretation.train_repair_rows_vs_oracle_gap.oracle_gap} missing-supported-candidate examples).

${result.unsupported_answer_repairability ? `## Unsupported Direct Answer Repairability

| Unsupported direct answers | Citation-repair candidates | Answer repair/regeneration needed | Should abstain |
| ---: | ---: | ---: | ---: |
| ${result.unsupported_answer_repairability.unsupported_answer_rows} | ${result.unsupported_answer_repairability.citation_repair_candidate_rows} | ${result.unsupported_answer_repairability.answer_repair_or_regeneration_needed_rows} | ${result.unsupported_answer_repairability.reference_insufficient_rows} |

${result.unsupported_answer_repairability.recommendation}
` : ""}

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Interpretation

${result.interpretation.caveat}

Next step: ${result.interpretation.next_step}

This audit makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readOptionalResult(runId) {
  try {
    return await readJson(path.join(runsDir, runId, "result.json"));
  } catch {
    return null;
  }
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
