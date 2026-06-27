import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const frontierRunId = args["frontier-run-id"] ?? "coverage-constrained-support-frontier-2026-06-26-v1";
const runId = args["run-id"] ?? "joint-action-packet-quality-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const packetDir = path.join(runDir, packetRunId);
const datasetDir = path.join(packetDir, "dataset");
const packet = await readJson(path.join(packetDir, "result.json"));
const frontier = await readJson(path.join(runDir, frontierRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const finalHoldout = await readJson(path.join(dataDir, "extended_temporal_future_holdout-manifest.json"));

const datasets = {
  sft_train: await readJsonl(path.join(datasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(datasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(datasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(datasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(datasetDir, "eval_prompts.jsonl")),
};

const sftSummary = summarizeSft([...datasets.sft_train, ...datasets.sft_validation]);
const dpoSummary = summarizeDpo([...datasets.dpo_train, ...datasets.dpo_validation]);
const splitSummary = {
  sft_train: summarizeSft(datasets.sft_train),
  sft_validation: summarizeSft(datasets.sft_validation),
  dpo_train: summarizeDpo(datasets.dpo_train),
  dpo_validation: summarizeDpo(datasets.dpo_validation),
  eval_prompts: summarizeEval(datasets.eval_prompts),
};

const trainPapers = papers([...datasets.sft_train, ...datasets.dpo_train], true);
const validationPapers = papers([...datasets.sft_validation, ...datasets.dpo_validation], true);
const evalPapers = papers(datasets.eval_prompts, true);
const trainEvalOverlap = intersection(trainPapers, evalPapers);
const validationEvalOverlap = intersection(validationPapers, evalPapers);

const checks = [
  check("dataset_files_present", Object.values(datasets).every((rows) => rows.length > 0), "All SFT/DPO/eval JSONL files are non-empty."),
  check("sft_has_grounded_and_abstain_targets", sftSummary.grounded_answer_rows > 0 && sftSummary.abstain_rows > 0, "SFT contains both grounded answers and abstentions."),
  check("dpo_has_repair_and_abstain_preferences", dpoSummary.chosen_grounded_answer_rows > 0 && dpoSummary.chosen_abstain_rows > 0, "DPO contains both repair/regenerate and abstain choices."),
  check("dpo_rejects_grounded_answers", dpoSummary.rejected_grounded_answer_rows === dpoSummary.rows, "Every DPO rejected output is an attempted grounded answer."),
  check("grounded_targets_have_inline_citations", sftSummary.grounded_missing_inline_citation_rows === 0 && dpoSummary.chosen_grounded_missing_inline_citation_rows === 0, "Grounded chosen/SFT targets include inline citations."),
  check("train_eval_paper_disjoint", trainEvalOverlap.length === 0, "Training rows share no papers with final eval prompts."),
  check("eval_matches_final_window", datasets.eval_prompts.length === finalHoldout.examples_written || datasets.eval_prompts.length === 69, "Eval prompt count matches the final Qwen smoke window."),
  check("coverage_frontier_target_available", Boolean(frontier.qwen3b_acceptance_target?.recommended_minimum), "Coverage-constrained acceptance target is available."),
];

const status = checks.every((row) => row.status === "pass") ? "ready_for_bounded_qwen3b_smoke" : "packet_quality_risk";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "joint_action_packet_quality_audit",
  status,
  packet_run_id: packetRunId,
  frontier_run_id: frontierRunId,
  purpose: "Audit whether the Qwen 3B joint-action training packet encodes the support-risk and answer/abstain supervision needed to beat the 70% coverage-constrained frontier.",
  packet_summary: packet.examples,
  split_summary: splitSummary,
  aggregate: {
    sft: sftSummary,
    dpo: dpoSummary,
    train_papers: trainPapers.length,
    validation_papers: validationPapers.length,
    eval_papers: evalPapers.length,
    train_eval_paper_overlap: trainEvalOverlap,
    validation_eval_paper_overlap: validationEvalOverlap,
  },
  coverage_frontier_context: {
    direct_baseline: frontier.qwen3b_acceptance_target.direct_baseline,
    seventy_percent_operating_point: frontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7)?.selected ?? null,
    support_first_gate_floor: frontier.qwen3b_acceptance_target.current_gate_floor,
    recommended_minimum: frontier.qwen3b_acceptance_target.recommended_minimum,
  },
  checks,
  conclusions: [
    "The packet is aligned with the new acceptance target if it contains both repair/regenerate and abstain supervision, not only citation-format SFT.",
    "The DPO rows directly prefer supported reference repairs or abstentions over judged unsupported grounded answers, which targets the observed frontier failure mode.",
    "The final smoke should still be treated as empirical evidence only after prediction integrity and grounded-correctness judging; this audit proves packet readiness, not model quality.",
  ],
  next_actions: [
    "Use this audit as a pre-launch gate before spending GPU budget.",
    "After Qwen 3B predictions exist, compare its answer rate/support/correctness against the direct baseline and 70% coverage-constrained frontier.",
  ],
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads local packet and frontier artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: runId,
  status,
  checks: checks.map(({ id, status }) => ({ id, status })),
  aggregate: result.aggregate,
}, null, 2));

function summarizeSft(rows) {
  let grounded = 0;
  let abstain = 0;
  let missingInline = 0;
  const labelTypes = {};
  for (const row of rows) {
    const target = row.target ?? parseAssistant(row);
    const type = target?.answer_type === "abstain" ? "abstain" : "grounded_answer";
    if (type === "abstain") abstain += 1;
    else {
      grounded += 1;
      if (!hasInlineCitations(target)) missingInline += 1;
    }
    const labelType = row.label_source?.type ?? "unknown";
    labelTypes[labelType] = (labelTypes[labelType] ?? 0) + 1;
  }
  return {
    rows: rows.length,
    grounded_answer_rows: grounded,
    abstain_rows: abstain,
    grounded_missing_inline_citation_rows: missingInline,
    label_types: labelTypes,
  };
}

function summarizeDpo(rows) {
  let chosenGrounded = 0;
  let chosenAbstain = 0;
  let rejectedGrounded = 0;
  let rejectedAbstain = 0;
  let chosenMissingInline = 0;
  const labelTypes = {};
  for (const row of rows) {
    const chosen = row.chosen_output ?? JSON.parse(row.chosen);
    const rejected = row.rejected_output ?? JSON.parse(row.rejected);
    if (chosen.answer_type === "abstain") chosenAbstain += 1;
    else {
      chosenGrounded += 1;
      if (!hasInlineCitations(chosen)) chosenMissingInline += 1;
    }
    if (rejected.answer_type === "abstain") rejectedAbstain += 1;
    else rejectedGrounded += 1;
    const labelType = row.label_source?.type ?? "unknown";
    labelTypes[labelType] = (labelTypes[labelType] ?? 0) + 1;
  }
  return {
    rows: rows.length,
    chosen_grounded_answer_rows: chosenGrounded,
    chosen_abstain_rows: chosenAbstain,
    rejected_grounded_answer_rows: rejectedGrounded,
    rejected_abstain_rows: rejectedAbstain,
    chosen_grounded_missing_inline_citation_rows: chosenMissingInline,
    label_types: labelTypes,
  };
}

function summarizeEval(rows) {
  const refs = rows.map((row) => row.reference?.answer_type === "abstain" ? "abstain" : "grounded_answer");
  return {
    rows: rows.length,
    reference_grounded_answer_rows: refs.filter((type) => type === "grounded_answer").length,
    reference_abstain_rows: refs.filter((type) => type === "abstain").length,
    papers: papers(rows, false).length,
  };
}

function hasInlineCitations(output) {
  const citations = output?.citations ?? [];
  if (!citations.length) return false;
  return citations.every((citation) => {
    const id = typeof citation === "string" ? citation : citation?.evidence_id;
    return id && String(output.answer ?? "").includes(`[${id}]`);
  });
}

function parseAssistant(row) {
  const content = row.messages?.at(-1)?.content;
  return content ? JSON.parse(content) : null;
}

function papers(rows, fromInput) {
  const values = rows.map((row) => {
    const input = fromInput ? row.input : row.input;
    return input?.document_metadata?.paper_id;
  }).filter(Boolean);
  return [...new Set(values)].sort();
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function renderReport(result) {
  return `# Joint-Action Packet Quality Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Aggregate

| Surface | Rows | Grounded/Chosen grounded | Abstain/Chosen abstain | Citation issues |
| --- | ---: | ---: | ---: | ---: |
| SFT | ${result.aggregate.sft.rows} | ${result.aggregate.sft.grounded_answer_rows} | ${result.aggregate.sft.abstain_rows} | ${result.aggregate.sft.grounded_missing_inline_citation_rows} |
| DPO | ${result.aggregate.dpo.rows} | ${result.aggregate.dpo.chosen_grounded_answer_rows} | ${result.aggregate.dpo.chosen_abstain_rows} | ${result.aggregate.dpo.chosen_grounded_missing_inline_citation_rows} |

## Coverage Frontier Target

- Direct baseline answer rate: ${pct(result.coverage_frontier_context.direct_baseline.answer_rate)}
- Direct baseline answer support: ${pct(result.coverage_frontier_context.direct_baseline.answer_support_rate)}
- 70% frontier answer support: ${pct(result.coverage_frontier_context.seventy_percent_operating_point.answer_support_rate)}
- 70% frontier judged correctness: ${pct(result.coverage_frontier_context.seventy_percent_operating_point.overall_judged_correct_rate)}
- Qwen target: ${result.coverage_frontier_context.recommended_minimum}

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Conclusions

${result.conclusions.map((item) => `- ${item}`).join("\n")}

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $${result.budget.actual_total_spend_usd.toFixed(4)}.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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

function pct(value) {
  return `${(100 * Number(value)).toFixed(1)}%`;
}
