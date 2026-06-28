import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const missAuditRunId = args["miss-audit-run"] ?? "qwen-label-ranker-miss-audit-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "qwen-overclaim-penalty-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const missAudit = await readJson(path.join(runsDir, missAuditRunId, "result.json"));
const auditRows = await readJsonl(path.join(runsDir, missAuditRunId, "diagnostic_audit.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const candidateIndex = buildCandidateIndex(diagnosticPairs);

const variants = [
  {
    id: "base_ranker",
    class: "baseline",
    training_use: "none",
    description: "Original Qwen-label support ranker score.",
    adjust: (candidate) => candidate.score,
  },
  {
    id: "deployable_short_answer_regularizer",
    class: "deployable_heuristic",
    training_use: "candidate_text_only",
    description: "Prefer concise answers and lightly penalize extra citation count.",
    adjust: (candidate) => candidate.score - 0.03 * candidate.answer_tokens - 0.15 * Math.max(0, candidate.citation_count - 1),
  },
  {
    id: "deployable_family_neutralizer",
    class: "deployable_heuristic",
    training_use: "candidate_metadata_only",
    description: "Penalize the Qwen 3B family shortcut observed in the miss audit.",
    adjust: (candidate) => candidate.score - (candidate.family === "qwen3b_lora" ? 0.5 : 0),
  },
  {
    id: "deployable_short_citation_family_regularizer",
    class: "deployable_heuristic",
    training_use: "candidate_text_and_metadata_only",
    description: "Combine concise-answer, extra-citation, and Qwen 3B family penalties.",
    adjust: (candidate) => candidate.score - 0.03 * candidate.answer_tokens - 0.15 * Math.max(0, candidate.citation_count - 1) - (candidate.family === "qwen3b_lora" ? 0.5 : 0),
  },
  {
    id: "oracle_unsupported_claim_penalty",
    class: "oracle_diagnostic",
    training_use: "forbidden_final_diagnostic_only",
    description: "Penalize candidates with final-window judge unsupported claims. This is diagnostic only and not deployable.",
    adjust: (candidate) => candidate.score - 10 * candidate.unsupported_claims.length,
  },
  {
    id: "oracle_support_first_selector",
    class: "oracle_diagnostic",
    training_use: "forbidden_final_diagnostic_only",
    description: "Sort by final-window support label before ranker score. This is an upper-bound diagnostic only.",
    adjust: (candidate) => candidate.score + (candidate.supported_answer ? 100 : 0),
  },
];

const sweepRows = [];
for (const variant of variants) {
  const selections = auditRows.map((row) => selectCandidate(row, variant));
  const selectedSupported = selections.filter((row) => row.selected_supported_answer).length;
  const unsupportedMisses = selections.filter((row) => !row.selected_supported_answer);
  sweepRows.push({
    variant_id: variant.id,
    class: variant.class,
    training_use: variant.training_use,
    description: variant.description,
    diagnostic_examples: selections.length,
    selected_supported: selectedSupported,
    selected_unsupported: unsupportedMisses.length,
    supported_selection_rate: selections.length ? selectedSupported / selections.length : 0,
    rescued_from_base: countRescues(auditRows, selections),
    degraded_from_base: countDegradations(auditRows, selections),
    unsupported_selected_example_ids: unsupportedMisses.map((row) => row.example_id),
    selections,
  });
}

const deployableRows = sweepRows.filter((row) => row.class === "deployable_heuristic");
const bestDeployable = deployableRows.toSorted((left, right) => right.selected_supported - left.selected_supported)[0] ?? null;
const oracleOverclaim = sweepRows.find((row) => row.variant_id === "oracle_unsupported_claim_penalty");
const targetPairs = buildVerifierTargetPairs(auditRows, candidateIndex);
const status = bestDeployable && oracleOverclaim && bestDeployable.selected_supported < oracleOverclaim.selected_supported
  ? "overclaim_verifier_needed"
  : "deployable_heuristic_needs_nonfinal_confirmation";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_overclaim_penalty_audit",
  status,
  miss_audit_run_id: missAuditRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  summary: {
    diagnostic_examples: auditRows.length,
    base_selected_supported: sweepRows.find((row) => row.variant_id === "base_ranker")?.selected_supported ?? null,
    best_deployable_variant_id: bestDeployable?.variant_id ?? null,
    best_deployable_selected_supported: bestDeployable?.selected_supported ?? null,
    oracle_overclaim_selected_supported: oracleOverclaim?.selected_supported ?? null,
    verifier_target_pairs: targetPairs.length,
    deployable_heuristic_sufficient: Boolean(bestDeployable && oracleOverclaim && bestDeployable.selected_supported >= oracleOverclaim.selected_supported),
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    verifier_target_pairs_training_use: "forbidden_final_diagnostic_only",
    oracle_variants_are_deployable: false,
  },
  conclusion: {
    finding: "Simple deployable penalties can be audited, but final-window unsupported-claim labels are the signal that directly fixes these misses.",
    next_step: "Treat the final miss pairs as verifier regression targets only. Build analogous selected-vs-supported pairs from leakage-safe non-final Qwen labels or buy a small bounded verifier-label batch before any further generator GPU run.",
  },
  decision: {
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    integrate_selector_now: false,
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
    note: "This audit reads existing judged final diagnostic artifacts only.",
  },
  inherited: {
    miss_audit_status: missAudit.status,
    miss_audit_selected_unsupported: missAudit.summary?.selected_unsupported ?? null,
  },
};

await writeJsonl(path.join(outputDir, "penalty_sweep.jsonl"), sweepRows);
await writeJsonl(path.join(outputDir, "verifier_target_pairs.jsonl"), targetPairs);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, sweepRows);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function selectCandidate(auditRow, variant) {
  const selected = auditRow.ranked_candidates
    .map((candidate) => ({
      ...candidate,
      adjusted_score: variant.adjust(candidate),
    }))
    .toSorted((left, right) => {
      if (right.adjusted_score !== left.adjusted_score) return right.adjusted_score - left.adjusted_score;
      return right.score - left.score;
    })[0];
  return {
    example_id: auditRow.example_id,
    selected_candidate_id: selected?.candidate_id ?? null,
    selected_family: selected?.family ?? null,
    selected_supported_answer: selected?.supported_answer ?? false,
    selected_score: selected?.score ?? null,
    adjusted_score: selected?.adjusted_score ?? null,
    base_selected_candidate_id: auditRow.selected_candidate_id,
    base_selected_supported_answer: auditRow.selected_supported_answer,
  };
}

