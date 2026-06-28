import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const ledgerDir = path.join(experimentDir, "llm-calls");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet"] ?? "qwen-frontier-pool-support-packet-2026-06-28-v1";
const selectorRunId = args["selector-run"] ?? "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "openai-pool-adjudication-qwen-frontier-pool-2026-06-28-v1";
const model = args.model ?? "gpt-4o";
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
const maxPools = Number(args["max-pools"] ?? 24);
const maxBudgetUsd = Number(args["max-budget-usd"] ?? 100);
const maxOutputTokens = Number(args["max-output-tokens"] ?? 520);
const outputDir = path.join(runsDir, runId);
const ledgerPath = path.join(ledgerDir, "ledger.jsonl");
const llmBudgetPath = path.join(ledgerDir, "budget.json");
const prices = {
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, source: "https://developers.openai.com/api/docs/models/gpt-4o" },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, source: "https://developers.openai.com/api/docs/models/gpt-4o-mini" },
};
const price = prices[model];
if (!price) throw new Error(`Missing price entry for ${model}.`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.mkdir(ledgerDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const supportLabels = await readJsonl(path.join(runsDir, sourcePacketRunId, "support_labels.jsonl"));
const selectorPredictions = await readJsonl(path.join(runsDir, selectorRunId, "baseline_nonfinal_validation_predictions.jsonl"));
const selectorPredictionByExample = new Map(selectorPredictions.map((row) => [row.example_id, row]));
const pools = selectPools(groupPools(supportLabels), maxPools);
const estimated = pools.map((pool) => estimatePool(pool));
const estimatedCost = sum(estimated.map((row) => row.estimated_cost_usd));
const ledgerSpendBefore = await ledgerSpend(ledgerPath);
if (ledgerSpendBefore + estimatedCost > maxBudgetUsd) {
  throw new Error(`Refusing run: OpenAI ledger $${ledgerSpendBefore.toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${maxBudgetUsd.toFixed(2)}.`);
}
if (Number(budget.spend_usd.total_actual) + estimatedCost > Number(budget.max_budget_usd)) {
  throw new Error(`Refusing run: total spend $${Number(budget.spend_usd.total_actual).toFixed(4)} + estimated $${estimatedCost.toFixed(4)} exceeds max budget $${Number(budget.max_budget_usd).toFixed(2)}.`);
}

const adjudications = [];
if (dryRun || !process.env.OPENAI_API_KEY) {
  const reason = dryRun ? "dry-run requested" : "OPENAI_API_KEY missing";
  for (const row of estimated) {
    adjudications.push({
      root_example_id: row.root_example_id,
      source_index: row.source_index,
      skipped: true,
      skip_reason: reason,
      model,
      estimated_input_tokens: row.estimated_input_tokens,
      estimated_output_tokens: row.estimated_output_tokens,
      estimated_cost_usd: row.estimated_cost_usd,
    });
  }
} else {
  for (const pool of pools) {
    const request = buildRequest(pool);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`OpenAI pool adjudication failed for ${pool.root_example_id}: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
    }
    const usage = payload.usage ?? {};
    const cost = callCost(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, price);
    const rawContent = payload.choices?.[0]?.message?.content ?? "";
    const judgment = normalizePoolJudgment(parseJson(rawContent), pool);
    await appendLedger(ledgerPath, {
      ts: new Date().toISOString(),
      provider: "openai",
      model,
      task: "grounded_qa_pool_adjudication",
      run_id: runId,
      source_packet: sourcePacketRunId,
      split: pool.split,
      example_id: pool.root_example_id,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: cost,
      price_source: price.source,
    });
    adjudications.push({
      root_example_id: pool.root_example_id,
      source_index: pool.source_index,
      split: pool.split,
      model,
      candidate_count: pool.candidates.length,
      candidate_ids: pool.candidates.map((candidate) => candidate.candidate_id),
      judgment,
      selected_existing_label: labelForSelection(pool, judgment.selected_candidate_id),
      selected_supported_by_existing_judge: existingSupportForSelection(pool, judgment.selected_candidate_id),
      existing_oracle_supported_candidate_count: pool.candidates.filter((candidate) => candidate.existing_supported_answer).length,
      raw_content: rawContent,
      usage,
      cost_usd: cost,
      targeting: pool.targeting,
    });
  }
}

const ledgerSpendAfter = await ledgerSpend(ledgerPath);
const metrics = summarizeAdjudications(adjudications);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "openai_pool_adjudication",
  source_packet_run_id: sourcePacketRunId,
  selector_run_id: selectorRunId,
  purpose: "Buy a small capped GPT-4o batch of final-like non-final pool-level adjudications, selecting among generated Qwen candidates from evidence only.",
  model,
  dry_run: dryRun || !process.env.OPENAI_API_KEY,
  selection_policy: {
    max_pools: maxPools,
    candidate_pool: "generated qwen frontier-pool candidates only; QASPER references excluded to match final candidate-selection setting",
    priority: "roots with both supported and unsupported generated answers, hard-negative tags, or selector mistakes",
  },
  pools_requested: pools.length,
  calls_made: adjudications.filter((row) => !row.skipped).length,
  calls_skipped: adjudications.filter((row) => row.skipped).length,
  estimated_cost_usd: estimatedCost,
  run_cost_usd: sum(adjudications.map((row) => Number(row.cost_usd ?? 0))),
  ledger_spend_before_usd: ledgerSpendBefore,
  ledger_spend_after_usd: ledgerSpendAfter,
  metrics,
  leakage_guard: {
    final_window_labels_used: false,
    final_window_labels_used_for_training: false,
    source_index_min: min(pools.map((pool) => pool.source_index)),
    source_index_max: max(pools.map((pool) => pool.source_index)),
    training_use: "allowed_nonfinal_pool_adjudication",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    total_actual_before_run_usd: budget.spend_usd.total_actual,
    estimated_total_after_run_usd: Number(budget.spend_usd.total_actual) + estimatedCost,
    actual_total_after_run_usd: Number(budget.spend_usd.total_actual) + sum(adjudications.map((row) => Number(row.cost_usd ?? 0))),
  },
  llm_budget: {
    openai_llm_calls: adjudications.filter((row) => !row.skipped).length,
    openai_cost_usd: sum(adjudications.map((row) => Number(row.cost_usd ?? 0))),
    external_compute_cost_usd: 0,
    ledger_task: "grounded_qa_pool_adjudication",
  },
  decision: decisionFromMetrics(metrics),
};

await writeJsonl(path.join(outputDir, "selected_pools.jsonl"), pools);
await writeJsonl(path.join(outputDir, "estimated_calls.jsonl"), estimated);
await writeJsonl(path.join(outputDir, "pool_adjudications.jsonl"), adjudications);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);
await fs.writeFile(llmBudgetPath, `${JSON.stringify({
  max_budget_usd: maxBudgetUsd,
  ledger_spend_usd: ledgerSpendAfter,
  remaining_budget_usd: Math.max(0, maxBudgetUsd - ledgerSpendAfter),
  ledger_path: path.relative(rootDir, ledgerPath),
  last_updated: new Date().toISOString(),
}, null, 2)}\n`);

console.log(JSON.stringify({
  run_id: result.run_id,
  dry_run: result.dry_run,
  calls_made: result.calls_made,
  run_cost_usd: result.run_cost_usd,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function groupPools(rows) {
  const byRoot = new Map();
  for (const row of rows) {
    if (!byRoot.has(row.root_example_id)) {
      byRoot.set(row.root_example_id, {
        root_example_id: row.root_example_id,
        split: row.split,
        source_index: Number(row.source_index),
        input: row.input,
        candidates: [],
      });
    }
    byRoot.get(row.root_example_id).candidates.push({
      candidate_id: row.example_id,
      sample_index: row.sample_index,
      answer_type: row.prediction?.answer_type ?? "grounded_answer",
      answer: row.prediction?.answer ?? "",
      citations: row.prediction?.citations ?? [],
      claim_table: row.prediction?.claim_table ?? [],
      abstention_reason: row.prediction?.abstention_reason ?? null,
      existing_supported_answer: row.labels?.supported_answer === true,
      existing_unsupported_answer: row.labels?.unsupported_answer === true,
      existing_supported_abstention: row.labels?.supported_abstention === true,
      existing_judge_verdict: row.judge?.verdict ?? null,
      existing_unsupported_claims: row.judge?.unsupported_claims ?? [],
    });
  }
  return [...byRoot.values()].map((pool) => ({
    ...pool,
    candidates: pool.candidates.sort((left, right) => Number(left.sample_index) - Number(right.sample_index)),
  }));
}

function selectPools(pools, limit) {
  const scored = pools
    .filter((pool) => pool.candidates.length >= 2)
    .filter((pool) => pool.candidates.some((candidate) => candidate.existing_supported_answer))
    .filter((pool) => pool.candidates.some((candidate) => candidate.existing_unsupported_answer))
    .map((pool) => ({ ...pool, targeting: targetingForPool(pool) }))
    .sort((left, right) => right.targeting.priority_score - left.targeting.priority_score || left.source_index - right.source_index);
  return scored.slice(0, limit);
}

function targetingForPool(pool) {
  const selectorRow = selectorPredictionByExample.get(pool.root_example_id);
  const unsupportedNumbers = pool.candidates.filter((candidate) => candidate.existing_unsupported_claims.some((claim) => numberTokens(claim).length)).length;
  const supported = pool.candidates.filter((candidate) => candidate.existing_supported_answer).length;
  const unsupported = pool.candidates.filter((candidate) => candidate.existing_unsupported_answer).length;
  const selectorFailed = selectorRow ? selectorRow.correct === false : false;
  const hardTags = selectorRow?.hard_negative_core_tags ?? [];
  return {
    priority_score: (selectorFailed ? 10 : 0) + hardTags.length + unsupportedNumbers + Math.min(supported, unsupported),
    selector_failed: selectorFailed,
    selector_pair_id: selectorRow?.pair_id ?? null,
    hard_negative_core_tags: hardTags,
    unsupported_number_candidate_count: unsupportedNumbers,
    supported_generated_answer_count: supported,
    unsupported_generated_answer_count: unsupported,
  };
}

function buildRequest(pool) {
  return {
    model,
    temperature: 0,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a strict grounded QA pool adjudicator.",
          "Use only the supplied question, evidence pack, and candidate answers.",
          "Choose the single best candidate if it is fully supported by its cited evidence.",
          "If no candidate answer is fully supported but an abstention candidate is justified by insufficient evidence, choose that abstention.",
          "If no candidate is acceptable, select NONE.",
          "Return only valid JSON with keys: selected_candidate_id, selected_answer_type, selected_is_fully_supported, rejected_candidate_ids, unsupported_candidate_reasons, notes.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${pool.input.question}`,
          "",
          "Evidence pack:",
          pool.input.compact_retrieved_evidence_pack.map(formatEvidence).join("\n\n"),
          "",
          "Candidates:",
          pool.candidates.map(formatCandidate).join("\n\n"),
          "",
          "Judge strictly. A claim is supported only if the cited evidence directly entails it. Prefer a concise fully supported answer over a longer overclaim.",
        ].join("\n"),
      },
    ],
  };
}

