import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "v13-support-delta-supervision-packet-v14";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const deltaRun = args["delta-run"] ?? "v13-coverage-gap-delta-qwen-only-hybrid-2026-06-28-v1";
const trainStart = numberArg(args["train-start"], 0, { allowZero: true });
const trainEnd = numberArg(args["train-end"], 160);
const validationStart = numberArg(args["validation-start"], 160);
const validationEnd = numberArg(args["validation-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const allExamples = (await readJsonl(path.join(dataDir, dataFile))).map(toExample);
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const deltaResult = await readJson(path.join(runsDir, deltaRun, "result.json"));
const deltaRows = await readJsonl(path.join(runsDir, deltaRun, "rows.jsonl"));
const byExampleId = new Map(allExamples.map((row) => [row.example_id, row]));

const evalRows = allExamples.slice(evalStart, evalEnd);
const evalPapers = new Set(evalRows.map(paperId).filter(Boolean));
const trainRows = allExamples.slice(trainStart, trainEnd).filter((row) => !evalPapers.has(paperId(row)));
const validationRows = allExamples.slice(validationStart, validationEnd).filter((row) => !evalPapers.has(paperId(row)));
const diagnostic = buildDiagnostic(deltaRows, byExampleId);
const targetProfileCounts = profileCounts(diagnostic.rows.map((row) => row.reference_example).filter(Boolean));
const trainPacket = buildSplit(trainRows, "train", targetProfileCounts);
const validationPacket = buildSplit(validationRows, "validation", targetProfileCounts);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "v13_support_delta_supervision_packet",
  status: classifyPacket(trainPacket.summary, validationPacket.summary, diagnostic),
  purpose: "Create a leakage-safe v14 supervision packet from the v13 row-level delta: use final-window v13 outcomes only as diagnostic profile signals, then train on earlier-window analogs with strict citation-contract positives and hard negatives.",
  source_runs: {
    delta_run: deltaRun,
    v13_prediction_run: deltaResult.source_runs?.v13_prediction_run ?? null,
    v13_judge_run: deltaResult.source_runs?.v13_judge_run ?? null,
    v13_contract_audit_run: deltaResult.source_runs?.v13_contract_audit_run ?? null,
  },
  source_data: {
    file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: { id: `${trainStart}-${trainEnd}`, examples: trainRows.length },
    validation_window: { id: `${validationStart}-${validationEnd}`, examples: validationRows.length },
    eval_window: { id: `${evalStart + 1}-${evalEnd}`, examples: evalRows.length },
    final_eval_labels_used_for_training: false,
    leakage_guard: leakageGuard(trainRows, validationRows, evalRows),
  },
  diagnostic,
  target_profile_counts: targetProfileCounts,
  examples: {
    sft_train: trainPacket.sft.length,
    sft_validation: validationPacket.sft.length,
    dpo_train: trainPacket.dpo.length,
    dpo_validation: validationPacket.dpo.length,
    diagnostic_delta_rows: diagnostic.rows.length,
  },
  quality_gates: {
    train_summary: trainPacket.summary,
    validation_summary: validationPacket.summary,
    target_profile_counts: targetProfileCounts,
    min_train_per_active_profile: minActiveProfileCount(trainPacket.summary, targetProfileCounts, "sft"),
    min_validation_per_active_profile: minActiveProfileCount(validationPacket.summary, targetProfileCounts, "sft"),
  },
  decision: decisionFor(trainPacket.summary, validationPacket.summary, diagnostic),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Packet generation is local and deterministic; no model API calls and no GPU job.",
  },
  artifacts: {
    sft_train_jsonl: rel(path.join(datasetDir, "sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "dpo_validation.jsonl")),
    diagnostic_delta_rows_jsonl: rel(path.join(datasetDir, "diagnostic_delta_rows.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), trainPacket.sft);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), validationPacket.sft);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), trainPacket.dpo);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), validationPacket.dpo);
await writeJsonl(path.join(datasetDir, "diagnostic_delta_rows.jsonl"), diagnostic.rows);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  diagnostic: result.diagnostic.summary,
  quality_gates: result.quality_gates,
  decision: result.decision,
}, null, 2));

function buildDiagnostic(rows, examplesById) {
  const diagnosticRows = [];
  for (const row of rows) {
    const v13 = row.policies?.v13 ?? {};
    const include = row.v13_targeted_gap
      || (row.next_packet_positive === true)
      || (v13.answered && v13.answer_citation_complete && !v13.supported_answer);
    const positive = !row.counterfactual && v13.supported_answer && v13.answer_citation_complete;
    const hardNegative = v13.answered && v13.answer_citation_complete && !v13.supported_answer;
    const targetedFailure = row.v13_targeted_gap && !v13.supported_answer;
    if (!include && !positive && !hardNegative && !targetedFailure) continue;
    const reference = examplesById.get(row.example_id);
    diagnosticRows.push({
      example_id: row.example_id,
      role: positive ? "positive_profile" : hardNegative ? "hard_negative_profile" : targetedFailure ? "targeted_gap_failure" : "diagnostic",
      counterfactual: Boolean(row.counterfactual),
      targeted_gap: Boolean(row.v13_targeted_gap),
      v13_answered: Boolean(v13.answered),
      v13_supported_answer: Boolean(v13.supported_answer),
      v13_answer_citation_complete: Boolean(v13.answer_citation_complete),
      v13_judge_verdict: v13.judge_verdict ?? null,
      v13_failure_tags: row.v13_failure_tags ?? [],
      reference_profile: reference ? answerProfile(reference) : null,
      reference_example: reference ?? null,
      final_window_training_use: "forbidden_diagnostic_profile_only",
      answer_preview: row.v13_answer_preview ?? "",
    });
  }
  return {
    source: "v13 coverage-gap delta rows",
    rows: diagnosticRows,
    summary: {
      diagnostic_rows: diagnosticRows.length,
      positives: diagnosticRows.filter((row) => row.role === "positive_profile").length,
      hard_negatives: diagnosticRows.filter((row) => row.role === "hard_negative_profile").length,
      targeted_gap_failures: diagnosticRows.filter((row) => row.role === "targeted_gap_failure").length,
      targeted_gap_rows: diagnosticRows.filter((row) => row.targeted_gap).length,
      final_window_labels_used_for_training: false,
    },
  };
}

function buildSplit(rows, splitName, targetProfiles) {
  const sft = [];
  const dpo = [];
  const summary = emptySummary(rows.length);
  for (const row of rows) {
    const profile = answerProfile(row);
    if (!profileMatchesTarget(profile, targetProfiles)) continue;
    const chosen = strictReferenceOutput(row, profile);
    sft.push(sftRow(row, splitName, chosen, profile));
    countProfile(summary, profile, "sft");
    if (row.reference.answer_type === "abstain") {
      const overanswer = overanswerFromNearbyEvidence(row);
      if (overanswer) {
        dpo.push(dpoRow(row, splitName, chosen, overanswer, profile, "prefer_abstention_over_nearby_evidence_overanswer"));
        summary.dpo_abstention_overanswer_negatives += 1;
      }
      continue;
    }
    for (const [type, rejected] of [
      ["prefer_strict_reference_over_wrong_evidence", wrongEvidenceOutput(row, profile)],
      ["prefer_strict_reference_over_missing_citations", citationOmissionOutput(row, profile)],
      ["prefer_strict_reference_over_claim_table_gap", claimTableGapOutput(row, profile)],
      ["prefer_strict_reference_over_unsupported_task_claim", unsupportedTaskClaimOutput(row, profile)],
      ["prefer_complete_answer_over_fragment", fragmentOutput(row, profile)],
    ]) {
      if (!rejected) continue;
      dpo.push(dpoRow(row, splitName, chosen, rejected, profile, type));
      summary[`dpo_${type}`] = (summary[`dpo_${type}`] ?? 0) + 1;
    }
    if (profile.yes_no) {
      dpo.push(dpoRow(row, splitName, chosen, invertedYesNoOutput(row, profile), profile, "prefer_correct_yes_no_polarity"));
      summary.dpo_yes_no_polarity_negatives += 1;
    }
  }
  summary.sft_rows = sft.length;
  summary.dpo_rows = dpo.length;
  return { sft, dpo, summary };
}

function sftRow(row, splitName, target, profile) {
  return {
    example_id: `${row.example_id}:v13-support-delta-sft-${splitName}`,
    task: "citation_grounded_domain_qa_v13_support_delta_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row, profile) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    input: row.input,
    target,
    label_source: labelSource(row, profile, splitName, "strict_reference_sft"),
  };
}

function dpoRow(row, splitName, chosen, rejected, profile, type) {
  return {
    example_id: `${row.example_id}:v13-support-delta:${type}:${splitName}`,
    task: "citation_grounded_domain_qa_v13_support_delta_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row, profile) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: row.input,
    label_source: labelSource(row, profile, splitName, type),
  };
}

function strictReferenceOutput(row, profile) {
  if (row.reference.answer_type === "abstain") {
    return {
      answer_type: "abstain",
      answer: "",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
      abstention_reason: row.reference.abstention_reason || "Evidence is insufficient to answer the question.",
    };
  }
  const citations = [...new Set(row.reference.citations)];
  return {
    answer_type: "grounded_answer",
    answer: ensureInlineCitations(row.reference.answer, citations),
    citations,
    claim_table: normalizeClaimTable(row.reference, citations, profile),
    abstention_reason: "",
  };
}

function wrongEvidenceOutput(row, profile) {
  const wrong = firstWrongEvidence(row);
  if (!wrong || row.reference.answer_type !== "grounded_answer") return null;
  const sentence = firstUsefulSentence(wrong.text);
  return {
    answer_type: "grounded_answer",
    answer: `${truncateAtWord(sentence, 220)} [${wrong.evidence_id}]`,
    citations: [wrong.evidence_id],
    claim_table: [{ claim: stripCitations(sentence), support: `wrong_evidence_${profile.style}`, citations: [wrong.evidence_id] }],
    abstention_reason: "",
  };
}

function citationOmissionOutput(row, profile) {
  if (row.reference.answer_type !== "grounded_answer") return null;
  return {
    answer_type: "grounded_answer",
    answer: stripCitations(row.reference.answer),
    citations: [],
    claim_table: [{ claim: stripCitations(row.reference.answer), support: `missing_citation_${profile.style}`, citations: [] }],
    abstention_reason: "",
  };
}

function claimTableGapOutput(row, profile) {
  if (row.reference.answer_type !== "grounded_answer") return null;
  const citations = [...new Set(row.reference.citations)];
  return {
    answer_type: "grounded_answer",
    answer: ensureInlineCitations(row.reference.answer, citations),
    citations,
    claim_table: [],
    abstention_reason: "",
  };
}

function unsupportedTaskClaimOutput(row, profile) {
  if (row.reference.answer_type !== "grounded_answer") return null;
  const citations = [...new Set(row.reference.citations)];
  const citation = citations[0];
  if (!citation) return null;
  const base = stripCitations(row.reference.answer);
  return {
    answer_type: "grounded_answer",
    answer: `${base}. This also shows the paper's task setup outperforms competing baselines [${citation}]`,
    citations: [citation],
    claim_table: [
      { claim: base, support: `partial_${profile.style}`, citations: [citation] },
      { claim: "The task setup outperforms competing baselines.", support: "unsupported_task_or_experiment_hard_negative", citations: [citation] },
    ],
    abstention_reason: "",
  };
}

function fragmentOutput(row, profile) {
  if (row.reference.answer_type !== "grounded_answer") return null;
  const citation = row.reference.citations[0];
  if (!citation) return null;
  const tokens = contentTokens(stripCitations(row.reference.answer));
  const fragment = tokens.slice(0, Math.max(2, Math.min(5, tokens.length))).join(" ");
  return {
    answer_type: "grounded_answer",
    answer: `${fragment} [${citation}]`,
    citations: [citation],
    claim_table: [{ claim: fragment, support: `incomplete_${profile.style}`, citations: [citation] }],
    abstention_reason: "",
  };
}

function overanswerFromNearbyEvidence(row) {
  const evidence = (row.input.compact_retrieved_evidence_pack ?? [])[0];
  if (!evidence) return null;
  const sentence = firstUsefulSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer: `${truncateAtWord(sentence, 220)} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    claim_table: [{ claim: stripCitations(sentence), support: "nearby_evidence_overanswer", citations: [evidence.evidence_id] }],
    abstention_reason: "",
  };
}

function invertedYesNoOutput(row, profile) {
  const citations = [...new Set(row.reference.citations)];
  const answer = stripCitations(row.reference.answer);
  const inverted = /^yes\b/i.test(answer) ? answer.replace(/^yes\b/i, "No") : answer.replace(/^no\b/i, "Yes");
  return {
    answer_type: "grounded_answer",
    answer: ensureInlineCitations(inverted, citations),
    citations,
    claim_table: [{ claim: stripCitations(inverted), support: `wrong_polarity_${profile.style}`, citations }],
    abstention_reason: "",
  };
}

function answerProfile(row) {
  const answer = stripCitations(row.reference.answer);
  const question = row.input.question ?? "";
  const citations = row.reference.citations ?? [];
  const answerable = row.reference.answer_type === "grounded_answer";
  const yesNo = answerable && /^(yes|no)\b/i.test(answer);
  const numeric = answerable && /\d|percent|percentage|score|f1|rouge|bleu|accuracy|metric|pairs?|models?|datasets?|claims?|topics?/i.test(answer);
  const list = answerable && (answer.split(/[,;]/).length >= 3 || /\b(which|what datasets?|what metrics?|what factors?|what assumptions?|which corpora|what are|what types?)\b/i.test(question));
  const multiEvidence = answerable && citations.length >= 2;
  const abstain = !answerable;
  const style = abstain ? "abstain"
    : yesNo ? "yes_no"
      : multiEvidence ? "multi_evidence_claims"
        : list ? "list_extraction"
          : numeric ? "metric_or_count_extraction"
            : "direct_extractive_answer";
  return { answerable, abstain, yes_no: yesNo, numeric, list, multi_evidence: multiEvidence, style };
}

function profileCounts(rows) {
  const counts = emptyProfileCounts();
  for (const row of rows) countProfile(counts, answerProfile(row), "");
  return counts;
}

function profileMatchesTarget(profile, target) {
  if (profile.abstain) return target.abstain > 0 || target.targeted_gap_failures > 0;
  return (target.yes_no > 0 && profile.yes_no)
    || (target.numeric > 0 && profile.numeric)
    || (target.list > 0 && profile.list)
    || (target.multi_evidence > 0 && profile.multi_evidence)
    || (target.direct_extractive > 0 && profile.style === "direct_extractive_answer");
}

function countProfile(summary, profile, prefix) {
  const key = prefix ? `${prefix}_` : "";
  if (profile.answerable) summary[`${key}answerable`] += 1;
  if (profile.abstain) summary[`${key}abstain`] += 1;
  if (profile.yes_no) summary[`${key}yes_no`] += 1;
  if (profile.numeric) summary[`${key}numeric`] += 1;
  if (profile.list) summary[`${key}list`] += 1;
  if (profile.multi_evidence) summary[`${key}multi_evidence`] += 1;
  if (profile.style === "direct_extractive_answer") summary[`${key}direct_extractive`] += 1;
}

function normalizeClaimTable(reference, citations, profile) {
  if (Array.isArray(reference.claim_table) && reference.claim_table.length) {
    return reference.claim_table.map((claim) => ({
      claim: String(claim.claim ?? stripCitations(reference.answer)),
      support: claim.support ?? `strict_reference_${profile.style}`,
      citations: normalizeCitations(claim.citations, citations),
    }));
  }
  return [{ claim: stripCitations(reference.answer), support: `strict_reference_${profile.style}`, citations }];
}

function normalizeCitations(value, fallback) {
  if (Array.isArray(value) && value.length) return value.map(String);
  if (typeof value === "string" && value) return [value];
  return fallback;
}

function labelSource(row, profile, splitName, type) {
  return {
    type,
    split: splitName,
    source_example_id: row.example_id,
    source_data: dataFile,
    profile,
    final_window_label_used: false,
    delta_run: deltaRun,
  };
}

function userPrompt(row, profile) {
  const metadata = row.input.document_metadata ?? {};
  return [
    `Question: ${row.input.question}`,
    `Paper title: ${metadata.title ?? ""}`,
    `Paper id: ${metadata.paper_id ?? ""}`,
    `Date: ${metadata.inferred_publication_date ?? metadata.inferred_publication_month ?? ""}`,
    `Target answer style: ${profile.style}`,
    "Evidence pack:",
    ...(row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`),
  ].join("\n");
}

function systemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
    "Every factual answer clause must have an inline citation and a matching claim_table citation.",
    "If the evidence only contains nearby task or experiment context but not the requested answer, abstain.",
    "For counterfactual or insufficient-evidence packs, preserve abstention even when a cited sentence looks topically related.",
  ].join(" ");
}

