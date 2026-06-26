# Hard Grounded Research Dataset Card

Status: pilot benchmark card generated from repository artifacts. This is not a final public release card until gold review is complete.

## Dataset Summary

Hard Grounded Research is a pilot benchmark for grounded research QA failure modes that go beyond simple fact lookup. Items are derived from public Hugging Face datasets and transformed into tasks that test document-state reasoning, source authority, temporal validity, evidence sufficiency, table/text interpretation, citation overreach, entity disambiguation, and contradiction handling.

- Benchmark id: `hard-grounded-research-benchmark`
- Pilot items: 30
- Categories: 10
- Source Hugging Face datasets: 6
- Scaled public source rows: 15
- Scaled public evidence units: 891
- Source diversity target rows: 15/300
- Source diversity deficit: 246
- Source acquisition batches: 17
- Source acquisition target rows: 246
- Source acquisition packets: 17
- Source acquisition audit findings: 0
- Source acquisition fetched rows: 246/246
- Source acquisition candidates: 246
- Construct map ready: true (10/10 constructs)
- Artifact checklist ready: true (14/14 artifact classes)
- Threats-to-validity ready: true (8 threats; 3 high severity)
- Failure atlas ready: true (116 cases; 8 modes)
- Paper tables ready: true (6 tables)
- Analysis plan ready: true (4 hypotheses; 4 model families)
- Paper target reviewed items/category: 30
- Paper target reviewed items total: 300
- Gold ready: false
- Valid reviewed items: 0/30
- Release gate status: blocked
- License review status: blocked
- Public redistribution clearance ready: true
- Pointer-only package items: 15
- Eligible external model baselines: 2

## Intended Uses

- Evaluate grounded research QA systems under adversarial evidence-use conditions.
- Diagnose whether failures come from answer selection, citation coverage, conclusion support, abstention, temporal validity, or contradiction handling.
- Support a benchmark/position paper about what makes grounded research hard beyond lookup.

## Out-of-Scope Uses

- Do not treat the current pilot as final gold data.
- Do not use mechanically seeded labels as human-validated truth.
- Do not compare production systems as a leaderboard until double review, disagreement resolution, and novelty refresh are complete.

## Source Datasets

| Dataset | License | HF URL | Benchmark roles |
| --- | --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | https://hf.co/datasets/hotpotqa/hotpot_qa | multi-hop synthesis<br>citation supports fact but not conclusion<br>entity disambiguation<br>cross-document contradiction |
| allenai/qasper | cc-by-4.0 | https://hf.co/datasets/allenai/qasper | multi-hop synthesis<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>appended document lifecycle changes |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | https://hf.co/datasets/danwakeem/wikitablequestions-wtq | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| DongfuJiang/FeTaQA | mit | https://hf.co/datasets/DongfuJiang/FeTaQA | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| tdiggelm/climate_fever | unknown | https://hf.co/datasets/tdiggelm/climate_fever | source authority conflicts<br>evidence insufficiency / abstention<br>cross-document contradiction<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| Pavithree/eli5 | unknown | https://hf.co/datasets/Pavithree/eli5 | multi-hop synthesis<br>source authority conflicts<br>citation supports fact but not conclusion |

## Category Coverage

| Category | Datasets | Seed tasks | Dataset ids |
| --- | --- | --- | --- |
| multi-hop synthesis | 3 | 1 | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 |
| stale-vs-current document conflicts | 1 | 1 | tdiggelm/climate_fever |
| appended document lifecycle changes | 1 | 1 | allenai/qasper |
| table + text reasoning | 2 | 1 | danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA |
| source authority conflicts | 2 | 1 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| evidence insufficiency / abstention | 2 | 1 | allenai/qasper<br>tdiggelm/climate_fever |
| citation supports fact but not conclusion | 5 | 1 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA<br>Pavithree/eli5 |
| entity disambiguation | 3 | 1 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA |
| temporal questions: as of date X | 1 | 1 | tdiggelm/climate_fever |
| cross-document contradiction | 2 | 1 | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever |

The generated construct map links each category to rubric dimensions, pilot examples, challenge payloads, scoring metrics, novelty risk, and review status. High novelty-risk constructs: 5; constructs with reviewed gold: 0. See `CONSTRUCT_MAP.md`.

## Source Diversity