function formatCandidate(candidate) {
  return [
    `Candidate id: ${candidate.candidate_id}`,
    `answer_type: ${candidate.answer_type}`,
    `answer: ${candidate.answer || "(empty)"}`,
    `citations: ${JSON.stringify(candidate.citations)}`,
    `claim_table: ${JSON.stringify(candidate.claim_table ?? [])}`,
    `abstention_reason: ${candidate.abstention_reason ?? ""}`,
  ].join("\n");
}

function formatEvidence(evidence) {
  return `[${evidence.evidence_id}] ${evidence.section ?? "Evidence"}: ${evidence.text}`;
}

function estimatePool(pool) {
  const request = buildRequest(pool);
  const estimatedInputTokens = Math.ceil(JSON.stringify(request.messages).length / 4);
  return {
    root_example_id: pool.root_example_id,
    source_index: pool.source_index,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: maxOutputTokens,
    estimated_cost_usd: callCost(estimatedInputTokens, maxOutputTokens, price),
  };
}

function normalizePoolJudgment(value, pool) {
  const candidateIds = new Set(pool.candidates.map((candidate) => candidate.candidate_id));
  const rawSelected = String(value.selected_candidate_id ?? "NONE");
  const selected = candidateIds.has(rawSelected) ? rawSelected : "NONE";
  const rejected = Array.isArray(value.rejected_candidate_ids) ? value.rejected_candidate_ids.map(String).filter((id) => candidateIds.has(id)) : [];
  return {
    selected_candidate_id: selected,
    selected_answer_type: selected === "NONE" ? "none" : String(value.selected_answer_type ?? pool.candidates.find((candidate) => candidate.candidate_id === selected)?.answer_type ?? ""),
    selected_is_fully_supported: Boolean(value.selected_is_fully_supported),
    rejected_candidate_ids: rejected,
    unsupported_candidate_reasons: value.unsupported_candidate_reasons && typeof value.unsupported_candidate_reasons === "object" ? value.unsupported_candidate_reasons : {},
    notes: String(value.notes ?? ""),
  };
}

