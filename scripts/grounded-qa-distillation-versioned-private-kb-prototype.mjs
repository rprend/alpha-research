import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "versioned-private-kb-prototype-git-docs-2026-06-26-v1";
const trainCommit = args["train-commit"] ?? "818a916fdf2cd878c85a7d92d7752d3e361f9004";
const evalCommit = args["eval-commit"] ?? git(["rev-parse", "HEAD"]);
const outputDir = path.join(runDir, runId);
const selectedDocs = [
  "ARCHITECTURE.md",
  "docs/control-plane.md",
  "docs/remote-agent-runner.md",
  "docs/run-lifecycle.md",
  "docs/quality.md",
  "docs/observability.md",
  "docs/product/dashboard.md",
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainDate = git(["show", "-s", "--format=%cI", trainCommit]);
const evalDate = git(["show", "-s", "--format=%cI", evalCommit]);

const documents = [];
const examples = [];

for (const docPath of selectedDocs) {
  const trainText = gitShow(trainCommit, docPath);
  const evalText = gitShow(evalCommit, docPath);
  const trainLines = splitLines(trainText);
  const evalLines = splitLines(evalText);
  const trainEvidence = evidenceLines(trainLines, docPath, trainCommit, "train");
  const evalEvidence = evidenceLines(evalLines, docPath, evalCommit, "eval");
  const trainNorm = new Set(trainEvidence.map((row) => row.normalized));
  const evalNorm = new Set(evalEvidence.map((row) => row.normalized));
  const stable = evalEvidence.filter((row) => trainNorm.has(row.normalized));
  const evalOnly = evalEvidence.filter((row) => !trainNorm.has(row.normalized));

  documents.push({
    path: docPath,
    train: docStats(trainText, trainLines),
    eval: docStats(evalText, evalLines),
    stable_evidence_lines: stable.length,
    eval_only_evidence_lines: evalOnly.length,
  });

  for (const row of stable.slice(0, 1)) {
    examples.push(makeAnswerExample({
      id: `stable-${slug(docPath)}-${row.line}`,
      kind: "stable_grounded_answer",
      question: `In both KB snapshots, what does ${docPath} state in the line beginning "${prefix(row.text)}"?`,
      answer: `${row.text} [${row.citation_id}]`,
      evidence: pack(evalEvidence, row),
      docPath,
      row,
      snapshot: "eval",
    }));
  }

  for (const row of evalOnly.slice(0, 2)) {
    examples.push(makeAnswerExample({
      id: `eval-update-${slug(docPath)}-${row.line}`,
      kind: "eval_update_grounded_answer",
      question: `According to the eval KB snapshot, what does ${docPath} state in the line beginning "${prefix(row.text)}"?`,
      answer: `${row.text} [${row.citation_id}]`,
      evidence: pack(evalEvidence, row),
      docPath,
      row,
      snapshot: "eval",
    }));
    examples.push(makeAbstainExample({
      id: `stale-train-${slug(docPath)}-${row.line}`,
      question: `According to the train KB snapshot, what does ${docPath} state in the eval-only line beginning "${prefix(row.text)}"?`,
      evidence: nearestPack(trainEvidence, row),
      docPath,
      row,
    }));
  }
}

const counts = countBy(examples, (row) => row.example_type);
const status = examples.length >= 20 && counts.eval_update_grounded_answer > 0 && counts.stale_snapshot_abstention > 0
  ? "versioned_domain_kb_candidate_ready"
  : "insufficient_versioned_domain_kb_candidate";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "versioned_private_kb_extension_candidate",
  status,
  purpose: "Prototype a versioned private/domain-KB extension using repository-local docs at two immutable git snapshots.",
  claim_boundary: {
    supports_versioned_domain_kb_extension: status === "versioned_domain_kb_candidate_ready",
    supports_private_enterprise_kb_proof: false,
    reason: "The source is repository-local product/architecture documentation with immutable git commits, not a confidential enterprise corpus with access-control semantics.",
  },
  snapshots: {
    train: { commit: trainCommit, committed_at: trainDate },
    eval: { commit: evalCommit, committed_at: evalDate },
  },
  selected_docs: documents,
  examples: {
    path: path.relative(rootDir, path.join(outputDir, "candidate_examples.jsonl")),
    total: examples.length,
    by_type: counts,
  },
  private_kb_upgrade_value: [
    "Uses immutable train/eval KB snapshots from git history rather than inferred paper dates.",
    "Includes stale-snapshot abstention cases where eval-only evidence is intentionally absent from the train snapshot.",
    "Preserves citation ids down to document path, commit, and line number.",
    "Keeps the private-enterprise claim blocked until access control, confidentiality, and allowed redistribution are established.",
  ],
  limitations: [
    "Generated questions are deterministic line-level probes, not natural user research questions.",
    "Repository docs are an enterprise-like domain KB proxy, not proof over a customer's private KB.",
    "A paper-grade private-KB result would need natural queries or human/LLM-authored questions over a licensed versioned corpus.",
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
    note: "This prototype reads git-tracked local documents only.",
  },
};

