import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "listwise-supervision-packet-audit-0-320-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const pairSources = [
  {
    run_id: "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1",
    file: "train_pairwise.jsonl",
    source_type: "margin_compatible_answer_support",
  },
  {
    run_id: "support-ranker-pairwise-packet-expanded-2026-06-28-v1",
    file: "train_pairwise.jsonl",
    source_type: "support_ranker_train",
  },
  {
    run_id: "support-ranker-pairwise-packet-expanded-2026-06-28-v1",
    file: "validation_pairwise.jsonl",
    source_type: "support_ranker_validation",
  },
  {
    run_id: "qwen-frontier-pool-support-packet-2026-06-28-v1",
    file: "train_contrast_pairs.jsonl",
    source_type: "qwen_frontier_train",
  },
  {
    run_id: "qwen-frontier-pool-support-packet-2026-06-28-v1",
    file: "validation_contrast_pairs.jsonl",
    source_type: "qwen_frontier_validation",
  },
  {
    run_id: "abstention-boundary-listwise-packet-160-320-2026-06-28-v1",
    file: "boundary_pairs.jsonl",
    source_type: "abstention_boundary",
  },
];
const targetLabelRuns = [
  "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1",
  "hard-target-label-batch-run-gpt4o-mini-2026-06-28-v1",
];
const preservationRunId = "preservation-pair-mining-audit-0-320-2026-06-28-v1";
const structuralRunId = "structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const readinessRunId = "current-readiness-audit-2026-06-28-v1";
const finalHeldoutRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const structural = await readJson(path.join(runsDir, structuralRunId, "result.json"));
const readiness = await readJson(path.join(runsDir, readinessRunId, "result.json"));
const pairRows = [];
for (const source of pairSources) {
  const rows = await readJsonl(path.join(runsDir, source.run_id, source.file));
  pairRows.push(...rows.map((row) => ({ ...row, audit_source_type: source.source_type, audit_source_run_id: source.run_id })));
}
const preservationPairs = await readJsonl(path.join(runsDir, preservationRunId, "preservation_pairs.jsonl"));
const targetLabelRows = [];
for (const runIdValue of targetLabelRuns) {
  const requests = new Map((await readJsonl(path.join(runsDir, runIdValue, "requests.jsonl"))).map((row) => [row.request_id, row]));
  const judgments = await readJsonl(path.join(runsDir, runIdValue, "judgments.jsonl"));
  for (const judgment of judgments) {
    if (judgment.skipped || judgment.duplicate_calibration) continue;
    const request = requests.get(judgment.request_id);
    if (!request) continue;
    targetLabelRows.push({ run_id: runIdValue, request, judgment });
  }
}
const finalPairs = await readJsonl(path.join(runsDir, finalHeldoutRunId, "heldout_pairwise.jsonl"));
const structuralFinalRows = await readJsonl(path.join(runsDir, structuralRunId, "selected_final_predictions.jsonl"));

const examples = new Map();
const sourcePairCandidates = [];
for (const pair of pairRows) {
  if (Number(pair.source_index) >= 321) continue;
  addCandidate(examples, pair, pair.chosen, {
    source_kind: "pairwise_supported_answer",
    support_label: pair.chosen?.answer_type === "abstain" ? "supported_abstention" : "supported_answer",
    target_complete_label: null,
    role: "chosen",
  });
  addCandidate(examples, pair, pair.rejected, {
    source_kind: "pairwise_rejected_answer",
    support_label: pair.rejected?.answer_type === "abstain" ? "unsupported_abstention" : "unsupported_answer",
    target_complete_label: null,
    role: "rejected",
  });
  sourcePairCandidates.push(pairCandidateSummary(pair, pair.chosen, "chosen"));
  sourcePairCandidates.push(pairCandidateSummary(pair, pair.rejected, "rejected"));
}