The current scaled public package has 15 distinct source rows against a paper target of 300. The generated source-diversity plan records a 246-row deficit and category-level acquisition targets so large-corpus claims cannot rely on cloned seed rows. See `SOURCE_DIVERSITY_PLAN.md`.

The generated source acquisition manifest converts that deficit into 17 Hugging Face sampling batches covering 246 target new distinct source rows. Known-license target rows: 174; pointer-only target rows: 72. See `SOURCE_ACQUISITION_MANIFEST.md`.

The generated acquisition packet set materializes 17 JSONL packet files with 246 target row slots under `generated/source-acquisition-packets/`. See `SOURCE_ACQUISITION_PACKETS.md`.

The generated packet audit validates 246/246 packet rows with 0 findings. See `SOURCE_ACQUISITION_AUDIT.md`.

The generated source acquisition fetch report executes the packets against Hugging Face and records 246/246 distinct source-row records with 0 findings. These fetched rows still require task materialization, deduplication against final public artifacts, reviewer export, double review, and adjudication before source-diversity targets can support paper claims. See `SOURCE_ACQUISITION_FETCHED_ROWS.md`.

The generated source acquisition candidate suite materializes those fetched rows into 246 review-pending task drafts requiring 492 independent review rows. It remains blocked from gold promotion. See `SOURCE_ACQUISITION_CANDIDATES.md`.

## Challenge-Type Coverage

| Challenge type | Pilot items |
| --- | --- |
| as_of_date_constraint | 3 |
| authority_conflict | 3 |
| citation_overreach_probe | 3 |
| cross_document_contradiction | 3 |
| document_lifecycle_appendix | 3 |
| insufficiency_probe | 3 |
| native_row | 9 |
| stale_current_conflict | 3 |

## Annotation And Review

- Annotation protocol: `ANNOTATION_PROTOCOL.md`
- Review workbooks: `generated/review-workbooks/*.jsonl`
- Annotation export: ready (124 rows across 30 files)
- Annotation import path: ready (124/124 fixture rows importable; applied=false)
- Annotation import smoke: ready (124 returned fixture rows checked; findings=0)
- Adjudication readiness: ready (pilot queue=0; expansion queue=0; promotion_allowed=false)
- Annotator agreement: ready (completed metric pairs=0; claim_allowed=false)
- Independent reviews required per item: 2
- Required reviewer fields: `final_label`, `final_answer`, `required_citation_ids`, `insufficient_or_conflicting_evidence`, `notes`, `reviewer_confidence`
- Missing-review items: 30
- Disagreement items: 0
- Repair-before-gold items: 0
- Review-carefully items: 20
- Exact agreement rate: n/a
- Label agreement rate: n/a

## Promotion Rehearsals

- Pilot gold promotion smoke: ready (30/30 fixture gold items; release_eligible=false)
- Scaled expansion promotion smoke: ready (270/270 fixture expansion items merge-ready; release_eligible=false)
- These rehearsals use fixture reviewer fields only. They prove the mechanics of merge and promotion; they do not clear human-review blockers.

## Scoring

The evaluator reports answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality. Challenge-type diagnostics are present for 5 scored baseline systems in `generated/baseline-analysis.json`.

## Failure Atlas

The generated failure atlas summarizes 116 pilot failure cases across 8 failure modes from 5 scored systems. It is qualitative diagnostic evidence only and remains blocked from completion claims while release status is `blocked`. See `FAILURE_ATLAS.md`.

## Paper Tables

The generated paper table pack materializes 6 synchronized tables for taxonomy, baseline results, challenge diagnostics, failure modes, novelty boundaries, and release blockers. See `PAPER_TABLES.md` and `generated/paper-tables.json`.

## Analysis Plan

The generated analysis plan pre-specifies 4 hypotheses, 4 model families, and 7 covariates for testing what makes grounded research hard beyond lookup. It keeps category-level and final novelty claims blocked until reviewed gold and final literature gates pass. See `ANALYSIS_PLAN.md`.

## Statistical Scale Plan

The current pilot supports diagnostic analysis only. The generated power plan targets 30 double-reviewed items per category (300 total) before category-level paper claims. At the category target, the worst-case 95% half-width for bounded task metrics is 0.1789; at the overall target it is 0.0566. See `POWER_PLAN.md`.

## Reproducibility Artifact Checklist

The generated artifact checklist records 17 reproduction commands, 14/14 ready artifact classes, and 7 release blockers. It keeps completion claims blocked while release status is `blocked`. See `ARTIFACT_CHECKLIST.md`.

