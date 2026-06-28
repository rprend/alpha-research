import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourceInventoryRunId = args["source-inventory-run"] ?? "final-contrast-source-inventory-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const inventory = await readJson(path.join(runsDir, sourceInventoryRunId, "result.json"));
const pairRows = await readJsonl(path.join(runsDir, sourceInventoryRunId, "usable_answer_contrasts.jsonl"));
const sourceInventory = await readJsonl(path.join(runsDir, sourceInventoryRunId, "source_inventory.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const nliUnits = buildNliUnits(pairRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_margin_compatible_heldout_packet",
  status: pairRows.length >= 40 ? "ready_for_frozen_selector_nli_and_eval" : "too_few_pairs",
  source_inventory_run_id: sourceInventoryRunId,
  purpose: "Convert existing judged 321-389 prediction-family contrasts into a D280-compatible heldout pair packet with claim-NLI input units.",
  window: inventory.window,
  counts: {
    source_prediction_runs: inventory.summary?.prediction_runs_with_69_final_rows,
    source_prediction_runs_with_full_judgments: inventory.summary?.prediction_runs_with_full_judgments,
    source_runs_usable_for_answer_contrasts: inventory.summary?.source_runs_usable_for_answer_contrasts,
    heldout_pair_rows: pairRows.length,
    heldout_examples_with_pairs: new Set(pairRows.map((row) => row.example_id)).size,
    nli_units_required: nliUnits.length,
    exact_duplicate_pairs_excluded: inventory.summary?.exact_duplicate_answer_contrast_pairs,
  },
  source_mix: {
    chosen_families: groupCount(pairRows.map((row) => row.chosen.family)),
    rejected_families: groupCount(pairRows.map((row) => row.rejected.family)),
    top_source_runs: sourceInventory
      .filter((row) => row.usable_for_answer_contrasts)
      .sort((left, right) => (right.supported_answers + right.unsupported_answers) - (left.supported_answers + left.unsupported_answers))
      .slice(0, 20),
  },
  compatibility: {
    pair_schema_matches_hard_negative_selector: true,
    nli_key_schema_matches_claim_nli_verifier: true,
    ready_for_local_nli_scoring: nliUnits.length > 0,
    ready_for_frozen_d280_eval_after_nli: pairRows.length >= 40,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: true,
    training_use: "frozen_d280_heldout_only",
    note: "This packet uses final-window judgments only for frozen heldout evaluation, not for fitting selector weights or D280 coefficients.",
  },
  decision: {
    score_local_nli_next: nliUnits.length > 0,
    evaluate_frozen_d280_next: pairRows.length >= 40,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    reason: "Existing judged final-window prediction families provide a large non-duplicate answer-contrast heldout for frozen selector replay.",
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
    note: "Packet construction reuses existing judged artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "heldout_pairwise.jsonl"), pairRows.map((row) => ({ ...row, training_use: "frozen_d280_heldout_only" })));
await writeJsonl(path.join(outputDir, "claim-nli-input.jsonl"), nliUnits);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  counts: result.counts,
  decision: result.decision,
}, null, 2));

function buildNliUnits(pairs) {
  const units = new Map();
  for (const pair of pairs) {
    for (const candidate of [pair.chosen, pair.rejected]) {
      for (const claim of claimTexts(candidate)) {
        const unitKey = nliKeyForCandidateClaim(pair, candidate, claim);
        if (units.has(unitKey)) continue;
        units.set(unitKey, {
          unit_key: unitKey,
          premise: truncate(citedText(pair.input, candidate), 3600),
          hypothesis: truncate(claim, 700),
          source: "final_margin_compatible_heldout_candidate_claim",
          example_id: pair.example_id,
          candidate_id: candidate.id,
        });
      }
    }
  }
  return [...units.values()];
}

function nliKeyForCandidateClaim(pair, candidate, claim) {
  return `candidate::${pair.example_id ?? pair.root_example_id}::${candidate.id}::${hashString(claim)}`;
}

function citedText(input, candidate) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  return citedIds.map((id) => evidenceById.get(id)?.text ?? "").filter(Boolean).join(" ");
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) {
    return [answer, ...claims];
  }
  return claims;
}

function groupCount(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function renderReport(result) {
  return `# Final Margin-Compatible Heldout Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no API calls. It converts existing judged 321-389 prediction-family contrasts into a D280-compatible heldout pair packet.

## Counts

- Heldout pair rows: ${result.counts.heldout_pair_rows}
- Examples with pairs: ${result.counts.heldout_examples_with_pairs}
- Required claim-NLI units: ${result.counts.nli_units_required}
- Exact duplicate pairs excluded upstream: ${result.counts.exact_duplicate_pairs_excluded}

## Decision

- Score local NLI next: ${result.decision.score_local_nli_next ? "yes" : "no"}
- Evaluate frozen D280 next: ${result.decision.evaluate_frozen_d280_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function stripCitations(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function normalizedText(value) {
  return stripCitations(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2).join(" ");
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
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
