# Grounded QA Distillation Data Card

Generated: 2026-06-26T01:09:31.899Z

## Source

- Hugging Face dataset: [allenai/qasper](https://huggingface.co/datasets/allenai/qasper)
- Config: `qasper`
- Domain: NLP research papers
- License: CC BY 4.0 per the Hugging Face dataset card

QASPER is a useful seed corpus for amortized grounded research because each record contains a paper-shaped knowledge-base entry, user-style questions, annotator answers, answer evidence, and unanswerable supervision.

## Project Shape

This corpus tests whether expensive multi-step RAG behavior can be distilled into cheaper inference. The teacher scaffold is: retrieve compact paper evidence, decide sufficiency, answer with inline citations, and produce a claim table that a verifier can audit.

The model-facing evidence pack does not expose teacher evidence roles or guaranteed gold-first ordering. Teacher-only roles are retained under `teacher_trace.evidence_roles` for evaluation.

## Output Schema

Each JSONL row contains:

- `input.question`
- `input.compact_retrieved_evidence_pack[]` with stable evidence ids
- `input.document_metadata` with paper id, title, abstract, domain, source dataset, and KB version
- `output.answer` with bracketed citations
- `output.citations[]`
- `output.claim_table[]`
- `output.abstention_reason` when evidence is insufficient

## Splits

| Split | Source rows read | Examples | Answerable | Abstentions |
| --- | ---: | ---: | ---: | ---: |
| train | 40 | 153 | 134 | 19 |
| validation | 40 | 127 | 122 | 5 |
| test | 40 | 149 | 143 | 6 |

## Evaluation Plan

Use held-out QASPER validation/test examples to compare:

1. Full multi-step RAG teacher: retrieval plus larger model answer generation.
2. Distilled scaffold: compact evidence pack plus smaller model.
3. Cheap abstention baseline: answer only when lexical overlap with evidence is high.

Primary metrics should be citation precision, answer support rate, abstention calibration, and estimated inference cost per accepted answer.
