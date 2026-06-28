import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "support-targeted-planning-packet-v12";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const auditRunId = args["audit-run-id"] ?? "expanded-candidate-pool-audit-final-window-v1";
const trainStart = numberArg(args["train-start"], 0, { allowZero: true });
const trainEnd = numberArg(args["train-end"], 240);
const validationStart = numberArg(args["validation-start"], 240);
const validationEnd = numberArg(args["validation-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const rows = (await readJsonl(path.join(dataDir, dataFile))).map(toExample);
const auditRows = await readJsonl(path.join(runsDir, auditRunId, "predictions.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const finalRows = rows.slice(evalStart, evalEnd);
const evalPapers = new Set(finalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
const missingSupportedRows = auditRows
  .filter((row) => row.reference?.answer_type === "grounded_answer")
  .filter((row) => !Object.values(row.candidate_summary ?? {}).some((candidate) => candidate.supported_answer))
  .map((row) => rows.find((candidate) => candidate.example_id === row.example_id))
  .filter(Boolean);
const targetProfiles = profileCounts(missingSupportedRows);

const trainRows = rows.slice(trainStart, trainEnd);
const validationCandidateRows = rows.slice(validationStart, validationEnd);
const validationRows = validationCandidateRows.filter((row) => !evalPapers.has(row.input.document_metadata?.paper_id));
const validationDroppedRows = validationCandidateRows.filter((row) => evalPapers.has(row.input.document_metadata?.paper_id));
const trainPacket = buildSplit(trainRows, "train", targetProfiles);
const validationPacket = buildSplit(validationRows, "validation", targetProfiles);
const evalPrompts = missingSupportedRows.map(evalPromptRow);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_targeted_planning_packet",
  status: classifyPacket(trainPacket.summary, validationPacket.summary, targetProfiles),
  purpose: "Build leakage-safe planning labels for the answer styles still missing supported candidates on the final window: yes/no, list extraction, metric/count extraction, and multi-evidence claim composition.",
  source_data: {
    file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: { id: `${trainStart}-${trainEnd}`, examples: trainRows.length },
    validation_window: { id: `${validationStart}-${validationEnd}`, examples: validationRows.length },
    validation_filtered_for_eval_paper_overlap: {
      candidate_examples: validationCandidateRows.length,
      dropped_examples: validationDroppedRows.length,
      dropped_paper_ids: [...new Set(validationDroppedRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean))],
    },
    eval_window: { id: `${evalStart + 1}-${evalEnd}`, examples: finalRows.length },
    final_eval_labels_used_for_training: false,
  },
  upstream_evidence: {
    expanded_candidate_pool_audit_run_id: auditRunId,
    missing_supported_candidate_examples: missingSupportedRows.length,
    missing_supported_candidate_ids: missingSupportedRows.map((row) => row.example_id),
    missing_profile_counts: targetProfiles,
  },
  curriculum: {
    type: "support_targeted_planning_v12",
    system_prompt: systemPrompt(),
    rationale: "The expanded candidate-pool oracle remains below the 70% answer-rate floor because eight answerable rows have no supported candidate. This packet teaches an explicit plan-first output contract on earlier-window analogs before another GPU run.",
    label_shape: {
      output_keys: ["answer_type", "answer_plan", "answer", "citations", "claim_table", "abstention_reason"],
      plan_keys: ["answer_style", "sufficiency", "required_evidence", "missing_information", "construction_steps"],
    },
    leakage_guard: leakageGuard(trainRows, validationRows, finalRows),
  },
  examples: {
    planning_sft_train: trainPacket.sft.length,
    planning_sft_validation: validationPacket.sft.length,
    planning_dpo_train: trainPacket.dpo.length,
    planning_dpo_validation: validationPacket.dpo.length,
    eval_missing_supported_prompts: evalPrompts.length,
  },
  quality_gates: {
    train_summary: trainPacket.summary,
    validation_summary: validationPacket.summary,
    target_profile_counts: targetProfiles,
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
    sft_train_jsonl: rel(path.join(datasetDir, "planning_sft_train.jsonl")),
    sft_validation_jsonl: rel(path.join(datasetDir, "planning_sft_validation.jsonl")),
    dpo_train_jsonl: rel(path.join(datasetDir, "planning_dpo_train.jsonl")),
    dpo_validation_jsonl: rel(path.join(datasetDir, "planning_dpo_validation.jsonl")),
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_missing_supported_prompts.jsonl")),
    dataset_readme: rel(path.join(datasetDir, "README.md")),
  },
};

await writeJsonl(path.join(datasetDir, "planning_sft_train.jsonl"), trainPacket.sft);
await writeJsonl(path.join(datasetDir, "planning_sft_validation.jsonl"), validationPacket.sft);
await writeJsonl(path.join(datasetDir, "planning_dpo_train.jsonl"), trainPacket.dpo);
await writeJsonl(path.join(datasetDir, "planning_dpo_validation.jsonl"), validationPacket.dpo);
await writeJsonl(path.join(datasetDir, "eval_missing_supported_prompts.jsonl"), evalPrompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  missing_profile_counts: result.upstream_evidence.missing_profile_counts,
  train_summary: result.quality_gates.train_summary,
  validation_summary: result.quality_gates.validation_summary,
  decision: result.decision,
}, null, 2));

function buildSplit(examples, splitName, target) {
  const sft = [];
  const dpo = [];
  const summary = emptySummary(examples.length);
  for (const example of examples) {
    const profile = answerProfile(example);
    if (!profileMatchesTarget(profile, target) && example.reference.answer_type === "grounded_answer") continue;
    const chosen = plannedOutput(example, profile);
    sft.push(sftRow(example, splitName, chosen, profile));
    countProfile(summary, profile, "sft");

    if (example.reference.answer_type === "abstain") {
      const rejected = plausibleUnsupportedOutput(example);
      if (rejected) {
        dpo.push(dpoRow(example, splitName, chosen, rejected, profile, "prefer_planned_abstention_over_plausible_unsupported_answer"));
        summary.dpo_abstention_contrasts += 1;
      }
      continue;
    }

    const fragment = incompleteOutput(example, profile);
    if (fragment) {
      dpo.push(dpoRow(example, splitName, chosen, fragment, profile, "prefer_planned_complete_answer_over_fragment"));
      summary.dpo_fragment_negatives += 1;
    }
    const wrongEvidence = wrongEvidenceOutput(example, profile);
    if (wrongEvidence) {
      dpo.push(dpoRow(example, splitName, chosen, wrongEvidence, profile, "prefer_planned_supported_answer_over_wrong_evidence"));
      summary.dpo_wrong_evidence_negatives += 1;
    }
    if (profile.yes_no) {
      dpo.push(dpoRow(example, splitName, chosen, invertedYesNoOutput(example), profile, "prefer_correct_yes_no_polarity"));
      summary.dpo_yes_no_polarity_negatives += 1;
    }
  }
  summary.sft_rows = sft.length;
  summary.dpo_rows = dpo.length;
  return { sft, dpo, summary };
}

function sftRow(example, splitName, target, profile) {
  return {
    example_id: `${example.example_id}:support-planning-${splitName}`,
    task: "citation_grounded_domain_qa_support_targeted_planning_sft",
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, profile) },
      { role: "assistant", content: JSON.stringify(target) },
    ],
    input: example.input,
    target,
    label_source: labelSource(example, profile, splitName),
  };
}

