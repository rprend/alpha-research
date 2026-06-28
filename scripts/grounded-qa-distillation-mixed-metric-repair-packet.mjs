import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-v11";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const trainStart = numberArg(args["train-start"], 0);
const trainEnd = numberArg(args["train-end"], 240);
const validationStart = numberArg(args["validation-start"], 240);
const validationEnd = numberArg(args["validation-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const launchTemplateRunId = args["launch-template-run-id"] ?? "joint-action-gpu-prep-qwen7b-answer-completion-repair-curriculum-v10";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11";
const oracleGapRunId = args["oracle-gap-run-id"] ?? "oracle-gap-repair-audit-qwen7b-v4-v10-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const rows = (await readJsonl(path.join(dataDir, dataFile))).map(toExample);
const oracleGap = await readJson(path.join(runsDir, oracleGapRunId, "result.json"));
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
  artifact_type: "mixed_metric_repair_curriculum_packet",
  status: "ready_for_bounded_gpu_smoke_after_preflight",
  purpose: "Prepare a leakage-safe Qwen 7B packet for the D220 residual gap: table/metric/numeric extraction, exact cited span copying, and multi-evidence claim planning.",
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
    final_eval_labels_used_for_training: false,
    launch_template_run_id: launchTemplateRunId,
  },
  base_model: "Qwen/Qwen2.5-7B-Instruct",
  estimated_gpu_cost_usd: 4,
  curriculum: {
    type: "mixed_metric_repair_v11",
    rationale: "D220 found the remaining Qwen 7B oracle-gap rows are dominated by table/metric/numeric answers and multi-evidence composition, so v11 teaches exact metric copying and cited claim planning rather than generic answer completion.",
    system_prompt: systemPrompt(),
    train_counts: trainPacket.summary,
    validation_counts: validationPacket.summary,
    eval_prompts: evalPrompts.length,
    final_eval_diagnostic_targets: {
      oracle_gap_run_id: oracleGapRunId,
      oracle_gap_examples: Number(oracleGap.summary?.examples ?? 0),
      oracle_gap_table_metric_rows: Number(oracleGap.summary?.bucket_counts?.table_metric_or_numeric_answer ?? 0),
      oracle_gap_multi_evidence_rows: Number(oracleGap.summary?.bucket_counts?.multi_evidence_reference_answer ?? 0),
      final_eval_labels_used_for_training: false,
    },
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
    train_metric_or_numeric_sft_rows: trainPacket.summary.metric_or_numeric_sft_rows,
    validation_metric_or_numeric_sft_rows: validationPacket.summary.metric_or_numeric_sft_rows,
    train_metric_span_negatives: trainPacket.summary.dpo_metric_span_negatives,
    validation_metric_span_negatives: validationPacket.summary.dpo_metric_span_negatives,
    train_incomplete_metric_negatives: trainPacket.summary.dpo_incomplete_metric_negatives,
    validation_incomplete_metric_negatives: validationPacket.summary.dpo_incomplete_metric_negatives,
    train_multi_evidence_negatives: trainPacket.summary.dpo_multi_evidence_negatives,
    validation_multi_evidence_negatives: validationPacket.summary.dpo_multi_evidence_negatives,
    train_abstention_contrasts: trainPacket.summary.dpo_abstention_contrasts,
    validation_abstention_contrasts: validationPacket.summary.dpo_abstention_contrasts,
  },
  upstream_evidence: {
    oracle_gap_run_id: oracleGapRunId,
    oracle_gap_status: oracleGap.status,
    oracle_gap_summary: oracleGap.summary,
  },
  budget: {
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Packet generation is deterministic and local. It makes no API/model calls and launches no GPU job.",
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
  final_eval_diagnostic_targets: result.curriculum.final_eval_diagnostic_targets,
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
      sft.push(sftRow(example, splitName, chosen, { type: "mixed_metric_abstention_sft" }));
      const rejected = plausibleAnswerFromTopEvidence(example);
      if (rejected) {
        dpo.push(dpoRow(example, splitName, chosen, rejected, { type: "prefer_abstention_over_metric_like_unsupported_answer" }));
        summary.dpo_abstention_contrasts += 1;
      }
      continue;
    }

    summary.answerable_rows += 1;
    const profile = exampleProfile(example);
    const oracle = bestGoldSpan(example);
    const chosen = referenceOutput(example, oracle);
    sft.push(sftRow(example, splitName, chosen, { type: "mixed_metric_supported_sft", answer_profile: profile, answer_span: oracle }));
    if (profile.metricOrNumeric) summary.metric_or_numeric_sft_rows += 1;
    if (profile.multiEvidence) summary.multi_evidence_sft_rows += 1;

    const wrongMetric = wrongMetricSpanOutput(example, oracle);
    if (wrongMetric) {
      dpo.push(dpoRow(example, splitName, chosen, wrongMetric, { type: "prefer_supported_answer_over_wrong_metric_span", chosen_span: oracle, rejected_span: wrongMetric.answer_span, answer_profile: profile }));
      summary.dpo_metric_span_negatives += 1;
    }

    const incompleteMetric = incompleteMetricOutput(example, oracle);
    if (incompleteMetric) {
      dpo.push(dpoRow(example, splitName, chosen, incompleteMetric, { type: "prefer_complete_metric_answer_over_incomplete_metric_fragment", chosen_span: oracle, rejected_span: incompleteMetric.answer_span, answer_profile: profile }));
      summary.dpo_incomplete_metric_negatives += 1;
    }

    const singleEvidence = singleEvidenceOnlyOutput(example, oracle);
    if (singleEvidence) {
      dpo.push(dpoRow(example, splitName, chosen, singleEvidence, { type: "prefer_multi_evidence_answer_over_single_evidence_fragment", chosen_span: oracle, rejected_span: singleEvidence.answer_span, answer_profile: profile }));
      summary.dpo_multi_evidence_negatives += 1;
    }

    dpo.push(dpoRow(example, splitName, chosen, conservativeAbstention(example), { type: "prefer_supported_metric_answer_over_conservative_abstention", chosen_span: oracle, answer_profile: profile }));
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
    let text = await fs.readFile(path.join(templateDir, file), "utf8");
    text = text
      .replaceAll(templateRunId, packetRunId)
      .replaceAll("joint-action-qwen7b-answer-completion-repair-smoke-eval-v10", smokeRunId)
      .replaceAll("grounded-qa-answer-completion-qwen7b-lora-v10", "grounded-qa-mixed-metric-qwen7b-lora-v11")
      .replaceAll("qwen2_5_7b_answer_completion_joint_action_lora", "qwen2_5_7b_mixed_metric_joint_action_lora");
    if (file === "prime_gpu_plan.md") text = renderPrimePlan({ packetRunId, smokeRunId });
    await fs.writeFile(path.join(outputDir, file), text);
  }
  for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
    await fs.chmod(path.join(outputDir, file), 0o755);
  }
}

