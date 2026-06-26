# Benchmarks for Hard Grounded Research

This benchmark asks: **What tasks actually make grounded research hard, beyond simple fact lookup?**

The working artifact is a seed suite for large-corpus grounded research QA. It is intentionally not another simple fact lookup benchmark: every item targets a failure where the answer may be easy to state but hard to justify with the right evidence.

## Hugging Face Grounding

| Dataset | License | Benchmark role |
| --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | multi-hop synthesis; citation supports fact but not conclusion; entity disambiguation; cross-document contradiction |
| allenai/qasper | cc-by-4.0 | multi-hop synthesis; evidence insufficiency / abstention; citation supports fact but not conclusion; appended document lifecycle changes |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | table + text reasoning; entity disambiguation; citation supports fact but not conclusion |
| DongfuJiang/FeTaQA | mit | table + text reasoning; entity disambiguation; citation supports fact but not conclusion |
| tdiggelm/climate_fever | unknown | source authority conflicts; evidence insufficiency / abstention; cross-document contradiction; stale-vs-current document conflicts; temporal questions: as of date X |
| Pavithree/eli5 | unknown | multi-hop synthesis; source authority conflicts; citation supports fact but not conclusion |

## Construction Approaches Tried

| Approach | Category coverage | Covered categories |
| --- | ---: | --- |
| Reuse existing QA and evidence labels | 10/10 | multi-hop synthesis; stale-vs-current document conflicts; appended document lifecycle changes; table + text reasoning; source authority conflicts; evidence insufficiency / abstention; citation supports fact but not conclusion; entity disambiguation; temporal questions: as of date X; cross-document contradiction |
| Compose multi-source suites | 8/10 | stale-vs-current document conflicts; table + text reasoning; source authority conflicts; evidence insufficiency / abstention; citation supports fact but not conclusion; entity disambiguation; temporal questions: as of date X; cross-document contradiction |
| Adversarially transform existing rows | 7/10 | stale-vs-current document conflicts; appended document lifecycle changes; source authority conflicts; evidence insufficiency / abstention; citation supports fact but not conclusion; temporal questions: as of date X; cross-document contradiction |

The current recommendation is to ship the composed corpus suite as the paper benchmark frame, use native labels for smoke tests and baselines, and use adversarial transforms for the hard slices that native datasets do not expose directly.

## Category Matrix

| Category | HF datasets | Seed tasks |
| --- | --- | --- |
| multi-hop synthesis | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 | hgr_multi_hop_001 |
| stale-vs-current document conflicts | tdiggelm/climate_fever | hgr_stale_current_001 |
| appended document lifecycle changes | allenai/qasper | hgr_appendix_lifecycle_001 |
| table + text reasoning | danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA | hgr_table_text_001 |
| source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | hgr_authority_conflict_001 |
| evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | hgr_abstain_001 |
| citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA<br>Pavithree/eli5 | hgr_citation_overreach_001 |
| entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA | hgr_entity_disambiguation_001 |
| temporal questions: as of date X | tdiggelm/climate_fever | hgr_as_of_date_001 |
| cross-document contradiction | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | hgr_contradiction_001 |

## Generated Files

