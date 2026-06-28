import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-answer-completion-repair-curriculum-v10";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const trainStart = numberArg(args["train-start"], 0);
const trainEnd = numberArg(args["train-end"], 240);
const validationStart = numberArg(args["validation-start"], 240);
const validationEnd = numberArg(args["validation-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const launchTemplateRunId = args["launch-template-run-id"] ?? "joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-answer-completion-repair-smoke-eval-v10";
const gapAuditRunId = args["gap-audit-run-id"] ?? "qwen7b-answer-form-regression-audit-v4-v9-2026-06-28-v1";
const gateRunId = args["gate-run-id"] ?? "qwen7b-answer-form-counterfactual-gate-v9-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const rows = (await readJsonl(path.join(dataDir, dataFile))).map(toExample);
const gapAudit = JSON.parse(await fs.readFile(path.join(runsDir, gapAuditRunId, "result.json"), "utf8"));
const gateResult = JSON.parse(await fs.readFile(path.join(runsDir, gateRunId, "result.json"), "utf8"));
const oracleGapIds = new Set(gapAudit.coverage_gap_summary?.answerable_without_supported_candidate_ids ?? []);
const v9UnsupportedIds = new Set(gapAudit.answer_form_summary?.unsupported_example_ids ?? []);

const trainRows = rows.slice(trainStart, trainEnd);
const evalRows = rows.slice(evalStart, evalEnd);
const evalPapers = new Set(evalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
const validationCandidateRows = rows.slice(validationStart, validationEnd);
const validationRows = validationCandidateRows.filter((row) => !evalPapers.has(row.input.document_metadata?.paper_id));
const validationDroppedRows = validationCandidateRows.filter((row) => evalPapers.has(row.input.document_metadata?.paper_id));

const trainPacket = buildSplit(trainRows, "train");
const validationPacket = buildSplit(validationRows, "validation");
const evalPrompts = evalRows.map(evalPromptRow);
await copyLaunchArtifacts({ templateRunId: launchTemplateRunId, packetRunId: runId, smokeRunId });

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "answer_completion_repair_curriculum_packet",
  status: "ready_for_bounded_gpu_smoke_after_preflight",
  purpose: "Prepare a leakage-safe Qwen 7B packet that targets the D215/D216 failure mode: short or underspecified cited answers and missing supported candidates on final-window oracle-gap rows.",
  source_data: {
    file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: { id: `${trainStart}-${trainEnd}`, examples: trainRows.length },
    validation_window: { id: `${validationStart}-${validationEnd}`, examples: validationRows.length },
    validation_filtered_for_eval_paper_overlap: {
      candidate_examples: validationCandidateRows.length,
      dropped_examples: validationDroppedRows.length,
      dropped_paper_ids: [...new Set(validationDroppedRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean))],
    },
    eval_window: { id: `${evalStart + 1}-${evalEnd}`, examples: evalRows.length },
    launch_template_run_id: launchTemplateRunId,
    final_eval_labels_used_for_training: false,
  },
  base_model: "Qwen/Qwen2.5-7B-Instruct",
  estimated_gpu_cost_usd: 4,
  curriculum: {
    type: "answer_completion_repair_v10",
    rationale: "D215 found zero unique non-counterfactual supported coverage from v9; D216 found suppression raises support but collapses coverage. V10 adds explicit full-answer-over-short-answer contrasts while preserving abstention and span/claim construction signals.",
    system_prompt: systemPrompt(),
    train_counts: trainPacket.summary,
    validation_counts: validationPacket.summary,
    eval_prompts: evalPrompts.length,
    final_eval_targets: {
      oracle_gap_answerable_rows: oracleGapIds.size,
      v9_unsupported_answer_rows: v9UnsupportedIds.size,
      answer_completion_needed_for_70pct_query_answer_rate: 11,
    },
    leakage_guard: leakageGuard(trainRows, validationRows, evalRows),
  },
  upstream_evidence: {
    gap_audit_run_id: gapAuditRunId,
    gate_run_id: gateRunId,
    gap_status: gapAudit.status,
    gate_status: gateResult.status,
  },
  examples: {
    sft_train: trainPacket.sft.length,
    sft_validation: validationPacket.sft.length,
    dpo_train: trainPacket.dpo.length,
    dpo_validation: validationPacket.dpo.length,
    eval_prompts: evalPrompts.length,
  },
  quality_gates: {
    train_answer_completion_negatives: trainPacket.summary.dpo_answer_completion_negatives,
    validation_answer_completion_negatives: validationPacket.summary.dpo_answer_completion_negatives,
    train_question_mismatch_negatives: trainPacket.summary.dpo_question_mismatch_negatives,
    validation_question_mismatch_negatives: validationPacket.summary.dpo_question_mismatch_negatives,
    train_answer_over_abstain_contrasts: trainPacket.summary.dpo_answer_over_abstain_contrasts,
    validation_answer_over_abstain_contrasts: validationPacket.summary.dpo_answer_over_abstain_contrasts,
    train_abstention_contrasts: trainPacket.summary.dpo_abstention_contrasts,
    validation_abstention_contrasts: validationPacket.summary.dpo_abstention_contrasts,
  },
  budget: {
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Packet generation is local and deterministic. It makes no API/model calls and launches no GPU job.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
    validate_script: rel(path.join(outputDir, "validate_joint_action_dataset_uv.py")),
    train_script: rel(path.join(outputDir, "train_joint_action_lora_uv.py")),
    eval_script: rel(path.join(outputDir, "eval_joint_action_adapter_uv.py")),
    smoke_runner: rel(path.join(outputDir, "run_joint_action_smoke.sh")),
    prime_bootstrap: rel(path.join(outputDir, "run_prime_qwen3b_smoke_on_pod.sh")),
    prime_plan: rel(path.join(outputDir, "prime_gpu_plan.md")),
    result_json: rel(path.join(outputDir, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), trainPacket.sft);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), validationPacket.sft);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), trainPacket.dpo);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), validationPacket.dpo);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), evalPrompts);
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
  final_eval_targets: result.curriculum.final_eval_targets,
  budget: result.budget,
}, null, 2));

