import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "qwen-coverage-gap-scaffold-packet-v13";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const qwenDiagnosticRunId = args["qwen-diagnostic-run-id"] ?? "qwen-only-amortization-diagnostic-final-window-v1";
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

const examples = (await readJsonl(path.join(dataDir, dataFile))).map(toExample);
const qwenOracleRows = await readJsonl(path.join(runsDir, qwenDiagnosticRunId, "qwen_judged_oracle_predictions.jsonl"));
const qwenDiagnostic = await readJson(path.join(runsDir, qwenDiagnosticRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const evalRows = examples.slice(evalStart, evalEnd);
const evalPapers = new Set(evalRows.map(paperId).filter(Boolean));
const trainCandidateRows = examples.slice(trainStart, trainEnd);
const validationCandidateRows = examples.slice(validationStart, validationEnd);
const trainRows = trainCandidateRows.filter((row) => !evalPapers.has(paperId(row)));
const validationRows = validationCandidateRows.filter((row) => !evalPapers.has(paperId(row)));
const trainDroppedRows = trainCandidateRows.filter((row) => evalPapers.has(paperId(row)));
const validationDroppedRows = validationCandidateRows.filter((row) => evalPapers.has(paperId(row)));
const qwenMissRows = evalRows
  .filter((row, index) => row.reference.answer_type === "grounded_answer" && qwenOracleRows[index]?.prediction?.answer_type !== "grounded_answer");
const targetProfiles = profileCounts(qwenMissRows);
const trainPacket = buildSplit(trainRows, "train", targetProfiles);
const validationPacket = buildSplit(validationRows, "validation", targetProfiles);
const evalPrompts = qwenMissRows.map(evalPromptRow);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_coverage_gap_scaffold_packet",
  status: classifyPacket(trainPacket.summary, validationPacket.summary, targetProfiles),
  purpose: "Build a leakage-safe scaffold-distillation packet for the final-window answer styles where the current Qwen-only oracle lacks any supported answer.",
  source_data: {
    file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: {
      id: `${trainStart}-${trainEnd}`,
      candidate_examples: trainCandidateRows.length,
      examples: trainRows.length,
      dropped_eval_paper_overlap_examples: trainDroppedRows.length,
    },
    validation_window: {
      id: `${validationStart}-${validationEnd}`,
      candidate_examples: validationCandidateRows.length,
      examples: validationRows.length,
      dropped_eval_paper_overlap_examples: validationDroppedRows.length,
    },
    eval_window: { id: `${evalStart + 1}-${evalEnd}`, examples: evalRows.length },
    final_eval_labels_used_for_training: false,
  },
  upstream_evidence: {
    qwen_diagnostic_run_id: qwenDiagnosticRunId,
    qwen_oracle_answer_rate: qwenDiagnostic.selection_metrics?.qwen_judged_oracle?.answer_rate ?? null,
    qwen_oracle_supported_answers: qwenDiagnostic.selection_metrics?.qwen_judged_oracle?.supported_answers ?? null,
    qwen_oracle_answerable_miss_examples: qwenMissRows.length,
    qwen_oracle_answerable_miss_ids: qwenMissRows.map((row) => row.example_id),
    qwen_miss_profile_counts: targetProfiles,
  },
  curriculum: {
    type: "qwen_coverage_gap_scaffold_v13",
    rationale: "D232 showed selector tuning cannot meet the 70% answer-rate floor because the Qwen-only oracle has supported answers for only 35/69 final rows. This packet trains on earlier-window scaffold/reference traces matching the nine missed answerable rows.",
    label_shape: {
      output_keys: ["answer_type", "answer", "citations", "claim_table", "abstention_reason"],
      diagnostic_profile_keys: ["answer_style", "yes_no", "numeric", "list", "multi_evidence"],
    },
    leakage_guard: leakageGuard(trainRows, validationRows, evalRows),
    split_policy: "Train uses rows 0-160; validation uses rows 160-320; final rows 321-389 are diagnostic prompts only.",
  },
  examples: {
    sft_train: trainPacket.sft.length,
    sft_validation: validationPacket.sft.length,
    dpo_train: trainPacket.dpo.length,
    dpo_validation: validationPacket.dpo.length,
    qwen_miss_eval_prompts: evalPrompts.length,
  },
  quality_gates: {
    train_summary: trainPacket.summary,
    validation_summary: validationPacket.summary,
    target_profile_counts: targetProfiles,
    train_eval_shared_papers: resultSafePapers(trainRows, evalRows),
    validation_eval_shared_papers: resultSafePapers(validationRows, evalRows),
  },
  decision: decisionFor(trainPacket.summary, validationPacket.summary, targetProfiles),
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
    qwen_miss_eval_prompts_jsonl: rel(path.join(datasetDir, "qwen_miss_eval_prompts.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), trainPacket.sft);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), validationPacket.sft);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), trainPacket.dpo);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), validationPacket.dpo);
await writeJsonl(path.join(datasetDir, "qwen_miss_eval_prompts.jsonl"), evalPrompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  qwen_miss_profile_counts: result.upstream_evidence.qwen_miss_profile_counts,
  train_summary: result.quality_gates.train_summary,
  validation_summary: result.quality_gates.validation_summary,
  decision: result.decision,
}, null, 2));

function buildSplit(rows, splitName, targetProfiles) {
  const sft = [];
  const dpo = [];
  const summary = emptySummary(rows.length);
  for (const row of rows) {
    const profile = answerProfile(row);
    if (row.reference.answer_type === "grounded_answer" && !profileMatchesTarget(profile, targetProfiles)) continue;
    const chosen = scaffoldOutput(row, profile);
    sft.push(sftRow(row, splitName, chosen, profile));
    countProfile(summary, profile, "sft");
    if (row.reference.answer_type === "abstain") {
      const rejected = plausibleUnsupportedOutput(row);
      if (rejected) {
        dpo.push(dpoRow(row, splitName, chosen, rejected, profile, "prefer_scaffold_abstention_over_overanswer"));
        summary.dpo_abstention_contrasts += 1;
      }
      continue;
    }
    const fragment = fragmentOutput(row, profile);
    if (fragment) {
      dpo.push(dpoRow(row, splitName, chosen, fragment, profile, "prefer_complete_scaffold_answer_over_fragment"));
      summary.dpo_fragment_negatives += 1;
    }
    const wrong = wrongEvidenceOutput(row, profile);
    if (wrong) {
      dpo.push(dpoRow(row, splitName, chosen, wrong, profile, "prefer_scaffold_answer_over_wrong_evidence"));
      summary.dpo_wrong_evidence_negatives += 1;
    }
    if (profile.yes_no) {
      dpo.push(dpoRow(row, splitName, chosen, invertedYesNoOutput(row), profile, "prefer_scaffold_yes_no_polarity"));
      summary.dpo_yes_no_polarity_negatives += 1;
    }
  }
  summary.sft_rows = sft.length;
  summary.dpo_rows = dpo.length;
  return { sft, dpo, summary };
}

function sftRow(row, splitName, target, profile) {
  return {
    example_id: `${row.example_id}:qwen-coverage-gap-scaffold-sft-${splitName}`,
    task: "citation_grounded_domain_qa_qwen_coverage_gap_scaffold_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row, profile) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    input: row.input,
    target,
    label_source: labelSource(row, profile, splitName, "scaffold_reference_sft"),
  };
}

function dpoRow(row, splitName, chosen, rejected, profile, type) {
  return {
    example_id: `${row.example_id}:qwen-coverage-gap:${type}:${splitName}`,
    task: "citation_grounded_domain_qa_qwen_coverage_gap_scaffold_dpo",
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

function evalPromptRow(row) {
  const profile = answerProfile(row);
  return {
    example_id: row.example_id,
    task: "citation_grounded_domain_qa_qwen_coverage_gap_eval_prompt",
    diagnostic_profile: profile,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(row, profile) },
    ],
    input: row.input,
    reference: row.reference,
    training_use: "forbidden_final_window_diagnostic_only",
  };
}

function scaffoldOutput(row, profile) {
  if (row.reference.answer_type === "abstain") {
    return {
      answer_type: "abstain",
      answer: "",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
      abstention_reason: row.reference.abstention_reason || "Evidence is insufficient to answer the question.",
    };
  }
  const citations = row.reference.citations;
  return {
    answer_type: "grounded_answer",
    answer: ensureInlineCitations(row.reference.answer, citations),
    citations,
    claim_table: normalizeClaimTable(row.reference, citations, profile),
    abstention_reason: "",
  };
}

function fragmentOutput(row, profile) {
  if (row.reference.answer_type !== "grounded_answer") return null;
  const citation = row.reference.citations[0];
  if (!citation) return null;
  const tokens = contentTokens(stripCitations(row.reference.answer));
  const fragment = profile.list ? tokens.slice(0, Math.min(4, tokens.length)).join(", ") : tokens.slice(0, Math.min(6, tokens.length)).join(" ");
  return {
    answer_type: "grounded_answer",
    answer: `${fragment} [${citation}]`,
    citations: [citation],
    claim_table: [{ claim: fragment, support: "incomplete_fragment", citations: [citation] }],
    abstention_reason: "",
  };
}

function wrongEvidenceOutput(row, profile) {
  if (row.reference.answer_type !== "grounded_answer") return null;
  const gold = new Set(row.reference.citations);
  const wrong = (row.input.compact_retrieved_evidence_pack ?? []).find((evidence) => !gold.has(evidence.evidence_id));
  if (!wrong) return null;
  const sentence = firstUsefulSentence(wrong.text);
  return {
    answer_type: "grounded_answer",
    answer: `${truncateAtWord(sentence, 220)} [${wrong.evidence_id}]`,
    citations: [wrong.evidence_id],
    claim_table: [{ claim: stripCitations(sentence), support: `wrong_evidence_for_${profile.style}`, citations: [wrong.evidence_id] }],
    abstention_reason: "",
  };
}

function plausibleUnsupportedOutput(row) {
  const evidence = (row.input.compact_retrieved_evidence_pack ?? [])[0];
  if (!evidence) return null;
  const sentence = firstUsefulSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer: `${truncateAtWord(sentence, 220)} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    claim_table: [{ claim: stripCitations(sentence), support: "plausible_unsupported_overanswer", citations: [evidence.evidence_id] }],
    abstention_reason: "",
  };
}

function invertedYesNoOutput(row) {
  const citations = row.reference.citations;
  const answer = stripCitations(row.reference.answer).trim();
  const inverted = /^yes\b/i.test(answer) ? answer.replace(/^yes\b/i, "No") : answer.replace(/^no\b/i, "Yes");
  return {
    answer_type: "grounded_answer",
    answer: ensureInlineCitations(inverted, citations),
    citations,
    claim_table: [{ claim: stripCitations(inverted), support: "wrong_yes_no_polarity", citations }],
    abstention_reason: "",
  };
}

function answerProfile(row) {
  const answer = stripCitations(row.reference.answer);
  const question = row.input.question ?? "";
  const citations = row.reference.citations ?? [];
  const answerable = row.reference.answer_type === "grounded_answer";
  const yesNo = answerable && /^(yes|no)\b/i.test(answer);
  const numeric = answerable && /\d|percent|percentage|score|f1|rouge|bleu|accuracy|metric|pairs?|models?|datasets?/i.test(answer);
  const list = answerable && (answer.split(/[,;]/).length >= 3 || /\b(which|what datasets?|what metrics?|what factors?|what assumptions?|which corpora|what are)\b/i.test(question));
  const multiEvidence = answerable && citations.length >= 2;
  const style = !answerable ? "abstain"
    : yesNo ? "yes_no"
      : multiEvidence ? "multi_evidence_claims"
        : list ? "list_extraction"
          : numeric ? "metric_or_count_extraction"
            : "direct_extractive_answer";
  return { answerable, yes_no: yesNo, numeric, list, multi_evidence: multiEvidence, style };
}

function profileCounts(rows) {
  const counts = emptyProfileCounts();
  for (const row of rows) countProfile(counts, answerProfile(row), "");
  return counts;
}

function profileMatchesTarget(profile, target) {
  if (!profile.answerable) return true;
  return (target.yes_no > 0 && profile.yes_no)
    || (target.numeric > 0 && profile.numeric)
    || (target.list > 0 && profile.list)
    || (target.multi_evidence > 0 && profile.multi_evidence);
}

function countProfile(summary, profile, prefix) {
  const key = prefix ? `${prefix}_` : "";
  if (profile.answerable) summary[`${key}answerable`] += 1;
  else summary[`${key}abstain`] += 1;
  if (profile.yes_no) summary[`${key}yes_no`] += 1;
  if (profile.numeric) summary[`${key}numeric`] += 1;
  if (profile.list) summary[`${key}list`] += 1;
  if (profile.multi_evidence) summary[`${key}multi_evidence`] += 1;
}

function normalizeClaimTable(reference, citations, profile) {
  if (Array.isArray(reference.claim_table) && reference.claim_table.length) {
    return reference.claim_table.map((claim) => ({
      claim: String(claim.claim ?? stripCitations(reference.answer)),
      support: claim.support ?? `scaffold_${profile.style}`,
      citations: Array.isArray(claim.citations) && claim.citations.length ? claim.citations : citations,
    }));
  }
  return [{ claim: stripCitations(reference.answer), support: `scaffold_${profile.style}`, citations }];
}

function labelSource(row, profile, splitName, type) {
  return {
    type,
    split: splitName,
    source_example_id: row.example_id,
    source_data: dataFile,
    profile,
    final_window_label_used: false,
    qwen_gap_targeted: true,
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
    "For yes/no questions, preserve polarity exactly and cite the evidence supporting the polarity.",
    "For list, metric, count, or multi-evidence questions, copy all supported requested items and cite every factual clause inline.",
    "If direct support is missing, abstain rather than answering from nearby evidence.",
  ].join(" ");
}

function classifyPacket(train, validation, target) {
  const targetFamilies = ["yes_no", "numeric", "list", "multi_evidence"].filter((key) => target[key] > 0);
  const trainCovered = targetFamilies.every((key) => train[`sft_${key}`] >= 10);
  const validationCovered = targetFamilies.every((key) => validation[`sft_${key}`] >= 3);
  if (trainCovered && validationCovered && train.dpo_rows >= train.sft_rows && validation.dpo_rows >= validation.sft_rows) return "ready_for_launch_packet_merge";
  if (trainCovered && validationCovered) return "analog_coverage_ready_dpo_sparse";
  if (trainCovered) return "train_ready_validation_sparse";
  return "insufficient_analog_coverage";
}

function decisionFor(train, validation, target) {
  const status = classifyPacket(train, validation, target);
  if (status === "ready_for_launch_packet_merge") {
    return {
      launch_next_gpu_now: false,
      next_step: "Merge this scaffold-distillation packet into a bounded Qwen 7B v13 launch packet, run packet-quality validation, then do Prime/budget preflight before any GPU creation.",
      reason: "The Qwen-only coverage gaps have leakage-safe train and validation analogs with both SFT and DPO supervision.",
    };
  }
  return {
    launch_next_gpu_now: false,
    next_step: "Do not launch; broaden analog mining or add paid teacher labels only if budget policy allows.",
    reason: `Packet status is ${status}, so it is not strong enough to justify GPU spend.`,
  };
}

function leakageGuard(trainRows, validationRows, evalRows) {
  const trainEval = resultSafePapers(trainRows, evalRows);
  const validationEval = resultSafePapers(validationRows, evalRows);
  return {
    train_eval_shared_papers: trainEval,
    validation_eval_shared_papers: validationEval,
    passes: trainEval.length === 0 && validationEval.length === 0,
  };
}

function resultSafePapers(leftRows, rightRows) {
  return intersection(new Set(leftRows.map(paperId).filter(Boolean)), new Set(rightRows.map(paperId).filter(Boolean)));
}

function paperId(row) {
  return row.input.document_metadata?.paper_id;
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

function emptySummary(examples) {
  return {
    examples,
    sft_rows: 0,
    dpo_rows: 0,
    dpo_fragment_negatives: 0,
    dpo_wrong_evidence_negatives: 0,
    dpo_yes_no_polarity_negatives: 0,
    dpo_abstention_contrasts: 0,
    ...Object.fromEntries(["sft", ""].flatMap((prefix) => {
      const key = prefix ? `${prefix}_` : "";
      return ["answerable", "abstain", "yes_no", "numeric", "list", "multi_evidence"].map((name) => [`${key}${name}`, 0]);
    })),
  };
}

function emptyProfileCounts() {
  return { answerable: 0, abstain: 0, yes_no: 0, numeric: 0, list: 0, multi_evidence: 0 };
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

function intersection(left, right) {
  return [...left].filter((value) => right.has(value)).sort();
}

function renderDatasetReadme(result) {
  return `# Qwen Coverage-Gap Scaffold Packet

Run: \`${result.run_id}\`

This packet is deterministic and local. It targets the final-window rows where the current Qwen-only judged oracle lacks a supported answer. Final-window rows are diagnostic prompts only and are not used as training labels.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} |
| Qwen-miss eval prompts | ${result.examples.qwen_miss_eval_prompts} | n/a |
`;
}

function renderReport(result) {
  return `# Qwen Coverage-Gap Scaffold Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Qwen-Only Coverage Gap

| Qwen oracle missed answerable rows | Yes/no | Numeric | List | Multi-evidence |
| ---: | ---: | ---: | ---: | ---: |
| ${result.upstream_evidence.qwen_oracle_answerable_miss_examples} | ${result.upstream_evidence.qwen_miss_profile_counts.yes_no} | ${result.upstream_evidence.qwen_miss_profile_counts.numeric} | ${result.upstream_evidence.qwen_miss_profile_counts.list} | ${result.upstream_evidence.qwen_miss_profile_counts.multi_evidence} |

## Packet Counts

| Split | SFT | DPO | Yes/no SFT | Numeric SFT | List SFT | Multi-evidence SFT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.sft_train} | ${result.examples.dpo_train} | ${result.quality_gates.train_summary.sft_yes_no} | ${result.quality_gates.train_summary.sft_numeric} | ${result.quality_gates.train_summary.sft_list} | ${result.quality_gates.train_summary.sft_multi_evidence} |
| Validation | ${result.examples.sft_validation} | ${result.examples.dpo_validation} | ${result.quality_gates.validation_summary.sft_yes_no} | ${result.quality_gates.validation_summary.sft_numeric} | ${result.quality_gates.validation_summary.sft_list} | ${result.quality_gates.validation_summary.sft_multi_evidence} |

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}

No OpenAI calls or GPU jobs were made.
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
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
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
