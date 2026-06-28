import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourceInventoryRunIds = (args["source-inventory-runs"] ?? [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
].join(",")).split(",").map((value) => value.trim()).filter(Boolean);
const runId = args["run-id"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceSummaries = [];
const pairRows = [];
for (const sourceRunId of sourceInventoryRunIds) {
  const sourceResult = await readJson(path.join(runsDir, sourceRunId, "result.json"));
  const rows = await readJsonl(path.join(runsDir, sourceRunId, "usable_answer_contrasts.jsonl"));
  sourceSummaries.push({
    source_inventory_run_id: sourceRunId,
    window: sourceResult.window,
    usable_answer_contrast_pairs: rows.length,
    examples_with_usable_answer_contrasts: sourceResult.summary?.examples_with_usable_answer_contrasts,
  });
  pairRows.push(...rows.map((row) => ({
    ...row,
    pair_id: `${sourceRunId}:${row.pair_id}`,
    training_use: "allowed_nonfinal_broad_contrast_training",
    source_inventory_run_id: sourceRunId,
  })));
}

const nliUnits = buildNliUnits(pairRows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonfinal_margin_compatible_train_packet",
  status: pairRows.length >= 40 ? "ready_for_zero_call_selector_training" : "too_sparse_for_selector_training",
  purpose: "Combine existing judged non-final answer-contrast inventories into a leakage-safe training packet for broad margin-compatible selector probes.",
  source_inventory_run_ids: sourceInventoryRunIds,
  source_summaries: sourceSummaries,
  counts: {
    train_pair_rows: pairRows.length,
    train_examples_with_pairs: new Set(pairRows.map((row) => row.example_id)).size,
    nli_units_required: nliUnits.length,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    train_windows: sourceSummaries.map((row) => row.window),
    training_use: "allowed_nonfinal_broad_contrast_training",
  },
  decision: {
    score_local_nli_next: nliUnits.length > 0,
    train_selector_probe_next: pairRows.length >= 40,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    reason: pairRows.length >= 40
      ? "Existing non-final windows provide a sparse but usable zero-call contrast packet for a selector-transfer probe."
      : "Existing non-final contrast rows remain too sparse for selector training.",
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
    note: "Packet construction reuses existing judged non-final artifacts only.",
  },
};

await writeJsonl(path.join(outputDir, "train_pairwise.jsonl"), pairRows);
await writeJsonl(path.join(outputDir, "claim-nli-input.jsonl"), nliUnits);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({ run_id: runId, status: result.status, counts: result.counts, decision: result.decision }, null, 2));

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
          source: "nonfinal_margin_compatible_train_candidate_claim",
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
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) return [answer, ...claims];
  return claims;
}

function renderReport(result) {
  return `# Non-Final Margin-Compatible Train Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet combines existing judged non-final answer contrasts. It makes no API calls.

## Counts

- Train pair rows: ${result.counts.train_pair_rows}
- Train examples with pairs: ${result.counts.train_examples_with_pairs}
- Required claim-NLI units: ${result.counts.nli_units_required}

## Decision

- Train selector probe next: ${result.decision.train_selector_probe_next ? "yes" : "no"}
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
