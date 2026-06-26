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
- `NOVELTY_WATCHLIST.md` and `generated/novelty-watchlist.json`: generated live-search watchlist for related work that must be resolved before final novelty claims.
- `NOVELTY_RESOLUTION_MATRIX.md` and `generated/novelty-resolution-matrix.json`: generated source-level resolution matrix for watchlist sources, claim impacts, and final-audit requirements.
- `NOVELTY_FINALIZATION_PREFLIGHT.md` and `generated/novelty-finalization-preflight.json`: generated final-audit preflight for unresolved related-work sources, claim boundaries, and final novelty blockers.
- `NOVELTY_SOURCE_REVIEW_PACKETS.md` and `generated/novelty-source-review-packets.json`: generated source-level review packets for unresolved related-work adjudication.
- `NOVELTY_CLAIM_REVISION_PLAN.md` and `generated/novelty-claim-revision-plan.json`: generated claim-level revision plan that maps unresolved related-work packets to manuscript boundary language and required dispositions.
- `NOVELTY_LINK_AUDIT.md` and `generated/novelty-link-audit.json`: generated link-verification audit that quarantines unresolved related-work sources whose recorded URLs do not match the expected primary source.
- `NOVELTY_REPLACEMENT_CANDIDATES.md` and `generated/novelty-replacement-candidates.json`: generated replacement-candidate report for quarantined related-work sources, with verified or explicitly caveated primary-source candidates for final novelty review.
- `NOVELTY_OVERLAP_ADJUDICATION.md` and `generated/novelty-overlap-adjudication.json`: generated worksheet that maps verified replacement candidates to overlap scope, affected claims, reviewer questions, and required citation/narrowing decisions.
- `NOVELTY_REFRESH_LEDGER.md` and `generated/novelty-refresh-ledger.json`: generated June 2026 refresh ledger that maps newly checked adjacent benchmarks to threatened hard-grounded categories and required claim-narrowing actions.
- `LICENSE_REVIEW.md` and `generated/license-review.json`: generated upstream dataset license/provenance review and redistribution blocker list.
- `PUBLIC_PACKAGE_MANIFEST.md` and `generated/public-package-manifest.json`: generated item-level public packaging policy that strips text for unknown-license evidence and keeps pointers plus hashes.
- `PUBLIC_PACKAGE_INTEGRITY.md` and `generated/public-package-integrity.json`: generated integrity report for public JSON/JSONL parity, pointer-only stripping, hashes, and package findings.
- `PUBLIC_PACKAGE_SCHEMA.md` and `generated/public-package-schema.json`: generated schema report for public package item, source-example, evidence-unit, and pointer-only field contracts.
- `RESPONSIBLE_USE.md` and `generated/responsible-use.json`: generated responsible-use and leaderboard policy for public artifact release.
- `DATA_STATEMENT.md` and `generated/data-statement.json`: generated datasheet-style statement covering composition, provenance, package policy, intended use, and review state.
- `VERSION_MANIFEST.md` and `generated/version-manifest.json`: checksum-backed manifest for package-critical benchmark artifacts.
- `REPRODUCTION_CAPSULE.md` and `generated/reproduction-capsule.json`: reviewer start-here reproduction commands, expected validation checks, artifact hashes, and known blockers.
- `CITATION.md` and `generated/citation-metadata.json`: generated provisional citation metadata with package hash counts and citation caveats.
- `REVIEW_PACKET_AUDIT.md` and `generated/review-packet-audit.json`: generated first-wave reviewer packet audit for export coverage, returnability, hashes, and packet findings.
- `REVIEW_RETURN_CONTRACT.md` and `generated/review-return-contract.json`: generated contract for real returned reviewer packets, import commands, and rejection rules.
- `REVIEW_RETURN_PREFLIGHT.md` and `generated/review-return-preflight.json`: generated preflight for real returned reviewer packet presence before import/apply.
- `REVIEW_RETURN_CHECKLIST.md` and `generated/review-return-checklist.json`: generated per-packet checklist for expected reviewer return files, rows, waves, and missing status.
- `REVIEW_COLLECTION_TRACKER.md` and `generated/review-collection-tracker.json`: generated prioritized collection queue for missing reviewer returns and review-gate impact.
- `REVIEW_WAVE_SCHEDULE.md` and `generated/review-wave-schedule.json`: generated ordered schedule for collecting missing returned-review packets by priority, category, reviewer slot, rows, acceptance criteria, and release-gate impact.
- `REVIEW_DROPOFF_MANIFEST.md` and `generated/review-dropoff-manifest.json`: generated drop-off contract for exact returned packet paths, source export hashes, editable fields, acceptance criteria, and import commands.
- `REVIEW_INTAKE_VALIDATOR.md` and `generated/review-intake-validator.json`: generated per-packet intake validator that joins drop-off hashes, return preflight, import dry-run findings, and apply-blocking status.
- `REVIEW_ASSIGNMENT_AUDIT.md` and `generated/review-assignment-audit.json`: generated blind double-review assignment audit for distinct reviewer slots and reviewer-field-only constraints.
- `GOLD_ADJUDICATION_PLAN.md` and `generated/gold-adjudication-plan.json`: generated item-level plan for pilot gold review, adjudication fields, and promotion gates.
- `SCALE_ADJUDICATION_PLAN.md` and `generated/scale-adjudication-plan.json`: generated batch-level plan for expansion review, category-scale targets, and adjudication gates.
- `SCALE_GAP_LEDGER.md` and `generated/scale-gap-ledger.json`: generated category-level deficit ledger for reviewed-item targets, planned candidates, review rows, and scale blockers.
- `DIFFICULTY_MECHANISM_LEDGER.md` and `generated/difficulty-mechanism-ledger.json`: generated category-level mechanism ledger tying each construct to observed failure evidence, target metrics, and claim blockers for the central paper question.
- `HYPOTHESIS_TEST_MATRIX.md` and `generated/hypothesis-test-matrix.json`: generated category-level matrix that turns difficulty mechanisms into falsifiable model-failure hypotheses, metrics, pilot evidence, and claim gates.
- `RESULT_INTERPRETATION_GUIDE.md` and `generated/result-interpretation-guide.json`: generated pre-registered confirm/partial/falsify rules for interpreting future reviewed mechanism results without overclaiming pilot diagnostics.
- `EVIDENCE_SUFFICIENCY_AUDIT.md` and `generated/evidence-sufficiency-audit.json`: generated item-level audit of required evidence contracts, trap/control signals, insufficiency probes, citation-overreach probes, temporal filters, and contradiction contracts.
- `ESTIMAND_REGISTRY.md` and `generated/estimand-registry.json`: generated statistical estimand registry that binds category hypotheses to populations, units, contrasts, metrics, estimators, uncertainty methods, sample requirements, and claim gates.
- `SENSITIVITY_ANALYSIS_PLAN.md` and `generated/sensitivity-analysis-plan.json`: generated robustness plan for metric strictness, abstention policy, aggregation, model eligibility, missing review data, and multiple-testing assumptions.
- `LOOKUP_CONTRAST_REGISTRY.md` and `generated/lookup-contrast-registry.json`: generated registry mapping each hard category to its simple lookup control, additional hard-grounding operation, expected lookup-only failure, metrics, hypothesis, and estimand links.
- `STATISTICAL_REPORTING_TEMPLATE.md` and `generated/statistical-reporting-template.json`: generated reviewed-result reporting template that requires estimands, lookup controls, denominators, uncertainty, sensitivity status, and claim gates for paper tables.
- `CONTROL_ABLATION_PLAN.md` and `generated/control-ablation-plan.json`: generated negative-control and ablation plan for testing whether category failures come from intended hard-grounding mechanisms rather than confounds.
- `generated/public-package/`: sanitized public suite artifacts that apply the manifest and omit text for pointer-only evidence.
- `MODEL_BASELINES.md`: reproducible prompt-packet and external model-output import workflow for frontier/open-model baselines.
- `MODEL_RUN_INDEX.md` and `generated/model-run-index.json`: generated scored-run inventory that separates heuristic diagnostics from eligible model baselines.
- `MODEL_REPORTING_CARD.md` and `generated/model-reporting-card.json`: generated model-result reporting policy that keeps pilot baselines diagnostic and blocks leaderboard framing.
- `SUBMISSION_CONTRACT.md` and `generated/submission-contract.json`: versioned external model prediction schema and validation policy.
- `SCORING_CONTRACT.md` and `generated/scoring-contract.json`: metric formulas, aggregation rules, and claim limits for scored submissions.
- `ERROR_CODEBOOK.md` and `generated/error-codebook.json`: qualitative failure-code definitions and reviewer coding rules for error analysis.
- `SUPPLEMENT_INDEX.md` and `generated/supplement-index.json`: reviewer-facing map from supplement sections, tables, and claims to source artifacts.
- `REVIEWER_FAQ.md` and `generated/reviewer-faq.json`: reviewer-facing FAQ that answers likely objections from current artifacts and blockers.
- `REVIEW_EXECUTION_PLAN.md` and `generated/review-execution-plan.json`: generated workload, effort, quality-control, and acceptance-gate plan for completing human review.
- `REVIEW_PREFLIGHT.md` and `generated/review-preflight.json`: generated reviewer completion work queue before gold merge.
- `SCALE_PLAN.md` and `generated/scale-plan.json`: generated category-level paper-scale target and current pilot/review gaps.
- `DATASET_CARD.md`: generated pilot dataset card with intended use, provenance, review status, scoring, limitations, and license caveats.
- `RELEASE_GATE.md` and `generated/release-gate.json`: generated release-readiness gate for gold, license, model-baseline, repair, and novelty blockers.
- `PAPER_DRAFT.md`: generated working paper scaffold tying taxonomy, datasets, baselines, review gates, and novelty position together.
- `PAPER_CLAIM_LEDGER.md` and `generated/paper-claim-ledger.json`: generated claim-by-claim admissibility ledger for allowed, diagnostic-only, and prohibited manuscript claims.
- `rubrics.json`: category-specific scoring dimensions, strong-answer criteria, near misses, and hard negatives.
- `generated/seed-suite.json`: runnable seed task contract.
- `generated/coverage-matrix.json`: category to dataset/task coverage.
- `generated/approach-scores.json`: comparison of construction approaches.
- `generated/materialized-examples.json`: concrete HF Dataset Viewer rows normalized into benchmark evidence examples.
- `generated/pilot-suite.json`: expanded 30-item pilot suite with native, composed, and adversarial-wrapper items, including explicit challenge payloads for hard categories.
- `SOURCE_ACQUISITION_CANDIDATES.md`, `generated/source-acquisition-candidates.json`, and `generated/source-acquisition-candidates.jsonl`: review-pending task drafts materialized from fetched source-acquisition rows.
- `SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md` and `generated/source-acquisition-review-workbooks/`: reviewer workbooks for source-acquisition task drafts.
- `SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md` and `generated/source-acquisition-review-preflight.json`: strict completion preflight for source-acquisition reviewer workbooks.
- `SOURCE_LINEAGE_LEDGER.md` and `generated/source-lineage-ledger.json`: generated row-level lineage ledger mapping pilot and acquisition-candidate items to Hugging Face source rows, licenses, package policies, and review state.
- `REVIEW_CALIBRATION.md` and `generated/review-calibration.json`: reviewer-screening sentinel items that calibrate annotators before batch assignment without entering benchmark gold.
- `ANNOTATION_QUALITY_CONTROL.md` and `generated/annotation-quality-control.json`: pre-registered reviewer QA policy covering calibration, blind overlap, citation support checks, adjudication, and agreement-claim gating.
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