function labelForSelection(pool, selectedCandidateId) {
  const selected = pool.candidates.find((candidate) => candidate.candidate_id === selectedCandidateId);
  if (!selected) return "none";
  if (selected.existing_supported_answer) return "supported_answer";
  if (selected.existing_supported_abstention) return "supported_abstention";
  if (selected.existing_unsupported_answer) return "unsupported_answer";
  return "other";
}

function existingSupportForSelection(pool, selectedCandidateId) {
  const selected = pool.candidates.find((candidate) => candidate.candidate_id === selectedCandidateId);
  return Boolean(selected?.existing_supported_answer || selected?.existing_supported_abstention);
}

function summarizeAdjudications(rows) {
  const judged = rows.filter((row) => !row.skipped);
  const selected = judged.filter((row) => row.judgment?.selected_candidate_id && row.judgment.selected_candidate_id !== "NONE");
  const selectedSupported = selected.filter((row) => row.selected_supported_by_existing_judge);
  return {
    pools_judged: judged.length,
    selections_made: selected.length,
    none_selected: judged.length - selected.length,
    selected_existing_supported: selectedSupported.length,
    selected_existing_unsupported: selected.length - selectedSupported.length,
    selected_existing_support_rate: rate(selectedSupported.length, selected.length),
    pool_success_rate: rate(selectedSupported.length, judged.length),
    pools_with_existing_supported_candidate: judged.filter((row) => row.existing_oracle_supported_candidate_count > 0).length,
  };
}