await fs.writeFile(path.join(outputDir, "candidate_examples.jsonl"), examples.map((row) => JSON.stringify(row)).join("\n") + "\n");
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({ run_id: result.run_id, status: result.status, examples: result.examples }, null, 2));

function makeAnswerExample({ id, kind, question, answer, evidence, docPath, row, snapshot }) {
  return {
    id,
    example_type: kind,
    input: {
      question,
      compact_retrieved_evidence_pack: evidence,
      document_metadata: {
        source: "repo_git_docs",
        document_path: docPath,
        snapshot,
        train_commit: trainCommit,
        eval_commit: evalCommit,
      },
    },
    output: {
      answer_type: "grounded_answer",
      answer,
      citations: [row.citation_id],
      abstention_reason: null,
      claim_table: [
        {
          claim: row.text,
          citation_id: row.citation_id,
          support: "direct_line_match",
        },
      ],
    },
  };
}

function makeAbstainExample({ id, question, evidence, docPath, row }) {
  return {
    id,
    example_type: "stale_snapshot_abstention",
    input: {
      question,
      compact_retrieved_evidence_pack: evidence,
      document_metadata: {
        source: "repo_git_docs",
        document_path: docPath,
        snapshot: "train",
        train_commit: trainCommit,
        withheld_eval_citation_id: row.citation_id,
      },
    },
    output: {
      answer_type: "abstain",
      answer: "Insufficient evidence in the train KB snapshot.",
      citations: [],
      abstention_reason: "The requested line is only present in the eval snapshot, so the train evidence pack is stale or insufficient.",
      claim_table: [],
    },
  };
}

function evidenceLines(lines, docPath, commit, snapshot) {
  return lines
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter((row) => row.text.length >= 72 && row.text.length <= 260 && !row.text.startsWith("|") && !row.text.startsWith("```"))
    .map((row) => ({
      evidence_id: `${snapshot}:${slug(docPath)}:L${row.line}`,
      citation_id: `${docPath}@${commit.slice(0, 12)}:L${row.line}`,
      document_path: docPath,
      commit: commit.slice(0, 12),
      line: row.line,
      text: row.text,
      normalized: normalize(row.text),
    }));
}

function pack(rows, target) {
  return rows
    .filter((row) => Math.abs(row.line - target.line) <= 1)
    .slice(0, 3)
    .map(toEvidence);
}

function nearestPack(rows, target) {
  return rows
    .slice()
    .sort((left, right) => Math.abs(left.line - target.line) - Math.abs(right.line - target.line))
    .slice(0, 3)
    .map(toEvidence);
}

function toEvidence(row) {
  return {
    evidence_id: row.evidence_id,
    citation_id: row.citation_id,
    document_path: row.document_path,
    line: row.line,
    text: row.text,
  };
}

function docStats(text, lines) {
  return {
    sha256: crypto.createHash("sha256").update(text).digest("hex"),
    bytes: Buffer.byteLength(text),
    lines: lines.length,
  };
}

function gitShow(commit, docPath) {
  return git(["show", `${commit}:${docPath}`]);
}

function git(args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trimEnd();
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

function prefix(text) {
  return text.split(/\s+/).slice(0, 8).join(" ").replaceAll('"', "'");
}

function normalize(text) {
  return text.toLowerCase().replace(/[`*_>#|[\]()]/g, "").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function countBy(values, getKey) {
  const counts = {};
  for (const value of values) counts[getKey(value)] = (counts[getKey(value)] ?? 0) + 1;
  return counts;
}

function renderReport(result) {
  return `# Versioned Private/Domain KB Prototype

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Snapshot Pair

| Snapshot | Commit | Date |
| --- | --- | --- |
| train | \`${result.snapshots.train.commit.slice(0, 12)}\` | ${result.snapshots.train.committed_at} |
| eval | \`${result.snapshots.eval.commit.slice(0, 12)}\` | ${result.snapshots.eval.committed_at} |

## Examples

| Type | Count |
| --- | ---: |
${Object.entries(result.examples.by_type).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

Candidate examples: \`${result.examples.path}\`

## Claim Boundary

- Supports versioned domain-KB extension: ${result.claim_boundary.supports_versioned_domain_kb_extension ? "yes" : "no"}
- Supports private enterprise-KB proof: ${result.claim_boundary.supports_private_enterprise_kb_proof ? "yes" : "no"}
- Reason: ${result.claim_boundary.reason}

## Value

${result.private_kb_upgrade_value.map((item) => `- ${item}`).join("\n")}

## Limitations

${result.limitations.map((item) => `- ${item}`).join("\n")}

This prototype makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