- `DECISION_LOG.md`: one-decision-per-iteration project decision log.
- `NOVELTY_AUDIT.md`: current literature comparison and novelty release gate.
- `LICENSE_REVIEW.md` and `generated/license-review.json`: generated upstream dataset license/provenance review and redistribution blocker list.
- `PUBLIC_PACKAGE_MANIFEST.md` and `generated/public-package-manifest.json`: generated item-level public packaging policy that strips text for unknown-license evidence and keeps pointers plus hashes.
- `generated/public-package/`: sanitized public suite artifacts that apply the manifest and omit text for pointer-only evidence.
- `MODEL_BASELINES.md`: reproducible prompt-packet and external model-output import workflow for frontier/open-model baselines.
- `MODEL_RUN_INDEX.md` and `generated/model-run-index.json`: generated scored-run inventory that separates heuristic diagnostics from eligible model baselines.
- `REVIEW_PREFLIGHT.md` and `generated/review-preflight.json`: generated reviewer completion work queue before gold merge.
- `SCALE_PLAN.md` and `generated/scale-plan.json`: generated category-level paper-scale target and current pilot/review gaps.
- `DATASET_CARD.md`: generated pilot dataset card with intended use, provenance, review status, scoring, limitations, and license caveats.
- `RELEASE_GATE.md` and `generated/release-gate.json`: generated release-readiness gate for gold, license, model-baseline, repair, and novelty blockers.
- `PAPER_DRAFT.md`: generated working paper scaffold tying taxonomy, datasets, baselines, review gates, and novelty position together.
- `rubrics.json`: category-specific scoring dimensions, strong-answer criteria, near misses, and hard negatives.
- `generated/seed-suite.json`: runnable seed task contract.
- `generated/coverage-matrix.json`: category to dataset/task coverage.
- `generated/approach-scores.json`: comparison of construction approaches.
- `generated/materialized-examples.json`: concrete HF Dataset Viewer rows normalized into benchmark evidence examples.
- `generated/pilot-suite.json`: expanded 30-item pilot suite with native, composed, and adversarial-wrapper items, including explicit challenge payloads for hard categories.
- `SOURCE_ACQUISITION_CANDIDATES.md`, `generated/source-acquisition-candidates.json`, and `generated/source-acquisition-candidates.jsonl`: review-pending task drafts materialized from fetched source-acquisition rows.
- `SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md` and `generated/source-acquisition-review-workbooks/`: reviewer workbooks for source-acquisition task drafts.
- `SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md` and `generated/source-acquisition-review-preflight.json`: strict completion preflight for source-acquisition reviewer workbooks.
- `REVIEW_CALIBRATION.md` and `generated/review-calibration.json`: reviewer-screening sentinel items that calibrate annotators before batch assignment without entering benchmark gold.
- `generated/adjudication-queue.jsonl`, `generated/adjudication-summary.json`, and `ADJUDICATION_PACKET.md`: human review path from machine-seeded pilot to gold data.
- `generated/adjudication-batches.json` and `ADJUDICATION_BATCHES.md`: double-review batch manifest for scaling pilot rows into reviewed gold data.
- `generated/review-workbooks/` and `REVIEW_WORKBOOKS.md`: per-batch reviewer JSONL workbooks, item quality hints, and merge policy.
- `generated/review-merge-report.json` and `REVIEW_MERGE_REPORT.md`: pre-merge validation report for completed reviewer workbooks.
- `generated/review-resolution-queue.jsonl` and `REVIEW_RESOLUTION_QUEUE.md`: adjudicator queue for items where independent reviewers disagree.
- `generated/gold-suite-summary.json`: adjudication readiness report; `generated/gold-suite.json` is emitted only after `generated/review-merge-report.json` proves every item has two valid agreeing reviews.
- `generated/calibration-suite.json` and `generated/calibration-suite-summary.json`: mechanically labeled, explicitly non-gold scorer calibration suite.
- `generated/baseline-submission.json` and `generated/baseline-report.json`: deterministic scorer smoke artifacts from `benchmark:hard-grounded:evaluate`.
- `generated/baseline-comparisons.json`: non-oracle diagnostic baseline comparison for answer-only and first-evidence systems.
- `generated/calibration-baseline-report.json`: gold-style evaluator smoke report from `benchmark:hard-grounded:evaluate -- --calibration`.
- Evaluator reports include `conclusion_support`, a citation-overreach diagnostic that distinguishes supporting a cited fact from supporting the submitted conclusion.
- `scripts/hard-grounded-research-evaluate.mjs --gold`: gold-aware scorer mode that uses adjudicated `final_answer` and `required_citation_ids` from `generated/gold-suite.json` once human review is complete.
- `runs/local-rule-agent-v1/submission.json` and `runs/local-rule-agent-v1/report.json`: reproducible local runner output using the same external submission contract expected from model systems.
- `runs/lexical-evidence-baseline-v1/submission.json` and `runs/lexical-evidence-baseline-v1/report.json`: non-oracle lexical evidence baseline that does not read gold answers.
- `runs/citation-aware-verifier-v1/submission.json` and `runs/citation-aware-verifier-v1/report.json`: non-oracle verifier baseline that abstains when selected citations do not support the answer.
- `runs/openai-grounded-baseline-v1/prompt-packet.jsonl`: dry-run prompt packet for an auditable OpenAI-compatible model baseline; scored reports are emitted only when run with `--run`.
- `runs/openai-grounded-baseline-v1-calibration/prompt-packet.jsonl`: dry-run prompt packet for the same model baseline against provisional calibration labels.
- `BASELINE_ANALYSIS.md` and `generated/baseline-analysis.json`: reproducible pilot results and failure-analysis summary across scored runs, gold readiness, and model-baseline readiness.
- `ITEM_QUALITY_AUDIT.md` and `generated/item-quality-audit.json`: pre-adjudication item repair queue for machine-seeded pilot examples.

Run:

```bash
pnpm run benchmark:hard-grounded
pnpm run benchmark:hard-grounded:calibrate
pnpm run benchmark:hard-grounded:adjudicate
pnpm run benchmark:hard-grounded:review-merge
pnpm run benchmark:hard-grounded:evaluate
pnpm run benchmark:hard-grounded:run
pnpm run benchmark:hard-grounded:lexical
pnpm run benchmark:hard-grounded:verify-citations
pnpm run benchmark:hard-grounded:openai
pnpm run benchmark:hard-grounded:openai:calibration
pnpm run benchmark:hard-grounded:report
pnpm run benchmark:hard-grounded:audit
```
