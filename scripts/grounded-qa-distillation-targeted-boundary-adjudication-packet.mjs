import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const tradeoffRunId = args["tradeoff-run"] ?? "overexpansion-tradeoff-audit-qwen-frontier-pool-2026-06-28-v1";
const gateRunId = args["gate-run"] ?? "conditional-overexpansion-gate-qwen-frontier-pool-2026-06-28-v1";
const packetRunId = args["packet-run"] ?? "minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "targeted-boundary-adjudication-packet-qwen-frontier-pool-2026-06-28-v1";
const maxRequests = Number(args["max-requests"] ?? 12);
const maxEstimatedCostUsd = Number(args["max-estimated-openai-cost-usd"] ?? 0.25);
const conservativeCostPerRequestUsd = Number(args["conservative-cost-per-request-usd"] ?? 0.02);
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const tradeoff = await readJson(path.join(runsDir, tradeoffRunId, "result.json"));
const gate = await readJson(path.join(runsDir, gateRunId, "result.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const recovered = await readJsonl(path.join(runsDir, tradeoffRunId, "overexpansion_only_successes.jsonl"));
const regressions = await readJsonl(path.join(runsDir, tradeoffRunId, "baseline_only_successes.jsonl"));
const bothFailures = await readJsonl(path.join(runsDir, tradeoffRunId, "both_failures.jsonl"));
const generatedPairs = await readJsonl(path.join(runsDir, packetRunId, "generated_contrast_pairs.jsonl"));
const allPairs = await readJsonl(path.join(runsDir, packetRunId, "contrast_pairs.jsonl"));
const secretReadiness = await readSecretReadiness();

const boundaryCases = [
  ...recovered.map((row) => boundaryCase(row, "d265_overexpansion_rescue")),
  ...regressions.map((row) => boundaryCase(row, "d265_overexpansion_regression")),
  ...bothFailures.map((row) => boundaryCase(row, "both_selectors_fail")),
];

const candidatePairs = selectCandidatePairs(generatedPairs, allPairs, maxRequests);
const requests = candidatePairs.map((pair, index) => adjudicationRequest(pair, index + 1));
const estimates = requests.map((request) => estimateRow(request, conservativeCostPerRequestUsd));
const estimatedCostUsd = round(sum(estimates.map((row) => row.estimated_cost_usd)), 6);
const budgetAfterEstimatedBatch = round(Number(budget.spend_usd.remaining) - estimatedCostUsd, 6);
const underCap = requests.length <= maxRequests && estimatedCostUsd <= maxEstimatedCostUsd && budgetAfterEstimatedBatch >= 0;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_boundary_adjudication_packet",
  status: underCap ? "paid_boundary_batch_ready_but_not_launched" : "paid_boundary_batch_not_ready",
  purpose: "Prepare a leakage-safe, tightly capped paid adjudication batch around the D267 rescue/regression boundary after cheap D268 gating failed.",
  source_runs: {
    tradeoff_run_id: tradeoffRunId,
    gate_run_id: gateRunId,
    overexpansion_packet_run_id: packetRunId,
  },
  boundary_summary: {
    final_diagnostic_cases: boundaryCases.length,
    d265_rescues: recovered.length,
    d265_regressions: regressions.length,
    both_failures: bothFailures.length,
    diagnostic_only: true,
    final_example_ids: boundaryCases.map((row) => row.example_id),
  },
  adjudication_batch: {
    candidate_requests: requests.length,
    generated_candidate_requests: requests.filter((row) => row.contrast_type === "generated_minimal_supported_vs_generated_overexpanded_unsupported").length,
    unique_nonfinal_roots: new Set(requests.map((row) => row.root_example_id)).size,
    max_requests: maxRequests,
    max_estimated_openai_cost_usd: maxEstimatedCostUsd,
    conservative_cost_per_request_usd: conservativeCostPerRequestUsd,
    estimated_openai_cost_usd: estimatedCostUsd,
    estimated_remaining_budget_after_batch_usd: budgetAfterEstimatedBatch,
    budget_gate_passed: underCap,
  },
  target_mechanism: {
    from_tradeoff_status: tradeoff.status,
    failed_gate_status: gate.status,
    source_packet_pairs: packet.counts?.all_pairs,
    source_generated_pairs: packet.counts?.generated_candidate_pairs,
    mechanism_tags: countTags(requests.flatMap((row) => row.tags)),
    rationale: "D265's rescues and regression are final diagnostics only; the payable labels are drawn from non-final D264 generated-vs-generated contrasts with similar numeric, list-scope, citation-surface, and overexpansion mechanisms.",
  },
  secret_readiness: secretReadiness,
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_boundary_cases_training_use: "forbidden_diagnostic_only",
    candidate_adjudication_training_use: "allowed_nonfinal_targeted_boundary_adjudication",
    candidate_requests_nonfinal_only: requests.every((row) => row.training_use === "allowed_nonfinal_targeted_boundary_adjudication" && row.final_window === false),
    paid_runner_must_reprice_before_calls: true,
  },
  decision: {
    paid_batch_prepared: underCap,
    run_paid_batch_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: secretReadiness.openai_api_key_present
      ? "The packet is capped and ready, but this script intentionally makes zero paid calls; use a ledgered runner to execute it."
      : "The packet is capped and ready, but OPENAI_API_KEY is not present in the saved secret names, so no paid calls should be attempted.",
    next_step: secretReadiness.openai_api_key_present
      ? "Run only these request ids through the ledgered adjudication runner after live repricing confirms the batch stays under the $100 total budget."
      : "Restore OPENAI_API_KEY with ~/.codex/scripts/ask-secret.sh, then run only these request ids through a ledgered adjudication runner after live repricing.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    estimated_total_after_batch_usd: round(Number(budget.spend_usd.total_actual) + estimatedCostUsd, 6),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet builder makes zero OpenAI calls and launches no external compute.",
  },
  artifacts: {
    boundary_cases_jsonl: rel(path.join(outputDir, "boundary_cases.jsonl")),
    candidate_adjudication_requests_jsonl: rel(path.join(outputDir, "candidate_adjudication_requests.jsonl")),
    estimated_calls_jsonl: rel(path.join(outputDir, "estimated_calls.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "boundary_cases.jsonl"), boundaryCases);
await writeJsonl(path.join(outputDir, "candidate_adjudication_requests.jsonl"), requests);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimates);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  adjudication_batch: result.adjudication_batch,
  secret_readiness: result.secret_readiness,
  decision: result.decision,
}, null, 2));

