import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const split = args.split ?? "validation";
const thresholdGrid = (args.thresholds ?? args.threshold ?? "0,0.04,0.08,0.12")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);
const learnedThresholdGrid = (args["learned-thresholds"] ?? "0.35,0.5,0.65")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-${split}`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const examples = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const trainExamples = await readJsonl(path.join(dataDir, "train.jsonl"));
const learnedSelector = trainEvidenceSelector(trainExamples);
const systems = [
  evaluateSystem("retrieval_rank_1", examples, predictRankOne),
  ...thresholdGrid.map((threshold) => evaluateSystem(`lexical_overlap_t${formatThreshold(threshold)}`, examples, (example) => predictLexical(example, threshold))),
  evaluateSystem("learned_selector_top1", examples, (example) => predictLearned(example, learnedSelector, { topK: 1, threshold: 0 })),
  ...learnedThresholdGrid.map((threshold) => evaluateSystem(`learned_selector_top2_t${formatThreshold(threshold)}`, examples, (example) => predictLearned(example, learnedSelector, { topK: 2, threshold }))),
];
const run = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  threshold_grid: thresholdGrid,
  learned_threshold_grid: learnedThresholdGrid,
  learned_selector: {
    training_examples: trainExamples.length,
    feature_count: Object.keys(learnedSelector.weights).length,
    epochs: learnedSelector.epochs,
    learning_rate: learnedSelector.learningRate,
    training_accuracy: learnedSelector.trainingAccuracy,
    positive_candidates: learnedSelector.positiveCandidates,
    negative_candidates: learnedSelector.negativeCandidates,
  },
  examples: examples.length,
  systems: systems.map(({ predictions, ...summary }) => summary),
};

for (const system of systems) {
  await writeJsonl(path.join(outputDir, `${system.system}.predictions.jsonl`), system.predictions);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(run, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "learned-selector-model.json"), `${JSON.stringify(learnedSelector, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(run));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  systems: run.systems,
}, null, 2));

function evaluateSystem(system, examples, predict) {
  const predictions = examples.map((example) => {
    const prediction = predict(example);
    const reference = normalizeReference(example);
    const predictedCitations = new Set(prediction.citations);
    const referenceCitations = new Set(reference.citations);
    const citedGold = prediction.citations.filter((id) => example.teacher_trace.evidence_roles[id] === "gold_evidence").length;
    const answerable = reference.answer_type !== "abstain";
    const abstained = prediction.answer_type === "abstain";
    return {
      example_id: example.example_id,
      system,
      prediction,
      reference,
      scores: {
        answer_type_correct: prediction.answer_type === reference.answer_type,
        citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : (abstained ? 1 : 0),
        citation_recall: reference.citations.length
          ? prediction.citations.filter((id) => referenceCitations.has(id)).length / reference.citations.length
          : (abstained ? 1 : 0),
        answer_token_f1: answerable && !abstained ? tokenF1(prediction.answer, reference.answer) : (answerable === !abstained ? 1 : 0),
        abstention_correct: answerable ? !abstained : abstained,
      },
    };
  });

  const avg = (key) => mean(predictions.map((row) => row.scores[key]));
  return {
    system,
    predictions,
    metrics: {
      examples: predictions.length,
      answer_type_accuracy: avg("answer_type_correct"),
      citation_precision: avg("citation_precision"),
      citation_recall: avg("citation_recall"),
      answer_token_f1: avg("answer_token_f1"),
      abstention_accuracy: avg("abstention_correct"),
      abstention_rate: mean(predictions.map((row) => row.prediction.answer_type === "abstain" ? 1 : 0)),
    },
  };
}

function predictRankOne(example) {
  const first = example.input.compact_retrieved_evidence_pack[0];
  if (!first) return abstain("empty evidence pack");
  return answerFromEvidence(first, "rank-one scaffold cites the first retrieved evidence item");
}

function predictLexical(example, minOverlap) {
  let best = null;
  for (const evidence of example.input.compact_retrieved_evidence_pack) {
    const score = jaccard(contentTokens(example.input.question), contentTokens(evidence.text));
    if (!best || score > best.score) best = { evidence, score };
  }
  if (!best || best.score < minOverlap) return abstain(`best lexical overlap ${best?.score.toFixed(3) ?? "0.000"} below threshold ${minOverlap}`);
  return answerFromEvidence(best.evidence, `lexical scaffold selected evidence with overlap ${best.score.toFixed(3)}`);
}

