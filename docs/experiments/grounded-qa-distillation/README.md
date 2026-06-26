# Grounded QA Distillation

## Question

Given a domain knowledge base that changes over time, can expensive multi-step RAG or agent behavior be distilled into a cheaper model or scaffold while preserving citation-grounded correctness?

This experiment focuses on amortized grounded research rather than generic RAG. The target output is post-training data that teaches a smaller model to:

- answer from a compact retrieved evidence pack,
- cite every factual claim with stable evidence ids,
- abstain when evidence is insufficient,
- emit a structured claim table for verification.

## Dataset Choice

The seed knowledge base is [allenai/qasper](https://huggingface.co/datasets/allenai/qasper) from Hugging Face.

QASPER is a good first dataset because it already has the supervision shape this project needs:

- domain documents: NLP research papers,
- user-style questions written from title and abstract context,
- full paper text for retrieval,
- annotator answers,
- answer evidence spans,
- unanswerable labels.

The Hugging Face Dataset Viewer reports `train`, `validation`, and `test` splits for the `qasper` config. The dataset card describes 5,049 questions over 1,585 NLP papers and lists the license as CC BY 4.0.

## Evolving-KB Setup

The first implementation treats each split as a reproducible knowledge-base snapshot:

- `train`: initial KB version used to construct post-training examples,
- `validation`: later KB version used for held-out scaffold checks,
- `test`: reserved for final evaluation.

Future versions can replace this coarse split model with dated paper snapshots, private corpus deltas, or Alpha Research dataset manifests. The output schema already carries `knowledge_base_version`, `source_dataset`, source record URL, and document metadata so examples remain traceable across updates.

## Data Construction

Run:

```bash
pnpm run grounded-qa:distill
```

The generator fetches QASPER rows through Hugging Face's Dataset Viewer API and writes:

- `data/train.jsonl`
- `data/validation.jsonl`
- `data/test.jsonl`
- `data/manifest.json`
- `reports/distillation-data-card.md`

Each JSONL row has:

- `input.question`
- `input.compact_retrieved_evidence_pack[]`
- `input.document_metadata`
- `output.answer`
- `output.citations[]`
- `output.claim_table[]`
- `output.abstention_reason`
- `teacher_trace`

The evidence pack is intentionally compact. It contains QASPER answer evidence plus deterministic hard-negative paragraphs from the same paper. By default, the pack uses stable mixed ordering so the student cannot exploit a gold-first positional shortcut.

Teacher-only evidence roles are stored under `teacher_trace.evidence_roles` for evaluation. They are not exposed in `input.compact_retrieved_evidence_pack`, because that would leak the answer key to a student model.

## Baseline Run

Run:

```bash
node scripts/grounded-qa-distillation-run.mjs --split=validation
```

The run writes:

- `runs/<run-id>/result.json`
- `runs/<run-id>/report.md`
- `runs/<run-id>/*.predictions.jsonl`

Current cheap systems:

- `retrieval_rank_1`: cite the first retrieved evidence item.
- `lexical_overlap_scaffold`: select evidence by question/evidence token overlap and abstain below a threshold.

These are controls, not final students. A learned distilled model must beat them on citation precision, answer support, abstention calibration, and cost per accepted grounded answer.

## Evaluation Plan

Compare three systems on held-out examples:

1. Full teacher: retrieval plus a larger model that answers and cites.
2. Distilled scaffold: compact evidence pack plus a cheaper model.
3. Cheap baseline: lexical evidence overlap plus templated abstention.

Primary metrics:

- citation precision: cited evidence actually supports the answer,
- answer support rate: factual claims are entailed by cited evidence,
- abstention calibration: insufficient-evidence questions are refused,
- cost per accepted grounded answer,
- update robustness: performance when validation/test snapshots include papers absent from training.

## Current Scope

This project is not paper-complete. Current artifacts cover deterministic data construction, leakage removal, and cheap scaffold baselines. Required next work:

- construct real temporal KB updates rather than split-as-time proxies,
- add a model-facing fine-tuning export,
- train or call a genuinely cheaper student,
- add an entailment-style citation judge beyond lexical answer overlap,
- evaluate cost/quality tradeoffs against a larger teacher,
- write the paper and threat model.
