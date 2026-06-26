import fs from "node:fs/promises";

const train = await readJsonl(new URL("./hf_dataset_repo/train.jsonl", import.meta.url));
const validation = await readJsonl(new URL("./hf_dataset_repo/validation.jsonl", import.meta.url));
const evalRows = await readJsonl(new URL("./hf_dataset_repo/eval_prompts.jsonl", import.meta.url));
const errors = [];
for (const [name, rows] of [["train", train], ["validation", validation]]) {
  if (!rows.length) errors.push(`${name} split is empty`);
  for (const [index, row] of rows.entries()) {
    if (!Array.isArray(row.messages) || row.messages.length !== 3) errors.push(`${name}:${index}: expected three messages`);
    const assistant = JSON.parse(row.messages.at(-1).content);
    if (assistant.answer_type === "grounded_answer") {
      if (!assistant.citations?.length) errors.push(`${name}:${index}: grounded answer missing citations`);
      for (const citation of assistant.citations ?? []) {
        if (!assistant.answer.includes(`[${citation}]`)) errors.push(`${name}:${index}: missing inline citation ${citation}`);
      }
    }
  }
}
const trainPapers = new Set(train.map((row) => row.input.document_metadata.paper_id));
const evalPapers = new Set(evalRows.map((row) => row.input.document_metadata.paper_id));
const overlap = [...trainPapers].filter((paper) => evalPapers.has(paper));
if (overlap.length) errors.push(`train/eval paper overlap: ${overlap.slice(0, 5).join(", ")}`);
if (!evalRows.length) errors.push("eval split is empty");
if (errors.length) throw new Error(errors.join("\n"));
console.log(JSON.stringify({ status: "ready", train: train.length, validation: validation.length, eval: evalRows.length }, null, 2));

async function readJsonl(url) {
  const text = await fs.readFile(url, "utf8");
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}
