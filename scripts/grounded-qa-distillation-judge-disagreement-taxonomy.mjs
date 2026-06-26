import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const secondPassRunId = args["second-pass-run-id"] ?? "judge-reliability-second-pass-run-2026-06-26-v2";
const packetRunId = args["packet-run-id"] ?? "judge-adjudication-packet-2026-06-26-v1";
const runId = args["run-id"] ?? `judge-disagreement-taxonomy-${secondPassRunId}`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const secondPass = await readJson(path.join(runDir, secondPassRunId, "result.json"));
const secondRows = await readJsonl(path.join(runDir, secondPassRunId, "second_pass_results.jsonl"));
const packetRows = await readJsonl(path.join(runDir, packetRunId, "adjudication_packet.jsonl"));
const packetCaseIndex = indexPacketCases(packetRows);

const compared = secondRows.filter((row) => !row.skipped);
const disagreements = compared
  .filter((row) => normalizeVerdict(row.original_verdict) !== normalizeVerdict(row.judgment?.verdict))
  .map((row) => enrichDisagreement(row, packetCaseIndex.get(row.case_id)));

const taxonomy = aggregateTaxonomy(disagreements);
const byAuditType = aggregateBy(disagreements, (row) => row.audit_type);
const byPolicy = aggregateBy(disagreements, (row) => row.policy);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "judge_disagreement_taxonomy",
  status: "judge_disagreement_taxonomy_complete",
  purpose: "Convert existing first-pass/second-pass judge disagreements into manuscript-facing error categories and claim constraints.",
  source_runs: {
    second_pass_run_id: secondPassRunId,
    adjudication_packet_run_id: packetRunId,
  },
  source_summary: {
    compared_cases: compared.length,
    exact_agreements: secondPass.agreement?.exact_agreements ?? null,
    exact_agreement_rate: secondPass.agreement?.exact_agreement_rate ?? null,
    disagreements: disagreements.length,
    disagreement_rate: ratio(disagreements.length, compared.length),
  },
  taxonomy,
  by_audit_type: byAuditType,
  by_policy: byPolicy,
  disagreement_examples: disagreements,
  manuscript_constraints: [
    "Call support/correctness metrics model-judged rather than human-validated.",
    "Report second-pass exact agreement and disagreement taxonomy near any judged-correctness table.",
    "Treat questionable abstentions as unstable boundary cases; do not use them as proof that abstention calibration is solved.",
    "For answer-support claims, highlight that most unsupported-answer and cross-policy cases are stable, but some first-pass unsupported/partial verdicts reverse to supported.",
    "Use Qwen 3B joint-action results to evaluate coverage/support jointly rather than relying on stronger abstention gates alone.",
  ],
  claim_boundary: {
    supports_answer_support_judge_as_screening_signal: true,
    supports_abstention_boundary_solved_claim: false,
    supports_human_validated_correctness_claim: false,
    reason: "This taxonomy uses two model judges and no human adjudication; it improves transparency but cannot replace human validation.",
  },
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
    note: "This taxonomy reads the already-paid second-pass judge artifacts and makes no new calls.",
  },
};

await fs.writeFile(path.join(outputDir, "disagreements.jsonl"), `${disagreements.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, source_summary: result.source_summary, taxonomy: result.taxonomy }, null, 2));

function indexPacketCases(packetRows) {
  const index = new Map();
  for (const row of packetRows) {
    for (const [caseIndex, item] of (row.cases ?? []).entries()) {
      const caseId = `${row.packet_id}-case-${String(caseIndex + 1).padStart(2, "0")}`;
      index.set(caseId, { packet: row, case: item });
    }
  }
  return index;
}

function enrichDisagreement(row, packetCase) {
  const category = classify(row);
  return {
    packet_id: row.packet_id,
    case_id: row.case_id,
    audit_type: row.audit_type,
    policy: row.policy,
    example_id: packetCase?.packet?.example_id ?? null,
    question: packetCase?.packet?.question ?? null,
    prediction_answer_type: row.prediction_answer_type,
    original_verdict: normalizeVerdict(row.original_verdict),
    second_pass_verdict: normalizeVerdict(row.judgment?.verdict),
    category,
    category_label: categoryLabel(category),
    original_judge_notes: packetCase?.case?.judge_verdict?.notes ?? null,
    second_pass_rationale: row.judgment?.rationale ?? null,
    cited_evidence_ids: packetCase?.case?.prediction?.citations ?? [],
    reference_answer_type: packetCase?.packet?.reference_output?.answer_type ?? null,
  };
}

function classify(row) {
  const original = normalizeVerdict(row.original_verdict);
  const second = normalizeVerdict(row.judgment?.verdict);
  if (row.audit_type === "questionable_abstention" && original === "incorrect_abstention" && second === "correct_abstention") {
    return "abstention_boundary_reversal";
  }
  if (["unsupported", "partial"].includes(original) && second === "supported") {
    return original === "partial" ? "partial_vs_supported_granularity" : "unsupported_to_supported_reversal";
  }
  if (original === "supported" && ["unsupported", "partial"].includes(second)) {
    return "supported_to_unsupported_reversal";
  }
  return "other_verdict_shift";
}

function categoryLabel(category) {
  return {
    abstention_boundary_reversal: "Abstention boundary reversed toward correct abstention",
    unsupported_to_supported_reversal: "First-pass unsupported reversed to supported",
    partial_vs_supported_granularity: "Partial-support granularity reversed to supported",
    supported_to_unsupported_reversal: "First-pass supported reversed to unsupported/partial",
    other_verdict_shift: "Other verdict shift",
  }[category] ?? category;
}

function aggregateTaxonomy(rows) {
  return Object.fromEntries(Object.entries(aggregateBy(rows, (row) => row.category)).map(([category, summary]) => [category, {
    ...summary,
    label: categoryLabel(category),
    manuscript_treatment: manuscriptTreatment(category),
  }]));
}

function manuscriptTreatment(category) {
  return {
    abstention_boundary_reversal: "Report as unstable abstention-boundary evidence; do not claim abstention calibration is solved.",
    unsupported_to_supported_reversal: "Report as answer-support judge uncertainty; inspect examples before treating unsupported rates as human truth.",
    partial_vs_supported_granularity: "Report partial/support boundary as a granularity issue in model-judge labels.",
    supported_to_unsupported_reversal: "Treat as high-risk support false positive if present.",
    other_verdict_shift: "Inspect manually before manuscript use.",
  }[category] ?? "Inspect manually before manuscript use.";
}

function aggregateBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row) ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, {
    disagreements: values.length,
    share_of_disagreements: ratio(values.length, rows.length),
    case_ids: values.map((row) => row.case_id),
  }]));
}

function renderReport(result) {
  const taxonomyRows = Object.entries(result.taxonomy)
    .map(([category, row]) => `| ${category} | ${row.disagreements} | ${pct(row.share_of_disagreements)} | ${row.manuscript_treatment} |`)
    .join("\n");
  return `# Judge Disagreement Taxonomy

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source second-pass run: \`${result.source_runs.second_pass_run_id}\`

Compared cases: ${result.source_summary.compared_cases}

Disagreements: ${result.source_summary.disagreements} (${pct(result.source_summary.disagreement_rate)})

## Taxonomy

| Category | Disagreements | Share | Manuscript treatment |
| --- | ---: | ---: | --- |
${taxonomyRows}

## Constraints

${result.manuscript_constraints.map((item) => `- ${item}`).join("\n")}

This taxonomy makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function normalizeVerdict(value) {
  return String(value ?? "").trim().toLowerCase();
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
