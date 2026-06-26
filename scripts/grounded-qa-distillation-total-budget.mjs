import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const llmDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");

await fs.mkdir(spendDir, { recursive: true });

const llmLedger = await readJsonl(path.join(llmDir, "ledger.jsonl"));
const externalLedger = await readJsonlIfPresent(path.join(spendDir, "ledger.jsonl"));
const openaiSpend = sum(llmLedger.map((row) => row.cost_usd));
const externalSpend = sum(externalLedger.map((row) => row.cost_usd));
const maxBudgetUsd = 100;
const summary = {
  generated_at: new Date().toISOString(),
  max_budget_usd: maxBudgetUsd,
  spend_usd: {
    openai: openaiSpend,
    external_compute: externalSpend,
    total_actual: openaiSpend + externalSpend,
    remaining: maxBudgetUsd - openaiSpend - externalSpend,
  },
  ledgers: {
    openai_ledger: path.relative(rootDir, path.join(llmDir, "ledger.jsonl")),
    external_compute_ledger: path.relative(rootDir, path.join(spendDir, "ledger.jsonl")),
  },
  policy: {
    note: "The $100 cap covers OpenAI API calls plus Prime Intellect/Hugging Face/other GPU spend. Planned GPU jobs must record estimated cost before launch and actual cost after completion.",
    launch_guardrail: "Do not launch a compute job when estimated total spend would exceed max_budget_usd.",
  },
};

await ensureExternalLedger(path.join(spendDir, "ledger.jsonl"));
await fs.writeFile(path.join(spendDir, "budget.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

async function ensureExternalLedger(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "");
  }
}

async function readJsonlIfPresent(filePath) {
  try {
    return await readJsonl(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}