function classifyPacket(train, validation, diagnostic) {
  const activeProfiles = ["yes_no", "numeric", "list", "multi_evidence", "direct_extractive"].filter((key) => diagnosticProfileHas(key, diagnostic));
  const trainReady = activeProfiles.every((key) => train[`sft_${key}`] >= 10);
  const validationReady = activeProfiles.every((key) => validation[`sft_${key}`] >= 3);
  const dpoReady = train.dpo_rows >= train.sft_rows * 2 && validation.dpo_rows >= validation.sft_rows * 2;
  if (trainReady && validationReady && dpoReady && diagnostic.summary.hard_negatives >= 10) return "ready_for_launch_packet_merge_after_validator";
  if (trainReady && validationReady && dpoReady) return "ready_but_final_hard_negative_signal_sparse";
  if (trainReady && validationReady) return "analog_coverage_ready_dpo_sparse";
  return "insufficient_analog_coverage";
}

function diagnosticProfileHas(key, diagnostic) {
  return diagnostic.rows.some((row) => row.reference_profile?.[key] || (key === "direct_extractive" && row.reference_profile?.style === "direct_extractive_answer"));
}

function decisionFor(train, validation, diagnostic) {
  const status = classifyPacket(train, validation, diagnostic);
  if (status === "ready_for_launch_packet_merge_after_validator") {
    return {
      launch_next_gpu_now: false,
      next_step: "Merge this v14 supervision packet into a bounded Qwen 7B launch packet only after adding validator coverage and running Prime/budget preflight.",
      reason: "The packet has leakage-safe train/validation analog coverage, strong DPO density, and enough v13 hard-negative signal to justify a launch-packet merge.",
    };
  }
  return {
    launch_next_gpu_now: false,
    next_step: "Do not launch; inspect sparse profiles or broaden analog mining first.",
    reason: `Packet status is ${status}.`,
  };
}

