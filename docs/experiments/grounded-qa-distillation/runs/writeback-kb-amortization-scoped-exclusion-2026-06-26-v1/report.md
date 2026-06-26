# WriteBack-RAG KB Amortization Scoped Exclusion

Status: scoped_exclusion_with_future_baseline_requirements

## Framing

- Close neighbor: WriteBack-RAG-style amortization writes derived evidence, summaries, or answers back into an external memory/KB so later queries retrieve the augmented corpus.
- Current scope: This project distills expensive grounded behavior into model/scaffold training data and preference data while keeping the evaluation evidence pack fixed and citation-auditable.
- Exclusion reason: A mutable write-back memory would change the retrieval corpus and can leak final-window facts unless it is built strictly from prior dated/private snapshots. The current QASPER/arXiv-id temporal split is not a trusted dated/private KB snapshot, so a full write-back baseline would overclaim evolving-KB validity.

## Current Artifacts

| Artifact | Kind | SFT rows | Rejected rows | Verifier rows | Writes back to KB |
| --- | --- | ---: | ---: | ---: | --- |
| teacher_combined_mini_det_guard_labels | response_label_and_verifier_export | 125 | 24 | 149 | no |
| teacher_mini_negative_labels | response_label_and_verifier_export | 192 | 37 | 229 | no |
| judge_support_direct_repair_labels | support_label_export | 167 | 82 | n/a | no |

## Existing Distillation Packets

- Support contrast prep: 126 SFT train rows, 59 preference train rows, 69 eval prompts.
- Joint-action GPU prep: 185 SFT train rows, 59 DPO train rows, 69 eval prompts.

## Decision

Exclude WriteBack-RAG as a required baseline for the current artifact set, while recording exact requirements for a future fair baseline.

- No artifact creates a persistent derived-memory index that is retrieved at inference time.
- Existing exports are answer/verifier/preference labels whose provenance remains in training files, not new KB records.
- A write-back memory built from final-window judged outputs would leak evaluation answers into retrieval.
- A fair write-back comparison needs trusted dated/private KB snapshots so derived records can be written only from past knowledge states.

## Future Baseline Requirements

- Build write-back records only from train-window teacher traces or judged supported answers, never from validation/final-window judgments.
- Store each derived record with source document ids, evidence ids, creation date, source run id, and citation provenance.
- Retrieve original KB evidence and write-back records together on validation/final windows, while preventing paper/document overlap leakage.
- Require final answers to cite original evidence ids or write-back record ids that themselves cite original evidence.
- Judge answer support, abstention support, citation support, and total inference cost against the same final-window protocol.

## Paper Implication

The paper can discuss WriteBack-RAG as a competing amortization family, but current claims should be scoped to post-training data/scaffold distillation. A future version with trusted dated/private KB snapshots should add the write-back baseline.

## Budget

No new OpenAI calls, no GPU jobs, and no new spend.