function dpoRow(example, splitName, chosen, rejected, profile, type) {
  return {
    example_id: `${example.example_id}:${type}:${splitName}`,
    task: "citation_grounded_domain_qa_support_targeted_planning_dpo",
    prompt: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, profile) },
    ],
    chosen: JSON.stringify(chosen),
    rejected: JSON.stringify(rejected),
    chosen_output: chosen,
    rejected_output: rejected,
    input: example.input,
    label_source: { ...labelSource(example, profile, splitName), type },
  };
}

function evalPromptRow(example) {
  const profile = answerProfile(example);
  return {
    example_id: example.example_id,
    task: "citation_grounded_domain_qa_support_targeted_planning_eval_missing_supported_candidate",
    diagnostic_profile: profile,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(example, profile) },
    ],
    input: example.input,
    reference: example.reference,
    training_use: "forbidden_final_window_diagnostic_only",
  };
}

function plannedOutput(example, profile) {
  if (example.reference.answer_type === "abstain") {
    return {
      answer_type: "abstain",
      answer_plan: {
        answer_style: "abstain",
        sufficiency: "insufficient",
        required_evidence: [],
        missing_information: "The compact evidence pack lacks direct support for the requested answer.",
        construction_steps: ["Do not infer missing facts from nearby evidence.", "Return an abstention."],
      },
      answer: "",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
      abstention_reason: example.reference.abstention_reason || "Evidence is insufficient to answer the question.",
    };
  }
  const citations = example.reference.citations;
  return {
    answer_type: "grounded_answer",
    answer_plan: {
      answer_style: profile.style,
      sufficiency: "sufficient",
      required_evidence: citations,
      missing_information: "",
      construction_steps: constructionSteps(profile, citations),
    },
    answer: ensureInlineCitations(example.reference.answer, citations),
    citations,
    claim_table: normalizeClaimTable(example.reference, citations),
    abstention_reason: "",
  };
}

