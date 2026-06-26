import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const exportDir = path.join(experimentDir, "exports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "writeback-kb-amortization-scoped-exclusion-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const currentArtifacts = [
  await exportArtifact({
    id: "teacher_combined_mini_det_guard_labels",
    kind: "response_label_and_verifier_export",
    sft: "teacher-combined-mini-det-guard-future-holdout-240-389-v1.sft.jsonl",
    rejected: "teacher-combined-mini-det-guard-future-holdout-240-389-v1.rejected.jsonl",
    verifier: "teacher-combined-mini-det-guard-future-holdout-240-389-v1.verifier.jsonl",
    report: "reports/teacher-combined-mini-det-guard-future-holdout-240-389-v1.md",
    role: "Distills a combined support policy into SFT/verifier rows. It does not write derived facts back into a retrievable KB.",
  }),
  await exportArtifact({
    id: "teacher_mini_negative_labels",
    kind: "response_label_and_verifier_export",
    sft: "teacher-mini-negative-future-holdout-160-389-v1.sft.jsonl",
    rejected: "teacher-mini-negative-future-holdout-160-389-v1.rejected.jsonl",
    verifier: "teacher-mini-negative-future-holdout-160-389-v1.verifier.jsonl",
    report: "reports/teacher-mini-negative-future-holdout-160-389-v1.md",
    role: "Exports mini-negative support labels for post-training/verifier training, not a persistent retrieval memory.",
  }),
  await exportArtifact({
    id: "judge_support_direct_repair_labels",
    kind: "support_label_export",
    sft: "judge-support-direct-repair-future-holdout-0-320-v1.sft.jsonl",
    rejected: "judge-support-direct-repair-future-holdout-0-320-v1.rejected.jsonl",
    verifier: null,
    report: "reports/judge-support-direct-repair-future-holdout-0-320-v1.md",
    role: "Converts prior-window judged support outcomes into labels; downstream use is model training, not KB rewriting.",
  }),
];

const supportContrast = await readResult("support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1");
const jointAction = await readResult("joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  comparison_type: "writeback_kb_amortization_scoped_exclusion",
  status: "scoped_exclusion_with_future_baseline_requirements",
  related_work_framing: {
    close_neighbor: "WriteBack-RAG-style amortization writes derived evidence, summaries, or answers back into an external memory/KB so later queries retrieve the augmented corpus.",
    current_project_scope: "This project distills expensive grounded behavior into model/scaffold training data and preference data while keeping the evaluation evidence pack fixed and citation-auditable.",
    exclusion_reason: "A mutable write-back memory would change the retrieval corpus and can leak final-window facts unless it is built strictly from prior dated/private snapshots. The current QASPER/arXiv-id temporal split is not a trusted dated/private KB snapshot, so a full write-back baseline would overclaim evolving-KB validity.",
  },
  current_artifacts: currentArtifacts,
  response_distillation_packets: {
    support_contrast_prep: {
      run_id: supportContrast.run_id,
      examples: supportContrast.examples,
      leakage_checks: supportContrast.leakage_checks ?? null,
      role: "Creates SFT/preference rows from judged support failures; it is a model-training packet rather than a retrievable KB update.",
    },
    joint_action_gpu_prep: {
      run_id: jointAction.run_id,
      examples: jointAction.examples,
      role: "Creates SFT/DPO rows for a joint keep/repair/abstain policy; it still trains a student rather than writing an evidence memory.",
    },
  },
  scoped_exclusion: {
    decision: "Exclude WriteBack-RAG as a required baseline for the current artifact set, while recording exact requirements for a future fair baseline.",
    why_not_counted_as_implemented_baseline: [
      "No artifact creates a persistent derived-memory index that is retrieved at inference time.",
      "Existing exports are answer/verifier/preference labels whose provenance remains in training files, not new KB records.",
      "A write-back memory built from final-window judged outputs would leak evaluation answers into retrieval.",
      "A fair write-back comparison needs trusted dated/private KB snapshots so derived records can be written only from past knowledge states.",
    ],
    future_baseline_requirements: [
      "Build write-back records only from train-window teacher traces or judged supported answers, never from validation/final-window judgments.",
      "Store each derived record with source document ids, evidence ids, creation date, source run id, and citation provenance.",
      "Retrieve original KB evidence and write-back records together on validation/final windows, while preventing paper/document overlap leakage.",
      "Require final answers to cite original evidence ids or write-back record ids that themselves cite original evidence.",
      "Judge answer support, abstention support, citation support, and total inference cost against the same final-window protocol.",
    ],
  },
  paper_implication: "The paper can discuss WriteBack-RAG as a competing amortization family, but current claims should be scoped to post-training data/scaffold distillation. A future version with trusted dated/private KB snapshots should add the write-back baseline.",
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This scoping artifact reuses local metadata and makes no API calls or GPU jobs.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function exportArtifact({ id, kind, sft, rejected, verifier, report, role }) {
  const sftRows = await countJsonl(path.join(exportDir, sft));
  const rejectedRows = await countJsonl(path.join(exportDir, rejected));
  const verifierRows = verifier ? await countJsonl(path.join(exportDir, verifier)) : null;
  return {
    id,
    kind,
    role,
    files: {
      sft: path.join("docs/experiments/grounded-qa-distillation/exports", sft),
      rejected: path.join("docs/experiments/grounded-qa-distillation/exports", rejected),
      verifier: verifier ? path.join("docs/experiments/grounded-qa-distillation/exports", verifier) : null,
      report: path.join("docs/experiments/grounded-qa-distillation", report),
    },
    row_counts: {
      sft: sftRows,
      rejected: rejectedRows,
      verifier: verifierRows,
    },
    writes_back_to_kb: false,
  };
}

async function countJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split("\n").filter((line) => line.trim()).length;
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function renderReport(result) {
  const artifactRows = result.current_artifacts.map((artifact) => `| ${artifact.id} | ${artifact.kind} | ${artifact.row_counts.sft} | ${artifact.row_counts.rejected} | ${artifact.row_counts.verifier ?? "n/a"} | ${artifact.writes_back_to_kb ? "yes" : "no"} |`).join("\n");
  return `# WriteBack-RAG KB Amortization Scoped Exclusion

Status: ${result.status}

## Framing

- Close neighbor: ${result.related_work_framing.close_neighbor}
- Current scope: ${result.related_work_framing.current_project_scope}
- Exclusion reason: ${result.related_work_framing.exclusion_reason}

## Current Artifacts

| Artifact | Kind | SFT rows | Rejected rows | Verifier rows | Writes back to KB |
| --- | --- | ---: | ---: | ---: | --- |
${artifactRows}

## Existing Distillation Packets

- Support contrast prep: ${result.response_distillation_packets.support_contrast_prep.examples.sft_train} SFT train rows, ${result.response_distillation_packets.support_contrast_prep.examples.preference_train} preference train rows, ${result.response_distillation_packets.support_contrast_prep.examples.eval_prompts} eval prompts.
- Joint-action GPU prep: ${result.response_distillation_packets.joint_action_gpu_prep.examples.sft_train} SFT train rows, ${result.response_distillation_packets.joint_action_gpu_prep.examples.dpo_train} DPO train rows, ${result.response_distillation_packets.joint_action_gpu_prep.examples.eval_prompts} eval prompts.

## Decision

${result.scoped_exclusion.decision}

${result.scoped_exclusion.why_not_counted_as_implemented_baseline.map((item) => `- ${item}`).join("\n")}

## Future Baseline Requirements

${result.scoped_exclusion.future_baseline_requirements.map((item) => `- ${item}`).join("\n")}

## Paper Implication

${result.paper_implication}

## Budget

No new OpenAI calls, no GPU jobs, and no new spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