function decisionFromMetrics(metrics) {
  const useful = metrics.pool_success_rate >= 0.75;
  return {
    train_selector_from_pool_labels_now: useful,
    launch_gpu_now: false,
    buy_more_openai_labels_now: !useful,
    reason: useful
      ? "Pool-level GPT-4o adjudication reliably selects existing-supported generated candidates on the targeted non-final batch."
      : "Pool-level GPT-4o adjudication is not reliable enough on the targeted non-final batch to justify immediate selector integration.",
    next_step: useful
      ? "Train a listwise selector from pool-choice labels and evaluate final diagnostic selection before any generator GPU run."
      : "Audit disagreement rows before buying more labels; if disagreement is judge ambiguity rather than model error, escalate to stronger adjudication or human review.",
  };
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return { selected_candidate_id: "NONE", selected_answer_type: "none", selected_is_fully_supported: false, rejected_candidate_ids: [], unsupported_candidate_reasons: {}, notes: String(content).slice(0, 500) };
  }
}

function callCost(inputTokens, outputTokens, modelPrice) {
  return (inputTokens / 1_000_000) * modelPrice.inputPerMillion + (outputTokens / 1_000_000) * modelPrice.outputPerMillion;
}

async function ledgerSpend(file) {
  try {
    const rows = await readJsonl(file);
    return sum(rows.map((row) => Number(row.cost_usd ?? 0)));
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

function renderReport(result) {
  return `# OpenAI Pool Adjudication

Generated: ${result.generated_at}

Status: \`${result.dry_run ? "dry_run" : "complete"}\`

This run buys a capped GPT-4o batch for pool-level candidate selection over non-final generated Qwen candidates only. It excludes reference answers and uses final-window labels nowhere.

| Pools | Calls | Cost | Selected supported | Pool success |
| ---: | ---: | ---: | ---: | ---: |
| ${result.pools_requested} | ${result.calls_made} | $${result.run_cost_usd.toFixed(6)} | ${result.metrics.selected_existing_supported}/${result.metrics.selections_made} | ${pct(result.metrics.pool_success_rate)} |

## Decision

- Train selector from pool labels now: ${result.decision.train_selector_from_pool_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

function max(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

async function appendLedger(file, row) {
  await fs.appendFile(file, `${JSON.stringify(row)}\n`);
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
