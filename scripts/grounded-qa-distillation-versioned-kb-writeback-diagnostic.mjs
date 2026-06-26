import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const sourceRunId = args["source-run-id"] ?? "versioned-private-kb-prototype-git-docs-2026-06-26-v1";
const runId = args["run-id"] ?? `versioned-kb-writeback-diagnostic-${sourceRunId}`;
const outputDir = path.join(runDir, runId);
const sourceDir = path.join(runDir, sourceRunId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const source = await readJson(path.join(sourceDir, "result.json"));
const examples = await readJsonl(path.join(sourceDir, "candidate_examples.jsonl"));
const trainRecords = buildRecords(source, "train");
const evalRecords = buildRecords(source, "eval");

const systems = [
  {
    id: "leak_safe_train_writeback_only",
    description: "Retrieve only records written from the train snapshot. This can answer stable facts but cannot know eval-only updates.",
    records: trainRecords,
    liveFallback: false,
  },
  {
    id: "leak_safe_train_writeback_plus_live_snapshot",
    description: "Use live snapshot evidence for eval-time questions, train write-back records for stable facts, and abstain on stale train-snapshot requests.",
    records: trainRecords,
    liveFallback: true,
  },
  {
    id: "leaky_eval_writeback_upper_bound",
    description: "Invalid upper bound that writes eval-snapshot facts into memory before evaluation.",
    records: [...trainRecords, ...evalRecords],
    liveFallback: false,
    leaky: true,
  },
];

const predictions = [];
const summaries = [];
for (const system of systems) {
  const rows = examples.map((example) => {
    const prediction = predict(example, system);
    const scores = score(example, prediction);
    return {
      id: example.id,
      example_type: example.example_type,
      system_id: system.id,
      prediction,
      scores,
    };
  });
  predictions.push(...rows);
  summaries.push({
    id: system.id,
    description: system.description,
    leaky: system.leaky === true,
    ...aggregate(rows),
  });
}

const safeOnly = summaries.find((row) => row.id === "leak_safe_train_writeback_only");
const safeLive = summaries.find((row) => row.id === "leak_safe_train_writeback_plus_live_snapshot");
const leaky = summaries.find((row) => row.id === "leaky_eval_writeback_upper_bound");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "versioned_kb_writeback_diagnostic",
  status: "writeback_diagnostic_complete",
  purpose: "Diagnose WriteBack-style KB amortization on the versioned git-doc prototype without leaking eval facts into train memory.",
  source_run_id: sourceRunId,
  source_snapshot_pair: source.snapshots,
  records: {
    train_writeback_records: trainRecords.length,
    eval_records_for_leaky_upper_bound: evalRecords.length,
  },
  systems: summaries,
  key_result: {
    leak_safe_memory_cannot_answer_eval_updates_alone: safeOnly?.by_type?.eval_update_grounded_answer?.overall_correct_rate === 0,
    leak_safe_memory_plus_live_snapshot_solves_deterministic_slice: safeLive?.overall_correct_rate === 1,
    leaky_eval_memory_overanswers_stale_queries: leaky?.leaky === true && leaky?.by_type?.stale_snapshot_abstention?.answer_rate === 1,
    interpretation: "Write-back memory is a valid competing amortization family only when records are created from prior snapshots. Train-only memory helps stable facts but cannot replace live retrieval for new updates; eval-written memory leaks future facts and over-answers stale train-snapshot queries.",
  },
  artifacts: {
    writeback_records_jsonl: path.relative(rootDir, path.join(outputDir, "writeback_records.jsonl")),
    predictions_jsonl: path.relative(rootDir, path.join(outputDir, "predictions.jsonl")),
    report_md: path.relative(rootDir, path.join(outputDir, "report.md")),
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
    note: "This diagnostic uses local git snapshots and deterministic matching only.",
  },
};

await fs.writeFile(path.join(outputDir, "writeback_records.jsonl"), [...trainRecords, ...evalRecords].map((row) => JSON.stringify(row)).join("\n") + "\n");
await fs.writeFile(path.join(outputDir, "predictions.jsonl"), predictions.map((row) => JSON.stringify(row)).join("\n") + "\n");
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, systems: result.systems }, null, 2));

function buildRecords(source, snapshot) {
  const commit = source.snapshots[snapshot].commit;
  const records = [];
  for (const doc of source.selected_docs) {
    const text = git(["show", `${commit}:${doc.path}`]);
    const lines = text.split(/\r?\n/);
    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (line.length < 72 || line.length > 260 || line.startsWith("|") || line.startsWith("```")) return;
      records.push({
        record_id: `writeback:${snapshot}:${slug(doc.path)}:L${index + 1}`,
        snapshot,
        source_document_path: doc.path,
        source_commit: commit.slice(0, 12),
        source_line: index + 1,
        source_citation_id: `${doc.path}@${commit.slice(0, 12)}:L${index + 1}`,
        text: line,
        normalized_prefix: normalize(line).split(" ").slice(0, 8).join(" "),
        created_from_snapshot: snapshot,
      });
    });
  }
  return records;
}