function leakageGuard(trainRows, validationRows, evalRows) {
  const trainEval = sharedPapers(trainRows, evalRows);
  const validationEval = sharedPapers(validationRows, evalRows);
  return {
    train_eval_shared_papers: trainEval,
    validation_eval_shared_papers: validationEval,
    passes: trainEval.length === 0 && validationEval.length === 0,
  };
}

function minActiveProfileCount(summary, target, prefix) {
  const values = ["yes_no", "numeric", "list", "multi_evidence", "direct_extractive"]
    .filter((key) => target[key] > 0)
    .map((key) => summary[`${prefix}_${key}`] ?? 0);
  return values.length ? Math.min(...values) : 0;
}

function emptySummary(examples) {
  return {
    examples,
    sft_rows: 0,
    dpo_rows: 0,
    dpo_abstention_overanswer_negatives: 0,
    dpo_yes_no_polarity_negatives: 0,
    ...Object.fromEntries(["sft", ""].flatMap((prefix) => {
      const key = prefix ? `${prefix}_` : "";
      return ["answerable", "abstain", "yes_no", "numeric", "list", "multi_evidence", "direct_extractive"].map((name) => [`${key}${name}`, 0]);
    })),
  };
}

function emptyProfileCounts() {
  return { answerable: 0, abstain: 0, yes_no: 0, numeric: 0, list: 0, multi_evidence: 0, direct_extractive: 0 };
}