function buildSplit(examples, splitName) {
  const sft = [];
  const dpo = [];
  const summary = emptySummary(examples.length);
  for (const example of examples) {
    if (example.reference.answer_type === "abstain") {
      summary.abstention_rows += 1;
      const chosen = referenceOutput(example);
      sft.push(sftRow(example, splitName, chosen, { type: "answer_completion_abstention_sft" }));
      const rejected = plausibleAnswerFromTopEvidence(example);
      if (rejected) {
        dpo.push(dpoRow(example, splitName, chosen, rejected, { type: "prefer_abstention_over_plausible_unsupported_answer" }));
        summary.dpo_abstention_contrasts += 1;
      }
      continue;
    }

    summary.answerable_rows += 1;
    const oracle = bestGoldSpan(example);
    if (oracle.best_token_f1 >= 0.6) summary.answerable_high_oracle_rows += 1;
    else if (oracle.best_token_f1 >= 0.35) summary.answerable_partial_oracle_rows += 1;
    else summary.answerable_structured_only_rows += 1;
    const chosen = referenceOutput(example, oracle);
    sft.push(sftRow(example, splitName, chosen, {
      type: "answer_completion_supported_sft",
      answer_span: oracle,
    }));

    const shortRejected = shortAnswerOutput(example, oracle);
    if (shortRejected) {
      dpo.push(dpoRow(example, splitName, chosen, shortRejected, {
        type: "prefer_complete_answer_over_short_cited_answer",
        chosen_span: oracle,
        rejected_span: shortRejected.answer_span,
      }));
      summary.dpo_answer_completion_negatives += 1;
    }

    const wrongSpan = questionMismatchedSpan(example, oracle);
    if (wrongSpan) {
      dpo.push(dpoRow(example, splitName, chosen, outputFromSpan(example, wrongSpan), {
        type: "prefer_complete_answer_over_question_mismatched_span",
        chosen_span: oracle,
        rejected_span: wrongSpan,
      }));
      summary.dpo_question_mismatch_negatives += 1;
    }

    dpo.push(dpoRow(example, splitName, chosen, conservativeAbstention(example), {
      type: "prefer_complete_supported_answer_over_conservative_abstention",
      chosen_span: oracle,
    }));
    summary.dpo_answer_over_abstain_contrasts += 1;
  }
  summary.sft_rows = sft.length;
  summary.dpo_rows = dpo.length;
  return { sft, dpo, summary };
}

