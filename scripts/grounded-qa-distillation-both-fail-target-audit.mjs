import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const constrainedRunId = args["constrained-run"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const missAuditRunId = args["miss-audit-run"] ?? "pool-selector-miss-audit-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "both-fail-target-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const constrainedResult = await readJson(path.join(runsDir, constrainedRunId, "result.json"));
const constrainedSelections = await readJsonl(path.join(runsDir, constrainedRunId, "constrained_final_diagnostic_selections.jsonl"));
const bothFailureRows = await readJsonl(path.join(runsDir, missAuditRunId, "both_failures.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const candidateIndex = buildCandidateIndex(diagnosticPairs);
const bothFailureIds = new Set(bothFailureRows.map((row) => row.example_id));

const audits = constrainedSelections
  .filter((row) => !row.selected_supported_answer && bothFailureIds.has(row.example_id))
  .map((selection) => auditExample(selection, candidateIndex.get(selection.example_id) ?? new Map()));
const targetCounts = countTags(audits.flatMap((row) => row.supervision_targets));
const mechanismCounts = countTags(audits.flatMap((row) => row.miss_mechanisms));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "both_fail_target_audit",
  status: statusFor(audits),
  constrained_run_id: constrainedRunId,
  miss_audit_run_id: missAuditRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Audit final diagnostic examples that both D258/D262 and D260 fail, so the next supervision target is more precise than another broad label batch.",
  summary: {
    audited_examples: audits.length,
    examples_with_supported_candidate: audits.filter((row) => row.supported_candidate_count > 0).length,
    selected_unsupported_with_existing_judge_claims: audits.filter((row) => row.selected.unsupported_claims.length > 0).length,
    short_supported_lost_to_expansion: audits.filter((row) => row.miss_mechanisms.includes("short_supported_answer_lost_to_expansion")).length,
    numeric_or_list_scope_misses: audits.filter((row) => row.miss_mechanisms.includes("numeric_or_list_scope_overclaim")).length,
    mechanism_counts: mechanismCounts,
    supervision_target_counts: targetCounts,
  },
  findings: deriveFindings(audits),
  proposed_next_supervision: {
    name: "minimal_supported_span_vs_overexpanded_answer_contrasts",
    construct_from_final_labels: false,
    construct_from_nonfinal_pool: true,
    required_positive_pattern: "short/exact cited answer or abstention that avoids unsupported predicate, list, or task-scope expansion",
    required_negative_pattern: "candidate with same citation surface but an unsupported predicate, dataset/list expansion, role/scope phrase, or numeric-purpose overclaim",
    feature_tests_before_paid_labels: [
      "exact_answer_span_bonus",
      "unsupported_judge_claim_penalty",
      "predicate_scope_overlap_between_answer_and_claim_table",
      "citation_same_but_claim_diff_contrast",
    ],
  },
  decision: {
    buy_more_labels_now: false,
    launch_gpu_now: false,
    next_step: "Build a zero-cost minimal-span/overexpansion contrast packet from existing non-final judged Qwen pools, then test a selector that explicitly rewards exact supported spans and penalizes unsupported judge claims.",
    reason: "The remaining failures are not missing citations or insufficient generation; they are answer-form overexpansion failures where supported short spans lose to unsupported but plausible expansions.",
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
    note: "This target audit reads existing diagnostic artifacts only.",
  },
  baseline_context: {
    constrained_final_selection: constrainedResult.metrics?.constrained_pool_pairwise_selector?.final_diagnostic_selection,
    selected_policy: constrainedResult.tuning?.selected_policy,
  },
};

await writeJsonl(path.join(outputDir, "audited_both_failures.jsonl"), audits);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, audits);
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

function auditExample(selection, candidates) {
  const ranked = selection.ranked_candidates.map((row) => ({
    ...row,
    candidate: candidates.get(row.candidate_id) ?? null,
  }));
  const selectedRank = ranked[0];
  const selected = summarizeCandidate(selectedRank?.candidate, selectedRank);
  const supported = ranked.filter((row) => row.supported_answer).map((row) => summarizeCandidate(row.candidate, row));
  const bestSupported = supported[0] ?? null;
  const missMechanisms = mechanismsFor(selected, bestSupported, supported);
  const supervisionTargets = targetsFor(missMechanisms, selected, bestSupported);
  return {
    example_id: selection.example_id,
    selected_candidate_id: selection.selected_candidate_id,
    selected_family: selection.selected_family,
    selected_score: round(selection.selected_score),
    supported_candidate_count: selection.supported_candidate_count,
    unsupported_candidate_count: selection.unsupported_candidate_count,
    selected,
    best_supported: bestSupported,
    supported_candidates: supported,
    miss_mechanisms: missMechanisms,
    supervision_targets: supervisionTargets,
    top_ranked_candidates: ranked.slice(0, 6).map((row) => summarizeCandidate(row.candidate, row)),
  };
}

function summarizeCandidate(candidate, ranked) {
  if (!candidate) return null;
  const answer = String(candidate.answer ?? "");
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? claim.text ?? "").trim()).filter(Boolean);
  const unsupportedClaims = (candidate.judgment?.unsupported_claims ?? []).map((claim) => String(claim.claim ?? claim.text ?? claim).trim()).filter(Boolean);
  return {
    candidate_id: candidate.id,
    family: candidate.family,
    supported_answer: ranked?.supported_answer ?? candidate.supported_answer ?? false,
    score: round(ranked?.score),
    rank_support_label: ranked?.supported_answer ?? null,
    answer_preview: preview(answer, 300),
    answer_tokens: contentTokens(answer).length,
    citations: candidate.citations ?? [],
    citation_count: (candidate.citations ?? []).length,
    claims: claims.slice(0, 5).map((claim) => preview(claim, 220)),
    claim_count: claims.length,
    unsupported_claims: unsupportedClaims.slice(0, 5).map((claim) => preview(claim, 240)),
    unsupported_claim_count: unsupportedClaims.length,
    number_tokens: numberTokens(answer),
    entityish_tokens: entityishTokens(answer).slice(0, 12),
  };
}