for (const row of targetLabelRows) {
  const input = row.request.input;
  const basePair = {
    pair_id: row.judgment.pair_id,
    example_id: row.judgment.root_example_id,
    root_example_id: row.judgment.root_example_id,
    source_index: row.judgment.source_index,
    split: row.judgment.train_split,
    contrast_type: row.request.metadata?.contrast_type,
    input: {
      question: input.question,
      compact_retrieved_evidence_pack: input.evidence_pack,
      document_metadata: input.document_metadata,
    },
    audit_source_run_id: row.run_id,
    audit_source_type: "paid_question_target_completeness_label",
  };
  addCandidate(examples, basePair, input.candidate_chosen, {
    source_kind: "target_completeness_candidate",
    support_label: null,
    target_complete_label: row.judgment.judgment?.chosen_question_target_complete ? "target_complete" : "target_incomplete",
    role: "chosen",
  });
  addCandidate(examples, basePair, input.candidate_rejected, {
    source_kind: "target_completeness_candidate",
    support_label: null,
    target_complete_label: row.judgment.judgment?.rejected_question_target_complete ? "target_complete" : "target_incomplete",
    role: "rejected",
  });
}

const listwiseRows = [...examples.values()].map((example) => finalizeExample(example)).sort((left, right) =>
  Number(left.source_index ?? 0) - Number(right.source_index ?? 0)
  || left.example_id.localeCompare(right.example_id)
);
const trainRows = listwiseRows.filter((row) => Number(row.source_index) < 240);
const validationRows = listwiseRows.filter((row) => Number(row.source_index) >= 240 && Number(row.source_index) < 321);
const finalProfile = profileFinalPairs(finalPairs, structuralFinalRows);
const nonfinalProfile = profileListwiseRows(listwiseRows);
const preservationSummary = summarizePreservationPairs(preservationPairs);
const sourceSummary = summarizeSources(pairRows, targetLabelRows);
const readinessBlockers = readiness.summary?.blocking_failures ?? [];
const status = statusFor({ trainRows, validationRows, nonfinalProfile });

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "listwise_supervision_packet_audit",
  status,
  purpose: "Consolidate existing non-final support, abstention, preservation, and question-target labels into a leakage-safe listwise supervision inventory before another selector or GPU run.",
  source_runs: {
    pair_sources: pairSources,
    target_label_runs: targetLabelRuns,
    preservation_pair_mining_audit: preservationRunId,
    structural_target_verifier_audit: structuralRunId,
    current_readiness_audit: readinessRunId,
    final_margin_compatible_heldout_packet: finalHeldoutRunId,
  },
  data: {
    nonfinal_pair_rows: pairRows.length,
    paid_target_label_rows: targetLabelRows.length,
    preservation_pairs: preservationPairs.length,
    listwise_examples: listwiseRows.length,
    train_examples: trainRows.length,
    validation_examples: validationRows.length,
    candidates: sum(listwiseRows.map((row) => row.candidates.length)),
  },
  source_summary: sourceSummary,
  nonfinal_listwise_profile: nonfinalProfile,
  validation_profile: profileListwiseRows(validationRows),
  preservation_summary: preservationSummary,
  final_heldout_profile_for_reporting_only: finalProfile,
  coverage_gaps: coverageGaps(nonfinalProfile, finalProfile),
  structural_context: {
    selected_policy_id: structural.selected_by_nonfinal_labels?.policy_id,
    selected_nonfinal_balanced_accuracy: structural.selected_by_nonfinal_labels?.nonfinal_candidate_labels?.balanced_accuracy,
    selected_final_pair_transfer_accuracy: structural.selected_by_nonfinal_labels?.final_pair_transfer?.accuracy,
  },
  readiness_context: {
    run_id: readinessRunId,
    status: readiness.status,
    blocking_failures: readinessBlockers,
    next_step: readiness.decision?.next_step,
  },
  decision: decisionFromStatus(status, nonfinalProfile, finalProfile),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_pairs_used_for_reporting_only: true,
    nonfinal_source_index_max: Math.max(...listwiseRows.map((row) => Number(row.source_index)).filter(Number.isFinite)),
    final_source_index_min: Math.min(...finalPairs.map((row) => Number(row.source_index ?? Infinity))),
    paid_openai_labels_already_ledgered: true,
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
    note: "Zero-call audit over existing paid labels, judged pairwise packets, and frozen final heldout metadata.",
  },
  artifacts: {
    listwise_examples_jsonl: rel(path.join(outputDir, "listwise_examples.jsonl")),
    candidate_inventory_jsonl: rel(path.join(outputDir, "candidate_inventory.jsonl")),
    final_analog_profile_json: rel(path.join(outputDir, "final_analog_profile.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "listwise_examples.jsonl"), listwiseRows);
await writeJsonl(path.join(outputDir, "candidate_inventory.jsonl"), listwiseRows.flatMap((row) => row.candidates.map((candidate) => ({
  example_id: row.example_id,
  source_index: row.source_index,
  question_type: row.question_type,
  ...candidate,
}))));
await fs.writeFile(path.join(outputDir, "final_analog_profile.json"), `${JSON.stringify(finalProfile, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  nonfinal_listwise_profile: result.nonfinal_listwise_profile,
  coverage_gaps: result.coverage_gaps,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function addCandidate(examples, pair, candidate, labels) {
  if (!candidate) return;
  const exampleId = pair.example_id ?? pair.root_example_id;
  if (!exampleId || Number(pair.source_index) >= 321) return;
  const question = pair.input?.question ?? "";
  if (!examples.has(exampleId)) {
    examples.set(exampleId, {
      example_id: exampleId,
      source_index: Number(pair.source_index),
      split: Number(pair.source_index) < 240 ? "train" : "validation",
      question,
      question_type: classifyQuestion(question),
      input: pair.input,
      candidateMap: new Map(),
      source_pair_ids: new Set(),
      source_runs: new Set(),
    });
  }
  const example = examples.get(exampleId);
  example.source_pair_ids.add(pair.pair_id);
  example.source_runs.add(pair.audit_source_run_id);
  const id = candidate.id ?? `${pair.pair_id}:${labels.role}`;
  if (!example.candidateMap.has(id)) {
    example.candidateMap.set(id, {
      candidate_id: id,
      family: candidate.family ?? "unknown",
      prediction_run_id: candidate.prediction_run_id ?? null,
      answer_type: candidate.answer_type ?? "grounded_answer",
      answer: candidate.answer ?? "",
      citations: normalizeCitations(candidate.citations),
      claim_count: Array.isArray(candidate.claim_table) ? candidate.claim_table.length : 0,
      answer_tokens: contentTokens(candidate.answer).length,
      support_labels: new Set(),
      target_complete_labels: new Set(),
      source_kinds: new Set(),
      roles: new Set(),
      unsupported_claim_count: (candidate.unsupported_claims ?? candidate.judgment?.unsupported_claims ?? []).length,
      inline_complete: inlineComplete(candidate),
      question_overlap: jaccard(contentTokens(question), contentTokens(candidate.answer)),
    });
  }
  const existing = example.candidateMap.get(id);
  if (labels.support_label) existing.support_labels.add(labels.support_label);
  if (labels.target_complete_label) existing.target_complete_labels.add(labels.target_complete_label);
  existing.source_kinds.add(labels.source_kind);
  existing.roles.add(labels.role);
}

function finalizeExample(example) {
  const candidates = [...example.candidateMap.values()].map((candidate) => {
    const supportLabels = [...candidate.support_labels].sort();
    const targetLabels = [...candidate.target_complete_labels].sort();
    const supportedAnswer = supportLabels.includes("supported_answer");
    const supportedAbstention = supportLabels.includes("supported_abstention");
    const unsafeAnswer = supportLabels.includes("unsupported_answer") || candidate.unsupported_claim_count > 0;
    const targetComplete = targetLabels.includes("target_complete");
    const targetIncomplete = targetLabels.includes("target_incomplete");
    return {
      ...candidate,
      support_labels: supportLabels,
      target_complete_labels: targetLabels,
      source_kinds: [...candidate.source_kinds].sort(),
      roles: [...candidate.roles].sort(),
      label_summary: {
        supported_answer: supportedAnswer,
        supported_abstention: supportedAbstention,
        unsafe_answer: unsafeAnswer,
        target_complete: targetComplete,
        target_incomplete: targetIncomplete,
        train_positive: supportedAnswer || supportedAbstention || targetComplete,
        train_negative: unsafeAnswer || targetIncomplete,
      },
    };
  }).sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  return {
    example_id: example.example_id,
    source_index: example.source_index,
    split: example.split,
    question: example.question,
    question_type: example.question_type,
    source_pair_count: example.source_pair_ids.size,
    source_runs: [...example.source_runs].filter(Boolean).sort(),
    candidates,
    supervision: {
      candidate_count: candidates.length,
      supported_answer_candidates: candidates.filter((row) => row.label_summary.supported_answer).length,
      supported_abstention_candidates: candidates.filter((row) => row.label_summary.supported_abstention).length,
      unsafe_answer_candidates: candidates.filter((row) => row.label_summary.unsafe_answer).length,
      target_complete_candidates: candidates.filter((row) => row.label_summary.target_complete).length,
      target_incomplete_candidates: candidates.filter((row) => row.label_summary.target_incomplete).length,
      has_positive_and_negative: candidates.some((row) => row.label_summary.train_positive) && candidates.some((row) => row.label_summary.train_negative),
      has_abstention_boundary: candidates.some((row) => row.answer_type === "abstain") && candidates.some((row) => row.answer_type === "grounded_answer"),
    },
  };
}

function profileListwiseRows(rows) {
  const candidates = rows.flatMap((row) => row.candidates);
  return {
    examples: rows.length,
    candidates: candidates.length,
    examples_with_positive_and_negative: rows.filter((row) => row.supervision.has_positive_and_negative).length,
    examples_with_abstention_boundary: rows.filter((row) => row.supervision.has_abstention_boundary).length,
    supported_answer_candidates: candidates.filter((row) => row.label_summary.supported_answer).length,
    supported_abstention_candidates: candidates.filter((row) => row.label_summary.supported_abstention).length,
    unsafe_answer_candidates: candidates.filter((row) => row.label_summary.unsafe_answer).length,
    target_complete_candidates: candidates.filter((row) => row.label_summary.target_complete).length,
    target_incomplete_candidates: candidates.filter((row) => row.label_summary.target_incomplete).length,
    qwen_family_candidates: candidates.filter((row) => /qwen/i.test(row.family) || /qwen/i.test(row.prediction_run_id ?? "")).length,
    openai_scaffold_candidates: candidates.filter((row) => /openai|mini|scaffold/i.test(row.family) || /mini|direct|claim-prun/i.test(row.prediction_run_id ?? "")).length,
    question_type_counts: countBy(rows, (row) => row.question_type),
    hard_negative_counts: {
      unsupported_claim: candidates.filter((row) => row.unsupported_claim_count > 0).length,
      target_incomplete: candidates.filter((row) => row.label_summary.target_incomplete).length,
      numeric_or_comparison_questions: rows.filter((row) => ["numeric", "comparison"].includes(row.question_type)).length,
      list_or_entity_questions: rows.filter((row) => row.question_type === "list_or_entity").length,
      citation_contract_failures: candidates.filter((row) => row.answer_type === "grounded_answer" && !row.inline_complete).length,
    },
  };
}

function profileFinalPairs(finalRows, structuralRows) {
  const structuralByPair = new Map(structuralRows.map((row) => [row.pair_id, row]));
  const questionTypes = countBy(finalRows, (row) => classifyQuestion(row.input?.question ?? ""));
  const structural = finalRows.map((row) => structuralByPair.get(row.pair_id)).filter(Boolean);
  return {
    pairs: finalRows.length,
    examples: new Set(finalRows.map((row) => row.example_id)).size,
    question_type_counts: questionTypes,
    structural_pair_errors: structural.filter((row) => row.correct === false).length,
    d314_errors_rescued_by_structural: structural.filter((row) => row.correct === true && row.d314_correct === false).length,
    structural_regressions_vs_d314: structural.filter((row) => row.correct === false && row.d314_correct === true).length,
    hard_pair_counts: {
      rejected_has_unsupported_penalty: structural.filter((row) => row.rejected_features?.unsupported_penalty > 0).length,
      chosen_lower_target_recall: structural.filter((row) => Number(row.chosen_features?.target_recall ?? 0) < Number(row.rejected_features?.target_recall ?? 0)).length,
      chosen_fewer_citations: structural.filter((row) => Number(row.chosen_features?.citation_count ?? 0) < Number(row.rejected_features?.citation_count ?? 0)).length,
      list_or_entity: structural.filter((row) => row.chosen_features?.question_type === "list_or_entity").length,
      numeric: structural.filter((row) => row.chosen_features?.question_type === "numeric").length,
    },
  };
}

function coverageGaps(nonfinal, finalProfile) {
  const nonfinalTypes = nonfinal.question_type_counts ?? {};
  const finalTypes = finalProfile.question_type_counts ?? {};
  const missingQuestionTypes = Object.entries(finalTypes)
    .filter(([key, value]) => value > 0 && Number(nonfinalTypes[key] ?? 0) < Math.min(5, value))
    .map(([key]) => key);
  return {
    missing_or_thin_question_types: missingQuestionTypes,
    abstention_boundary_examples: nonfinal.examples_with_abstention_boundary,
    needs_more_abstention_boundaries: nonfinal.examples_with_abstention_boundary < 25,
    needs_more_qwen_candidate_coverage: nonfinal.qwen_family_candidates < 100,
    needs_more_target_incomplete_negatives: nonfinal.target_incomplete_candidates < 80,
    final_structural_errors_remaining: finalProfile.structural_pair_errors,
  };
}

function summarizeSources(rows, targetRows) {
  return {
    pair_rows_by_source: countBy(rows, (row) => row.audit_source_type),
    target_rows_by_run: countBy(targetRows, (row) => row.run_id),
    source_index_range: {
      min: Math.min(...rows.map((row) => Number(row.source_index ?? Infinity)), ...targetRows.map((row) => Number(row.judgment.source_index ?? Infinity))),
      max: Math.max(...rows.map((row) => Number(row.source_index ?? -Infinity)), ...targetRows.map((row) => Number(row.judgment.source_index ?? -Infinity))),
    },
  };
}

function summarizePreservationPairs(rows) {
  return {
    pairs: rows.length,
    labels: countBy(rows, (row) => row.preservation_label),
    objectives: countBy(rows, (row) => row.objective),
    examples: new Set(rows.map((row) => row.example_id)).size,
  };
}

function statusFor({ trainRows, validationRows, nonfinalProfile }) {
  if (trainRows.length >= 80
    && validationRows.length >= 30
    && nonfinalProfile.examples_with_positive_and_negative >= 80
    && nonfinalProfile.target_incomplete_candidates >= 80
    && nonfinalProfile.examples_with_abstention_boundary >= 25) {
    return "listwise_supervision_ready_for_selector_training";
  }
  if (nonfinalProfile.examples >= 100
    && validationRows.length >= 40
    && nonfinalProfile.examples_with_positive_and_negative >= 100
    && nonfinalProfile.target_incomplete_candidates >= 80
    && nonfinalProfile.examples_with_abstention_boundary >= 25) {
    return "listwise_supervision_ready_for_cross_window_selector_probe";
  }
  return "listwise_supervision_needs_more_nonfinal_coverage";
}

function decisionFromStatus(status, nonfinal, finalProfile) {
  if (status === "listwise_supervision_ready_for_selector_training") {
    return {
      train_selector_now: true,
      buy_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Train a zero-call listwise selector on this packet before any new GPU launch.",
      reason: "The packet has enough non-final positives, negatives, target-incomplete rows, and abstention boundaries for a selector probe.",
    };
  }
  if (status === "listwise_supervision_ready_for_cross_window_selector_probe") {
    return {
      train_selector_now: true,
      buy_openai_labels_now: false,
      launch_gpu_now: false,
      next_step: "Train a zero-call cross-window listwise selector probe from this packet before any new GPU launch.",
      reason: `The expanded packet has ${nonfinal.examples} non-final examples, ${nonfinal.examples_with_positive_and_negative} positive/negative examples, ${nonfinal.target_incomplete_candidates} target-incomplete candidates, and ${nonfinal.examples_with_abstention_boundary} abstention-boundary examples; fixed split train rows are still modest, so use cross-window validation rather than a single holdout.`,
    };
  }
  return {
    train_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Expand non-final listwise supervision before training a new selector or launching GPU.",
    reason: `The packet has ${nonfinal.examples} examples and ${nonfinal.examples_with_abstention_boundary} abstention-boundary examples while final heldout still has ${finalProfile.structural_pair_errors} structural pair errors; more non-final coverage is needed before a selector probe.`,
  };
}

function pairCandidateSummary(pair, candidate, role) {
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id ?? pair.root_example_id,
    source_index: pair.source_index,
    role,
    candidate_id: candidate?.id ?? null,
    family: candidate?.family ?? null,
    answer_type: candidate?.answer_type ?? null,
  };
}

function classifyQuestion(question) {
  const q = String(question ?? "").toLowerCase();
  if (/^(is|are|was|were|do|does|did|can|could|should|has|have)\b/.test(q)) return "yes_no";
  if (/\b(how many|how much|percentage|percent|ratio|score|number|size|large)\b/.test(q)) return "numeric";
  if (/\b(compare|compared|difference|improve|improvement|better|worse|more|less|fewer)\b/.test(q)) return "comparison";
  if (/\b(what datasets|which datasets|what models|which models|what methods|which methods|list|what are|which are)\b/.test(q)) return "list_or_entity";
  if (/\b(how|why)\b/.test(q)) return "method_or_explanation";
  return "factoid";
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, "")).filter(Boolean);
}

function inlineComplete(candidate) {
  if (candidate?.answer_type !== "grounded_answer") return true;
  const answer = String(candidate.answer ?? "");
  const citations = normalizeCitations(candidate.citations);
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) return 1;
  const union = new Set([...leftSet, ...rightSet]);
  return [...leftSet].filter((token) => rightSet.has(token)).length / union.size;
}

function countBy(rows, fn) {
  const counts = {};
  for (const row of rows) {
    const key = fn(row) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function renderReport(result) {
  return `# Listwise Supervision Packet Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no new OpenAI calls and launches no compute.

## Data

| Split | Examples | Candidates |
| --- | ---: | ---: |
| All non-final | ${result.data.listwise_examples} | ${result.data.candidates} |
| Train | ${result.data.train_examples} | ${sum(result.nonfinal_listwise_profile ? [0] : [0]) + result.nonfinal_listwise_profile.candidates - result.validation_profile.candidates} |
| Validation | ${result.data.validation_examples} | ${result.validation_profile.candidates} |

## Supervision

- Positive+negative examples: ${result.nonfinal_listwise_profile.examples_with_positive_and_negative}
- Abstention-boundary examples: ${result.nonfinal_listwise_profile.examples_with_abstention_boundary}
- Supported-answer candidates: ${result.nonfinal_listwise_profile.supported_answer_candidates}
- Unsafe-answer candidates: ${result.nonfinal_listwise_profile.unsafe_answer_candidates}
- Target-incomplete candidates: ${result.nonfinal_listwise_profile.target_incomplete_candidates}
- Preservation pairs available: ${result.preservation_summary.pairs}

## Final Reporting Profile

- Frozen final pairs: ${result.final_heldout_profile_for_reporting_only.pairs}
- Final structural pair errors remaining: ${result.final_heldout_profile_for_reporting_only.structural_pair_errors}
- Structural regressions vs D314: ${result.final_heldout_profile_for_reporting_only.structural_regressions_vs_d314}

## Decision

- Train selector now: ${result.decision.train_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