function firstWrongEvidence(row) {
  const gold = new Set(row.reference.citations);
  return (row.input.compact_retrieved_evidence_pack ?? []).find((evidence) => !gold.has(evidence.evidence_id));
}

function toExample(row) {
  const citations = (row.output?.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id).filter(Boolean);
  return {
    example_id: row.example_id,
    input: row.input,
    teacher_trace: row.teacher_trace,
    reference: {
      answer_type: row.output?.answer_type === "grounded_answer" ? "grounded_answer" : "abstain",
      answer: String(row.output?.answer ?? ""),
      citations,
      claim_table: Array.isArray(row.output?.claim_table) ? row.output.claim_table : [],
      abstention_reason: row.output?.abstention_reason ?? "",
    },
  };
}

function ensureInlineCitations(answer, citations) {
  let output = stripCitations(answer);
  for (const id of citations) {
    if (!output.includes(`[${id}]`)) output += ` [${id}]`;
  }
  return output;
}

function firstUsefulSentence(text) {
  return splitSentences(text).find((sentence) => contentTokens(sentence).length >= 5) ?? String(text ?? "");
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
}

function stripCitations(text) {
  return String(text ?? "").replace(/\s*\[[^\]]+\]/g, "").trim();
}

function truncateAtWord(text, maxChars) {
  const value = String(text ?? "").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).replace(/\s+\S*$/, "")}...`;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? [];
}

function paperId(row) {
  return row.input.document_metadata?.paper_id;
}

function sharedPapers(leftRows, rightRows) {
  const right = new Set(rightRows.map(paperId).filter(Boolean));
  return [...new Set(leftRows.map(paperId).filter((id) => id && right.has(id)))].sort();
}

function renderDatasetReadme(result) {
  return `# V13 Support-Delta Supervision Packet