function predictLearned(example, model, { topK, threshold }) {
  const ranked = example.input.compact_retrieved_evidence_pack
    .map((evidence) => ({
      evidence,
      probability: sigmoid(scoreFeatures(model.weights, evidenceFeatures(example, evidence))),
    }))
    .sort((a, b) => b.probability - a.probability || a.evidence.retrieval_rank - b.evidence.retrieval_rank);

  const selected = ranked
    .filter((item, index) => index === 0 || item.probability >= threshold)
    .slice(0, topK)
    .filter((item) => item.probability >= threshold);

  if (!selected.length) {
    const best = ranked[0]?.probability ?? 0;
    return abstain(`learned selector best probability ${best.toFixed(3)} below threshold ${threshold}`);
  }

  return answerFromEvidenceSet(
    selected.map((item) => item.evidence),
    `learned evidence selector chose ${selected.length} item(s), top probability ${selected[0].probability.toFixed(3)}`,
  );
}

function answerFromEvidence(evidence, rationale) {
  const sentence = firstUsefulSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer: `${sentence} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    rationale,
  };
}

function answerFromEvidenceSet(evidenceItems, rationale) {
  const sentences = evidenceItems.map((evidence) => `${firstUsefulSentence(evidence.text)} [${evidence.evidence_id}]`);
  return {
    answer_type: "grounded_answer",
    answer: sentences.join(" "),
    citations: evidenceItems.map((evidence) => evidence.evidence_id),
    rationale,
  };
}

function abstain(rationale) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    rationale,
  };
}

function normalizeReference(example) {
  return {
    answer_type: example.output.answer_type,
    answer: stripCitations(example.output.answer),
    citations: (example.output.citations ?? []).map((citation) => citation.evidence_id),
  };
}

function firstUsefulSentence(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const selected = parts.find((part) => contentTokens(part).length >= 5) ?? parts[0] ?? String(text).trim();
  return selected.length > 420 ? `${selected.slice(0, 417).trim()}...` : selected;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(reference);
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = counts(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function trainEvidenceSelector(examples) {
  const candidates = [];
  for (const example of examples) {
    for (const evidence of example.input.compact_retrieved_evidence_pack) {
      candidates.push({
        features: evidenceFeatures(example, evidence),
        label: example.teacher_trace.evidence_roles[evidence.evidence_id] === "gold_evidence" ? 1 : 0,
      });
    }
  }

  const weights = {};
  const epochs = numberArg(args.epochs, 60);
  const learningRate = Number(args["learning-rate"] ?? 0.18);
  const l2 = Number(args.l2 ?? 0.0005);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const candidate of candidates) {
      const prediction = sigmoid(scoreFeatures(weights, candidate.features));
      const error = candidate.label - prediction;
      for (const [name, value] of Object.entries(candidate.features)) {
        weights[name] = (weights[name] ?? 0) * (1 - learningRate * l2) + learningRate * error * value;
      }
    }
  }

  const correct = candidates.filter((candidate) => {
    const prediction = sigmoid(scoreFeatures(weights, candidate.features)) >= 0.5 ? 1 : 0;
    return prediction === candidate.label;
  }).length;

  return {
    model_type: "hashed-logistic-evidence-selector",
    epochs,
    learningRate,
    l2,
    trainingAccuracy: candidates.length ? correct / candidates.length : 0,
    positiveCandidates: candidates.filter((candidate) => candidate.label === 1).length,
    negativeCandidates: candidates.filter((candidate) => candidate.label === 0).length,
    weights,
  };
}

function evidenceFeatures(example, evidence) {
  const questionTokens = contentTokens(example.input.question);
  const evidenceTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section);
  const titleTokens = contentTokens(example.input.document_metadata?.title ?? "");
  const abstractTokens = contentTokens(example.input.document_metadata?.abstract ?? "");
  const questionTokenSet = new Set(questionTokens);
  const evidenceTokenSet = new Set(evidenceTokens);
  const overlapTokens = evidenceTokens.filter((token) => questionTokenSet.has(token));
  const questionHasNumberIntent = /\b(how many|how much|how big|number|size|large|results?|score|accuracy|percentage)\b/i.test(example.input.question);
  const evidenceHasNumber = /\d/.test(evidence.text);
  const tableLike = /FLOAT SELECTED|Table|Figure|accuracy|score|result/i.test(evidence.text);

  const features = {
    bias: 1,
    lexical_jaccard: jaccard(questionTokens, evidenceTokens),
    lexical_overlap_count: Math.min(8, new Set(overlapTokens).size) / 8,
    question_token_coverage: questionTokens.length ? new Set(overlapTokens).size / new Set(questionTokens).size : 0,
    evidence_token_coverage: evidenceTokens.length ? new Set(overlapTokens).size / evidenceTokenSet.size : 0,
    title_overlap: jaccard(questionTokens, titleTokens),
    abstract_overlap: jaccard(questionTokens, abstractTokens),
    section_overlap: jaccard(questionTokens, sectionTokens),
    reciprocal_rank: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 1)),
    log_length: Math.min(1, Math.log1p(evidenceTokens.length) / 7),
    number_match: questionHasNumberIntent && evidenceHasNumber ? 1 : 0,
    table_like: tableLike ? 1 : 0,
  };

  for (const token of questionTokens.slice(0, 24)) {
    if (evidenceTokenSet.has(token)) features[`qtok:${token}`] = 1;
  }
  for (const token of sectionTokens.slice(0, 8)) {
    features[`section:${token}`] = 1;
  }

  return features;
}

function scoreFeatures(weights, features) {
  let score = 0;
  for (const [name, value] of Object.entries(features)) {
    score += (weights[name] ?? 0) * value;
  }
  return score;
}

function sigmoid(value) {
  if (value < -30) return 0;
  if (value > 30) return 1;
  return 1 / (1 + Math.exp(-value));
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function renderReport(run) {
  const metricRows = run.systems.map((system) => {
    const metric = system.metrics;
    return `| ${system.system} | ${pct(metric.answer_type_accuracy)} | ${pct(metric.citation_precision)} | ${pct(metric.citation_recall)} | ${pct(metric.answer_token_f1)} | ${pct(metric.abstention_accuracy)} | ${pct(metric.abstention_rate)} |`;
  }).join("\n");

  const decision = decide(run);
  return `# Grounded QA Distillation Run

Run: \`${run.run_id}\`

Split: \`${run.split}\`

Examples: ${run.examples}

## Systems

- \`retrieval_rank_1\`: cheapest scaffold; cites the first retrieved evidence item.
- \`lexical_overlap_t*\`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: ${run.threshold_grid.join(", ")}.
- \`learned_selector_*\`: logistic evidence selector trained on \`train.jsonl\` teacher roles. Training accuracy: ${pct(run.learned_selector.training_accuracy)} over ${run.learned_selector.positive_candidates} positive and ${run.learned_selector.negative_candidates} negative candidates.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${metricRows}

## Decision

${decision}
`;
}