function mechanismsFor(selected, bestSupported, supported) {
  const tags = new Set(["selected_unsupported_over_supported_candidate"]);
  if (!selected || !bestSupported) return [...tags, "missing_supported_candidate_detail"].sort();
  if (bestSupported.answer_tokens <= 6 && selected.answer_tokens > bestSupported.answer_tokens + 4) tags.add("short_supported_answer_lost_to_expansion");
  if (selected.unsupported_claim_count > 0) tags.add("existing_judge_unsupported_claim_available");
  if (sameCitationSet(selected, bestSupported)) tags.add("same_citation_different_claim");
  if (selected.number_tokens.length || bestSupported.number_tokens.length || looksListAnswer(bestSupported.answer_preview)) tags.add("numeric_or_list_scope_overclaim");
  if (selected.citation_count >= bestSupported.citation_count) tags.add("citation_count_not_discriminative");
  if (supported.length > 1) tags.add("multiple_supported_candidates_ranked_below");
  if (selected.entityish_tokens.length > bestSupported.entityish_tokens.length + 1) tags.add("entity_rich_unsupported_expansion");
  return [...tags].sort();
}

function targetsFor(mechanisms, selected, bestSupported) {
  const tags = new Set(["selected_vs_best_supported_pair"]);
  if (mechanisms.includes("short_supported_answer_lost_to_expansion")) tags.add("minimal_supported_span_preference");
  if (mechanisms.includes("existing_judge_unsupported_claim_available")) tags.add("unsupported_judge_claim_penalty");
  if (mechanisms.includes("same_citation_different_claim")) tags.add("same_citation_claim_difference_contrast");
  if (mechanisms.includes("numeric_or_list_scope_overclaim")) tags.add("numeric_or_list_scope_guard");
  if (mechanisms.includes("entity_rich_unsupported_expansion")) tags.add("entity_scope_guard");
  if (selected?.claim_count === 0 && bestSupported?.claim_count > 0) tags.add("require_claim_table_for_short_numeric_answers");
  return [...tags].sort();
}