## Threats To Validity

The generated threats-to-validity report tracks 8 risks across construct, internal, statistical, external, artifact, evaluation, novelty, and measurement validity. High-severity threats: 3. See `THREATS_TO_VALIDITY.md`.

## External Model Baselines

| System | Evaluation source | Tasks | Macro answer correct | Report present |
| --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | pilot-suite | 30 | 0.3667 | yes |
| openai-grounded-baseline-v1 | pilot-suite | 30 | 0.4 | yes |

## Data Provenance And Licensing Notes

This benchmark stores normalized evidence snippets and metadata from upstream Hugging Face datasets. Upstream dataset licenses are mixed and include unknown-license sources, so a public release must either preserve attribution and license notices, replace unknown-license sources, or release only pointers/transforms where required. See `LICENSE_REVIEW.md`, `generated/license-review.json`, `PUBLIC_PACKAGE_MANIFEST.md`, and `generated/public-package-manifest.json` for the generated blocker and pointer-only packaging lists.

Packaged redistribution clearance is currently ready for the generated public package: 54 impacted scaled candidates are replaced with known-license alternatives, 81 are pointer-only, and 135 use redistributable known-license evidence. Raw upstream source-license status is still tracked separately from package clearance.

## Known Limitations

1. Current scale is 30 pilot items, not the target 30-50 reviewed items per category.
2. Gold labels are blocked until independent review and disagreement resolution are complete.
3. Some challenge items are synthetic transformations of existing rows and require human review before publication.
4. The novelty audit is refreshed_preliminary and records 4 June 2026 refresh queries; it still must become final before any completion claim.
5. Unknown-license upstream datasets must remain pointer-only or be replaced before any package that redistributes source text.

## Release Gate

See `RELEASE_GATE.md` and `generated/release-gate.json`. Current blockers: 7.

Key release checks:

- Gold review: block - 0/30 valid reviewed items
- Review preflight: block - 0/60 complete review rows
- Reviewer handoff: pass - 124 handoff rows across 30 files; gates=6/6
- Review progress: pass - 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300
- Adjudication readiness: pass - pilot_queue=0; expansion_queue=0; gold_ready=false; promotion_allowed=false
- Annotator agreement: pass - completed_metric_pairs=0; agreement_claim_allowed=false
- Corpus audit: pass - 6 source datasets; 270 scaled public items; 891 scaled evidence units; pointer_only=108
- Source diversity: pass - 15/300 target source rows; deficit=246
- Source acquisition: pass - 17 batches; target_rows=246; known_license_rows=174
- Source acquisition packets: pass - 17 packets; target_rows=246
- Source acquisition audit: pass - 246/246 packet rows audited; findings=0
- Source acquisition fetch report: pass - 246/246 rows fetched; findings=0; full_ready=true
- Source acquisition full fetch: pass - 246/246 distinct fetched source rows; known_license=174; pointer_only=72
- Source acquisition candidates: pass - 246 candidates; categories=10; required_review_rows=492
- Construct map: pass - 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5
- Artifact checklist: pass - 13/13 artifact classes ready; reproduction_commands=16; release_blockers=7
- Threats to validity: pass - 8 threats tracked; high_severity=3; completion_claim_allowed=false
- Failure atlas: pass - 116 failure cases; 8 failure modes; systems=5
- Paper tables: pass - 6 paper tables; systems=5; blockers=7
- Analysis plan: pass - 4 hypotheses; 4 model families; reviewed=0/300
- Power plan: pass - 30 reviewed items/category; 300 total target; remaining=300
- Novelty refresh ledger: pass - 4 refresh queries; 10 related sources; completion_claim_allowed=false
- Novelty claim boundaries: pass - 6 search queries; 1 allowed claims; 5 prohibited/unsupported claims
- Annotation export: pass - 124 exported rows across 30 files; pilot=24; expansion=100
- Annotation return readiness: pass - 30 expected returned files; 124 expected returned rows
- Annotation import path: pass - 124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false
- Pilot promotion smoke: pass - 30/30 fixture gold items; release_eligible=false
- Expansion promotion smoke: pass - 270/270 fixture expansion items merge-ready; release_eligible=false
- Public package clearance: pass - tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true
- External model baselines: pass - anthropic-grounded-baseline-v1, openai-grounded-baseline-v1
- Novelty audit: block - checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5