function boundaryCase(row, boundaryRole) {
  return {
    example_id: row.example_id,
    boundary_role: boundaryRole,
    training_use: "forbidden_diagnostic_only",
    diagnostic_use: "prompt_design_and_error_taxonomy_only",
    bucket: row.bucket,
    gate_features: row.gate_features ?? [],
    selected_baseline: summarizeFinalSelection(row.baseline),
    selected_overexpansion: summarizeFinalSelection(row.overexpansion),
    selected_hybrid: summarizeFinalSelection(row.hybrid),
    best_supported: row.best_supported ?? null,
    warning: "Final diagnostic case: do not adjudicate, tune, train, or select policy thresholds from this row.",
  };
}

function summarizeFinalSelection(selection) {
  return {
    candidate_id: selection?.selected_candidate_id ?? null,
    selected_supported_answer: selection?.selected_supported_answer ?? null,
    score: round(selection?.selected_score),
    selected: selection?.selected ?? null,
  };
}

function selectCandidatePairs(generatedPairs, allPairs, limit) {
  const primary = generatedPairs
    .filter((row) => row.train_split === "train")
    .sort((a, b) => candidatePriority(b) - candidatePriority(a));
  const fallback = allPairs
    .filter((row) => row.train_split === "train" && row.contrast_type !== "generated_minimal_supported_vs_generated_overexpanded_unsupported")
    .sort((a, b) => candidatePriority(b) - candidatePriority(a));
  const selected = [];
  const roots = new Set();
  for (const pair of [...primary, ...fallback]) {
    if (selected.length >= limit) break;
    const rootAlreadyUsed = roots.has(pair.root_example_id);
    const allowSecondSameRoot = selected.length < Math.min(2, limit) && pair.contrast_type === "generated_minimal_supported_vs_generated_overexpanded_unsupported";
    if (rootAlreadyUsed && !allowSecondSameRoot) continue;
    selected.push(pair);
    roots.add(pair.root_example_id);
  }
  return selected;
}

function candidatePriority(row) {
  const tags = new Set(row.tags ?? []);
  let score = 0;
  if (row.contrast_type === "generated_minimal_supported_vs_generated_overexpanded_unsupported") score += 100;
  if (tags.has("numeric_or_list_scope_overclaim")) score += 20;
  if (tags.has("same_citation_surface")) score += 12;
  if (tags.has("minimal_supported_span")) score += 10;
  if (tags.has("entity_scope_expansion")) score += 8;
  if (tags.has("longer_unsupported_expansion")) score += 6;
  if (tags.has("unsupported_judge_claim_available")) score += 4;
  score -= Number(row.source_index ?? 0) / 1000;
  return score;
}

function adjudicationRequest(pair, ordinal) {
  const prompt = [
    "You are adjudicating grounded QA candidates.",
    "Use only the evidence pack.",
    "Decide whether Candidate A, Candidate B, both, or neither are fully citation-grounded.",
    "A candidate is unsupported if the answer or claim table adds a predicate, number, list member, entity, or scope not entailed by cited evidence.",
    "Return JSON with: supported_candidate, candidate_a_errors, candidate_b_errors, minimal_supported_answer, required_citations, rationale.",
  ].join(" ");
  return {
    request_id: `boundary-adjudication-${String(ordinal).padStart(3, "0")}`,
    root_example_id: pair.root_example_id,
    split: pair.split,
    source_index: pair.source_index,
    final_window: false,
    training_use: "allowed_nonfinal_targeted_boundary_adjudication",
    selection_reason: selectionReason(pair),
    contrast_type: pair.contrast_type,
    tags: pair.tags ?? [],
    input: pair.input,
    prompt,
    candidate_a: summarizeCandidateForAdjudication(pair.chosen),
    candidate_b: summarizeCandidateForAdjudication(pair.rejected),
    expected_existing_signal_not_for_prompting: {
      candidate_a_existing_proxy: "supported_by_existing_nonfinal_judge_or_reference",
      candidate_b_existing_proxy: "unsupported_by_existing_nonfinal_judge",
      note: "Use only for post-hoc agreement analysis; do not include this field in the paid adjudicator prompt.",
    },
  };
}

