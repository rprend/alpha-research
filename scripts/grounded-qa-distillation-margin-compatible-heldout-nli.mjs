import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run"] ?? "margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const modelId = args.model ?? "cross-encoder/nli-distilroberta-base";
const pythonBin = args.python ?? process.env.PYTHON_BIN ?? "/Users/ryanprendergast/miniconda3/bin/python3";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const nliInput = await readJsonl(path.join(runsDir, packetRunId, "claim-nli-input.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

await writeJsonl(path.join(outputDir, "claim-nli-input.jsonl"), nliInput);
const nliRows = await scoreNliUnits(nliInput, path.join(outputDir, "claim-nli-scores.jsonl"));
const missingOrMalformed = nliRows.filter((row) => !row.unit_key || !Number.isFinite(Number(row.nli?.entailment)) || !Number.isFinite(Number(row.nli?.contradiction)) || !Number.isFinite(Number(row.nli?.margin)));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "margin_compatible_heldout_nli",
  status: !nliInput.length ? "heldout_nli_no_units" : missingOrMalformed.length ? "heldout_nli_malformed" : "heldout_nli_scored",
  packet_run_id: packetRunId,
  purpose: "Score the new 321-389 heldout candidate-claim units with the same local NLI model used by the D280 hard-negative selector, without making API calls.",
  semantic_model: {
    model_id: modelId,
    premise: "candidate cited evidence text",
    hypothesis: "single answer or claim-table claim",
    input_units: nliInput.length,
    scored_units: nliRows.length,
  },
  inherited_packet: {
    status: packet.status,
    heldout_pair_rows: packet.counts?.heldout_pair_rows,
    nli_units_required: packet.counts?.nli_units_required,
  },
  quality: {
    missing_or_malformed_rows: missingOrMalformed.length,
    all_units_scored: nliRows.length === nliInput.length && missingOrMalformed.length === 0,
    entailment_range: numericRange(nliRows.map((row) => row.nli?.entailment)),
    contradiction_range: numericRange(nliRows.map((row) => row.nli?.contradiction)),
    margin_range: numericRange(nliRows.map((row) => row.nli?.margin)),
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    training_use: "frozen_d280_heldout_only",
    note: "Local NLI scores are features for heldout evaluation only.",
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
    note: "Local open-weight NLI inference only; no API calls and no rented GPU.",
  },
  decision: {
    evaluate_frozen_d280_next: nliInput.length > 0 && nliRows.length === nliInput.length && missingOrMalformed.length === 0,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    reason: nliInput.length
      ? "The heldout pair packet now has the missing local NLI features needed for a frozen-selector evaluation."
      : "The heldout packet has no usable feature-contrast pairs, so no local NLI units are needed or useful.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  semantic_model: result.semantic_model,
  decision: result.decision,
}, null, 2));

async function scoreNliUnits(units, outputPath) {
  if (!units.length) {
    await fs.writeFile(outputPath, "");
    return [];
  }
  try {
    const existing = await readJsonl(outputPath);
    if (existing.length === units.length) return existing;
  } catch {
    // Score from scratch.
  }

  const scorer = `
import json
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

model_id = ${JSON.stringify(modelId)}
input_path = Path(${JSON.stringify(path.join(outputDir, "claim-nli-input.jsonl"))})
output_path = Path(${JSON.stringify(outputPath)})
tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=False)
model = AutoModelForSequenceClassification.from_pretrained(model_id)
model.eval()
id2label = {int(k): str(v).lower() for k, v in model.config.id2label.items()}
entailment_index = next((idx for idx, label in id2label.items() if "entail" in label), None)
contradiction_index = next((idx for idx, label in id2label.items() if "contrad" in label), None)
if entailment_index is None:
    raise SystemExit(f"No entailment label in {id2label}")
rows = [json.loads(line) for line in input_path.read_text().splitlines() if line.strip()]
with output_path.open("w") as out:
    for row in rows:
        encoded = tokenizer(row["premise"], row["hypothesis"], truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            logits = model(**encoded).logits[0]
            probs = torch.softmax(logits, dim=-1).tolist()
        entailment = float(probs[entailment_index])
        contradiction = float(probs[contradiction_index]) if contradiction_index is not None else 0.0
        out.write(json.dumps({
            "unit_key": row["unit_key"],
            "source": row.get("source"),
            "example_id": row.get("example_id"),
            "candidate_id": row.get("candidate_id"),
            "nli": {
                "entailment": entailment,
                "contradiction": contradiction,
                "margin": entailment - contradiction
            }
        }) + "\\n")
`;
  const scriptPath = path.join(outputDir, "score-heldout-nli.tmp.py");
  await fs.writeFile(scriptPath, scorer);
  const envPrefix = "PYTHONPATH=/tmp/groundedqa-hf-runtime HF_HOME=/tmp/groundedqa-hf-cache";
  const scored = spawnSync("bash", ["-lc", `${envPrefix} ${shellQuote(pythonBin)} ${shellQuote(scriptPath)}`], {
    cwd: rootDir,
    stdio: "inherit",
  });
  await fs.rm(scriptPath, { force: true });
  if (scored.status !== 0) throw new Error(`heldout NLI scoring failed with exit code ${scored.status}`);
  return readJsonl(outputPath);
}

function numericRange(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? { min: Math.min(...finite), max: Math.max(...finite) } : { min: null, max: null };
}

function renderReport(result) {
  return `# Margin-Compatible Heldout NLI

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run scores the 321-389 heldout packet's candidate-claim units with local NLI only. It makes no OpenAI calls and launches no rented compute.

## Counts

- Heldout pair rows: ${result.inherited_packet.heldout_pair_rows}
- Input NLI units: ${result.semantic_model.input_units}
- Scored NLI units: ${result.semantic_model.scored_units}
- Missing or malformed rows: ${result.quality.missing_or_malformed_rows}

## Decision

- Evaluate frozen D280 next: ${result.decision.evaluate_frozen_d280_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
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