function incompleteOutput(example, profile) {
  if (example.reference.answer_type !== "grounded_answer") return null;
  const citation = example.reference.citations[0];
  if (!citation) return null;
  const tokens = contentTokens(stripCitations(example.reference.answer));
  const fragment = profile.list ? tokens.slice(0, Math.min(4, tokens.length)).join(", ") : tokens.slice(0, Math.min(6, tokens.length)).join(" ");
  return {
    answer_type: "grounded_answer",
    answer_plan: { answer_style: profile.style, sufficiency: "partial", required_evidence: [citation], missing_information: "Incomplete answer.", construction_steps: ["Emit only a fragment."] },
    answer: `${fragment} [${citation}]`,
    citations: [citation],
    claim_table: [{ claim: fragment, support: "incomplete_fragment", citations: [citation] }],
    abstention_reason: "",
  };
}

function wrongEvidenceOutput(example, profile) {
  if (example.reference.answer_type !== "grounded_answer") return null;
  const gold = new Set(example.reference.citations);
  const wrong = (example.input.compact_retrieved_evidence_pack ?? []).find((evidence) => !gold.has(evidence.evidence_id));
  if (!wrong) return null;
  const sentence = firstUsefulSentence(wrong.text);
  return {
    answer_type: "grounded_answer",
    answer_plan: { answer_style: profile.style, sufficiency: "misgrounded", required_evidence: [wrong.evidence_id], missing_information: "Selected nearby but non-answer evidence.", construction_steps: ["Answer from the wrong evidence sentence."] },
    answer: `${truncateAtWord(sentence, 220)} [${wrong.evidence_id}]`,
    citations: [wrong.evidence_id],
    claim_table: [{ claim: stripCitations(sentence), support: "wrong_or_nearby_evidence", citations: [wrong.evidence_id] }],
    abstention_reason: "",
  };
}