Run: \`${result.run_id}\`

This packet is deterministic and local. Final-window v13 rows are diagnostic profile sources only; all train and validation examples come from earlier windows.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} |
| Diagnostic delta rows | ${result.examples.diagnostic_delta_rows} | n/a |
`;
}

function renderReport(result) {
  return `# V13 Support-Delta Supervision Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no compute.

## Diagnostic Signal

| Diagnostic rows | Positives | Hard negatives | Targeted gap failures | Final labels used for training |
| ---: | ---: | ---: | ---: | --- |
| ${result.diagnostic.summary.diagnostic_rows} | ${result.diagnostic.summary.positives} | ${result.diagnostic.summary.hard_negatives} | ${result.diagnostic.summary.targeted_gap_failures} | ${result.diagnostic.summary.final_window_labels_used_for_training ? "yes" : "no"} |

## Packet Counts

| Split | SFT | DPO | Yes/no SFT | Numeric SFT | List SFT | Multi-evidence SFT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} | ${result.quality_gates.train_summary.sft_yes_no} | ${result.quality_gates.train_summary.sft_numeric} | ${result.quality_gates.train_summary.sft_list} | ${result.quality_gates.train_summary.sft_multi_evidence} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} | ${result.quality_gates.validation_summary.sft_yes_no} | ${result.quality_gates.validation_summary.sft_numeric} | ${result.quality_gates.validation_summary.sft_list} | ${result.quality_gates.validation_summary.sft_multi_evidence} |

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}
`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function numberArg(value, fallback, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (!allowZero && number <= 0) || (allowZero && number < 0)) return fallback;
  return number;
}
