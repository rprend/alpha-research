import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const trainStart = numberArg(args["train-start"], 0);
const trainEnd = numberArg(args["train-end"], 240);
const validationStart = numberArg(args["validation-start"], 240);
const validationEnd = numberArg(args["validation-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const launchTemplateRunId = args["launch-template-run-id"] ?? "joint-action-gpu-prep-qwen7b-repair-regeneration-focused-curriculum-v8";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-span-claim-construction-smoke-eval-v9";
const outputDir = path.join(runDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const rows = (await readJsonl(path.join(dataDir, dataFile))).map(toExample);
const trainRows = rows.slice(trainStart, trainEnd);
const evalRows = rows.slice(evalStart, evalEnd);
const evalPapers = new Set(evalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
const validationCandidateRows = rows.slice(validationStart, validationEnd);
const validationRows = validationCandidateRows.filter((row) => !evalPapers.has(row.input.document_metadata?.paper_id));
const validationDroppedRows = validationCandidateRows.filter((row) => evalPapers.has(row.input.document_metadata?.paper_id));

const trainPacket = buildSplit(trainRows, "train");
const validationPacket = buildSplit(validationRows, "validation");
const evalPrompts = evalRows.map(evalPromptRow);

await copyLaunchArtifacts({
  templateRunId: launchTemplateRunId,
  packetRunId: runId,
  smokeRunId,
});

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "span_claim_construction_curriculum_packet",
  status: "ready_for_bounded_gpu_smoke_after_preflight",
  purpose: "Prepare a leakage-safe post-training packet that directly targets D210 answer-span and structured-claim construction failures.",
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
    type: "question_conditioned_span_claim_construction_v9",
    rationale: "D210 showed evidence-id selection alone is too weak: many failures select a reference citation but choose a question-mismatched span. This packet teaches minimal answer-bearing spans and structured claim construction from gold evidence, with DPO negatives that cite plausible but wrong spans.",
    system_prompt: systemPrompt(),
    train_counts: trainPacket.summary,
    validation_counts: validationPacket.summary,
    eval_prompts: evalPrompts.length,
    leakage_guard: leakageGuard(trainRows, validationRows, evalRows),
  },
  examples: {
    sft_train: trainPacket.sft.length,
    sft_validation: validationPacket.sft.length,
    dpo_train: trainPacket.dpo.length,
    dpo_validation: validationPacket.dpo.length,
    eval_prompts: evalPrompts.length,
  },
  quality_gates: {
    train_answerable_high_oracle_rate: ratio(trainPacket.summary.answerable_high_oracle_rows, trainPacket.summary.answerable_rows),
    validation_answerable_high_oracle_rate: ratio(validationPacket.summary.answerable_high_oracle_rows, validationPacket.summary.answerable_rows),
    train_dpo_question_mismatch_negatives: trainPacket.summary.dpo_question_mismatch_negatives,
    validation_dpo_question_mismatch_negatives: validationPacket.summary.dpo_question_mismatch_negatives,
    train_dpo_abstention_contrasts: trainPacket.summary.dpo_abstention_contrasts,
    validation_dpo_abstention_contrasts: validationPacket.summary.dpo_abstention_contrasts,
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
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  examples: result.examples,
  quality_gates: result.quality_gates,
  budget: result.budget,
}, null, 2));

function buildSplit(examples, splitName) {
  const sft = [];
  const dpo = [];
  const summary = emptySummary(examples.length);
  for (const example of examples) {
    if (example.reference.answer_type === "abstain") {
      summary.abstention_rows += 1;
      sft.push(sftRow(example, splitName, referenceOutput(example), {
        type: "span_claim_abstention_sft",
        answer_span: null,
      }));
      const rejected = plausibleAnswerFromTopEvidence(example);
      if (rejected) {
        dpo.push(dpoRow(example, splitName, referenceOutput(example), rejected, {
          type: "prefer_abstention_over_question_mismatched_span",
          rejected_span: rejected.answer_span,
        }));
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
      type: "span_claim_supported_answer_sft",
      answer_span: oracle,
    }));
    const wrongSpan = questionMismatchedSpan(example, oracle);
    if (wrongSpan) {
      dpo.push(dpoRow(example, splitName, chosen, outputFromSpan(example, wrongSpan), {
        type: "prefer_reference_answer_over_question_mismatched_span",
        chosen_span: oracle,
        rejected_span: wrongSpan,
      }));
      summary.dpo_question_mismatch_negatives += 1;
    }
    const conservative = conservativeAbstention(example);
    dpo.push(dpoRow(example, splitName, chosen, conservative, {
      type: "prefer_supported_span_claim_over_conservative_abstention",
      chosen_span: oracle,
    }));
    summary.dpo_answer_over_abstain_contrasts += 1;
  }
  summary.sft_rows = sft.length;
  summary.dpo_rows = dpo.length;
  return { sft, dpo, summary };
}