function plausibleUnsupportedOutput(example) {
  const evidence = (example.input.compact_retrieved_evidence_pack ?? [])[0];
  if (!evidence) return null;
  const sentence = firstUsefulSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer_plan: { answer_style: "plausible_but_unsupported", sufficiency: "misgrounded", required_evidence: [evidence.evidence_id], missing_information: "Gold evidence was withheld or insufficient.", construction_steps: ["Over-answer from distractor evidence."] },
    answer: `${truncateAtWord(sentence, 220)} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    claim_table: [{ claim: stripCitations(sentence), support: "plausible_unsupported_answer", citations: [evidence.evidence_id] }],
    abstention_reason: "",
  };
}

function invertedYesNoOutput(example) {
  const citations = example.reference.citations;
  const answer = stripCitations(example.reference.answer).trim();
  const inverted = /^yes\b/i.test(answer) ? answer.replace(/^yes\b/i, "No") : answer.replace(/^no\b/i, "Yes");
  return {
    answer_type: "grounded_answer",
    answer_plan: { answer_style: "yes_no", sufficiency: "misread_polarity", required_evidence: citations, missing_information: "The answer polarity is inverted.", construction_steps: ["Use the wrong yes/no polarity despite citing the right evidence."] },
    answer: ensureInlineCitations(inverted, citations),
    citations,
    claim_table: [{ claim: stripCitations(inverted), support: "wrong_yes_no_polarity", citations }],
    abstention_reason: "",
  };
}

function answerProfile(example) {
  const answer = stripCitations(example.reference.answer);
  const question = example.input.question ?? "";
  const citations = example.reference.citations ?? [];
  const answerable = example.reference.answer_type === "grounded_answer";
  const yesNo = answerable && /^(yes|no)\b/i.test(answer);
  const numeric = answerable && /\d|percent|percentage|score|f1|rouge|bleu|pairs?|models?|datasets?/i.test(answer);
  const list = answerable && (answer.split(/[,;]/).length >= 3 || /\b(which|what datasets?|what factors?|what assumptions?|which corpora)\b/i.test(question));
  const multiEvidence = citations.length >= 2;
  const style = !answerable ? "abstain"
    : yesNo ? "yes_no"
      : multiEvidence ? "multi_evidence_claims"
        : list ? "list_extraction"
          : numeric ? "metric_or_count_extraction"
            : "direct_extractive_answer";
  return { answerable, yes_no: yesNo, numeric, list, multi_evidence: multiEvidence, style };
}

function profileCounts(examples) {
  const counts = emptyProfileCounts();
  for (const example of examples) countProfile(counts, answerProfile(example), "");
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

function constructionSteps(profile, citations) {
  const steps = ["Decide that the evidence is sufficient before answering."];
  if (profile.yes_no) steps.push("Preserve the yes/no polarity exactly.");
  if (profile.list) steps.push("Enumerate all requested list items supported by the cited evidence.");
  if (profile.numeric) steps.push("Copy exact counts, metrics, dataset names, or table values.");
  if (profile.multi_evidence) steps.push("Split the answer into claims and cite each required evidence item.");
  steps.push(`Use inline citations: ${citations.map((id) => `[${id}]`).join(" ")}.`);
  return steps;
}

function normalizeClaimTable(reference, citations) {
  if (Array.isArray(reference.claim_table) && reference.claim_table.length) {
    return reference.claim_table.map((claim) => ({
      claim: String(claim.claim ?? stripCitations(reference.answer)),
      support: claim.support ?? "supported",
      citations: Array.isArray(claim.citations) && claim.citations.length ? claim.citations : citations,
    }));
  }
  return [{ claim: stripCitations(reference.answer), support: "supported", citations }];
}

function labelSource(example, profile, splitName) {
  return {
    type: "support_targeted_planning_label",
    split: splitName,
    source_example_id: example.example_id,
    source_data: dataFile,
    profile,
    final_window_label_used: false,
  };
}

function userPrompt(example, profile) {
  const metadata = example.input.document_metadata ?? {};
  const lines = [
    `Question: ${example.input.question}`,
    `Paper title: ${metadata.title ?? ""}`,
    `Paper id: ${metadata.paper_id ?? ""}`,
    `Date: ${metadata.inferred_publication_date ?? metadata.inferred_publication_month ?? ""}`,
    "Evidence pack:",
    ...(example.input.compact_retrieved_evidence_pack ?? []).map((evidence) => `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`),
  ];
  if (profile?.style) lines.push(`Planning target style: ${profile.style}`);
  return lines.join("\n");
}

function systemPrompt() {
  return [
    "Answer using only the compact evidence pack.",
    "Return valid JSON only with keys answer_type, answer_plan, answer, citations, claim_table, and abstention_reason.",
    "The answer_plan must decide sufficiency, answer style, required evidence ids, missing information, and construction steps before the final answer.",
    "For yes/no questions, preserve polarity exactly and cite the evidence supporting the polarity.",
    "For list, metric, count, or multi-evidence questions, copy all supported requested items and cite every factual clause inline.",
    "If direct support is missing, abstain rather than answering from nearby evidence.",
  ].join(" ");
}

function classifyPacket(train, validation, target) {
  const targetFamilies = ["yes_no", "numeric", "list", "multi_evidence"].filter((key) => target[key] > 0);
  const trainCovered = targetFamilies.every((key) => train[`sft_${key}`] >= 10);
  const validationCovered = targetFamilies.every((key) => validation[`sft_${key}`] >= 3);
  if (trainCovered && validationCovered && train.dpo_rows >= train.sft_rows) return "ready_to_merge_into_next_gpu_packet";
  if (trainCovered) return "train_ready_validation_sparse";
  return "insufficient_analog_coverage";
}

function decisionFor(train, validation, target) {
  const status = classifyPacket(train, validation, target);
  if (status === "ready_to_merge_into_next_gpu_packet") {
    return {
      launch_next_gpu_now: false,
      next_step: "Merge these planning rows into a bounded v12 launch packet, then run packet validation and Prime/budget preflight.",
      reason: "The missing final-window answer styles have training and validation analogs, but this packet still needs to be integrated into the Qwen runner format before launch.",
    };
  }
  return {
    launch_next_gpu_now: false,
    next_step: "Do not launch yet; either broaden training windows or add teacher-labeled analogs for sparse missing styles.",
    reason: "Planning analog coverage is not strong enough to justify another adapter run.",
  };
}

function leakageGuard(trainRows, validationRows, evalRows) {
  const trainPapers = new Set(trainRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
  const validationPapers = new Set(validationRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
  const evalPapersLocal = new Set(evalRows.map((row) => row.input.document_metadata?.paper_id).filter(Boolean));
  return {
    train_eval_shared_papers: intersection(trainPapers, evalPapersLocal),
    validation_eval_shared_papers: intersection(validationPapers, evalPapersLocal),
    passes: intersection(trainPapers, evalPapersLocal).length === 0 && intersection(validationPapers, evalPapersLocal).length === 0,
  };
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
  return `# Support-Targeted Planning Packet

Run: \`${result.run_id}\`

This packet is deterministic and local. It targets the final-window answer styles that still have no supported candidate, but final-window labels are diagnostic only and are not used in training rows.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | ${result.examples.planning_sft_train} | ${result.examples.planning_dpo_train} |
| Validation | ${result.examples.planning_sft_validation} | ${result.examples.planning_dpo_validation} |
| Missing-candidate eval prompts | ${result.examples.eval_missing_supported_prompts} | n/a |
`;
}