function summarizeCandidateForAdjudication(candidate) {
  return {
    candidate_id: candidate.id,
    family: candidate.family,
    answer_type: candidate.answer_type,
    answer: candidate.answer,
    citations: candidate.citations ?? [],
    claim_table: candidate.claim_table ?? [],
    unsupported_claims_from_existing_local_judge_for_posthoc_only: candidate.unsupported_claims ?? [],
    features: candidate.features ?? {},
  };
}

function selectionReason(pair) {
  const reasons = [];
  const tags = new Set(pair.tags ?? []);
  if (pair.contrast_type === "generated_minimal_supported_vs_generated_overexpanded_unsupported") reasons.push("generated-vs-generated non-final contrast");
  if (tags.has("numeric_or_list_scope_overclaim")) reasons.push("numeric/list-scope overclaim mechanism");
  if (tags.has("same_citation_surface")) reasons.push("same citation surface boundary");
  if (tags.has("entity_scope_expansion")) reasons.push("entity/scope expansion");
  if (tags.has("minimal_supported_span")) reasons.push("minimal supported span positive");
  return reasons.join("; ") || "non-final overexpansion boundary contrast";
}

function estimateRow(request, costPerRequestUsd) {
  const promptChars = JSON.stringify({
    prompt: request.prompt,
    input: request.input,
    candidate_a: request.candidate_a,
    candidate_b: request.candidate_b,
  }).length;
  const estimatedPromptTokens = Math.ceil(promptChars / 4);
  const estimatedCompletionTokens = 350;
  return {
    request_id: request.request_id,
    root_example_id: request.root_example_id,
    estimated_prompt_tokens: estimatedPromptTokens,
    estimated_completion_tokens: estimatedCompletionTokens,
    conservative_pricing_basis: "local fixed estimate; paid runner must re-price with current provider prices before calls",
    estimated_cost_usd: round(costPerRequestUsd, 6),
  };
}

async function readSecretReadiness() {
  const secretPath = path.join(os.homedir(), ".codex", "secrets.env");
  let names = [];
  try {
    const text = await fs.readFile(secretPath, "utf8");
    names = text.split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0].replace(/^export\s+/, "").trim())
      .filter(Boolean);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    openai_api_key_present: names.includes("OPENAI_API_KEY"),
    checked_secret_names_only: true,
    secret_file_present: names.length > 0,
    checked_secret_name_count: names.length,
    restore_command_template: "~/.codex/scripts/ask-secret.sh OPENAI_API_KEY ~/.codex/secrets.env \"Enter OPENAI_API_KEY\"",
  };
}

function renderReport(result) {
  return `# Targeted Boundary Adjudication Packet

This is a zero-call launch packet. It made no OpenAI calls and launched no external compute.

## Why this packet exists

D267 found that the D265 overexpansion selector rescues ${result.boundary_summary.d265_rescues} final diagnostic cases but regresses ${result.boundary_summary.d265_regressions}. D268 showed the current cheap conditional risk features do not recover that gain, so the next defensible paid step is a small boundary adjudication batch rather than more broad labels.

## Leakage guard

- Final boundary cases are diagnostic-only and forbidden for training.
- Candidate adjudication requests are non-final only.
- Candidate labels may be used only as allowed non-final targeted boundary adjudication.
- The paid runner must re-price before calls and ledger every call.

## Batch

- Requests: ${result.adjudication_batch.candidate_requests}/${result.adjudication_batch.max_requests}
- Unique non-final roots: ${result.adjudication_batch.unique_nonfinal_roots}
- Estimated cost: $${result.adjudication_batch.estimated_openai_cost_usd}
- Cost cap: $${result.adjudication_batch.max_estimated_openai_cost_usd}
- Budget remaining before batch: $${result.budget.remaining_budget_usd}
- Estimated total after batch: $${result.budget.estimated_total_after_batch_usd}

## Decision

Paid batch prepared: ${result.decision.paid_batch_prepared}. Run paid batch now: ${result.decision.run_paid_batch_now}. Reason: ${result.decision.reason}
`;
}

function countTags(tags) {
  return tags.reduce((counts, tag) => {
    counts[tag] = (counts[tag] ?? 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function rel(file) {
  return path.relative(rootDir, file);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value), 0);
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