function sftRow(example, splitName, target, labelSource) {
  return {
    example_id: `${example.example_id}:mixed-metric-${splitName}`,
    task: "citation_grounded_domain_qa_mixed_metric_repair_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, labelSource.answer_span ?? null, labelSource.answer_profile ?? null) },
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
    task: "citation_grounded_domain_qa_mixed_metric_repair_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, labelSource.chosen_span ?? null, labelSource.answer_profile ?? null) },
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
    task: "citation_grounded_domain_qa_mixed_metric_repair_eval",
    eval_target: {
      diagnostic_only_oracle_gap: oracleGap.rows?.some((row) => row.example_id === example.example_id) ?? false,
      diagnostic_only_table_metric: oracleGap.rows?.some((row) => row.example_id === example.example_id && row.buckets?.includes("table_metric_or_numeric_answer")) ?? false,
      diagnostic_only_multi_evidence: oracleGap.rows?.some((row) => row.example_id === example.example_id && row.buckets?.includes("multi_evidence_reference_answer")) ?? false,
    },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, null, null) },
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
    "For grounded_answer, copy exact numeric, table, metric, or model-comparison facts from evidence instead of paraphrasing unsupported values.",
    "For multi-evidence answers, create separate claim_table rows and cite each factual clause inline.",
    "If the evidence pack lacks the needed metric, table value, or cited claim composition, abstain.",
  ].join(" ");
}