function decide(run) {
  const rankOne = run.systems.find((system) => system.system === "retrieval_rank_1")?.metrics;
  const lexicalSystems = run.systems.filter((system) => system.system.startsWith("lexical_overlap_"));
  const learnedSystems = run.systems.filter((system) => system.system.startsWith("learned_selector_"));
  const bestLexical = lexicalSystems
    .map((system) => ({ ...system, score: system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  const bestLearned = learnedSystems
    .map((system) => ({ ...system, score: system.metrics.citation_precision + system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  if (!rankOne || !bestLexical || !bestLearned) return "No decision: missing system metrics.";
  if (bestLearned.metrics.citation_precision >= bestLexical.metrics.citation_precision && bestLearned.metrics.answer_token_f1 >= bestLexical.metrics.answer_token_f1) {
    return `Promote \`${bestLearned.system}\` as the current cheap student baseline. It matches or beats the lexical family on citation precision and answer compression, but still needs a generative student and entailment judge before paper claims.`;
  }
  if (rankOne.citation_precision > bestLexical.metrics.citation_precision && rankOne.answer_token_f1 >= bestLexical.metrics.answer_token_f1) {
    return "Keep retrieval rank as a strong baseline, but it is not paper-sufficient because it depends on retrieved-evidence ordering rather than learning answer synthesis.";
  }
  return `Keep the learned selector as an ablation, not yet the main student. Best lexical variant is \`${bestLexical.system}\`; best learned variant is \`${bestLearned.system}\`.`;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatThreshold(value) {
  return String(value).replace(".", "p");
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}