async function copyLaunchArtifacts({ templateRunId, packetRunId, smokeRunId }) {
  const templateDir = path.join(runDir, templateRunId);
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
      .replaceAll("joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8", smokeRunId)
      .replaceAll("joint-action-qwen3b-smoke-eval-v1", smokeRunId)
      .replaceAll("Joint-Action Qwen 3B Adapter Eval", "Joint-Action Qwen 7B Span/Claim Adapter Eval")
      .replaceAll("qwen2_5_3b_joint_action_lora", "qwen2_5_7b_span_claim_joint_action_lora")
      .replaceAll("grounded-qa-joint-action-qwen3b-lora-v1", "grounded-qa-span-claim-qwen7b-lora-v9");
    if (file === "prime_gpu_plan.md") {
      text = renderPrimePlan({ packetRunId, smokeRunId });
    }
    await fs.writeFile(outputPath, text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function sftRow(example, splitName, target, labelSource) {
  return {
    example_id: `${example.example_id}:span-claim-${splitName}`,
    task: "citation_grounded_domain_qa_span_claim_construction_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, labelSource.answer_span) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    input: example.input,
    target,
    label_source: {
      ...labelSource,
      source_example_id: example.example_id,
      source_data: dataFile,
      final_window_label_used: false,
    },
  };
}

function dpoRow(example, splitName, chosen, rejected, labelSource) {
  const cleanChosen = stripTrainingOnlyFields(chosen);
  const cleanRejected = stripTrainingOnlyFields(rejected);
  return {
    example_id: `${example.example_id}:${labelSource.type}:${splitName}`,
    task: "citation_grounded_domain_qa_span_claim_construction_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, labelSource.chosen_span ?? labelSource.answer_span ?? null) },
    ],
    chosen: JSON.stringify(cleanChosen),
    rejected: JSON.stringify(cleanRejected),
    chosen_output: cleanChosen,
    rejected_output: cleanRejected,
    input: example.input,
    label_source: {
      ...labelSource,
      source_example_id: example.example_id,
      source_data: dataFile,
      final_window_label_used: false,
    },
  };
}

function evalPromptRow(example) {
  return {
    example_id: example.example_id,
    task: "citation_grounded_domain_qa_span_claim_construction_eval",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, null) },
    ],
    input: example.input,
    reference: example.reference,
  };
}

function systemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "First identify the minimal evidence span that directly answers the question.",
    "For grounded_answer, answer only the asked question; do not emit nearby but question-mismatched facts.",
    "Every factual claim must be directly entailed by cited evidence and every citation id must appear inline in the answer.",
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
    lines.push("Use the hint only if it directly answers the question; otherwise abstain.");
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