function predict(example, system) {
  const prefix = quotedPrefix(example.input.question);
  if (!system.leaky && example.input.document_metadata?.snapshot === "train" && example.input.document_metadata?.withheld_eval_citation_id) {
    return {
      answer_type: "abstain",
      answer: "Insufficient evidence in the train KB snapshot.",
      citations: [],
      abstention_reason: "The requested fact is marked eval-only, so train write-back memory must not answer it.",
      claim_table: [],
    };
  }
  if (system.liveFallback && example.input.document_metadata?.snapshot === "eval") {
    const evidence = example.input.compact_retrieved_evidence_pack.find((row) => normalize(row.text).startsWith(normalize(prefix)));
    if (evidence) return answerFromEvidence(evidence);
  }
  const record = system.records.find((candidate) => normalize(candidate.text).startsWith(normalize(prefix)));
  if (record) return answerFromRecord(record, system.leaky === true);
  return {
    answer_type: "abstain",
    answer: "Insufficient evidence in the available KB memory.",
    citations: [],
    abstention_reason: "No write-back record or permitted live evidence supports the requested fact.",
    claim_table: [],
  };
}

function answerFromRecord(record, leaky) {
  return {
    answer_type: "grounded_answer",
    answer: `${record.text} [${record.record_id}]`,
    citations: [record.record_id],
    abstention_reason: null,
    claim_table: [{
      claim: record.text,
      citation_id: record.record_id,
      support: leaky ? "leaky_eval_writeback_record" : "train_snapshot_writeback_record",
      source_citation_id: record.source_citation_id,
    }],
    provenance: {
      writeback_record_id: record.record_id,
      source_citation_id: record.source_citation_id,
      created_from_snapshot: record.created_from_snapshot,
    },
  };
}

function answerFromEvidence(evidence) {
  return {
    answer_type: "grounded_answer",
    answer: `${evidence.text} [${evidence.citation_id}]`,
    citations: [evidence.citation_id],
    abstention_reason: null,
    claim_table: [{
      claim: evidence.text,
      citation_id: evidence.citation_id,
      support: "live_snapshot_evidence",
    }],
  };
}

function score(example, prediction) {
  const target = example.output;
  const targetType = target.answer_type;
  const predictedType = prediction.answer_type;
  const targetClaim = normalize(target.claim_table?.[0]?.claim ?? target.answer);
  const predictedClaim = normalize(prediction.claim_table?.[0]?.claim ?? prediction.answer);
  const answerSupported = predictedType === "grounded_answer" && targetType === "grounded_answer" && predictedClaim === targetClaim;
  const abstentionCorrect = targetType === "abstain" ? predictedType === "abstain" : null;
  return {
    target_type: targetType,
    predicted_type: predictedType,
    overall_correct: targetType === "abstain" ? predictedType === "abstain" : answerSupported,
    answer_supported: predictedType === "grounded_answer" ? answerSupported : null,
    abstention_correct: abstentionCorrect,
    inline_citation_rate: predictedType === "grounded_answer"
      ? ratio((prediction.citations ?? []).filter((id) => String(prediction.answer).includes(`[${id}]`)).length, (prediction.citations ?? []).length)
      : null,
  };
}

function aggregate(rows) {
  const byType = {};
  for (const type of [...new Set(rows.map((row) => row.example_type))].sort()) {
    byType[type] = summarize(rows.filter((row) => row.example_type === type));
  }
  return {
    examples: rows.length,
    ...summarize(rows),
    by_type: byType,
  };
}

function summarize(rows) {
  const answered = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  const abstentionRows = rows.filter((row) => row.scores.abstention_correct !== null);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    answer_rate: ratio(answered.length, rows.length),
    overall_correct_rate: ratio(rows.filter((row) => row.scores.overall_correct).length, rows.length),
    answer_support_rate: ratio(answered.filter((row) => row.scores.answer_supported).length, answered.length),
    abstention_correct_rate: ratio(abstentionRows.filter((row) => row.scores.abstention_correct).length, abstentionRows.length),
    inline_citation_rate: mean(answered.map((row) => row.scores.inline_citation_rate)),
  };
}

function renderReport(result) {
  return `# Versioned KB WriteBack Diagnostic

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Systems

| System | Leaky | Answer rate | Overall correct | Answer support | Abstention correct | Inline citation |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${result.systems.map((row) => `| ${row.id} | ${row.leaky ? "yes" : "no"} | ${pct(row.answer_rate)} | ${pct(row.overall_correct_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_correct_rate)} | ${pct(row.inline_citation_rate)} |`).join("\n")}

## Eval-Update Slice

| System | Correct on eval updates |
| --- | ---: |
${result.systems.map((row) => `| ${row.id} | ${pct(row.by_type.eval_update_grounded_answer.overall_correct_rate)} |`).join("\n")}

Interpretation: ${result.key_result.interpretation}

This diagnostic makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function git(args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trimEnd();
}

function quotedPrefix(question) {
  const match = String(question).match(/"([^"]+)"/);
  return match ? match[1] : "";
}

function normalize(value) {
  return String(value).replace(/\[[^\]]+\]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(Number(value)));
  return finite.length ? finite.reduce((total, value) => total + Number(value), 0) / finite.length : null;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
