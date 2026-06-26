import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const gateRunId = requiredArg(args, "gate-run");
const directJudgeRunId = requiredArg(args, "direct-judge-run");
const gateJudgeRunId = requiredArg(args, "gate-judge-run");
const runId = args["run-id"] ?? `${gateRunId}-threshold-sweep`;
const outputDir = path.join(runDir, runId);

const gateResult = await readJson(path.join(runDir, gateRunId, "result.json"));
const gatePredictions = await readJsonl(path.join(runDir, gateRunId, "predictions.jsonl"));
const directJudgments = await readJudgments(directJudgeRunId);
const gateJudgments = await readJudgments(gateJudgeRunId);
const sourceThreshold = Number(gateResult.risk_gate?.threshold);
if (!Number.isFinite(sourceThreshold)) throw new Error("Gate result is missing a numeric risk_gate.threshold.");

const thresholds = parseThresholds(args.thresholds ?? "0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70")
  .filter((threshold) => threshold <= sourceThreshold + 1e-12);
if (!thresholds.length) throw new Error(`No thresholds <= source threshold ${sourceThreshold}.`);

await fs.mkdir(outputDir, { recursive: true });

const rows = thresholds.map((threshold) => evaluateThreshold(threshold));
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  gate_run_id: gateRunId,
  direct_judge_run_id: directJudgeRunId,
  gate_judge_run_id: gateJudgeRunId,
  inherited_judgment_policy: "For kept source predictions, inherit direct-judge labels. For gate-forced abstentions, inherit labels from the already-judged source gate run. Valid only for thresholds no higher than the source gate threshold.",
  source_threshold: sourceThreshold,
  llm_calls: 0,
  run_cost_usd: 0,
  rows,
  recommended_threshold: recommend(rows),
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  recommended_threshold: result.recommended_threshold,
}, null, 2));

function evaluateThreshold(threshold) {
  let answered = 0;
  let abstained = 0;
  let correct = 0;
  let supportedAnswers = 0;
  let unsupportedAnswers = 0;
  let supportedAbstentions = 0;
  let unsupportedAbstentions = 0;
  let inheritedMissing = 0;
  let gateFired = 0;
  for (const row of gatePredictions) {
    const sourcePrediction = row.source_prediction ?? row.prediction ?? {};
    const sourceAnswerType = normalizeAnswerType(sourcePrediction.answer_type);
    const score = Number(row.metadata?.support_score);
    const forcedAbstain = sourceAnswerType === "grounded_answer" && Number.isFinite(score) && score < threshold;
    const judgment = forcedAbstain ? gateJudgments.get(row.example_id) : directJudgments.get(row.example_id);
    if (!judgment) {
      inheritedMissing += 1;
      continue;
    }
    if (forcedAbstain) {
      gateFired += 1;
      abstained += 1;
      if (isCorrectAbstention(judgment)) {
        supportedAbstentions += 1;
        correct += 1;
      } else {
        unsupportedAbstentions += 1;
      }
    } else if (sourceAnswerType === "abstain") {
      abstained += 1;
      if (isCorrectAbstention(judgment)) {
        supportedAbstentions += 1;
        correct += 1;
      } else {
        unsupportedAbstentions += 1;
      }
    } else {
      answered += 1;
      if (isSupportedAnswer(judgment)) {
        supportedAnswers += 1;
        correct += 1;
      } else {
        unsupportedAnswers += 1;
      }
    }
  }
  const judged = answered + abstained;
  return {
    threshold,
    judged,
    answered,
    abstained,
    gate_fired: gateFired,
    inherited_missing: inheritedMissing,
    answer_support_rate: rate(supportedAnswers, answered),
    abstention_support_rate: rate(supportedAbstentions, abstained),
    overall_judged_correct_rate: rate(correct, judged),
    unsupported_answers: unsupportedAnswers,
    unsupported_abstentions: unsupportedAbstentions,
  };
}

function recommend(rows) {
  const eligible = rows.filter((row) => row.overall_judged_correct_rate >= 0.85);
  const pool = eligible.length ? eligible : rows;
  return pool.reduce((best, row) => {
    if (!best) return row;
    if (row.answered !== best.answered) return row.answered > best.answered ? row : best;
    if (row.overall_judged_correct_rate !== best.overall_judged_correct_rate) {
      return row.overall_judged_correct_rate > best.overall_judged_correct_rate ? row : best;
    }
    return row.threshold < best.threshold ? row : best;
  }, null);
}

function renderReport(result) {
  const lines = [
    `# Risk-Gate Threshold Sweep`,
    ``,
    `Gate run: \`${result.gate_run_id}\``,
    ``,
    `This replay makes no LLM calls. It inherits direct-judge labels for kept source predictions and gate-judge labels for abstentions that are already covered by the source threshold \`${result.source_threshold}\`.`,
    ``,
    `| Threshold | Answered | Abstained | Gate fired | Answer support | Abstention support | Overall correct | Unsupported answers | Unsupported abstentions |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...result.rows.map((row) => `| ${row.threshold.toFixed(2)} | ${row.answered} | ${row.abstained} | ${row.gate_fired} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.overall_judged_correct_rate)} | ${row.unsupported_answers} | ${row.unsupported_abstentions} |`),
    ``,
    `Recommended threshold: \`${result.recommended_threshold.threshold.toFixed(2)}\`, with ${result.recommended_threshold.answered} answered examples and ${pct(result.recommended_threshold.overall_judged_correct_rate)} inherited judged correctness.`,
    ``,
  ];
  return `${lines.join("\n")}\n`;
}

async function readJudgments(runId) {
  const rows = await readJsonl(path.join(runDir, runId, "judgments.jsonl"));
  return new Map(rows.map((row) => [row.example_id, row.judgment]));
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function normalizeAnswerType(value) {
  return value === "grounded_answer" ? "grounded_answer" : "abstain";
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function parseThresholds(value) {
  return String(value).split(",").map((item) => Number(item.trim())).filter(Number.isFinite);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function requiredArg(source, name) {
  if (!source[name]) throw new Error(`Missing --${name}=...`);
  return source[name];
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