function outputFromSpan(example, span) {
  const answer = `${truncateAtWord(span.text, 260)} [${span.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [span.evidence_id],
    claim_table: [{ claim: stripCitations(answer), support: "selected_span", citations: [span.evidence_id] }],
    abstention_reason: "",
    answer_span: {
      evidence_id: span.evidence_id,
      text: span.text,
      token_f1_against_reference: tokenF1(span.text, example.reference.answer),
    },
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
  const best = spans.sort((left, right) => right.best_token_f1 - left.best_token_f1 || contentTokens(left.text).length - contentTokens(right.text).length)[0];
  return best ?? {
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
    citations: reference.citations,
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
    dpo_question_mismatch_negatives: 0,
    dpo_answer_over_abstain_contrasts: 0,
    dpo_abstention_contrasts: 0,
    sft_rows: 0,
    dpo_rows: 0,
  };
}

function renderDatasetReadme(result) {
  return `# Span/Claim Construction Curriculum Packet

This packet targets answer-span and structured-claim construction failures diagnosed in D210.

- Train window: \`${result.source_data.train_window.id}\`
- Validation window: \`${result.source_data.validation_window.id}\`
- Eval window: \`${result.source_data.eval_window.id}\`
- SFT train rows: ${result.examples.sft_train}
- DPO train rows: ${result.examples.dpo_train}
- OpenAI calls: ${result.budget.openai_calls}
- External compute cost: $${result.budget.external_compute_cost_usd.toFixed(2)}

Final eval labels are not used for training.
`;
}

function renderPrimePlan({ packetRunId, smokeRunId }) {
  return `# Prime GPU Plan

Prime CLI is authenticated locally, but do a fresh no-spend check immediately before launch:

\`\`\`bash
prime --plain whoami
prime --plain wallet
prime --plain pods list --output json
\`\`\`

Budget guardrail:

- Total project budget cap: $100
- Current tracked spend before this packet's launch: $10.2036706
- Estimated bounded GPU smoke cost for this run: $4.00
- Prime wallet balance observed before packet prep: $47.02
- Ledger actual spend in \`docs/experiments/grounded-qa-distillation/spend/ledger.jsonl\` after launch/termination.

Recommended hardware: one A6000/RTX6000Ada-class 48GB GPU for \`Qwen/Qwen2.5-7B-Instruct\`.

Launch command:

\`\`\`bash
RUN_ID=${smokeRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${packetRunId}/run_joint_action_smoke.sh
\`\`\`

The smoke runner validates the dataset, trains the bounded SFT/DPO adapter, evaluates the saved DPO adapter on the unchanged 69 final-window prompts, and writes \`predictions.jsonl\`, \`result.json\`, \`report.md\`, and \`smoke_manifest.json\` under \`runs/${smokeRunId}/\`.

Do not start the pod if active pods are nonzero, live pricing is unavailable, or projected total spend would exceed the remaining experiment budget.
`;
}

function renderReport(result) {
  return `# Span/Claim Construction Curriculum Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Purpose

${result.purpose}

## Counts

| Split | SFT rows | DPO rows | Answerable | Abstention | High-oracle answer spans |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} | ${result.curriculum.train_counts.answerable_rows} | ${result.curriculum.train_counts.abstention_rows} | ${result.curriculum.train_counts.answerable_high_oracle_rows} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} | ${result.curriculum.validation_counts.answerable_rows} | ${result.curriculum.validation_counts.abstention_rows} | ${result.curriculum.validation_counts.answerable_high_oracle_rows} |
| Eval | ${result.examples.eval_prompts} | n/a | n/a | n/a | n/a |

## DPO Mix

| Split | Question-mismatch negatives | Answer-over-abstain | Abstention contrasts |
| --- | ---: | ---: | ---: |
| Train | ${result.curriculum.train_counts.dpo_question_mismatch_negatives} | ${result.curriculum.train_counts.dpo_answer_over_abstain_contrasts} | ${result.curriculum.train_counts.dpo_abstention_contrasts} |
| Validation | ${result.curriculum.validation_counts.dpo_question_mismatch_negatives} | ${result.curriculum.validation_counts.dpo_answer_over_abstain_contrasts} | ${result.curriculum.validation_counts.dpo_abstention_contrasts} |

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

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function countsMap(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
