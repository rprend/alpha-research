import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const adjudicationRunId = args["adjudication-run"] ?? "targeted-boundary-adjudication-run-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "boundary-adjudication-disagreement-audit-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const adjudicationResult = await readJson(path.join(runsDir, adjudicationRunId, "result.json"));
const requests = await readJsonl(path.join(runsDir, adjudicationRunId, "requests.jsonl"));
const adjudications = await readJsonl(path.join(runsDir, adjudicationRunId, "adjudications.jsonl"));
const requestById = new Map(requests.map((row) => [row.request_id, row]));

const auditRows = adjudications.map((row) => auditRow(row, requestById.get(row.request_id)));
const disagreements = auditRows.filter((row) => row.existing_signal_agreement !== "agrees_a_supported_b_unsupported");
const acceptedForTraining = auditRows.filter((row) => row.training_recommendation === "accept_paid_label_for_nonfinal_boundary_training");
const quarantined = auditRows.filter((row) => row.training_recommendation !== "accept_paid_label_for_nonfinal_boundary_training");
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "boundary_adjudication_disagreement_audit",
  adjudication_run_id: adjudicationRunId,
  purpose: "Audit the 12 paid D270 boundary adjudications before using them as non-final selector supervision.",
  summary: {
    adjudications: auditRows.length,
    disagreements: disagreements.length,
    accepted_for_training: acceptedForTraining.length,
    quarantined: quarantined.length,
    disagreement_mechanism_counts: countBy(disagreements.map((row) => row.audit_category)),
    accepted_supported_candidate_counts: countBy(acceptedForTraining.map((row) => row.paid_supported_candidate)),
  },
  findings: findingsFor(disagreements),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    audit_uses_paid_nonfinal_rows_only: true,
    accepted_training_use: "allowed_nonfinal_targeted_boundary_adjudication_filtered",
    quarantined_training_use: "forbidden_until_manual_or_second_judge_review",
  },
  decision: decisionFor(auditRows, acceptedForTraining, disagreements),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_openai_cost_usd: adjudicationResult.run_cost_usd,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing paid adjudication artifacts only.",
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    disagreements_jsonl: rel(path.join(outputDir, "disagreements.jsonl")),
    accepted_training_labels_jsonl: rel(path.join(outputDir, "accepted_training_labels.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), auditRows);
await writeJsonl(path.join(outputDir, "disagreements.jsonl"), disagreements);
await writeJsonl(path.join(outputDir, "accepted_training_labels.jsonl"), acceptedForTraining.map(trainingLabel));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  decision: result.decision,
}, null, 2));

function auditRow(adjudication, request) {
  const candidateASupport = citedSupportProbe(request?.candidate_a, request?.input);
  const candidateBSupport = citedSupportProbe(request?.candidate_b, request?.input);
  const existingAgreement = adjudication.agreement_with_existing_signal;
  const paidSupported = adjudication.judgment?.supported_candidate ?? "missing";
  const auditCategory = categoryFor({ paidSupported, existingAgreement, candidateASupport, candidateBSupport });
  const trainingRecommendation = trainingRecommendationFor({ paidSupported, auditCategory });
  return {
    request_id: adjudication.request_id,
    root_example_id: adjudication.root_example_id,
    source_index: adjudication.source_index,
    paid_supported_candidate: paidSupported,
    existing_signal_agreement: existingAgreement,
    audit_category: auditCategory,
    training_recommendation: trainingRecommendation,
    candidate_a: {
      candidate_id: request?.candidate_a?.candidate_id,
      answer: request?.candidate_a?.answer,
      claim_table: request?.candidate_a?.claim_table ?? [],
      cited_support_probe: candidateASupport,
    },
    candidate_b: {
      candidate_id: request?.candidate_b?.candidate_id,
      answer: request?.candidate_b?.answer,
      claim_table: request?.candidate_b?.claim_table ?? [],
      cited_support_probe: candidateBSupport,
    },
    paid_judgment: adjudication.judgment,
    tags: adjudication.tags ?? request?.tags ?? [],
  };
}

function citedSupportProbe(candidate, input) {
  const citedEvidence = (candidate?.citations ?? [])
    .map((citation) => input?.compact_retrieved_evidence_pack?.find((item) => item.evidence_id === citation))
    .filter(Boolean);
  const citedText = normalizeText(citedEvidence.map((item) => item.text).join(" "));
  const answerNumbers = numberTokens(candidate?.answer);
  const claimNumbers = numberTokens((candidate?.claim_table ?? []).map((claim) => claim.claim ?? "").join(" "));
  const contentTerms = contentTokens(`${candidate?.answer ?? ""} ${(candidate?.claim_table ?? []).map((claim) => claim.claim ?? "").join(" ")}`);
  return {
    cited_evidence_ids: citedEvidence.map((item) => item.evidence_id),
    answer_numbers: answerNumbers,
    claim_numbers: claimNumbers,
    all_numbers_found_in_cited_evidence: [...answerNumbers, ...claimNumbers].every((token) => citedText.includes(normalizeNumberToken(token))),
    content_term_coverage: rate(contentTerms.filter((token) => citedText.includes(token)).length, contentTerms.length),
    cited_text_preview: preview(citedText, 220),
  };
}

