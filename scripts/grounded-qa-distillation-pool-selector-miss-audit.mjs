import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const hardSelectorRunId = args["hard-selector-run"] ?? "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const poolSelectorRunId = args["pool-selector-run"] ?? "pool-adjudicated-selector-qwen-frontier-pool-2026-06-28-v1";
const adjudicationRunId = args["adjudication-run"] ?? "openai-pool-adjudication-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "pool-selector-miss-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const hardResult = await readJson(path.join(runsDir, hardSelectorRunId, "result.json"));
const poolResult = await readJson(path.join(runsDir, poolSelectorRunId, "result.json"));
const hardSelections = await readJsonl(path.join(runsDir, hardSelectorRunId, "baseline_final_diagnostic_selections.jsonl"));
const poolSelections = await readJsonl(path.join(runsDir, poolSelectorRunId, "final_diagnostic_selections.jsonl"));
const hybridSelections = await readJsonl(path.join(runsDir, poolSelectorRunId, "hybrid_final_diagnostic_selections.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const adjudications = await readJsonl(path.join(runsDir, adjudicationRunId, "pool_adjudications.jsonl"));
const selectedPools = await readJsonl(path.join(runsDir, adjudicationRunId, "selected_pools.jsonl"));

const candidateIndex = buildCandidateIndex(diagnosticPairs);
const poolByExample = new Map(poolSelections.map((row) => [row.example_id, row]));
const hybridByExample = new Map(hybridSelections.map((row) => [row.example_id, row]));
const comparisons = hardSelections.map((hard) => compareSelection({
  hard,
  pool: poolByExample.get(hard.example_id),
  hybrid: hybridByExample.get(hard.example_id),
  candidates: candidateIndex.get(hard.example_id) ?? new Map(),
}));
const hardOnlySuccesses = comparisons.filter((row) => row.bucket === "hard_only_success");
const poolOnlySuccesses = comparisons.filter((row) => row.bucket === "pool_only_success");
const bothSuccesses = comparisons.filter((row) => row.bucket === "both_success");
const bothFailures = comparisons.filter((row) => row.bucket === "both_fail");
const disagreements = adjudications
  .filter((row) => !row.skipped && row.selected_supported_by_existing_judge === false)
  .map((row) => auditAdjudicationDisagreement(row, selectedPools.find((pool) => pool.root_example_id === row.root_example_id)));

const tagCounts = countTags([
  ...hardOnlySuccesses.flatMap((row) => row.tags),
  ...bothFailures.flatMap((row) => row.tags),
  ...disagreements.flatMap((row) => row.tags),
]);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "pool_selector_miss_audit",
  status: statusFor({ hardOnlySuccesses, poolOnlySuccesses, disagreements }),
  hard_selector_run_id: hardSelectorRunId,
  pool_selector_run_id: poolSelectorRunId,
  adjudication_run_id: adjudicationRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Audit where the non-final pool-adjudicated selector loses to the hard-negative pairwise selector, plus GPT-4o pool-vs-existing-judge disagreements, before buying more labels.",
  summary: {
    final_examples: comparisons.length,
    hard_selected_supported: comparisons.filter((row) => row.hard.selected_supported_answer).length,
    pool_selected_supported: comparisons.filter((row) => row.pool?.selected_supported_answer).length,
    hybrid_selected_supported: comparisons.filter((row) => row.hybrid?.selected_supported_answer).length,
    both_successes: bothSuccesses.length,
    hard_only_successes: hardOnlySuccesses.length,
    pool_only_successes: poolOnlySuccesses.length,
    both_failures: bothFailures.length,
    pool_adjudication_disagreements: disagreements.length,
    tag_counts: tagCounts,
  },
  metrics_read: {
    hard_final_selection: hardResult.metrics?.final_diagnostic_selection,
    pool_final_selection: poolResult.metrics?.final_diagnostic_selection,
    pool_hybrid_final_selection: poolResult.metrics?.hybrid_pool_pairwise_selector?.final_diagnostic_selection,
  },
  findings: deriveFindings({ hardOnlySuccesses, poolOnlySuccesses, bothFailures, disagreements }),
  decision: {
    buy_more_labels_now: false,
    launch_gpu_now: false,
    next_step: "Train or score a constrained selector that uses D258 pairwise support as a regularizer for D259 pool-choice labels, and add an answer/claim-table consistency penalty before any more paid labels.",
    reason: "The paid pool selector loses one final supported selection relative to the zero-cost hard-negative selector, and the lone pool-adjudication disagreement exposes a claim-table overclaim that answer-level adjudication can miss.",
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
    inherited_openai_calls_inspected: Number(poolResult.llm_budget?.inherited_openai_llm_calls ?? 0),
    inherited_openai_cost_inspected_usd: Number(poolResult.llm_budget?.inherited_openai_cost_usd ?? 0),
    note: "This miss audit reads existing selector and adjudication artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "final_selector_comparisons.jsonl"), comparisons);
await writeJsonl(path.join(outputDir, "hard_only_successes.jsonl"), hardOnlySuccesses);
await writeJsonl(path.join(outputDir, "both_failures.jsonl"), bothFailures);
await writeJsonl(path.join(outputDir, "pool_adjudication_disagreements.jsonl"), disagreements);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, hardOnlySuccesses, disagreements);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function buildCandidateIndex(pairs) {
  const byExample = new Map();
  for (const pair of pairs) {
    if (!byExample.has(pair.example_id)) byExample.set(pair.example_id, new Map());
    const candidates = byExample.get(pair.example_id);
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      if (!candidates.has(candidate.id)) {
        candidates.set(candidate.id, {
          ...candidate,
          supported_answer: role === "chosen",
          input: pair.input,
          reference: pair.reference,
        });
      } else if (role === "chosen") {
        candidates.get(candidate.id).supported_answer = true;
      }
    }
  }
  return byExample;
}

function compareSelection({ hard, pool, hybrid, candidates }) {
  const hardSelected = candidateSummary(candidates.get(hard.selected_candidate_id), hard.selected_score);
  const poolSelected = candidateSummary(candidates.get(pool?.selected_candidate_id), pool?.selected_score);
  const bestSupported = bestSupportedCandidate(pool?.ranked_candidates ?? hard.ranked_candidates ?? [], candidates);
  const bucket = bucketFor(hard.selected_supported_answer, pool?.selected_supported_answer);
  const tags = tagsForComparison({ bucket, hard, pool, hardSelected, poolSelected, bestSupported });
  return {
    example_id: hard.example_id,
    bucket,
    tags,
    hard: {
      selected_candidate_id: hard.selected_candidate_id,
      selected_family: hard.selected_family,
      selected_supported_answer: hard.selected_supported_answer,
      selected_score: round(hard.selected_score),
      selected: hardSelected,
    },
    pool: pool ? {
      selected_candidate_id: pool.selected_candidate_id,
      selected_family: pool.selected_family,
      selected_supported_answer: pool.selected_supported_answer,
      selected_score: round(pool.selected_score),
      selected: poolSelected,
    } : null,
    hybrid: hybrid ? {
      selected_candidate_id: hybrid.selected_candidate_id,
      selected_family: hybrid.selected_family,
      selected_supported_answer: hybrid.selected_supported_answer,
      selected_score: round(hybrid.selected_score),
    } : null,
    best_supported_candidate: bestSupported,
    candidate_counts: {
      total: hard.candidate_count ?? pool?.candidate_count ?? candidates.size,
      supported: hard.supported_candidate_count ?? pool?.supported_candidate_count ?? [...candidates.values()].filter((row) => row.supported_answer).length,
      unsupported: hard.unsupported_candidate_count ?? pool?.unsupported_candidate_count ?? [...candidates.values()].filter((row) => !row.supported_answer).length,
    },
    top_pool_ranked_candidates: (pool?.ranked_candidates ?? []).slice(0, 5).map((row) => ({
      candidate_id: row.candidate_id,
      family: row.family,
      supported_answer: row.supported_answer,
      score: round(row.score),
      candidate: candidateSummary(candidates.get(row.candidate_id), row.score),
    })),
  };
}

function bucketFor(hardSupported, poolSupported) {
  if (hardSupported && poolSupported) return "both_success";
  if (hardSupported && !poolSupported) return "hard_only_success";
  if (!hardSupported && poolSupported) return "pool_only_success";
  return "both_fail";
}

function bestSupportedCandidate(ranked, candidates) {
  const supported = ranked.find((row) => row.supported_answer === true);
  if (!supported) {
    const fallback = [...candidates.values()].find((row) => row.supported_answer);
    return candidateSummary(fallback, null);
  }
  return {
    candidate_id: supported.candidate_id,
    family: supported.family,
    score: round(supported.score),
    ...candidateSummary(candidates.get(supported.candidate_id), supported.score),
  };
}

function candidateSummary(candidate, score) {
  if (!candidate) return null;
  return {
    candidate_id: candidate.id ?? candidate.candidate_id ?? null,
    family: candidate.family ?? null,
    supported_answer: candidate.supported_answer ?? null,
    score: Number.isFinite(Number(score)) ? round(score) : null,
    answer_preview: preview(candidate.answer, 280),
    answer_tokens: tokenCount(candidate.answer),
    citations: candidate.citations ?? [],
    citation_count: (candidate.citations ?? []).length,
    claim_count: (candidate.claim_table ?? []).length,
    claims: (candidate.claim_table ?? []).slice(0, 4).map((claim) => preview(claim.claim ?? claim.text ?? claim, 180)),
    unsupported_claims: (candidate.judgment?.unsupported_claims ?? []).slice(0, 4).map((claim) => preview(claim.claim ?? claim.text ?? claim, 180)),
  };
}

function tagsForComparison({ bucket, hard, pool, hardSelected, poolSelected, bestSupported }) {
  const tags = new Set();
  if (bucket === "hard_only_success") {
    tags.add("pool_selector_regression_against_hard_pairwise");
    tags.add("hard_selector_better_pairwise_signal");
  }
  if (bucket === "both_fail") tags.add("both_selectors_miss_supported_candidate");
  if (pool?.selected_supported_answer === false) tags.add("pool_selected_unsupported_candidate");
  if (poolSelected && bestSupported && poolSelected.answer_tokens > bestSupported.answer_tokens + 5) tags.add("pool_selected_longer_unsupported");
  if (poolSelected && bestSupported && poolSelected.citation_count >= bestSupported.citation_count) tags.add("citation_count_not_discriminative");
  if (poolSelected && poolSelected.unsupported_claims.length) tags.add("pool_selected_candidate_has_existing_unsupported_claims");
  if (bestSupported && bestSupported.answer_tokens <= 8) tags.add("supported_candidate_is_short");
  if (hard.selected_candidate_id !== pool?.selected_candidate_id) tags.add("selector_disagreement");
  if (hardSelected?.family !== poolSelected?.family) tags.add("family_choice_changed");
  return [...tags].sort();
}

function auditAdjudicationDisagreement(row, pool) {
  const selected = pool?.candidates?.find((candidate) => candidate.candidate_id === row.judgment.selected_candidate_id);
  const existingSupported = pool?.candidates?.filter((candidate) => candidate.existing_supported_answer === true) ?? [];
  const tags = new Set(["d259_existing_judge_pool_disagreement"]);
  if (selected?.answer_type === "grounded_answer" && selected.existing_unsupported_answer === true) tags.add("gpt4o_answer_selection_conflicts_with_existing_claim_judge");
  if ((selected?.claim_table ?? []).some((claim) => !(claim.citations ?? []).length)) tags.add("selected_claim_table_has_uncited_claim");
  if ((selected?.existing_unsupported_claims ?? []).length) tags.add("selected_has_existing_unsupported_claims");
  if (tokenCount(selected?.answer) <= 8) tags.add("short_answer_claim_table_mismatch");
  return {
    root_example_id: row.root_example_id,
    source_index: row.source_index,
    selected_candidate_id: row.judgment.selected_candidate_id,
    selected_existing_label: row.selected_existing_label,
    existing_oracle_supported_candidate_count: row.existing_oracle_supported_candidate_count,
    gpt4o_notes: preview(row.judgment.notes, 500),
    gpt4o_rejected_reasons: Object.fromEntries(Object.entries(row.judgment.unsupported_candidate_reasons ?? {}).map(([id, reason]) => [id, preview(reason, 300)])),
    tags: [...tags].sort(),
    selected_candidate: summarizePoolCandidate(selected),
    existing_supported_candidates: existingSupported.map(summarizePoolCandidate),
    pool_candidates: (pool?.candidates ?? []).map(summarizePoolCandidate),
  };
}

function summarizePoolCandidate(candidate) {
  if (!candidate) return null;
  return {
    candidate_id: candidate.candidate_id,
    sample_index: candidate.sample_index,
    answer_type: candidate.answer_type,
    existing_judge_verdict: candidate.existing_judge_verdict,
    existing_supported_answer: candidate.existing_supported_answer,
    existing_unsupported_answer: candidate.existing_unsupported_answer,
    answer_preview: preview(candidate.answer, 260),
    citations: candidate.citations ?? [],
    claims: (candidate.claim_table ?? []).slice(0, 4).map((claim) => ({
      claim: preview(claim.claim ?? claim.text ?? claim, 180),
      citations: claim.citations ?? [],
    })),
    existing_unsupported_claims: (candidate.existing_unsupported_claims ?? []).slice(0, 4).map((claim) => preview(claim, 180)),
  };
}

function deriveFindings({ hardOnlySuccesses, poolOnlySuccesses, bothFailures, disagreements }) {
  const findings = [];
  if (hardOnlySuccesses.length && !poolOnlySuccesses.length) {
    findings.push("The pool-adjudicated selector strictly regresses one final selection relative to the D258 hard-negative pairwise selector, with no compensating final wins.");
  }
  if (bothFailures.length) {
    findings.push(`${bothFailures.length} final examples still defeat both selectors, so more labels should be targeted at selector miss patterns rather than generation volume.`);
  }
  if (disagreements.length) {
    findings.push("The only D259 pool-label disagreement is not random noise: GPT-4o judged the answer text supported, while the existing judge rejected the candidate because its claim table introduced an unsupported overclaim.");
  }
  findings.push("A better next objective should combine listwise pool choice with candidate-level support regularization and explicit answer/claim-table consistency.");
  return findings;
}

function statusFor({ hardOnlySuccesses, poolOnlySuccesses, disagreements }) {
  if (hardOnlySuccesses.length > poolOnlySuccesses.length && disagreements.length) return "pool_selector_regression_plus_claim_table_disagreement";
  if (hardOnlySuccesses.length > poolOnlySuccesses.length) return "pool_selector_regresses_final_selection";
  if (disagreements.length) return "pool_adjudication_disagreement_requires_consistency_guard";
  return "pool_selector_audit_no_new_blocker";
}

function renderReport(result, hardOnlySuccesses, disagreements) {
  const tagRows = Object.entries(result.summary.tag_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`)
    .join("\n");
  const hardOnlyRows = hardOnlySuccesses.map((row) => `- \`${row.example_id}\`: hard picked \`${row.hard.selected_candidate_id}\` supported; pool picked \`${row.pool?.selected_candidate_id}\` unsupported. Tags: ${row.tags.map((tag) => `\`${tag}\``).join(", ")}.`);
  const disagreementRows = disagreements.map((row) => `- \`${row.root_example_id}\`: GPT-4o selected \`${row.selected_candidate_id}\`, existing label \`${row.selected_existing_label}\`. Tags: ${row.tags.map((tag) => `\`${tag}\``).join(", ")}.`);
  return `# Pool Selector Miss Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no new OpenAI calls and launches no compute.

| Final examples | Hard selected supported | Pool selected supported | Hybrid selected supported |
| ---: | ---: | ---: | ---: |
| ${result.summary.final_examples} | ${result.summary.hard_selected_supported} | ${result.summary.pool_selected_supported} | ${result.summary.hybrid_selected_supported} |

## Selector Delta

| Bucket | Count |
| --- | ---: |
| both success | ${result.summary.both_successes} |
| hard only success | ${result.summary.hard_only_successes} |
| pool only success | ${result.summary.pool_only_successes} |
| both fail | ${result.summary.both_failures} |

## Audit Tags

| Tag | Count |
| --- | ---: |
${tagRows || "| none | 0 |"}

## Hard-Only Final Successes

${hardOnlyRows.join("\n") || "None."}

## Pool Adjudication Disagreements

${disagreementRows.join("\n") || "None."}

## Decision

Buy more labels now: \`${result.decision.buy_more_labels_now}\`

Next step: ${result.decision.next_step}
`;
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function preview(value, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function tokenCount(value) {
  return String(value ?? "").split(/\s+/).filter(Boolean).length;
}

function round(value, digits = 6) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(digits));
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
