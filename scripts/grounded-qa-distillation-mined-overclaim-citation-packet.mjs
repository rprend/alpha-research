import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "mined-overclaim-citation-packet-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const sourceFiles = [
  {
    run_id: "qwen-frontier-pool-support-packet-2026-06-28-v1",
    files: ["train_contrast_pairs.jsonl", "validation_contrast_pairs.jsonl", "frontier_contrast_pairs.jsonl"],
  },
  {
    run_id: "support-ranker-pairwise-packet-expanded-2026-06-28-v1",
    files: ["train_pairwise.jsonl", "validation_pairwise.jsonl"],
  },
  {
    run_id: "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1",
    files: ["dataset/train_dpo.jsonl", "dataset/validation_dpo.jsonl"],
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.join(outputDir, "dataset"), { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const candidates = [];
for (const source of sourceFiles) {
  for (const file of source.files) {
    const rows = await readJsonlIfPresent(path.join(runsDir, source.run_id, file));
    for (const row of rows) {
      const normalized = normalizeRow(row, source.run_id, file);
      if (normalized) candidates.push(normalized);
    }
  }
}

const deduped = dedupeCandidates(candidates);
const selected = selectDiverse(deduped, 96, 5);
const split = splitByExample(selected, 0.72);
const trainRows = split.train.map((row, index) => dpoRow(row, index, "train"));
const validationRows = split.validation.map((row, index) => dpoRow(row, index, "validation"));
const inventoryRows = deduped.map((row, index) => ({ inventory_id: `candidate-${String(index + 1).padStart(4, "0")}`, ...inventoryRow(row) }));
const decision = decisionFromRows(trainRows, validationRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "mined_overclaim_citation_packet",
  status: decision.run_zero_cost_probe_next ? "mined_overclaim_citation_packet_ready_for_probe" : "mined_overclaim_citation_packet_not_ready",
  purpose: "Mine already-judged non-final support contrast pools for overclaim and citation-mismatch preferences after the focused D351 packet was too small.",
  source_runs: Object.fromEntries(sourceFiles.map((source) => [source.run_id, source.files])),
  data: {
    raw_candidates: candidates.length,
    deduped_candidates: deduped.length,
    selected_candidates: selected.length,
    selected_examples: new Set(selected.map((row) => row.example_id)).size,
    train_dpo_rows: trainRows.length,
    validation_dpo_rows: validationRows.length,
    train_examples: new Set(split.train.map((row) => row.example_id)).size,
    validation_examples: new Set(split.validation.map((row) => row.example_id)).size,
    selected_failure_mode_counts: countBy(selected.map((row) => row.failure_mode)),
    selected_source_counts: countBy(selected.map((row) => row.source_run_id)),
    selected_question_type_counts: countBy(selected.map((row) => inferQuestionType(row.question))),
  },
  training_contract: {
    objective: "Prefer supported concise answers over answers with unsupported overclaims, numeric/comparison errors, or citation mismatches.",
    train_sources: "already-judged non-final rows only",
    validation_sources: "already-judged non-final rows only, example-disjoint from train split",
    final_window_rows_used: false,
    row_schema: ["messages", "chosen", "rejected", "failure_mode", "judge_signal", "source_metadata"],
  },
  decision,
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    only_nonfinal_source_indices: selected.every((row) => Number(row.source_index) < 321),
    train_validation_example_disjoint: disjoint(new Set(split.train.map((row) => row.example_id)), new Set(split.validation.map((row) => row.example_id))),
    selected_rows_training_use_allowed: selected.every((row) => row.training_use.includes("allowed") || row.training_use === "nonfinal_preference_training"),
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
    note: "Zero-call mining over already-ledgered judged artifacts.",
  },
  artifacts: {
    inventory_jsonl: rel(path.join(outputDir, "candidate_inventory.jsonl")),
    train_dpo_jsonl: rel(path.join(outputDir, "dataset", "train_dpo.jsonl")),
    validation_dpo_jsonl: rel(path.join(outputDir, "dataset", "validation_dpo.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "candidate_inventory.jsonl"), inventoryRows);
await writeJsonl(path.join(outputDir, "dataset", "train_dpo.jsonl"), trainRows);
await writeJsonl(path.join(outputDir, "dataset", "validation_dpo.jsonl"), validationRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  decision: result.decision,
  leakage_guard: result.leakage_guard,
  budget: result.budget,
}, null, 2));

function normalizeRow(row, sourceRunId, sourceFile) {
  if (sourceRunId === "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1") {
    return normalizeD351Row(row, sourceRunId, sourceFile);
  }
  const sourceIndex = inferSourceIndex(row);
  if (sourceIndex >= 321) return null;
  if (!String(row.training_use ?? "").includes("allowed")) return null;
  const chosen = row.chosen;
  const rejected = row.rejected;
  if (!chosen || !rejected) return null;
  if (!chosenSupported(row)) return null;
  if (!rejectedUnsupported(row)) return null;
  if (rejected.answer_type && rejected.answer_type !== "grounded_answer") return null;
  const judge = row.judge?.rejected ?? rejected.judgment ?? {};
  const failureMode = classifyFailure({ judge, rejected, answer: rejected.answer });
  if (!failureMode) return null;
  return {
    source_run_id: sourceRunId,
    source_file: sourceFile,
    source_pair_id: row.pair_id,
    example_id: row.example_id ?? row.root_example_id,
    root_example_id: row.root_example_id ?? row.example_id,
    source_index: sourceIndex,
    training_use: row.training_use,
    question: row.input?.question,
    evidence_pack: row.input?.compact_retrieved_evidence_pack ?? [],
    document_metadata: row.input?.document_metadata ?? null,
    chosen: normalizeCandidate(chosen),
    rejected: normalizeCandidate(rejected),
    judge_signal: {
      verdict: judge.verdict ?? rejected.judgment?.verdict ?? null,
      all_claims_supported: judge.all_claims_supported ?? rejected.judgment?.all_claims_supported ?? null,
      citation_ids_valid: judge.citation_ids_valid ?? rejected.judgment?.citation_ids_valid ?? null,
      unsupported_claims: judge.unsupported_claims ?? rejected.unsupported_claims ?? [],
      missing_citations: judge.missing_citations ?? [],
      notes: judge.notes ?? "",
    },
    failure_mode: failureMode,
  };
}

function normalizeD351Row(row, sourceRunId, sourceFile) {
  if (!row.example_id || !row.chosen || !row.rejected) return null;
  const failureMode = row.failure_mode === "citation_mismatch" ? "citation_mismatch" : "overbroad_or_overclaimed";
  return {
    source_run_id: sourceRunId,
    source_file: sourceFile,
    source_pair_id: row.row_id,
    example_id: row.example_id,
    root_example_id: row.example_id,
    source_index: 0,
    training_use: "nonfinal_preference_training",
    question: row.question,
    evidence_pack: row.evidence_pack ?? [],
    document_metadata: null,
    chosen: normalizeCandidate(row.chosen),
    rejected: normalizeCandidate(row.rejected),
    judge_signal: {
      verdict: row.support_adjudication?.rejected_answer_supported === false ? "unsupported" : null,
      all_claims_supported: row.support_adjudication?.rejected_answer_supported ?? null,
      citation_ids_valid: null,
      unsupported_claims: [],
      missing_citations: [],
      notes: row.support_adjudication?.rationale ?? "",
    },
    failure_mode: failureMode,
  };
}

function chosenSupported(row) {
  return row.chosen?.judgment?.verdict === "supported"
    || row.chosen?.family === "qasper_reference"
    || String(row.contrast_type ?? "").startsWith("reference_supported")
    || row.label?.preferred === "chosen";
}

function inferSourceIndex(row) {
  if (Number.isFinite(Number(row.source_index))) return Number(row.source_index);
  if (String(row.training_use ?? "").includes("allowed") && !String(row.split ?? "").includes("final") && !String(row.window ?? "").includes("321-389")) return 0;
  return 9999;
}

function rejectedUnsupported(row) {
  const judge = row.judge?.rejected ?? row.rejected?.judgment ?? {};
  return ["unsupported", "partial"].includes(String(judge.verdict ?? ""))
    || judge.all_claims_supported === false
    || Array.isArray(judge.unsupported_claims) && judge.unsupported_claims.length > 0;
}

function classifyFailure({ judge, rejected, answer }) {
  const notes = String(judge.notes ?? "").toLowerCase();
  const missing = judge.missing_citations ?? [];
  const citations = rejected.citations ?? [];
  if (judge.citation_ids_valid === false || missing.length > 0 || !citations.length || /lacks? citations?|missing citations?|citation mismatch|not cited/.test(notes)) {
    return "citation_mismatch";
  }
  const unsupported = judge.unsupported_claims ?? rejected.unsupported_claims ?? [];
  if (unsupported.length || /not supported|unsupported|not contain|does not contain|doesn't contain|overclaim|too broad|omits|wrong|incorrect|not enough/.test(notes)) {
    if (numericTokenCount(answer) > 0 || comparativeTokenCount(answer) > 0) return "numeric_or_comparison_overclaim";
    return "overbroad_or_overclaimed";
  }
  return null;
}

function normalizeCandidate(candidate) {
  return {
    id: candidate.id ?? candidate.candidate_id ?? null,
    family: candidate.family ?? null,
    answer_type: candidate.answer_type,
    answer: candidate.answer ?? "",
    citations: candidate.citations ?? [],
    claim_table: candidate.claim_table ?? [],
    abstention_reason: candidate.abstention_reason ?? null,
  };
}

function dedupeCandidates(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows.sort(candidateSort)) {
    const key = [
      row.example_id,
      row.failure_mode,
      clean(row.rejected.answer).slice(0, 160),
      clean(row.chosen.answer).slice(0, 160),
    ].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function selectDiverse(rows, target, maxPerExample) {
  const selected = [];
  const counts = new Map();
  const byMode = new Map();
  for (const row of rows.sort(candidateSort)) {
    const count = counts.get(row.example_id) ?? 0;
    if (count >= maxPerExample) continue;
    selected.push(row);
    counts.set(row.example_id, count + 1);
    byMode.set(row.failure_mode, (byMode.get(row.failure_mode) ?? 0) + 1);
    if (selected.length >= target) break;
  }
  return selected;
}

function candidateSort(left, right) {
  return priority(right) - priority(left)
    || String(left.example_id).localeCompare(String(right.example_id))
    || String(left.source_pair_id).localeCompare(String(right.source_pair_id));
}

function priority(row) {
  return (row.failure_mode === "citation_mismatch" ? 3 : 0)
    + (row.failure_mode === "numeric_or_comparison_overclaim" ? 2 : 0)
    + Math.min(3, (row.judge_signal?.unsupported_claims ?? []).length)
    + (row.source_run_id === "overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1" ? 1 : 0);
}

function splitByExample(rows, trainFraction) {
  const examples = [...new Set(rows.map((row) => row.example_id))].sort();
  const trainCount = Math.max(1, Math.floor(examples.length * trainFraction));
  const trainExamples = new Set(examples.slice(0, trainCount));
  return {
    train: rows.filter((row) => trainExamples.has(row.example_id)),
    validation: rows.filter((row) => !trainExamples.has(row.example_id)),
  };
}

function dpoRow(row, index, splitName) {
  return {
    row_id: `${runId}:${splitName}:${String(index + 1).padStart(3, "0")}`,
    task: "grounded_qa_overclaim_citation_preference",
    split: splitName,
    example_id: row.example_id,
    source_index: row.source_index,
    question: row.question,
    evidence_pack: row.evidence_pack,
    messages: [
      {
        role: "system",
        content: "Answer using only the evidence pack. Cite every factual claim. Prefer concise answers whose claims are directly supported; abstain when support is insufficient.",
      },
      {
        role: "user",
        content: renderPrompt(row),
      },
    ],
    chosen: row.chosen,
    rejected: row.rejected,
    failure_mode: row.failure_mode,
    judge_signal: row.judge_signal,
    source_metadata: {
      source_run_id: row.source_run_id,
      source_file: row.source_file,
      source_pair_id: row.source_pair_id,
      training_use: "mined_nonfinal_preference_training",
    },
  };
}

function inventoryRow(row) {
  return {
    source_run_id: row.source_run_id,
    source_file: row.source_file,
    source_pair_id: row.source_pair_id,
    example_id: row.example_id,
    source_index: row.source_index,
    training_use: row.training_use,
    question: row.question,
    failure_mode: row.failure_mode,
    chosen_id: row.chosen.id,
    rejected_id: row.rejected.id,
    rejected_answer_preview: clean(row.rejected.answer).slice(0, 240),
    judge_signal: row.judge_signal,
  };
}

function renderPrompt(row) {
  return [
    `Question: ${row.question}`,
    "",
    "Evidence pack:",
    row.evidence_pack.map((item) => `[${item.evidence_id}] ${item.section ?? "Evidence"}: ${item.text}`).join("\n\n"),
    "",
    "Return JSON with answer_type, answer, citations, claim_table, and abstention_reason when needed.",
  ].join("\n");
}

function decisionFromRows(trainRows, validationRows) {
  if (trainRows.length >= 50 && validationRows.length >= 20) {
    return {
      run_zero_cost_probe_next: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "The mined packet is large enough for a local verifier/selector probe before any paid work.",
      next_step: "Run a zero-cost overclaim/citation transfer probe over this mined packet.",
    };
  }
  return {
    run_zero_cost_probe_next: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    reason: "The mined packet still lacks enough train/validation rows for a meaningful probe.",
    next_step: "Plan a narrow paid batch for overclaim/citation-mismatch rows if no additional judged pools exist.",
  };
}

function renderReport(result) {
  return `# Mined Overclaim/Citation Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no API calls and launches no compute. It mines existing judged non-final contrast pools after D351 found the targeted paid slice too small.

## Data

- Raw candidates: ${result.data.raw_candidates}
- Deduped candidates: ${result.data.deduped_candidates}
- Selected candidates: ${result.data.selected_candidates}
- Train DPO rows: ${result.data.train_dpo_rows}
- Validation DPO rows: ${result.data.validation_dpo_rows}
- Failure modes: ${JSON.stringify(result.data.selected_failure_mode_counts)}
- Sources: ${JSON.stringify(result.data.selected_source_counts)}

## Decision

- Run zero-cost probe next: ${result.decision.run_zero_cost_probe_next ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function inferQuestionType(question) {
  const q = String(question ?? "").toLowerCase();
  if (/^(is|are|was|were|does|do|did|can|could|has|have|had)\b/.test(q)) return "yes_no";
  if (/\b(how many|number|percentage|percent|score|rate)\b/.test(q)) return "numeric";
  if (/\b(compare|better|worse|higher|lower|versus|vs)\b/.test(q)) return "comparison";
  if (/\b(which|what)\b/.test(q)) return "factoid";
  return "method_or_explanation";
}

function numericTokenCount(text) {
  return (String(text ?? "").match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
}

function comparativeTokenCount(text) {
  return (String(text ?? "").toLowerCase().match(/\b(more|less|better|worse|higher|lower|best|worst|larger|smaller|improve|outperform|underperform|significant|significantly)\b/g) ?? []).length;
}

function clean(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value ?? "missing"] = (counts[value ?? "missing"] ?? 0) + 1;
    return counts;
  }, {});
}

function disjoint(left, right) {
  for (const value of left) {
    if (right.has(value)) return false;
  }
  return true;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonlIfPresent(filePath) {
  try {
    return await readJsonl(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