function categoryFor({ paidSupported, existingAgreement, candidateASupport, candidateBSupport }) {
  if (existingAgreement === "agrees_a_supported_b_unsupported") return "paid_label_matches_existing_signal";
  if (paidSupported === "both") return "existing_weak_label_too_strict_or_equivalent_surface";
  if (paidSupported === "neither" && candidateASupport.all_numbers_found_in_cited_evidence && candidateASupport.content_term_coverage >= 0.45) {
    return "paid_adjudicator_false_negative_or_claim_table_overstrict";
  }
  if (paidSupported === "neither") return "existing_weak_label_likely_false_positive";
  if (paidSupported === "B") return "existing_weak_label_reversed_or_paid_false_positive";
  return "uncategorized_disagreement";
}

function trainingRecommendationFor({ paidSupported, auditCategory }) {
  if (paidSupported === "A" && auditCategory === "paid_label_matches_existing_signal") {
    return "accept_paid_label_for_nonfinal_boundary_training";
  }
  return "quarantine_until_manual_or_second_judge_review";
}

function trainingLabel(row) {
  return {
    request_id: row.request_id,
    root_example_id: row.root_example_id,
    source_index: row.source_index,
    training_use: "allowed_nonfinal_targeted_boundary_adjudication_filtered",
    chosen_candidate_id: row.candidate_a.candidate_id,
    rejected_candidate_id: row.candidate_b.candidate_id,
    label_source: "gpt4o_targeted_boundary_adjudication_exact_existing_signal_agreement",
    paid_supported_candidate: row.paid_supported_candidate,
    tags: row.tags,
  };
}

function findingsFor(disagreements) {
  const counts = countBy(disagreements.map((row) => row.audit_category));
  const findings = [];
  if (counts.existing_weak_label_too_strict_or_equivalent_surface) {
    findings.push("At least one disagreement shows the existing weak label is too strict for equivalent numeric surfaces, so weak labels should not be treated as ground truth.");
  }
  if (counts.paid_adjudicator_false_negative_or_claim_table_overstrict) {
    findings.push("At least one disagreement appears to be a paid-adjudicator false negative or overstrict handling of the candidate claim table, so raw GPT-4o labels should not be blindly trusted either.");
  }
  if (counts.existing_weak_label_likely_false_positive) {
    findings.push("Some disagreements suggest the original accepted candidate lacked explicit cited support, which validates the need for paid boundary adjudication.");
  }
  return findings;
}

function decisionFor(rows, accepted, disagreements) {
  const acceptedRate = rate(accepted.length, rows.length);
  return {
    integrate_all_paid_labels_now: false,
    integrate_filtered_paid_labels_now: accepted.length >= 6 && acceptedRate >= 0.5,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: `${accepted.length}/${rows.length} labels are high-confidence A-over-B boundary labels after audit; ${disagreements.length} rows need quarantine or second-pass review.`,
    next_step: accepted.length >= 6
      ? "Train a filtered boundary selector on accepted labels only and keep quarantined disagreements out of training."
      : "Do not train yet; run a second-pass adjudicator or manual review on quarantined disagreements first.",
  };
}

function renderReport(result) {
  return `# Boundary Adjudication Disagreement Audit

Generated: ${result.generated_at}

This is a zero-call audit over the paid D270 non-final boundary labels. It makes no OpenAI calls and uses no final-window labels for training.

| Paid rows | Disagreements | Accepted for training | Quarantined | Spend inherited |
| ---: | ---: | ---: | ---: | ---: |
| ${result.summary.adjudications} | ${result.summary.disagreements} | ${result.summary.accepted_for_training} | ${result.summary.quarantined} | $${Number(result.budget.inherited_openai_cost_usd).toFixed(6)} |

## Decision

- Integrate all paid labels now: ${result.decision.integrate_all_paid_labels_now ? "yes" : "no"}
- Integrate filtered paid labels now: ${result.decision.integrate_filtered_paid_labels_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function contentTokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z][a-z0-9-]{2,}|\d+(?:[.,]\d+)*(?:k|%)?/g) ?? [];
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:k|%| percent)?/gi) ?? [];
}

function normalizeNumberToken(token) {
  return normalizeText(String(token).replace(/,/g, ""));
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
}

function preview(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
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

function rel(file) {
  return path.relative(rootDir, file);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}