function countRescues(baseRows, selections) {
  const byExample = new Map(baseRows.map((row) => [row.example_id, row]));
  return selections.filter((selection) => {
    const base = byExample.get(selection.example_id);
    return base?.selected_supported_answer === false && selection.selected_supported_answer === true;
  }).length;
}

function countDegradations(baseRows, selections) {
  const byExample = new Map(baseRows.map((row) => [row.example_id, row]));
  return selections.filter((selection) => {
    const base = byExample.get(selection.example_id);
    return base?.selected_supported_answer === true && selection.selected_supported_answer === false;
  }).length;
}

function buildVerifierTargetPairs(auditRows, candidateIndex) {
  return auditRows
    .filter((row) => row.selected_supported_answer === false && row.best_supported_candidate_id)
    .map((row) => {
      const candidates = candidateIndex.get(row.example_id) ?? new Map();
      const selected = candidates.get(row.selected_candidate_id);
      const supported = candidates.get(row.best_supported_candidate_id);
      return {
        example_id: row.example_id,
        training_use: "forbidden_final_diagnostic_only",
        target_type: "selected_unsupported_vs_best_supported",
        preference_label: "prefer_best_supported",
        required_verifier_behavior: "rank the best supported candidate above the selected unsupported overclaim",
        input: selected?.input ?? supported?.input ?? null,
        selected_unsupported: {
          candidate_id: row.selected_candidate_id,
          family: row.selected_family,
          score: row.selected_score,
          answer: selected?.answer ?? row.selected_answer,
          citations: selected?.citations ?? [],
          unsupported_claims: selected?.judgment?.unsupported_claims ?? row.selected_judgment?.unsupported_claims ?? [],
        },
        best_supported: {
          candidate_id: row.best_supported_candidate_id,
          family: row.best_supported_family,
          score: row.best_supported_score,
          answer: supported?.answer ?? row.best_supported_answer,
          citations: supported?.citations ?? [],
          unsupported_claims: supported?.judgment?.unsupported_claims ?? [],
        },
        failure_tags: row.failure_tags,
        score_gap_selected_minus_best_supported: row.score_gap_selected_minus_best_supported,
      };
    });
}

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

function renderReport(result, sweepRows) {
  const sweepTable = sweepRows.map((row) => (
    `| ${row.variant_id} | ${row.class} | ${row.selected_supported}/${row.diagnostic_examples} | ${row.rescued_from_base} | ${row.degraded_from_base} |`
  )).join("\n");
  return `# Qwen Overclaim Penalty Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls, launches no compute, and does not authorize GPU spend.

| Diagnostic examples | Base supported | Best deployable supported | Oracle overclaim supported | Verifier target pairs |
| ---: | ---: | ---: | ---: | ---: |
| ${result.summary.diagnostic_examples} | ${result.summary.base_selected_supported} | ${result.summary.best_deployable_selected_supported} | ${result.summary.oracle_overclaim_selected_supported} | ${result.summary.verifier_target_pairs} |

## Penalty Sweep

| Variant | Class | Selected supported | Rescued | Degraded |
| --- | --- | ---: | ---: | ---: |
${sweepTable}

## Leakage Guard

Final-window labels are not used for training. Oracle rows and verifier target pairs are marked \`${result.leakage_guard.final_diagnostic_training_use}\`.

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
