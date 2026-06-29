import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "targeted-disagreement-repair-packet-2026-06-29-v1";
const packetRunId = args["packet-run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const teacherRouterRunId = args["teacher-router-run-id"] ?? "fresh-nonfinal-teacher-router-audit-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const candidateRows = await readJsonl(path.join(runsDir, teacherRouterRunId, "candidate_rows.jsonl"));
const supervisionRows = await readJsonl(path.join(runsDir, teacherRouterRunId, "selector_supervision_rows.jsonl"));

const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row.target]));
const candidateById = new Map(candidateRows.map((row) => [row.example_id, row]));

const selectorPairs = [];
const constructionRepairs = [];
const abstentionBoundaryRepairs = [];
for (const supervision of supervisionRows) {
  const prompt = promptById.get(supervision.example_id);
  const target = targetById.get(supervision.example_id);
  const candidates = candidateById.get(supervision.example_id)?.candidates ?? {};
  if (!prompt || !target) continue;
  if (supervision.teacher_wrong_cheap_right) {
    const chosenSource = chooseCorrectCheapSource(supervision.correct_sources);
    const chosen = candidates[chosenSource];
    const rejected = candidates.teacher;
    if (chosen && rejected) {
      selectorPairs.push({
        pair_id: `${supervision.example_id}:selector:${chosenSource}:over:teacher`,
        example_id: supervision.example_id,
        source_split: supervision.source_split,
        router_split: supervision.router_split,
        training_role: supervision.source_split === "train" ? "selector_listwise_train_candidate" : "fresh_validation_reporting_only",
        repair_type: "teacher_wrong_cheap_right_selector_pair",
        target_answer_type: target.answer_type,
        target_citations: normalizeCitations(target.citations),
        input: prompt.input,
        chosen: candidateForPair(chosenSource, chosen),
        rejected: candidateForPair("teacher", rejected),
        label_source: "diagnostic_contract_target",
      });
    }
  }
  if (supervision.disagreement_category === "no_source_correct") {
    constructionRepairs.push({
      repair_id: `${supervision.example_id}:construction-repair`,
      example_id: supervision.example_id,
      source_split: supervision.source_split,
      router_split: supervision.router_split,
      training_role: supervision.source_split === "train" ? "construction_repair_train_candidate" : "fresh_validation_reporting_only",
      repair_type: repairTypeFor(target),
      target,
      input: prompt.input,
      failed_candidates: failedCandidateSummaries(candidates),
      construction_need: constructionNeed(target, candidates),
    });
  }
  if (isAbstentionBoundary(supervision, target)) {
    abstentionBoundaryRepairs.push({
      repair_id: `${supervision.example_id}:abstention-boundary`,
      example_id: supervision.example_id,
      source_split: supervision.source_split,
      router_split: supervision.router_split,
      training_role: supervision.source_split === "train" ? "abstention_boundary_train_candidate" : "fresh_validation_reporting_only",
      repair_type: "answer_abstention_boundary",
      target,
      input: prompt.input,
      source_answer_types: supervision.answer_types,
      source_citation_sets: supervision.citation_sets,
      correct_sources: supervision.correct_sources,
    });
  }
}