async function copyLaunchArtifacts({ templateRunId, packetRunId, smokeRunId }) {
  const templateDir = path.join(runsDir, templateRunId);
  const files = [
    "validate_joint_action_dataset_uv.py",
    "train_joint_action_lora_uv.py",
    "eval_joint_action_adapter_uv.py",
    "run_joint_action_smoke.sh",
    "run_prime_qwen3b_smoke_on_pod.sh",
    "prime_gpu_plan.md",
  ];
  for (const file of files) {
    const templatePath = path.join(templateDir, file);
    const outputPath = path.join(outputDir, file);
    let text = await fs.readFile(templatePath, "utf8");
    text = text
      .replaceAll(templateRunId, packetRunId)
      .replaceAll("joint-action-qwen7b-span-claim-construction-smoke-eval-v9", smokeRunId)
      .replaceAll("grounded-qa-span-claim-qwen7b-lora-v9", "grounded-qa-answer-completion-qwen7b-lora-v10")
      .replaceAll("qwen2_5_7b_span_claim_joint_action_lora", "qwen2_5_7b_answer_completion_joint_action_lora");
    if (file === "prime_gpu_plan.md") text = renderPrimePlan({ packetRunId, smokeRunId });
    await fs.writeFile(outputPath, text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function sftRow(example, splitName, target, labelSource) {
  return {
    example_id: `${example.example_id}:answer-completion-${splitName}`,
    task: "citation_grounded_domain_qa_answer_completion_repair_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, labelSource.answer_span ?? null) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    input: example.input,
    target,
    label_source: labelSourceBlock(example, labelSource),
  };
}

function dpoRow(example, splitName, chosen, rejected, labelSource) {
  return {
    example_id: `${example.example_id}:${labelSource.type}:${splitName}`,
    task: "citation_grounded_domain_qa_answer_completion_repair_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, labelSource.chosen_span ?? null) },
    ],
    chosen: JSON.stringify(stripTrainingOnlyFields(chosen)),
    rejected: JSON.stringify(stripTrainingOnlyFields(rejected)),
    chosen_output: stripTrainingOnlyFields(chosen),
    rejected_output: stripTrainingOnlyFields(rejected),
    input: example.input,
    label_source: labelSourceBlock(example, labelSource),
  };
}

function evalPromptRow(example) {
  return {
    example_id: example.example_id,
    task: "citation_grounded_domain_qa_answer_completion_repair_eval",
    eval_target: {
      oracle_gap_answerable_without_supported_qwen7b_candidate: oracleGapIds.has(example.example_id),
      v9_unsupported_answer: v9UnsupportedIds.has(example.example_id),
    },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, null) },
    ],
    input: example.input,
    reference: example.reference,
  };
}

function labelSourceBlock(example, labelSource) {
  return {
    ...labelSource,
    source_example_id: example.example_id,
    source_data: dataFile,
    final_window_label_used: false,
  };
}

function systemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "For grounded_answer, write a complete answer to the user's question, not a fragment, yes/no, citation-only phrase, or nearby fact.",
    "Every factual clause must be directly entailed by cited evidence, and every citation id must appear inline in the answer.",
    "If the evidence pack lacks a direct answer-bearing span or structured claim, abstain.",
  ].join(" ");
}

function userPrompt(example, answerSpan) {
  const metadata = example.input.document_metadata ?? {};
  const lines = [
    `Question: ${example.input.question}`,
    `Paper title: ${metadata.title ?? ""}`,
    `Paper id: ${metadata.paper_id ?? ""}`,
    `Date: ${metadata.inferred_publication_date ?? metadata.inferred_publication_month ?? ""}`,
    "Evidence pack:",
    ...example.input.compact_retrieved_evidence_pack.map((evidence) => `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`),
  ];
  if (answerSpan) {
    lines.push("");
    lines.push("Training hint:");
    lines.push(`Minimal answer-bearing span candidate: [${answerSpan.evidence_id}] ${answerSpan.text}`);
    lines.push("Use the hint only if it directly answers the question, and turn it into a complete answer.");
  }
  return lines.join("\n");
}

function referenceOutput(example, oracle = null) {
  if (example.reference.answer_type === "abstain") {
    return {
      answer_type: "abstain",
      answer: "",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
      abstention_reason: example.reference.abstention_reason || "Evidence is insufficient to answer the question.",
    };
  }
  const answer = ensureInlineCitations(example.reference.answer, example.reference.citations);
  return {
    answer_type: "grounded_answer",
    answer,
    citations: example.reference.citations,
    claim_table: normalizeClaimTable(example.reference, oracle),
    abstention_reason: "",
  };
}