function userPrompt(example, answerSpan, profile) {
  const metadata = example.input.document_metadata ?? {};
  const lines = [
    `Question: ${example.input.question}`,
    `Paper title: ${metadata.title ?? ""}`,
    `Paper id: ${metadata.paper_id ?? ""}`,
    `Date: ${metadata.inferred_publication_date ?? metadata.inferred_publication_month ?? ""}`,
    "Evidence pack:",
    ...example.input.compact_retrieved_evidence_pack.map((evidence) => `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`),
  ];
  if (profile?.metricOrNumeric) lines.push("Training hint: this question requires exact table/metric/numeric extraction.");
  if (profile?.multiEvidence) lines.push("Training hint: this answer needs multiple cited claims, not a single evidence fragment.");
  if (answerSpan?.text) lines.push(`Training hint: answer-bearing span candidate: [${answerSpan.evidence_id}] ${answerSpan.text}`);
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

function wrongMetricSpanOutput(example, oracle) {
  const referenceIds = new Set(example.reference.citations);
  const spans = example.input.compact_retrieved_evidence_pack
    .flatMap((evidence) => candidateSpans(evidence).map((span) => ({
      ...span,
      reference_evidence: referenceIds.has(span.evidence_id),
      answer_f1: tokenF1(span.text, example.reference.answer),
      numeric: hasNumericOrMetric(span.text),
    })))
    .filter((span) => span.numeric)
    .filter((span) => span.text !== oracle?.text)
    .sort((left, right) => {
      const leftScore = (left.reference_evidence ? 0.1 : 0.3) + (1 - left.answer_f1);
      const rightScore = (right.reference_evidence ? 0.1 : 0.3) + (1 - right.answer_f1);
      return rightScore - leftScore;
    });
  return spans[0] ? outputFromSpan(spans[0], "wrong_metric_or_nearby_table_value") : null;
}

function incompleteMetricOutput(example, oracle) {
  const citation = oracle?.evidence_id ?? example.reference.citations[0];
  if (!citation) return null;
  const metricTokens = contentTokens(stripCitations(example.reference.answer)).filter((token) => /\d|%|f1|score|accuracy|bleu|rouge|baseline|model/.test(token)).slice(0, 4);
  const answer = `${metricTokens.length ? metricTokens.join(" ") : contentTokens(stripCitations(example.reference.answer)).slice(0, 4).join(" ")} [${citation}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [citation],
    claim_table: [{ claim: stripCitations(answer), support: "incomplete_metric_fragment", citations: [citation] }],
    abstention_reason: "",
    answer_span: oracle ?? null,
  };
}

function singleEvidenceOnlyOutput(example, oracle) {
  if (example.reference.citations.length < 2) return null;
  const citation = example.reference.citations[0];
  const evidence = example.input.compact_retrieved_evidence_pack.find((item) => item.evidence_id === citation);
  const span = evidence ? (candidateSpans(evidence)[0] ?? { evidence_id: citation, text: evidence.text ?? "" }) : oracle;
  return span ? outputFromSpan(span, "single_evidence_fragment_for_multi_evidence_answer") : null;
}

function outputFromSpan(span, support) {
  const answer = `${truncateAtWord(span.text, 260)} [${span.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [span.evidence_id],
    claim_table: [{ claim: stripCitations(answer), support, citations: [span.evidence_id] }],
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
    abstention_reason: `Conservative abstention despite answerable metric/claim evidence for ${example.example_id}.`,
  };
}

function plausibleAnswerFromTopEvidence(example) {
  const span = example.input.compact_retrieved_evidence_pack?.flatMap(candidateSpans).find((item) => contentTokens(item.text).length >= 5);
  return span ? outputFromSpan(span, "plausible_unsupported_answer") : null;
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
  return uniqueBy(sentences.flatMap((sentence) => [
    { evidence_id: evidence.evidence_id, section: evidence.section ?? "", text: sentence },
    ...sentence.split(/,\s+(?=(?:which|where|who|and|but|with|show|showing|using|based|including|such as|respectively)\b)/i)
      .map((part) => part.trim())
      .filter((part) => contentTokens(part).length >= 4)
      .map((part) => ({ evidence_id: evidence.evidence_id, section: evidence.section ?? "", text: part })),
  ]), (span) => `${span.evidence_id}:${span.text}`);
}

function exampleProfile(example) {
  const text = `${example.input.question} ${example.reference.answer} ${example.input.compact_retrieved_evidence_pack.map((item) => item.text).join(" ")}`;
  return {
    metricOrNumeric: hasNumericOrMetric(text),
    multiEvidence: example.reference.citations.length > 1,
    explanatory: /\bwhy|how|what factors|what aspects|in what way\b/i.test(example.input.question),
  };
}

function hasNumericOrMetric(value) {
  return /\d|%|\b(table|tabref|figure|fig\.|metric|score|accuracy|f1|bleu|rouge|baseline|precision|recall|percent|percentage|ratio|correlation|outperform|higher|lower)\b/i.test(String(value ?? ""));
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
  return [{ claim: stripCitations(reference.answer), support: "supported", citations: oracle?.evidence_id ? [oracle.evidence_id] : reference.citations }];
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
    metric_or_numeric_sft_rows: 0,
    multi_evidence_sft_rows: 0,
    dpo_metric_span_negatives: 0,
    dpo_incomplete_metric_negatives: 0,
    dpo_multi_evidence_negatives: 0,
    dpo_answer_over_abstain_contrasts: 0,
    dpo_abstention_contrasts: 0,
    sft_rows: 0,
    dpo_rows: 0,
  };
}

function renderDatasetReadme(result) {
  return `# Mixed Metric Repair Curriculum Packet

This packet targets D220: table/metric/numeric extraction and multi-evidence cited claim planning.

- Train window: \`${result.source_data.train_window.id}\`
- Validation window: \`${result.source_data.validation_window.id}\`
- Eval window: \`${result.source_data.eval_window.id}\`
- SFT train rows: ${result.examples.sft_train}
- DPO train rows: ${result.examples.dpo_train}
- Metric-span DPO negatives: ${result.quality_gates.train_metric_span_negatives}
- Incomplete metric DPO negatives: ${result.quality_gates.train_incomplete_metric_negatives}
- Multi-evidence DPO negatives: ${result.quality_gates.train_multi_evidence_negatives}
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
- Current tracked spend before this packet's launch: $10.8938081
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
  return `# Mixed Metric Repair Curriculum Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Purpose

${result.purpose}

## Counts

| Split | SFT rows | DPO rows | Metric/numeric SFT | Multi-evidence SFT | Metric-span negatives | Incomplete metric negatives | Multi-evidence negatives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} | ${result.curriculum.train_counts.metric_or_numeric_sft_rows} | ${result.curriculum.train_counts.multi_evidence_sft_rows} | ${result.curriculum.train_counts.dpo_metric_span_negatives} | ${result.curriculum.train_counts.dpo_incomplete_metric_negatives} | ${result.curriculum.train_counts.dpo_multi_evidence_negatives} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} | ${result.curriculum.validation_counts.metric_or_numeric_sft_rows} | ${result.curriculum.validation_counts.multi_evidence_sft_rows} | ${result.curriculum.validation_counts.dpo_metric_span_negatives} | ${result.curriculum.validation_counts.dpo_incomplete_metric_negatives} | ${result.curriculum.validation_counts.dpo_multi_evidence_negatives} |
| Eval | ${result.examples.eval_prompts} | n/a | n/a | n/a | n/a | n/a | n/a |

## D220 Diagnostic Link

| Oracle-gap examples | Table/metric rows | Multi-evidence rows | Final labels used for training |
| ---: | ---: | ---: | --- |
| ${result.curriculum.final_eval_diagnostic_targets.oracle_gap_examples} | ${result.curriculum.final_eval_diagnostic_targets.oracle_gap_table_metric_rows} | ${result.curriculum.final_eval_diagnostic_targets.oracle_gap_multi_evidence_rows} | ${result.curriculum.final_eval_diagnostic_targets.final_eval_labels_used_for_training ? "yes" : "no"} |

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
  return String(value).toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.%+-]+/).filter((token) => token.length > 1 && !stop.has(token));
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

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected integer argument, got ${value}`);
  return parsed;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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