const trainSelectorPairs = selectorPairs.filter((row) => row.source_split === "train");
const trainConstructionRepairs = constructionRepairs.filter((row) => row.source_split === "train");
const trainBoundaryRepairs = abstentionBoundaryRepairs.filter((row) => row.source_split === "train");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_disagreement_repair_packet",
  status: statusFor(trainSelectorPairs, trainConstructionRepairs),
  purpose: "Convert D426 three-source disagreement diagnostics into concrete selector and construction repair packets without new model calls.",
  source_runs: {
    packet: packetRunId,
    teacher_router: teacherRouterRunId,
  },
  packet_counts: {
    selector_pairs: selectorPairs.length,
    selector_train_pairs: trainSelectorPairs.length,
    selector_fresh_validation_reporting_pairs: selectorPairs.length - trainSelectorPairs.length,
    construction_repairs: constructionRepairs.length,
    construction_train_repairs: trainConstructionRepairs.length,
    construction_fresh_validation_reporting_repairs: constructionRepairs.length - trainConstructionRepairs.length,
    abstention_boundary_repairs: abstentionBoundaryRepairs.length,
    abstention_boundary_train_repairs: trainBoundaryRepairs.length,
    abstention_boundary_fresh_validation_reporting_repairs: abstentionBoundaryRepairs.length - trainBoundaryRepairs.length,
  },
  breakdowns: {
    selector_pair_chosen_source: countBy(selectorPairs, (row) => row.chosen.source),
    construction_repair_type: countBy(constructionRepairs, (row) => row.repair_type),
    train_construction_repair_type: countBy(trainConstructionRepairs, (row) => row.repair_type),
    boundary_target_type: countBy(abstentionBoundaryRepairs, (row) => row.target.answer_type),
  },
  decision: decisionFor(trainSelectorPairs, trainConstructionRepairs),
  leakage_guard: {
    validation_rows_are_reporting_only: true,
    train_rows_available_for_supervision: trainSelectorPairs.length + trainConstructionRepairs.length + trainBoundaryRepairs.length,
    labels_are_diagnostic_contract_targets: true,
    new_paid_labels_used: false,
  },
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This packet mines existing local artifacts only.",
  },
  artifacts: {
    selector_pairs_jsonl: rel(path.join(outputDir, "selector_pairs.jsonl")),
    construction_repairs_jsonl: rel(path.join(outputDir, "construction_repairs.jsonl")),
    abstention_boundary_repairs_jsonl: rel(path.join(outputDir, "abstention_boundary_repairs.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "selector_pairs.jsonl"), selectorPairs);
await writeJsonl(path.join(outputDir, "construction_repairs.jsonl"), constructionRepairs);
await writeJsonl(path.join(outputDir, "abstention_boundary_repairs.jsonl"), abstentionBoundaryRepairs);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  packet_counts: result.packet_counts,
  breakdowns: result.breakdowns,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function chooseCorrectCheapSource(correctSources) {
  if (correctSources.includes("learned")) return "learned";
  if (correctSources.includes("pattern")) return "pattern";
  return correctSources.find((source) => source !== "teacher") ?? correctSources[0];
}

function candidateForPair(source, candidate) {
  return {
    source,
    answer_type: candidate.answer_type,
    answer: candidate.prediction?.answer ?? "",
    citations: normalizeCitations(candidate.citations),
    claim_table: candidate.prediction?.claim_table ?? [],
    abstention_reason: candidate.prediction?.abstention_reason ?? null,
    contract_correct: Boolean(candidate.contract_correct),
    answer_type_correct: Boolean(candidate.answer_type_correct),
    citation_set_exact: Boolean(candidate.citation_set_exact),
  };
}

function failedCandidateSummaries(candidates) {
  return Object.entries(candidates).map(([source, candidate]) => ({
    source,
    answer_type: candidate.answer_type,
    citations: normalizeCitations(candidate.citations),
    answer_type_correct: Boolean(candidate.answer_type_correct),
    citation_set_exact: Boolean(candidate.citation_set_exact),
    contract_correct: Boolean(candidate.contract_correct),
  }));
}

function repairTypeFor(target) {
  if (target.answer_type === "abstain") return "abstention_false_answer_repair";
  const citations = normalizeCitations(target.citations);
  if (citations.length > 1) return "multi_citation_grounded_construction_repair";
  return "single_citation_grounded_construction_repair";
}

function constructionNeed(target, candidates) {
  const targetCitations = normalizeCitations(target.citations);
  if (target.answer_type === "abstain") {
    return "All candidate sources failed to abstain correctly; train an answerability/sufficiency boundary.";
  }
  const candidateCitationKeys = new Set(Object.values(candidates).map((candidate) => normalizeCitations(candidate.citations).sort().join("|")));
  if (!candidateCitationKeys.has(targetCitations.sort().join("|"))) {
    return "No candidate produced the target citation set; train citation-set construction from evidence pack.";
  }
  return "A candidate produced target citations but failed another contract field; train contract formatting/answer-type repair.";
}

function isAbstentionBoundary(supervision, target) {
  const answerTypes = Object.values(supervision.answer_types ?? {});
  return new Set(answerTypes).size > 1 || target.answer_type === "abstain";
}

function statusFor(selectorPairsValue, constructionRepairsValue) {
  if (selectorPairsValue.length >= 25 && constructionRepairsValue.length >= 50) return "targeted_repair_packet_ready";
  if (selectorPairsValue.length >= 25) return "selector_packet_ready_construction_packet_sparse";
  if (constructionRepairsValue.length >= 50) return "construction_packet_ready_selector_packet_sparse";
  return "targeted_repair_packet_sparse";
}

function decisionFor(selectorPairsValue, constructionRepairsValue) {
  return {
    train_selector_next: selectorPairsValue.length >= 25,
    train_constructor_next: constructionRepairsValue.length >= 50,
    buy_openai_labels_now: false,
    rent_prime_gpu_now: false,
    next_step: constructionRepairsValue.length >= 50
      ? "Train or audit a targeted construction repair scaffold on no-source-correct train rows before spending on new labels."
      : "Use selector pairs first; construction repair packet is too sparse for a separate scaffold.",
    reason: `Mined ${selectorPairsValue.length} train selector pairs and ${constructionRepairsValue.length} train construction repairs from existing artifacts.`,
  };
}

function renderReport(result) {
  return `# Targeted Disagreement Repair Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Counts

- Selector pairs: ${result.packet_counts.selector_pairs}
- Selector train pairs: ${result.packet_counts.selector_train_pairs}
- Construction repairs: ${result.packet_counts.construction_repairs}
- Construction train repairs: ${result.packet_counts.construction_train_repairs}
- Abstention-boundary repairs: ${result.packet_counts.abstention_boundary_repairs}
- Abstention-boundary train repairs: ${result.packet_counts.abstention_boundary_train_repairs}

## Breakdowns

- Selector chosen source: ${JSON.stringify(result.breakdowns.selector_pair_chosen_source)}
- Construction repair type: ${JSON.stringify(result.breakdowns.construction_repair_type)}
- Train construction repair type: ${JSON.stringify(result.breakdowns.train_construction_repair_type)}
- Boundary target type: ${JSON.stringify(result.breakdowns.boundary_target_type)}

## Decision

- Train selector next: ${result.decision.train_selector_next ? "yes" : "no"}
- Train constructor next: ${result.decision.train_constructor_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Rent Prime GPU now: ${result.decision.rent_prime_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function countBy(rows, getKey) {
  const out = {};
  for (const row of rows) {
    const key = getKey(row) ?? "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (const value of argv) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
