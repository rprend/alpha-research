import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const failureRunId = args["failure-run-id"] ?? "support-failure-analysis-qwen3b-smoke-citation-repair-2026-06-27-v1";
const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3";
const curriculumVariant = args["curriculum-variant"] ?? (runId.includes("v6") ? "answerability_gated_coverage_v6" : runId.includes("v5") ? "coverage_aware_v5" : runId.includes("v4") ? "support_aware_v4" : "failure_driven_v3");
const supportAware = ["support_aware_v4", "coverage_aware_v5", "answerability_gated_coverage_v6"].includes(curriculumVariant);
const coverageAware = curriculumVariant === "coverage_aware_v5";
const answerabilityGatedCoverage = curriculumVariant === "answerability_gated_coverage_v6";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDir = path.join(runsDir, sourcePacketRunId);
const sourceDatasetDir = path.join(sourceDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const source = await readJson(path.join(sourceDir, "result.json"));
const failure = await readJson(path.join(runsDir, failureRunId, "result.json"));
const sourceRows = {
  sft_train: await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(sourceDatasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(sourceDatasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl")),
};

const hardenedSystem = [
  "Answer using only the compact evidence pack.",
  "Return valid JSON only with keys answer_type, answer, citations, claim_table, and abstention_reason.",
  "Before answering, decide whether the supplied evidence directly supports the requested claim.",
  "If evidence is insufficient, answer_type must be abstain, answer must be empty, citations must be empty, and abstention_reason must name the missing support.",
  "For grounded_answer, every factual claim must be directly entailed by cited evidence and every listed citation id must appear inline in the answer.",
  ...(coverageAware ? [
    "When the evidence directly answers the question, give the supported grounded_answer instead of abstaining.",
    "Use abstention for insufficient evidence, not as a default for difficult but answerable questions.",
  ] : []),
  ...(answerabilityGatedCoverage ? [
    "Answer instead of abstaining only when cited evidence explicitly and directly answers the question.",
    "When evidence relevance is indirect, partial, comparative without a stated comparison, or counterfactual, abstain.",
  ] : []),
  "Do not output bare yes/no answers, empty answers, citation-only answers, or paper-level guesses.",
  "If no valid citation can be attached to the answer, abstain.",
  ...(supportAware ? [
    "Prefer concise answers whose claims are exact, directly supported paraphrases of cited evidence.",
    "Do not add dataset sizes, main-focus statements, baseline/comparison claims, task descriptions, model names, or annotation/context details unless the cited evidence directly states them.",
    "If a question asks for a comparison and the evidence only partially supports it, answer only the supported part or abstain.",
  ] : []),
].join(" ");

const hardened = {
  sft_train: sourceRows.sft_train.map(hardenSftRow),
  sft_validation: sourceRows.sft_validation.map(hardenSftRow),
  dpo_train: sourceRows.dpo_train.map(hardenDpoRow),
  dpo_validation: sourceRows.dpo_validation.map(hardenDpoRow),
  eval_prompts: sourceRows.eval_prompts.map(hardenEvalRow),
};

const sourceDpoTrainIds = new Set(sourceRows.dpo_train.map((row) => row.example_id));
const sourceDpoValidationIds = new Set(sourceRows.dpo_validation.map((row) => row.example_id));
const syntheticTrainDpo = sourceRows.sft_train.map((row) => syntheticDpoFromSft(row)).filter((row) => row && !sourceDpoTrainIds.has(row.example_id));
const syntheticValidationDpo = sourceRows.sft_validation.map((row) => syntheticDpoFromSft(row)).filter((row) => row && !sourceDpoValidationIds.has(row.example_id));
hardened.dpo_train.push(...syntheticTrainDpo);
hardened.dpo_validation.push(...syntheticValidationDpo);

const supportAwareTrainDpo = supportAware
  ? sourceRows.sft_train.map((row) => supportAwareDpoFromSft(row)).filter(Boolean)
  : [];
const supportAwareValidationDpo = supportAware
  ? sourceRows.sft_validation.map((row) => supportAwareDpoFromSft(row)).filter(Boolean)
  : [];
hardened.dpo_train.push(...supportAwareTrainDpo);
hardened.dpo_validation.push(...supportAwareValidationDpo);

const coverageAwareTrainDpo = coverageAware
  ? sourceRows.sft_train.map((row) => coverageAwareDpoFromSft(row)).filter(Boolean)
  : [];
const coverageAwareValidationDpo = coverageAware
  ? sourceRows.sft_validation.map((row) => coverageAwareDpoFromSft(row)).filter(Boolean)
  : [];
hardened.dpo_train.push(...coverageAwareTrainDpo);
hardened.dpo_validation.push(...coverageAwareValidationDpo);

const answerabilityGatedCoverageTrainDpo = answerabilityGatedCoverage
  ? sourceRows.sft_train.map((row) => answerabilityGatedCoverageDpoFromSft(row)).filter(Boolean)
  : [];
const answerabilityGatedCoverageValidationDpo = answerabilityGatedCoverage
  ? sourceRows.sft_validation.map((row) => answerabilityGatedCoverageDpoFromSft(row)).filter(Boolean)
  : [];
hardened.dpo_train.push(...answerabilityGatedCoverageTrainDpo);
hardened.dpo_validation.push(...answerabilityGatedCoverageValidationDpo);

const finalFailureDrivenTrainDpo = hardened.dpo_train.filter((row) => row.curriculum_metadata?.failure_driven_hard_negative);
const finalFailureDrivenValidationDpo = hardened.dpo_validation.filter((row) => row.curriculum_metadata?.failure_driven_hard_negative);

for (const file of [
  "validate_joint_action_dataset_uv.py",
  "train_joint_action_lora_uv.py",
  "eval_joint_action_adapter_uv.py",
  "run_joint_action_smoke.sh",
  "run_prime_qwen3b_smoke_on_pod.sh",
  "prime_gpu_plan.md",
]) {
  const sourcePath = path.join(sourceDir, file);
  const outputPath = path.join(outputDir, file);
  if (file.endsWith(".sh") || file.endsWith(".md")) {
    const copied = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(outputPath, copied.replaceAll(sourcePacketRunId, runId));
  } else {
    await fs.copyFile(sourcePath, outputPath);
  }
}
for (const file of ["run_joint_action_smoke.sh", "run_prime_qwen3b_smoke_on_pod.sh"]) {
  await fs.chmod(path.join(outputDir, file), 0o755);
}

const result = {
  ...source,
  run_id: runId,
  generated_at: new Date().toISOString(),
  source_packet_run_id: sourcePacketRunId,
  failure_run_id: failureRunId,
  curriculum: {
    type: "failure_driven_citation_abstention_hard_negative_curriculum",
    variant: curriculumVariant,
    failure_signal: {
      supported_answers: failure.supported_answers,
      unsupported_answers: failure.unsupported_answers,
      support_rate: failure.support_rate,
      tag_counts: failure.tag_counts,
    },
    policy_changes: [
      "Harden system prompts to require evidence-sufficiency decision before answering.",
      "Reject bare yes/no, empty, citation-only, and no-citation grounded answers.",
      "Add synthetic DPO hard negatives from training rows only: cited/reference answer or abstention is chosen over no-citation/too-short/spurious answers.",
      ...(supportAware ? [
        "Add support-aware DPO hard negatives from train/validation rows only: choose concise directly cited answers or abstention over overclaiming answers that add unsupported context, task, model, or comparison claims.",
        "Tighten the system prompt against dataset sizes, main-focus statements, baseline/comparison claims, task descriptions, model names, and annotation/context details unless directly supported by cited evidence.",
      ] : []),
      ...(coverageAware ? [
        "Add coverage-aware DPO positives from answerable train/validation rows only: choose the directly cited target answer over a conservative abstention.",
        "Tighten the system prompt to make abstention evidence-sensitive rather than the default for difficult answerable questions.",
      ] : []),
      ...(answerabilityGatedCoverage ? [
        "Add answerability-gated coverage DPO positives from train/validation rows only: choose the directly cited target answer over a conservative abstention only when deterministic evidence-sufficiency checks pass.",
        "Keep abstention pressure for indirect, partial, comparative-without-stated-comparison, and counterfactual-looking evidence packs.",
      ] : []),
      "Keep final eval prompts unchanged and never use final-window judge labels as training examples.",
    ],
    source_counts: summarizeRows(sourceRows),
    curriculum_counts: summarizeRows(hardened),
    synthetic_hard_negative_counts: {
      dpo_train_added: finalFailureDrivenTrainDpo.length,
      dpo_validation_added: finalFailureDrivenValidationDpo.length,
      newly_emitted_dpo_train_rows: syntheticTrainDpo.length + supportAwareTrainDpo.length + coverageAwareTrainDpo.length + answerabilityGatedCoverageTrainDpo.length,
      newly_emitted_dpo_validation_rows: syntheticValidationDpo.length + supportAwareValidationDpo.length + coverageAwareValidationDpo.length + answerabilityGatedCoverageValidationDpo.length,
      train_answer_hard_negatives: finalFailureDrivenTrainDpo.filter((row) => row.label_source?.type === "prefer_cited_answer_over_no_citation_short_answer").length,
      train_abstention_hard_negatives: finalFailureDrivenTrainDpo.filter((row) => row.label_source?.type === "prefer_abstention_over_spurious_short_answer").length,
      train_support_aware_overclaim_negatives: finalFailureDrivenTrainDpo.filter((row) => row.label_source?.type === "prefer_directly_supported_answer_over_overclaim").length,
      train_support_aware_insufficient_negatives: finalFailureDrivenTrainDpo.filter((row) => row.label_source?.type === "prefer_abstention_over_supported_sounding_insufficient_answer").length,
      train_coverage_aware_answer_over_abstain: finalFailureDrivenTrainDpo.filter((row) => row.label_source?.type === "prefer_supported_answer_over_conservative_abstention").length,
      train_answerability_gated_coverage_answer_over_abstain: finalFailureDrivenTrainDpo.filter((row) => row.label_source?.type === "prefer_supported_answer_over_conservative_abstention_when_evidence_sufficient").length,
      train_answerability_gated_coverage_rejected_answerable_rows: answerabilityGatedCoverage ? sourceRows.sft_train.filter((row) => parseAssistantTarget(row)?.answer_type !== "abstain").length - answerabilityGatedCoverageTrainDpo.length : 0,
    },
    leakage_guard: {
      eval_example_ids_unchanged: sameList(sourceRows.eval_prompts.map((row) => row.example_id), hardened.eval_prompts.map((row) => row.example_id)),
      eval_references_unchanged: JSON.stringify(sourceRows.eval_prompts.map((row) => row.reference)) === JSON.stringify(hardened.eval_prompts.map((row) => row.reference)),
      eval_system_prompt_hardened: true,
      final_window_failure_labels_used_for_training: false,
      note: "The final-window failure audit selects policy changes only; generated training rows come from the source packet's train/validation rows. Eval example ids and references are preserved, while the system prompt is deliberately hardened.",
    },
  },
  examples: {
    sft_train: hardened.sft_train.length,
    sft_validation: hardened.sft_validation.length,
    dpo_train: hardened.dpo_train.length,
    dpo_validation: hardened.dpo_validation.length,
    eval_prompts: hardened.eval_prompts.length,
    synthetic_dpo_train_added: syntheticTrainDpo.length,
    synthetic_dpo_validation_added: syntheticValidationDpo.length,
    support_aware_dpo_train_added: supportAwareTrainDpo.length,
    support_aware_dpo_validation_added: supportAwareValidationDpo.length,
    coverage_aware_dpo_train_added: coverageAwareTrainDpo.length,
    coverage_aware_dpo_validation_added: coverageAwareValidationDpo.length,
    answerability_gated_coverage_dpo_train_added: answerabilityGatedCoverageTrainDpo.length,
    answerability_gated_coverage_dpo_validation_added: answerabilityGatedCoverageValidationDpo.length,
  },
  objective: {
    ...source.objective,
    rationale: answerabilityGatedCoverage
      ? "The Qwen 7B v5 comparison recovered answer coverage but lost support by pushing answers over abstentions indiscriminately. This v6 packet keeps support-aware overclaim pressure and adds coverage pressure only for answerable rows that pass deterministic evidence-sufficiency checks, without training on final-window labels."
      : coverageAware
      ? "The Qwen 7B v4 comparison showed much better support than Qwen 3B but too much abstention. This v5 packet keeps support-aware overclaim pressure while adding answerable-row preferences that choose cited grounded answers over conservative abstention, without training on final-window labels."
      : curriculumVariant === "support_aware_v4"
      ? "The failure-driven v3 Qwen 3B smoke improved support but still overclaimed context/task/comparison details and answered some insufficient-evidence prompts. This v4 packet adds support-aware overclaim and insufficient-evidence preference rows without training on final-window labels."
      : "The first trained Qwen 3B smoke failed mostly through no-citation/too-short answers, invalid citation behavior, and spurious answers on insufficient evidence. This v3 packet adds explicit hard negatives for those failures without training on final-window labels.",
  },
  budget: {
    ...source.budget,
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet is generated from existing local rows. It makes no API/model calls and launches no GPU job.",
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
    prime_plan: rel(path.join(outputDir, "prime_gpu_plan.md")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(datasetDir, "sft_train.jsonl"), hardened.sft_train);
await writeJsonl(path.join(datasetDir, "sft_validation.jsonl"), hardened.sft_validation);
await writeJsonl(path.join(datasetDir, "dpo_train.jsonl"), hardened.dpo_train);
await writeJsonl(path.join(datasetDir, "dpo_validation.jsonl"), hardened.dpo_validation);
await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), hardened.eval_prompts);
await fs.writeFile(path.join(datasetDir, "README.md"), renderDatasetReadme(result));
await fs.writeFile(path.join(outputDir, "curriculum_manifest.json"), `${JSON.stringify(result.curriculum, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  examples: result.examples,
  synthetic_hard_negative_counts: result.curriculum.synthetic_hard_negative_counts,
  leakage_guard: result.curriculum.leakage_guard,
  budget: result.budget,
}, null, 2));

function hardenSftRow(row) {
  const messages = row.messages.map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  return {
    ...row,
    messages,
    curriculum_metadata: {
      ...(row.curriculum_metadata ?? {}),
      failure_driven_hardened_prompt: true,
    },
  };
}

function hardenDpoRow(row) {
  const prompt = row.prompt.map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  return {
    ...row,
    prompt,
    curriculum_metadata: {
      ...(row.curriculum_metadata ?? {}),
      failure_driven_hardened_prompt: true,
    },
  };
}

function hardenEvalRow(row) {
  const messages = row.messages.map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  return {
    ...row,
    messages,
    curriculum_metadata: {
      ...(row.curriculum_metadata ?? {}),
      failure_driven_hardened_prompt: true,
    },
  };
}

function syntheticDpoFromSft(row) {
  const target = parseAssistantTarget(row);
  if (!target) return null;
  const prompt = row.messages.slice(0, 2).map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  const answerType = target.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const rejected = answerType === "abstain" ? spuriousShortAnswer(row) : noCitationShortAnswer(target);
  const type = answerType === "abstain"
    ? "prefer_abstention_over_spurious_short_answer"
    : "prefer_cited_answer_over_no_citation_short_answer";
  return {
    example_id: `${row.example_id}:failure-driven-hard-negative`,
    task: "citation_grounded_domain_qa_joint_action_dpo",
    prompt,
    chosen: JSON.stringify(target),
    rejected: JSON.stringify(rejected),
    chosen_output: target,
    rejected_output: rejected,
    input: row.input,
    label_source: {
      type,
      source_example_id: row.example_id,
      source_packet_run_id: sourcePacketRunId,
      failure_run_id: failureRunId,
      rejection_reason: "Synthetic hard negative targets Qwen v1 no-citation, too-short, or spurious-answer failure modes.",
    },
    curriculum_metadata: {
      source_example_id: row.example_id,
      split: "synthetic_dpo_from_sft",
      failure_driven_hard_negative: true,
    },
  };
}

function supportAwareDpoFromSft(row) {
  const target = parseAssistantTarget(row);
  if (!target) return null;
  const prompt = row.messages.slice(0, 2).map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  const targetIsAbstain = target.answer_type === "abstain";
  const rejected = targetIsAbstain ? supportedSoundingInsufficientAnswer(row) : overclaimingAnswer(target, row);
  const type = targetIsAbstain
    ? "prefer_abstention_over_supported_sounding_insufficient_answer"
    : "prefer_directly_supported_answer_over_overclaim";
  return {
    example_id: `${row.example_id}:support-aware-v4-hard-negative`,
    task: "citation_grounded_domain_qa_joint_action_dpo",
    prompt,
    chosen: JSON.stringify(target),
    rejected: JSON.stringify(rejected),
    chosen_output: target,
    rejected_output: rejected,
    input: row.input,
    label_source: {
      type,
      source_example_id: row.example_id,
      source_packet_run_id: sourcePacketRunId,
      failure_run_id: failureRunId,
      rejection_reason: "Synthetic support-aware hard negative targets Qwen v3 unsupported context, task, model, comparison, and insufficient-evidence overclaiming failures.",
    },
    curriculum_metadata: {
      source_example_id: row.example_id,
      split: "support_aware_v4_synthetic_dpo_from_sft",
      failure_driven_hard_negative: true,
      support_aware_hard_negative: true,
    },
  };
}

function coverageAwareDpoFromSft(row) {
  const target = parseAssistantTarget(row);
  if (!target || target.answer_type === "abstain") return null;
  const prompt = row.messages.slice(0, 2).map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  const rejected = conservativeAbstention(row);
  return {
    example_id: `${row.example_id}:coverage-aware-v5-answer-over-abstain`,
    task: "citation_grounded_domain_qa_joint_action_dpo",
    prompt,
    chosen: JSON.stringify(target),
    rejected: JSON.stringify(rejected),
    chosen_output: target,
    rejected_output: rejected,
    input: row.input,
    label_source: {
      type: "prefer_supported_answer_over_conservative_abstention",
      source_example_id: row.example_id,
      source_packet_run_id: sourcePacketRunId,
      failure_run_id: failureRunId,
      rejection_reason: "Synthetic coverage-aware preference targets Qwen 7B v4 over-abstention on answerable prompts while keeping the chosen answer directly cited.",
    },
    curriculum_metadata: {
      source_example_id: row.example_id,
      split: "coverage_aware_v5_synthetic_dpo_from_sft",
      failure_driven_hard_negative: true,
      coverage_aware_hard_negative: true,
    },
  };
}

function answerabilityGatedCoverageDpoFromSft(row) {
  const target = parseAssistantTarget(row);
  if (!target || target.answer_type === "abstain") return null;
  const gate = evidenceSufficiencyGate(row, target);
  if (!gate.passed) return null;
  const prompt = row.messages.slice(0, 2).map((message, index) => index === 0 ? { ...message, content: hardenedSystem } : message);
  const rejected = conservativeAbstention(row);
  return {
    example_id: `${row.example_id}:answerability-gated-v6-answer-over-abstain`,
    task: "citation_grounded_domain_qa_joint_action_dpo",
    prompt,
    chosen: JSON.stringify(target),
    rejected: JSON.stringify(rejected),
    chosen_output: target,
    rejected_output: rejected,
    input: row.input,
    label_source: {
      type: "prefer_supported_answer_over_conservative_abstention_when_evidence_sufficient",
      source_example_id: row.example_id,
      source_packet_run_id: sourcePacketRunId,
      failure_run_id: failureRunId,
      evidence_sufficiency_gate: gate,
      rejection_reason: "Synthetic answerability-gated coverage preference targets Qwen 7B v4 over-abstention only when cited evidence directly overlaps the question and target answer.",
    },
    curriculum_metadata: {
      source_example_id: row.example_id,
      split: "answerability_gated_coverage_v6_synthetic_dpo_from_sft",
      failure_driven_hard_negative: true,
      coverage_aware_hard_negative: true,
      answerability_gated_coverage: true,
    },
  };
}

function parseAssistantTarget(row) {
  const content = row.messages?.[2]?.content;
  if (!content) return null;
  try {
    return normalizeOutput(JSON.parse(content));
  } catch {
    return null;
  }
}

function evidenceSufficiencyGate(row, target) {
  const question = String(row.input?.question ?? "");
  const answer = stripCitations(target.answer);
  const citations = Array.isArray(target.citations) ? target.citations : [];
  const evidencePack = Array.isArray(row.input?.compact_retrieved_evidence_pack) ? row.input.compact_retrieved_evidence_pack : [];
  const evidenceById = new Map(evidencePack.map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = citations.map((citation) => evidenceById.get(citation)?.text ?? "").join(" ");
  const citedSectionText = citations.map((citation) => evidenceById.get(citation)?.section ?? "").join(" ");
  const validCitations = citations.length > 0 && citations.every((citation) => evidenceById.has(citation));
  const inlineCitations = citations.every((citation) => String(target.answer ?? "").includes(`[${citation}]`));
  const questionTokens = contentTokens(question);
  const answerTokens = contentTokens(answer);
  const citedTokens = new Set(contentTokens(`${citedSectionText} ${citedText}`));
  const questionOverlap = overlapRate(questionTokens, citedTokens);
  const answerOverlap = overlapRate(answerTokens, citedTokens);
  const exactAnswerPhrase = answer.length >= 18 && citedText.toLowerCase().includes(answer.toLowerCase().replace(/\s*\[[^\]]+\]/g, "").slice(0, 80));
  const riskyQuestion = /\b(compare|compared|outperform|better|worse|higher|lower|baseline|state-of-the-art|best|improve|why|how|main|overall)\b/i.test(question);
  const numericAnswer = /\b\d+(?:\.\d+)?%?\b/.test(answer);
  const numericSupported = !numericAnswer || [...answer.matchAll(/\b\d+(?:\.\d+)?%?\b/g)].every((match) => citedText.includes(match[0]));
  const passed = validCitations
    && inlineCitations
    && numericSupported
    && answerTokens.length >= 3
    && answerOverlap >= 0.6
    && (questionOverlap >= 0.35 || exactAnswerPhrase)
    && (!riskyQuestion || answerOverlap >= 0.72);
  return {
    passed,
    valid_citations: validCitations,
    inline_citations: inlineCitations,
    numeric_supported: numericSupported,
    question_overlap: questionOverlap,
    answer_overlap: answerOverlap,
    risky_question: riskyQuestion,
  };
}

function contentTokens(value) {
  const stopwords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from", "has", "have", "how", "in", "is", "it", "of", "on", "or", "that", "the", "their", "there", "they", "this", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with",
  ]);
  return String(value ?? "")
    .toLowerCase()
    .replace(/bibref\d+|secref\d+|e\d+/g, " ")
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.filter((token) => !stopwords.has(token)) ?? [];
}

function overlapRate(tokens, candidateSet) {
  const unique = [...new Set(tokens)];
  if (!unique.length) return 0;
  return unique.filter((token) => candidateSet.has(token)).length / unique.length;
}

function normalizeOutput(value) {
  const answerType = value?.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value?.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: answerType === "abstain" ? "" : String(value?.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value?.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value?.abstention_reason ?? "Evidence is insufficient.") : "",
  };
}

function noCitationShortAnswer(target) {
  const stripped = stripCitations(target.answer).trim();
  const short = firstUsefulPhrase(stripped) || "Yes.";
  return {
    answer_type: "grounded_answer",
    answer: short,
    citations: [],
    claim_table: [],
    abstention_reason: "",
  };
}

function spuriousShortAnswer(row) {
  const question = String(row.input?.question ?? "").replace(/\?$/, "");
  return {
    answer_type: "grounded_answer",
    answer: question ? `Yes, ${question}.` : "Yes.",
    citations: [],
    claim_table: [],
    abstention_reason: "",
  };
}

function overclaimingAnswer(target, row) {
  const citations = Array.isArray(target.citations) ? target.citations : [];
  const citationText = citations.map((citation) => `[${citation}]`).join(" ");
  const unsupported = overclaimSentence(row);
  const baseAnswer = stripTrailingCitations(String(target.answer ?? "")).trim() || "The evidence supports the answer";
  return {
    answer_type: "grounded_answer",
    answer: `${baseAnswer}. ${unsupported}${citationText ? ` ${citationText}` : ""}`.replace(/\s+/g, " ").trim(),
    citations,
    claim_table: [
      ...(Array.isArray(target.claim_table) ? target.claim_table : []),
      {
        claim: unsupported.replace(/\.$/, ""),
        support: false,
        citations,
      },
    ],
    abstention_reason: "",
  };
}

function supportedSoundingInsufficientAnswer(row) {
  const evidenceIds = Array.isArray(row.input?.compact_retrieved_evidence_pack)
    ? row.input.compact_retrieved_evidence_pack.slice(0, 2).map((evidence) => evidence.evidence_id).filter(Boolean)
    : ["E1"];
  const citations = evidenceIds.length ? evidenceIds : ["E1"];
  const question = String(row.input?.question ?? "the requested claim").replace(/\?$/, "");
  return {
    answer_type: "grounded_answer",
    answer: `The evidence supports that ${question}. ${citations.map((citation) => `[${citation}]`).join(" ")}`,
    citations,
    claim_table: [
      {
        claim: `The evidence supports that ${question}.`,
        support: false,
        citations,
      },
    ],
    abstention_reason: "",
  };
}

function conservativeAbstention(row) {
  return {
    answer_type: "abstain",
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The evidence is insufficient to answer the question with direct citation support.",
  };
}

function overclaimSentence(row) {
  const question = String(row.input?.question ?? "").toLowerCase();
  if (/\bbaseline|compare|compared|improve|outperform|state-of-the-art|better|higher|lower|best\b/.test(question)) {
    return "This is the strongest overall comparison against the relevant baselines.";
  }
  if (/\bdataset|annotat|context|speaker|role|task|experiment|model\b/.test(question)) {
    return "This is the main experimental setting and dataset focus of the paper.";
  }
  return "This is a central finding of the paper and generalizes to the full experimental setting.";
}

function firstUsefulPhrase(value) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const beforeSemicolon = compact.split(/[.;]/)[0].trim();
  const tokens = beforeSemicolon.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 8).join(" ");
}

function stripCitations(value) {
  return String(value ?? "").replace(/\s*\[[^\]]+\]/g, "").trim();
}

function stripTrailingCitations(value) {
  return String(value ?? "").replace(/(?:\s*\[[^\]]+\])+\s*$/g, "").trim();
}

function summarizeRows(rowSets) {
  return {
    sft_train: summarizeSft(rowSets.sft_train),
    sft_validation: summarizeSft(rowSets.sft_validation),
    dpo_train: summarizeDpo(rowSets.dpo_train),
    dpo_validation: summarizeDpo(rowSets.dpo_validation),
    eval_prompts: { rows: rowSets.eval_prompts.length },
  };
}

function summarizeSft(rows) {
  return {
    rows: rows.length,
    label_source_counts: countBy(rows, (row) => row.label_source?.type ?? "unknown"),
  };
}

function summarizeDpo(rows) {
  return {
    rows: rows.length,
    label_source_counts: countBy(rows, (row) => row.label_source?.type ?? "unknown"),
    chosen_grounded: rows.filter((row) => safeParse(row.chosen)?.answer_type === "grounded_answer").length,
    chosen_abstain: rows.filter((row) => safeParse(row.chosen)?.answer_type === "abstain").length,
    rejected_no_citation_grounded: rows.filter((row) => {
      const rejected = safeParse(row.rejected);
      return rejected?.answer_type === "grounded_answer" && (!Array.isArray(rejected.citations) || rejected.citations.length === 0);
    }).length,
  };
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function renderDatasetReadme(result) {
  return `# Qwen 3B Failure-Driven Curriculum Packet

Source packet: \`${result.source_packet_run_id}\`

Failure audit: \`${result.failure_run_id}\`

This packet keeps the same final eval prompts and does not train on final-window labels. It hardens the instruction contract and adds synthetic DPO hard negatives from train/validation rows.

## Added Pressure

- Synthetic DPO train rows added: ${result.curriculum.synthetic_hard_negative_counts.dpo_train_added}
- No-citation answer hard negatives: ${result.curriculum.synthetic_hard_negative_counts.train_answer_hard_negatives}
- Spurious insufficient-evidence answer hard negatives: ${result.curriculum.synthetic_hard_negative_counts.train_abstention_hard_negatives}

## Failure Signal

\`\`\`json
${JSON.stringify(result.curriculum.failure_signal.tag_counts, null, 2)}
\`\`\`

## Support-Aware v4 Additions

- Support-aware DPO train rows added: ${result.examples.support_aware_dpo_train_added ?? 0}
- Support-aware DPO validation rows added: ${result.examples.support_aware_dpo_validation_added ?? 0}
- Train overclaim hard negatives: ${result.curriculum.synthetic_hard_negative_counts.train_support_aware_overclaim_negatives ?? 0}
- Train insufficient-evidence hard negatives: ${result.curriculum.synthetic_hard_negative_counts.train_support_aware_insufficient_negatives ?? 0}

## Coverage-Aware v5 Additions

- Coverage-aware DPO train rows added: ${result.examples.coverage_aware_dpo_train_added ?? 0}
- Coverage-aware DPO validation rows added: ${result.examples.coverage_aware_dpo_validation_added ?? 0}
- Train answer-over-abstain preferences: ${result.curriculum.synthetic_hard_negative_counts.train_coverage_aware_answer_over_abstain ?? 0}

## Answerability-Gated Coverage v6 Additions

- Gated coverage DPO train rows added: ${result.examples.answerability_gated_coverage_dpo_train_added ?? 0}
- Gated coverage DPO validation rows added: ${result.examples.answerability_gated_coverage_dpo_validation_added ?? 0}
- Train gated answer-over-abstain preferences: ${result.curriculum.synthetic_hard_negative_counts.train_answerability_gated_coverage_answer_over_abstain ?? 0}
- Train answerable rows rejected by sufficiency gate: ${result.curriculum.synthetic_hard_negative_counts.train_answerability_gated_coverage_rejected_answerable_rows ?? 0}
`;
}

function renderReport(result) {
  const source = result.curriculum.source_counts;
  const current = result.curriculum.curriculum_counts;
  return `# Qwen 3B Failure-Driven Curriculum Packet

Run id: \`${result.run_id}\`

Source packet: \`${result.source_packet_run_id}\`

Failure audit: \`${result.failure_run_id}\`

## Purpose

The first trained Qwen 3B smoke failed on support despite good JSON validity. This packet targets the observed no-citation, too-short, invalid-citation, and counterfactual-answering failure modes before any larger model escalation.

## Policy Changes

${result.curriculum.policy_changes.map((item) => `- ${item}`).join("\n")}

## Counts

| Split | Source rows | New rows |
| --- | ---: | ---: |
| SFT train | ${source.sft_train.rows} | ${current.sft_train.rows} |
| SFT validation | ${source.sft_validation.rows} | ${current.sft_validation.rows} |
| DPO train | ${source.dpo_train.rows} | ${current.dpo_train.rows} |
| DPO validation | ${source.dpo_validation.rows} | ${current.dpo_validation.rows} |
| Eval prompts | ${source.eval_prompts.rows} | ${current.eval_prompts.rows} |

## Synthetic Hard Negatives

| DPO train added | DPO validation added | Train no-citation negatives | Train spurious abstention negatives | Train overclaim negatives | Train insufficient-evidence negatives | Train blanket answer-over-abstain | Train gated answer-over-abstain | Train answerable rows rejected by gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.curriculum.synthetic_hard_negative_counts.dpo_train_added} | ${result.curriculum.synthetic_hard_negative_counts.dpo_validation_added} | ${result.curriculum.synthetic_hard_negative_counts.train_answer_hard_negatives} | ${result.curriculum.synthetic_hard_negative_counts.train_abstention_hard_negatives} | ${result.curriculum.synthetic_hard_negative_counts.train_support_aware_overclaim_negatives ?? 0} | ${result.curriculum.synthetic_hard_negative_counts.train_support_aware_insufficient_negatives ?? 0} | ${result.curriculum.synthetic_hard_negative_counts.train_coverage_aware_answer_over_abstain ?? 0} | ${result.curriculum.synthetic_hard_negative_counts.train_answerability_gated_coverage_answer_over_abstain ?? 0} | ${result.curriculum.synthetic_hard_negative_counts.train_answerability_gated_coverage_rejected_answerable_rows ?? 0} |

## Leakage Guard

- Eval example ids unchanged: ${result.curriculum.leakage_guard.eval_example_ids_unchanged ? "yes" : "no"}
- Eval references unchanged: ${result.curriculum.leakage_guard.eval_references_unchanged ? "yes" : "no"}
- Eval system prompt hardened: ${result.curriculum.leakage_guard.eval_system_prompt_hardened ? "yes" : "no"}
- Final-window failure labels used for training: ${result.curriculum.leakage_guard.final_window_failure_labels_used_for_training ? "yes" : "no"}

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