function deriveFindings(audits) {
  const findings = [];
  const shortLosses = audits.filter((row) => row.miss_mechanisms.includes("short_supported_answer_lost_to_expansion")).length;
  const sameCitation = audits.filter((row) => row.miss_mechanisms.includes("same_citation_different_claim")).length;
  const unsupportedClaim = audits.filter((row) => row.miss_mechanisms.includes("existing_judge_unsupported_claim_available")).length;
  findings.push(`${shortLosses}/${audits.length} both-fail examples prefer unsupported expansions over short supported answers.`);
  findings.push(`${unsupportedClaim}/${audits.length} selected unsupported candidates already carry existing judge unsupported-claim evidence, so this can be used without new labels.`);
  findings.push(`${sameCitation}/${audits.length} failures are same-citation or citation-count-indistinguishable cases, so citation volume is not the missing signal.`);
  findings.push("The next zero-cost target should mine non-final contrasts where answer text/citation surface is close but claim scope differs.");
  return findings;
}

function statusFor(audits) {
  const shortLosses = audits.filter((row) => row.miss_mechanisms.includes("short_supported_answer_lost_to_expansion")).length;
  const unsupportedClaim = audits.filter((row) => row.miss_mechanisms.includes("existing_judge_unsupported_claim_available")).length;
  if (shortLosses >= Math.ceil(audits.length / 2) && unsupportedClaim === audits.length) return "both_failures_are_overexpanded_answer_scope_errors";
  if (unsupportedClaim === audits.length) return "both_failures_have_existing_unsupported_claim_targets";
  return "both_failures_require_mixed_targeting";
}

function renderReport(result, audits) {
  const mechanismRows = Object.entries(result.summary.mechanism_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`)
    .join("\n");
  const targetRows = Object.entries(result.summary.supervision_target_counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => `| \`${tag}\` | ${count} |`)
    .join("\n");
  const exampleRows = audits.map((row) => `- \`${row.example_id}\`: selected \`${row.selected_candidate_id}\`; best supported \`${row.best_supported?.candidate_id ?? "missing"}\`; targets ${row.supervision_targets.map((tag) => `\`${tag}\``).join(", ")}.`);
  return `# Both-Fail Target Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls, launches no compute, and uses final-window labels only as forbidden diagnostics.

| Audited examples | Selected unsupported with judge claims | Short supported lost to expansion | Numeric/list scope misses |
| ---: | ---: | ---: | ---: |
| ${result.summary.audited_examples} | ${result.summary.selected_unsupported_with_existing_judge_claims} | ${result.summary.short_supported_lost_to_expansion} | ${result.summary.numeric_or_list_scope_misses} |

## Mechanisms

| Mechanism | Count |
| --- | ---: |
${mechanismRows}

## Supervision Targets

| Target | Count |
| --- | ---: |
${targetRows}

## Examples

${exampleRows.join("\n")}

## Decision

Buy more labels now: \`${result.decision.buy_more_labels_now}\`

Next step: ${result.decision.next_step}
`;
}

function sameCitationSet(left, right) {
  const leftSet = new Set(left?.citations ?? []);
  const rightSet = new Set(right?.citations ?? []);
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
}

function looksListAnswer(value) {
  return String(value ?? "").includes(",") || /\band\b/i.test(String(value ?? ""));
}

function preview(value, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function contentTokens(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function entityishTokens(value) {
  return String(value ?? "").match(/\b[A-Z][A-Za-z0-9.-]*(?:-[A-Za-z0-9.]+)?\b/g) ?? [];
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function round(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
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