function shortAnswerOutput(example, oracle) {
  const citation = oracle?.evidence_id ?? example.reference.citations[0];
  if (!citation) return null;
  const tokens = contentTokens(stripCitations(example.reference.answer)).slice(0, 3);
  const answer = `${tokens.length ? tokens.join(" ") : "yes"} [${citation}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [citation],
    claim_table: [{ claim: stripCitations(answer), support: "underspecified", citations: [citation] }],
    abstention_reason: "",
    answer_span: oracle ?? null,
  };
}

function outputFromSpan(example, span) {
  const answer = `${truncateAtWord(span.text, 260)} [${span.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [span.evidence_id],
    claim_table: [{ claim: stripCitations(answer), support: "selected_span", citations: [span.evidence_id] }],
    abstention_reason: "",
    answer_span: span,
  };
}

function conservativeAbstention(example) {
  return {
    answer_type: "abstain",
    answer: "",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: `Conservative abstention despite answerable evidence for ${example.example_id}.`,
  };
}

function plausibleAnswerFromTopEvidence(example) {
  const evidence = example.input.compact_retrieved_evidence_pack?.[0];
  if (!evidence) return null;
  const span = candidateSpans(evidence).find((item) => contentTokens(item.text).length >= 5);
  return span ? outputFromSpan(example, span) : null;
}

function questionMismatchedSpan(example, oracle) {
  const referenceIds = new Set(example.reference.citations);
  const candidates = example.input.compact_retrieved_evidence_pack
    .flatMap((evidence) => candidateSpans(evidence).map((span) => ({
      ...span,
      is_reference_evidence: referenceIds.has(span.evidence_id),
      answer_f1: tokenF1(span.text, example.reference.answer),
      question_overlap: overlapRate(contentTokens(example.input.question), new Set(contentTokens(`${span.section} ${span.text}`))),
    })))
    .filter((span) => span.text !== oracle?.text)
    .filter((span) => contentTokens(span.text).length >= 5)
    .sort((left, right) => {
      const leftScore = (left.is_reference_evidence ? 0.15 : 0.25) + left.question_overlap - left.answer_f1;
      const rightScore = (right.is_reference_evidence ? 0.15 : 0.25) + right.question_overlap - right.answer_f1;
      return rightScore - leftScore;
    });
  return candidates.find((span) => span.answer_f1 < 0.35) ?? candidates[0] ?? null;
}

function bestGoldSpan(example) {
  const referenceIds = new Set(example.reference.citations);
  const evidence = example.input.compact_retrieved_evidence_pack.filter((item) => referenceIds.has(item.evidence_id));
  const spans = evidence.flatMap((item) => candidateSpans(item).map((span) => ({
    ...span,
    best_token_f1: tokenF1(span.text, example.reference.answer),
  })));
  return spans.sort((left, right) => right.best_token_f1 - left.best_token_f1 || contentTokens(left.text).length - contentTokens(right.text).length)[0] ?? {
    evidence_id: example.reference.citations[0] ?? null,
    section: "",
    text: stripCitations(example.reference.answer),
    best_token_f1: 0,
  };
}

function candidateSpans(evidence) {
  const sentences = String(evidence.text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const spans = [];
  for (const sentence of sentences) {
    spans.push({ evidence_id: evidence.evidence_id, section: evidence.section ?? "", text: sentence });
    spans.push(...sentence.split(/,\s+(?=(?:which|where|who|and|but|with|show|showing|using|based|including|such as)\b)/i)
      .map((part) => part.trim())
      .filter((part) => contentTokens(part).length >= 4)
      .map((part) => ({ evidence_id: evidence.evidence_id, section: evidence.section ?? "", text: part })));
  }
  return uniqueBy(spans, (span) => `${span.evidence_id}:${span.text}`);
}

function toExample(row) {
  const citations = (row.output?.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id).filter(Boolean);
  return {
    example_id: row.example_id,
    input: row.input,
    reference: {
      answer_type: row.output?.answer_type === "grounded_answer" ? "grounded_answer" : "abstain",
      answer: String(row.output?.answer ?? ""),
      citations,
      claim_table: Array.isArray(row.output?.claim_table) ? row.output.claim_table : [],
      abstention_reason: row.output?.abstention_reason ?? "",
    },
  };
}

function normalizeClaimTable(reference, oracle) {
  if (Array.isArray(reference.claim_table) && reference.claim_table.length) return reference.claim_table;
  return [{
    claim: stripCitations(reference.answer),
    support: "supported",
    citations: oracle?.evidence_id ? [oracle.evidence_id] : reference.citations,
  }];
}

function stripTrainingOnlyFields(output) {
  const { answer_span: _answerSpan, ...rest } = output;
  return rest;
}

function ensureInlineCitations(answer, citations) {
  let result = String(answer ?? "").trim();
  for (const citation of citations) {
    if (!result.includes(`[${citation}]`)) result = `${result} [${citation}]`;
  }
  return result;
}

function leakageGuard(trainRows, validationRows, evalRows) {
  const trainPapers = new Set(trainRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
  const validationPapers = new Set(validationRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
  const evalPapers = new Set(evalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
  return {
    train_eval_paper_overlap: intersection(trainPapers, evalPapers),
    validation_eval_paper_overlap: intersection(validationPapers, evalPapers),
    final_eval_labels_used_for_training: false,
    eval_examples: evalRows.length,
  };
}

function emptySummary(sourceRows) {
  return {
    source_rows: sourceRows,
    answerable_rows: 0,
    abstention_rows: 0,
    answerable_high_oracle_rows: 0,
    answerable_partial_oracle_rows: 0,
    answerable_structured_only_rows: 0,
    dpo_answer_completion_negatives: 0,
    dpo_question_mismatch_negatives: 0,
    dpo_answer_over_abstain_contrasts: 0,
    dpo_abstention_contrasts: 0,
    sft_rows: 0,
    dpo_rows: 0,
  };
}

function renderDatasetReadme(result) {
  return `# Answer-Completion Repair Curriculum Packet

This packet targets the D215/D216 Qwen 7B failure mode: short, underspecified, or counterfactual answers and missing supported candidates.

- Train window: \`${result.source_data.train_window.id}\`
- Validation window: \`${result.source_data.validation_window.id}\`
- Eval window: \`${result.source_data.eval_window.id}\`
- SFT train rows: ${result.examples.sft_train}
- DPO train rows: ${result.examples.dpo_train}
- Answer-completion DPO negatives: ${result.quality_gates.train_answer_completion_negatives}
- Final oracle-gap eval targets: ${result.curriculum.final_eval_targets.oracle_gap_answerable_rows}
- OpenAI calls: ${result.budget.openai_calls}
- External compute cost: $${result.budget.external_compute_cost_usd.toFixed(2)}

Final eval labels are not used for training.
`;
}

function renderPrimePlan({ packetRunId, smokeRunId }) {
  return `# Prime GPU Plan

Run fresh no-spend checks immediately before launch:

\`\`\`bash
prime --plain whoami
prime --plain wallet
prime --plain pods list --output json
\`\`\`

Budget guardrail:

- Total project budget cap: $100
- Current tracked spend before this packet's launch: $10.5846081
- Estimated bounded GPU smoke cost for this run: $4.00
- Ledger actual spend in \`docs/experiments/grounded-qa-distillation/spend/ledger.jsonl\` after launch/termination.

Launch command:

\`\`\`bash
RUN_ID=${smokeRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${packetRunId}/run_joint_action_smoke.sh
\`\`\`

Do not start the pod if active pods are nonzero, live pricing is unavailable, or projected total spend would exceed the remaining experiment budget.
`;
}

function renderReport(result) {
  return `# Answer-Completion Repair Curriculum Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Purpose

${result.purpose}

## Counts

| Split | SFT rows | DPO rows | Answerable | Abstention | Completion negatives |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} | ${result.curriculum.train_counts.answerable_rows} | ${result.curriculum.train_counts.abstention_rows} | ${result.curriculum.train_counts.dpo_answer_completion_negatives} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} | ${result.curriculum.validation_counts.answerable_rows} | ${result.curriculum.validation_counts.abstention_rows} | ${result.curriculum.validation_counts.dpo_answer_completion_negatives} |
| Eval | ${result.examples.eval_prompts} | n/a | n/a | n/a | n/a |

## Final Eval Targets

| Oracle-gap answerable rows | V9 unsupported answer rows | Needed supported answers for 70% query answer rate |
| ---: | ---: | ---: |
| ${result.curriculum.final_eval_targets.oracle_gap_answerable_rows} | ${result.curriculum.final_eval_targets.v9_unsupported_answer_rows} | ${result.curriculum.final_eval_targets.answer_completion_needed_for_70pct_query_answer_rate} |

## Leakage Guard

| Check | Value |
| --- | --- |
| Train/eval paper overlap | ${result.curriculum.leakage_guard.train_eval_paper_overlap.length} |
| Validation/eval paper overlap | ${result.curriculum.leakage_guard.validation_eval_paper_overlap.length} |
| Final eval labels used for training | ${result.curriculum.leakage_guard.final_eval_labels_used_for_training ? "yes" : "no"} |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(stripCitations(reference));
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = countsMap(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "they", "them", "there", "than", "then", "also", "any"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function truncateAtWord(value, maxChars) {
  const text = String(value).trim();
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  return `${truncated.slice(0, Math.max(0, truncated.lastIndexOf(" "))).trim()}...`;
}

function overlapRate(tokens, candidateSet) {
  const unique = [...new Set(tokens)];
  if (!unique.length) return 0;
  return unique.filter((token) => candidateSet.has(token)).length / unique.length;
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function countsMap(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected integer argument, got ${value}`);
  return parsed;
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
