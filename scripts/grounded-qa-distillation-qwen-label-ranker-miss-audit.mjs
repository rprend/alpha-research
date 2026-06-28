import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const rankerRunId = args["ranker-run"] ?? "qwen-label-support-ranker-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "qwen-label-ranker-miss-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const ranker = await readJson(path.join(runsDir, rankerRunId, "result.json"));
const selections = await readJsonl(path.join(runsDir, rankerRunId, "diagnostic_selections.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const candidateIndex = buildCandidateIndex(diagnosticPairs);

const audits = selections.map((selection) => auditSelection(selection, candidateIndex.get(selection.example_id) ?? new Map()));
const misses = audits.filter((row) => !row.selected_supported_answer);
const tagCounts = countTags(misses.flatMap((row) => row.failure_tags));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_label_ranker_miss_audit",
  status: misses.length ? "ranker_misses_require_stronger_verifier" : "ranker_no_final_diagnostic_misses",
  ranker_run_id: rankerRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  summary: {
    diagnostic_examples: audits.length,
    selected_supported: audits.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: misses.length,
    examples_with_supported_candidate: audits.filter((row) => row.supported_candidate_count > 0).length,
    miss_tag_counts: tagCounts,
  },
  missed_examples: misses.map((row) => ({
    example_id: row.example_id,
    selected_candidate_id: row.selected_candidate_id,
    selected_family: row.selected_family,
    best_supported_candidate_id: row.best_supported_candidate_id,
    best_supported_family: row.best_supported_family,
    score_gap_selected_minus_best_supported: row.score_gap_selected_minus_best_supported,
    failure_tags: row.failure_tags,
  })),
  conclusion: {
    finding: "The ranker often gives high scores to unsupported Qwen answers that look contract-complete or lexically plausible, while supported alternatives are short, lower-coverage, or from a different model family.",
    next_step: "Do not launch another generator-only GPU run. Build a stronger verifier target that compares selected-vs-supported candidate pairs directly, with features or labels that penalize unsupported overclaims and family/length shortcuts.",
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
    note: "This audit reads existing final diagnostic artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "misses.jsonl"), misses);
await writeJsonl(path.join(outputDir, "diagnostic_audit.jsonl"), audits);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  conclusion: result.conclusion,
}, null, 2));

function buildCandidateIndex(pairs) {
  const byExample = new Map();
  for (const pair of pairs) {
    if (!byExample.has(pair.example_id)) byExample.set(pair.example_id, new Map());
    const candidates = byExample.get(pair.example_id);
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const key = candidate.id;
      if (!candidates.has(key)) {
        candidates.set(key, {
          ...candidate,
          supported_answer: role === "chosen",
          input: pair.input,
          reference: pair.reference,
        });
      } else if (role === "chosen") {
        candidates.get(key).supported_answer = true;
      }
    }
  }
  return byExample;
}

function auditSelection(selection, candidates) {
  const selected = candidates.get(selection.selected_candidate_id) ?? null;
  const ranked = selection.ranked_candidates.map((row) => ({
    ...row,
    candidate: candidates.get(row.candidate_id) ?? null,
  }));
  const supportedRanked = ranked.filter((row) => row.supported_answer);
  const bestSupported = supportedRanked[0] ?? null;
  const selectedCandidate = selected ?? ranked[0]?.candidate ?? null;
  const bestSupportedCandidate = bestSupported?.candidate ?? null;
  const failureTags = selection.selected_supported_answer ? [] : tagsForMiss({
    selection,
    selected: selectedCandidate,
    bestSupported: bestSupportedCandidate,
    ranked,
  });
  return {
    example_id: selection.example_id,
    selected_candidate_id: selection.selected_candidate_id,
    selected_family: selection.selected_family,
    selected_supported_answer: selection.selected_supported_answer,
    selected_score: selection.selected_score,
    selected_answer: selectedCandidate?.answer ?? null,
    selected_judgment: selectedCandidate?.judgment ?? null,
    best_supported_candidate_id: bestSupported?.candidate_id ?? null,
    best_supported_family: bestSupported?.family ?? null,
    best_supported_score: bestSupported?.score ?? null,
    best_supported_answer: bestSupportedCandidate?.answer ?? null,
    score_gap_selected_minus_best_supported: bestSupported ? selection.selected_score - bestSupported.score : null,
    candidate_count: selection.candidate_count,
    supported_candidate_count: selection.supported_candidate_count,
    unsupported_candidate_count: selection.unsupported_candidate_count,
    failure_tags: failureTags,
    ranked_candidates: ranked.map((row) => ({
      candidate_id: row.candidate_id,
      family: row.family,
      supported_answer: row.supported_answer,
      score: row.score,
      answer_tokens: tokenCount(row.candidate?.answer),
      citation_count: row.candidate?.citations?.length ?? 0,
      unsupported_claims: row.candidate?.judgment?.unsupported_claims ?? [],
    })),
  };
}

function tagsForMiss({ selection, selected, bestSupported, ranked }) {
  const tags = new Set(["selected_unsupported_candidate"]);
  if (!bestSupported) {
    tags.add("no_supported_candidate_available");
    return [...tags];
  }
  const selectedTokens = tokenCount(selected?.answer);
  const supportedTokens = tokenCount(bestSupported?.answer);
  const selectedUnsupportedClaims = selected?.judgment?.unsupported_claims?.length ?? 0;
  if (selectedUnsupportedClaims > 0) tags.add("unsupported_overclaim_ranked_high");
  if (selectedTokens > supportedTokens + 5) tags.add("longer_unsupported_answer_over_supported");
  if (supportedTokens <= 6) tags.add("supported_answer_is_short");
  if (selected?.family !== bestSupported?.family) tags.add("family_shortcut_or_domain_shift");
  if ((selected?.citations?.length ?? 0) >= (bestSupported?.citations?.length ?? 0)) tags.add("citation_count_not_discriminative");
  const selectedRank = ranked.findIndex((row) => row.candidate_id === selection.selected_candidate_id);
  const supportedRank = ranked.findIndex((row) => row.candidate_id === bestSupported.id);
  if (selectedRank >= 0 && supportedRank >= 0 && supportedRank - selectedRank > 1) tags.add("supported_candidate_ranked_far_below");
  return [...tags].sort();
}

function countTags(tags) {
  const counts = {};
  for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return counts;
}

function tokenCount(value) {
  return String(value ?? "").split(/\s+/).filter(Boolean).length;
}

function renderReport(result) {
  const tagRows = Object.entries(result.summary.miss_tag_counts)
    .sort((left, right) => right[1] - left[1])
    .map(([tag, count]) => `| ${tag} | ${count} |`)
    .join("\n");
  return `# Qwen Label Ranker Miss Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no compute.

| Diagnostic examples | Selected supported | Selected unsupported |
| ---: | ---: | ---: |
| ${result.summary.diagnostic_examples} | ${result.summary.selected_supported} | ${result.summary.selected_unsupported} |

## Miss Tags

| Tag | Count |
| --- | ---: |
${tagRows || "| none | 0 |"}

## Conclusion

${result.conclusion.finding}

Next step: ${result.conclusion.next_step}
`;
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
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