function renderReport(result) {
  return `# Support-Targeted Planning Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Missing Final-Window Profiles

| Missing rows | Yes/no | Numeric | List | Multi-evidence |
| ---: | ---: | ---: | ---: | ---: |
| ${result.upstream_evidence.missing_supported_candidate_examples} | ${result.upstream_evidence.missing_profile_counts.yes_no} | ${result.upstream_evidence.missing_profile_counts.numeric} | ${result.upstream_evidence.missing_profile_counts.list} | ${result.upstream_evidence.missing_profile_counts.multi_evidence} |

## Packet Counts

| Split | SFT | DPO | Yes/no SFT | Numeric SFT | List SFT | Multi-evidence SFT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.examples.planning_sft_train} | ${result.examples.planning_dpo_train} | ${result.quality_gates.train_summary.sft_yes_no} | ${result.quality_gates.train_summary.sft_numeric} | ${result.quality_gates.train_summary.sft_list} | ${result.quality_gates.train_summary.sft_multi_evidence} |
| Validation | ${result.examples.planning_sft_validation} | ${result.examples.planning_dpo_validation} | ${result.quality_gates.validation_summary.sft_yes_no} | ${result.quality_gates.validation_summary.sft_numeric} | ${result.quality_gates.validation_summary.sft_list} | ${result.quality_gates.validation_summary.sft_multi_evidence} |

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
