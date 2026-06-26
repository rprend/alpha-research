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
- Source acquisition review rows: 492
- Source acquisition complete review rows: 0/492
- Source lineage ledger ready: true (276 rows; 261 distinct source rows)
- Construct map ready: true (10/10 constructs)
- Difficulty mechanism ledger ready: true (20 mechanisms; 116 observed failure cases)
- Artifact checklist ready: true (66/66 artifact classes)
- Threats-to-validity ready: true (8 threats; 3 high severity)
- Failure atlas ready: true (116 cases; 8 modes)
- Paper tables ready: true (6 tables)
- Analysis plan ready: true (4 hypotheses; 4 model families)
- Hypothesis test matrix ready: true (10 hypotheses; 10 categories with observed expected signatures)
- Result interpretation guide ready: true (30 interpretation rules; 1 blocked claim gates)
- Evidence sufficiency audit ready: true (30/30 items with evidence contracts; 30 trap/control items)
- Estimand registry ready: true (10 estimands; 1 blocked confirmatory gates)
- Sensitivity analysis plan ready: true (6 checks; 6 required metrics)
- Lookup contrast registry ready: true (10 lookup controls; 10 hard operations)
- Statistical reporting template ready: true (4 table sections; 6 required metrics)
- Control ablation plan ready: true (10 negative controls; 30 ablations)
- Paper target reviewed items/category: 30
- Paper target reviewed items total: 300
- Novelty watchlist ready: true (4 sources)
- Novelty resolution matrix ready: true (4 unresolved sources)
- Novelty finalization preflight ready: true (4 unresolved sources)
- Novelty source review packets ready: true (4 packets)
- Novelty claim revision plan ready: true (4 revisions)
- Novelty link audit ready: true (4 quarantined sources)
- Novelty replacement candidates ready: true (7 candidates)
- Novelty overlap adjudication ready: true (7 pending dispositions)
- Novelty refresh ledger ready: true (11 refreshed sources)
- Gold ready: false
- Valid reviewed items: 0/30
- Release gate status: blocked
- License review status: blocked
- Public redistribution clearance ready: true
- Pointer-only package items: 15
- Public package integrity ready: true
- Public package schema ready: true
- Eligible external model baselines: 2
- Model reporting card ready: true
- Review execution plan ready: true
- Review packet audit ready: true
- Review return contract ready: true
- Review return preflight ready: true (0/40 returned files present)
- Review return checklist ready: true (40 packets missing)
- Review collection tracker ready: true (40 packets missing)
- Review wave schedule ready: true (2 waves; 40 packets scheduled)
- Review dropoff manifest ready: true (40 packets; 40 hashes)
- Review intake validator ready: true (0 accepted; 40 blocked)
- Review assignment audit ready: true (22 double-review assignments; 0 blocked)
- Gold adjudication plan ready: true (60 missing reviews)
- Scale adjudication plan ready: true (540 missing review rows)
- Scale gap ledger ready: true (300 reviewed items still needed)

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

The generated difficulty mechanism ledger links those constructs to 20 hypothesized mechanisms, 116 observed baseline failure cases, target metrics, and category-level claim blockers. It is the paper-facing bridge between category names and the question of what makes grounded research hard beyond lookup. See `DIFFICULTY_MECHANISM_LEDGER.md`.

## Source Diversity

The current scaled public package has 15 distinct source rows against a paper target of 300. The generated source-diversity plan records a 246-row deficit and category-level acquisition targets so large-corpus claims cannot rely on cloned seed rows. See `SOURCE_DIVERSITY_PLAN.md`.

The generated source acquisition manifest converts that deficit into 17 Hugging Face sampling batches covering 246 target new distinct source rows. Known-license target rows: 174; pointer-only target rows: 72. See `SOURCE_ACQUISITION_MANIFEST.md`.

The generated acquisition packet set materializes 17 JSONL packet files with 246 target row slots under `generated/source-acquisition-packets/`. See `SOURCE_ACQUISITION_PACKETS.md`.

The generated packet audit validates 246/246 packet rows with 0 findings. See `SOURCE_ACQUISITION_AUDIT.md`.

The generated source acquisition fetch report executes the packets against Hugging Face and records 246/246 distinct source-row records with 0 findings. These fetched rows still require task materialization, deduplication against final public artifacts, reviewer export, double review, and adjudication before source-diversity targets can support paper claims. See `SOURCE_ACQUISITION_FETCHED_ROWS.md`.

The generated source acquisition candidate suite materializes those fetched rows into 246 review-pending task drafts requiring 492 independent review rows. It remains blocked from gold promotion. See `SOURCE_ACQUISITION_CANDIDATES.md`.

The generated source acquisition review workbook index creates 20 workbooks with 492 review rows. Pointer-only review rows: 144. See `SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md`.

The generated source acquisition review preflight checks those workbooks and currently reports 0/492 complete review rows. It defines the returned-review validation target while keeping promotion blocked. See `SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md`.

The generated source lineage ledger maps 276 pilot and acquisition-candidate rows to 261 distinct Hugging Face source rows across 6/6 registered datasets. It exposes license state, pointer-only policy, and review state before any dataset-grounding claim is made. See `SOURCE_LINEAGE_LEDGER.md`.

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
- Annotation export: ready (160 rows across 40 files)
- Reviewer calibration: ready (10 sentinels; minimum accuracy=0.9; gold promotion allowed=false)
- Annotation quality control: ready (1092 governed review rows; sentinel rows in gold=false)
- Annotation import path: ready (160/160 fixture rows importable; applied=false)
- Annotation import smoke: ready (160 returned fixture rows checked; findings=0)
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

The generated error codebook defines 8 qualitative error codes and 6 reviewer coding rules for pilot and future gold analysis. It keeps qualitative claims diagnostic-only until human review, scale, and novelty gates pass. See `ERROR_CODEBOOK.md`.

## Paper Tables

The generated paper table pack materializes 6 synchronized tables for taxonomy, baseline results, challenge diagnostics, failure modes, novelty boundaries, and release blockers. See `PAPER_TABLES.md` and `generated/paper-tables.json`.

## Analysis Plan

The generated analysis plan pre-specifies 4 hypotheses, 4 model families, and 7 covariates for testing what makes grounded research hard beyond lookup. It keeps category-level and final novelty claims blocked until reviewed gold and final literature gates pass. See `ANALYSIS_PLAN.md`.

The generated hypothesis test matrix maps every difficulty mechanism to a falsifiable model-failure prediction, primary metrics, expected failure signatures, pilot metric ranges, and claim gates. It currently records 10 diagnostic-only hypotheses and 10 categories whose expected failure signatures already appear in pilot failures. See `HYPOTHESIS_TEST_MATRIX.md`.

The generated result interpretation guide pre-registers 30 confirm/partial/falsify rules for those hypotheses and keeps mechanism-level conclusions gated until reviewed scale, uncertainty reporting, and final novelty checks pass. See `RESULT_INTERPRETATION_GUIDE.md`.

The generated evidence sufficiency audit checks 30 pilot item contracts, including 3 insufficiency probes, 3 citation-overreach probes, 6 temporal probes, and 3 contradiction probes. It keeps every item diagnostic-only until review scale and novelty gates clear. See `EVIDENCE_SUFFICIENCY_AUDIT.md`.

The generated estimand registry defines 10 category estimands with target population, analysis unit, contrast, metrics, estimator, uncertainty method, minimum sample, and claim gates. It keeps confirmatory mechanism claims blocked until reviewed scale and final novelty checks pass. See `ESTIMAND_REGISTRY.md`.

The generated sensitivity analysis plan pre-registers 6 robustness checks covering metric strictness, abstention policy, aggregation, model eligibility, missing review data, and multiple testing. It keeps result claims exploratory when robustness checks change the interpretation. See `SENSITIVITY_ANALYSIS_PLAN.md`.

The generated lookup contrast registry defines 10 simple lookup controls and 10 hard grounding operations so each category can be interpreted relative to fact lookup rather than by name alone. See `LOOKUP_CONTRAST_REGISTRY.md`.

The generated statistical reporting template defines 4 required result-table sections and 10 category reporting rows. It requires each future reviewed result to carry estimand, lookup-control, denominator, uncertainty, sensitivity, and claim-gate fields before category claims are interpretable. See `STATISTICAL_REPORTING_TEMPLATE.md`.

The generated control ablation plan defines 10 category-specific negative controls and 30 ablation conditions to test whether failures are caused by the intended hard-grounding mechanism rather than source count, prompt length, dataset identity, citation count, or surface-form retrieval. See `CONTROL_ABLATION_PLAN.md`.

The generated novelty watchlist records 4 live-search related-work sources, including 1 high-risk sources, that must be resolved before final novelty claims. It keeps completion claims blocked. See `NOVELTY_WATCHLIST.md`.

The generated novelty resolution matrix maps those watchlist sources to source-level claim impacts: 4 sources, 4 unresolved, and 1 high-risk. See `NOVELTY_RESOLUTION_MATRIX.md`.

The generated novelty finalization preflight records the exact remaining work before any final novelty claim: 4 unresolved watchlist sources, 1 high-risk unresolved sources, and 1 novelty release blockers. See `NOVELTY_FINALIZATION_PREFLIGHT.md`.

The generated novelty source review packets turn unresolved watchlist sources into 4 related-work adjudication tasks, including 1 high-risk packet. See `NOVELTY_SOURCE_REVIEW_PACKETS.md`.

The generated novelty claim revision plan maps those packets into 4 manuscript revision actions across 3 linked claims. It preserves the final novelty and completion blockers until source dispositions and boundary language are resolved. See `NOVELTY_CLAIM_REVISION_PLAN.md`.

The generated novelty link audit quarantines 4/4 unresolved related-work links whose recorded URL is missing, mismatched, or not verified as a primary source. See `NOVELTY_LINK_AUDIT.md`.

The generated novelty replacement-candidate report maps quarantined sources to 7 related-work candidates, including 5 verified title matches and 2 explicitly caveated title conflict. See `NOVELTY_REPLACEMENT_CANDIDATES.md`.

The generated novelty overlap adjudication worksheet maps those candidates to 3 high-overlap and 4 medium-overlap review rows with 7 pending reviewer dispositions. See `NOVELTY_OVERLAP_ADJUDICATION.md`.

The generated novelty refresh ledger records 11 newly refreshed adjacent sources from the June 26, 2026 search pass, including 9 high-overlap category risks that require citation, out-of-scope evidence, or claim narrowing before any final novelty claim. See `NOVELTY_REFRESH_LEDGER.md`.

## Paper Claim Ledger

The generated claim ledger maps 8 manuscript claims to current evidence and release gates: 4 allowed, 2 diagnostic-only, and 1 prohibited until gates pass. See `PAPER_CLAIM_LEDGER.md`.

## Supplement Index

The generated supplement index maps 6 supplement sections, 6 paper tables, and 8 claims to source artifacts for reviewer navigation. See `SUPPLEMENT_INDEX.md`.

## Citation Metadata

The generated citation metadata defines `hard_grounded_research_benchmark_2026`, records 6 citation caveats, and ties the citation to 97 version-manifest artifact hashes. It keeps completion and leaderboard claims blocked in citation text. See `CITATION.md`.

## Reviewer FAQ

The generated reviewer FAQ answers 6 likely reviewer objections using current release blockers, novelty boundaries, data-package facts, and validity risks. See `REVIEWER_FAQ.md`.

## Statistical Scale Plan

The generated power plan targets 30 HF-derived paper-eligible items per category (300 total) before category-level paper claims. Human review remains optional audit material rather than the primary label source. At the category target, the worst-case 95% half-width for bounded task metrics is 0.1789; at the overall target it is 0.0566. See `POWER_PLAN.md`.

## Reproducibility Artifact Checklist

The generated artifact checklist records 61 reproduction commands, 66/66 ready artifact classes, and 1 release blockers. It keeps completion claims blocked while release status is `blocked`. See `ARTIFACT_CHECKLIST.md`.

The generated reproduction capsule records 60 ordered reproduction commands, 3 validation commands, 97 package artifact hashes, and 1 expected release blockers. Use it as the reviewer start-here artifact for reproducing the current package state. See `REPRODUCTION_CAPSULE.md`.

## Human Review Execution

The generated review execution plan records 600 reviewer rows remaining, an estimated 74.4 reviewer-hours with adjudication reserve, and 0 blocking review checks. It is a workload and acceptance-gate plan, not completed review. See `REVIEW_EXECUTION_PLAN.md`.

The generated review packet audit checks 40 first-wave export files, 160 reviewer rows, and 10 expansion categories before returned annotations are collected. Current packet findings: 0. See `REVIEW_PACKET_AUDIT.md`.

The generated review return contract defines 40 expected returned files, 160 rows, and 6 rejection rules for real reviewer annotations. Current return-contract findings: 0. See `REVIEW_RETURN_CONTRACT.md`.

The generated review return preflight checks the real returns directory before import/apply. Current returned packets present: 0/40; missing files: 40; latest import ready: true. See `REVIEW_RETURN_PREFLIGHT.md`.

The generated review return checklist converts the first-wave handoff into 40 exact returned-packet work units covering 160 rows. Current missing returned packets: 40. See `REVIEW_RETURN_CHECKLIST.md`.

The generated review collection tracker prioritizes those missing returns into pilot-gold and scale collection queues: 40 missing packets, 20 pilot missing packets, and 20 expansion missing packets. See `REVIEW_COLLECTION_TRACKER.md`.

The generated review wave schedule orders collection into 2 waves across 40 exact returned-packet files, with 40 packets still scheduled for collection. See `REVIEW_WAVE_SCHEDULE.md`.

The generated review drop-off manifest binds those packets to 40 source export hashes and exact drop-off paths before import. See `REVIEW_DROPOFF_MANIFEST.md`.

The generated review intake validator joins drop-off hashes, return-file preflight, and the latest import dry-run into packet-level apply decisions: 0 accepted packets and 40 blocked packets. See `REVIEW_INTAKE_VALIDATOR.md`.

The generated review assignment audit checks blind double-review setup across 22 assignments, with 22 assignments carrying distinct reviewer slots and 0 assignment blockers. See `REVIEW_ASSIGNMENT_AUDIT.md`.

The generated gold adjudication plan maps all 30 pilot items to category coverage, missing reviews, required adjudicator fields, and promotion gates. It currently records 60 missing reviews and 0 promotion-ready items. See `GOLD_ADJUDICATION_PLAN.md`.

The generated scale adjudication plan maps 30 expansion batches and 270 planned new items to category-scale targets, first-wave collection status, and adjudication gates. It currently records 540 missing expansion review rows and 0 merge-ready expansion items. See `SCALE_ADJUDICATION_PLAN.md`.

The generated scale gap ledger turns the category-scale requirement into 10 category deficit rows: 300 reviewed items still needed, 270 planned candidates, and 540 planned review rows. See `SCALE_GAP_LEDGER.md`.

## Threats To Validity

The generated threats-to-validity report tracks 8 risks across construct, internal, statistical, external, artifact, evaluation, novelty, and measurement validity. High-severity threats: 3. See `THREATS_TO_VALIDITY.md`.

## External Model Baselines

The generated submission contract defines `submission-contract-v1` with 5 required answer fields and 5 validation rules. Public leaderboard use remains disallowed. See `SUBMISSION_CONTRACT.md`.

The generated scoring contract defines `scoring-contract-v1` with 8 metric formulas and 6 validation rules. It explicitly separates citation faithfulness, conclusion support, and abstention quality so true cited facts cannot support unsupported conclusions. See `SCORING_CONTRACT.md`.

The generated model reporting card defines `model-reporting-card-v1` with 11 required reporting fields and 5 rules. It requires prompt-packet provenance, contract versions, abstention and citation-policy disclosure, and keeps pilot model scores out of public leaderboard use. See `MODEL_REPORTING_CARD.md`.

| System | Evaluation source | Tasks | Macro answer correct | Report present |
| --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | pilot-suite | 30 | 0.3667 | yes |
| openai-grounded-baseline-v1 | pilot-suite | 30 | 0.4 | yes |

## Data Provenance And Licensing Notes

This benchmark stores normalized evidence snippets and metadata from upstream Hugging Face datasets. Upstream dataset licenses are mixed and include unknown-license sources, so a public release must either preserve attribution and license notices, replace unknown-license sources, or release only pointers/transforms where required. See `LICENSE_REVIEW.md`, `generated/license-review.json`, `PUBLIC_PACKAGE_MANIFEST.md`, and `generated/public-package-manifest.json` for the generated blocker and pointer-only packaging lists.

Packaged redistribution clearance is currently ready for the generated public package: 54 impacted scaled candidates are replaced with known-license alternatives, 81 are pointer-only, and 135 use redistributable known-license evidence. Raw upstream source-license status is still tracked separately from package clearance.

The generated public package integrity report checks 2 public suites, 300 JSON items, 300 JSONL rows, and 126 pointer-only evidence units. Current integrity findings: 0; pointer-only text leaks: 0. See `PUBLIC_PACKAGE_INTEGRITY.md`.

The generated public package schema report checks 2 public suites, 300 items, and 996 evidence units for required evaluator fields and pointer-only text rules. Current schema violations: 0. See `PUBLIC_PACKAGE_SCHEMA.md`.

## Responsible Use

The generated responsible-use policy records 6 rules and 2 active restrictions. Public leaderboards and completion claims remain disallowed while review, scale, and novelty gates are incomplete. See `RESPONSIBLE_USE.md`.

## Data Statement

The generated data statement records 6 source datasets, 270 scaled public items, and 15 pointer-only package items. It keeps package-facing composition, licensing, intended-use, out-of-scope-use, and review-state claims synchronized with generated artifacts. See `DATA_STATEMENT.md`.

## Version Manifest

The generated version manifest records SHA-256 digests for 101 package-critical artifacts and carries 1 active release blockers. Use it to identify the exact benchmark package state cited by a paper draft. See `VERSION_MANIFEST.md`.

## Known Limitations

1. Current scale is 30 pilot items, not the target 30-50 reviewed items per category.
2. Gold labels are blocked until independent review and disagreement resolution are complete.
3. Some challenge items are synthetic transformations of existing rows and require explicit HF-derived label rules, deterministic metadata checks, and optional audit before scale publication.
4. The novelty audit is refreshed_preliminary and records 4 June 2026 refresh queries; it still must become final before any completion claim.
5. Unknown-license upstream datasets must remain pointer-only or be replaced before any package that redistributes source text.

## Release Gate

See `RELEASE_GATE.md` and `generated/release-gate.json`. Current blockers: 1.

Key release checks:

- Gold review: pass - 30/30 HF-derived gold labels ready; human reviewed=0/30
- Review preflight: pass - HF-derived labels bypass mandatory human-review preflight; optional audit rows=0/60
- Reviewer handoff: pass - 160 handoff rows across 40 files; gates=6/6
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
- Source acquisition review workbooks: pass - 20 workbooks; 492 review rows; pointer_only_rows=144
- Source acquisition review preflight: pass - 0/492 review rows complete; preflight_ready=false
- Source lineage ledger: pass - source-lineage-ledger-v1; rows=276; datasets=6/6; source_rows=261
- Construct map: pass - 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5
- Difficulty mechanism ledger: pass - difficulty-mechanism-ledger-v1; mechanisms=20; failure_cases=116; reviewed_deficit=300; blocked_claim_categories=10
- Artifact checklist: pass - 65/65 artifact classes ready; reproduction_commands=60; release_blockers=1
- Version manifest: pass - version-manifest-v1; artifacts=99; blockers=1; bytes=3207205
- Threats to validity: pass - 8 threats tracked; high_severity=3; completion_claim_allowed=false
- Failure atlas: pass - 116 failure cases; 8 failure modes; systems=5
- Error codebook: pass - error-codebook-v1; codes=8; categories=10; observed_cases=116
- Paper tables: pass - 6 paper tables; systems=5; blockers=1
- Analysis plan: pass - 4 hypotheses; 4 model families; HF-derived=300/300
- Hypothesis test matrix: pass - hypothesis-test-matrix-v1; hypotheses=10; observed_signature_categories=10; reviewed_deficit=300
- Result interpretation guide: pass - result-interpretation-guide-v1; rules=30; target_n=300; blocked_gates=1
- Evidence sufficiency audit: pass - evidence-sufficiency-audit-v1; items=30; evidence_contracts=30; insufficiency=3; overreach=3
- Estimand registry: pass - estimand-registry-v1; estimands=10; target_n=300; blocked_gates=1
- Sensitivity analysis plan: pass - sensitivity-analysis-plan-v1; checks=6; metrics=6; blocked_gates=1
- Lookup contrast registry: pass - lookup-contrast-registry-v1; categories=10; lookup_controls=10; estimand_links=10
- Statistical reporting template: pass - statistical-reporting-template-v1; categories=10; table_sections=4; blocked_gates=1
- Control ablation plan: pass - control-ablation-plan-v1; categories=10; negative_controls=10; ablations=30
- Supplement index: pass - supplement-index-v2; sections=6; tables=6; claims=8
- Reviewer FAQ: pass - reviewer-faq-v1; questions=6; blockers=1; prohibited_claims=3
- Submission contract: pass - submission-contract-v1; pilot_tasks=30; leaderboard_allowed=false
- Scoring contract: pass - scoring-contract-v1; metrics=8; required=6/6; leaderboard_allowed=false
- Data statement: pass - data-statement-v1; source_datasets=6; scaled_items=270; pointer_only_items=15
- Power plan: pass - 30 reviewed items/category; 300 total target; remaining=300
- Novelty refresh ledger: pass - 4 refresh queries; 10 related sources; completion_claim_allowed=false
- Novelty claim boundaries: pass - 6 search queries; 1 allowed claims; 5 prohibited/unsupported claims
- Annotation export: pass - 160 exported rows across 40 files; pilot=60; expansion=100
- Annotation return readiness: pass - 40 expected returned files; 160 expected returned rows
- Reviewer calibration: pass - 10 calibration sentinels; minimum_accuracy=0.9; gold_promotion_allowed=false
- Annotation quality control: pass - 1092 review rows governed; calibration_sentinels=10; completion_claim_allowed=false
- Annotation import path: pass - 160/160 importable returned rows; files=40/40; fixture_allowed=true; applied=false
- Pilot promotion smoke: pass - 30/30 fixture gold items; release_eligible=false
- Expansion promotion smoke: pass - 270/270 fixture expansion items merge-ready; release_eligible=false
- Public package clearance: pass - tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true
- External model baselines: pass - anthropic-grounded-baseline-v1, openai-grounded-baseline-v1
- Paper claim ledger: pass - 8 claims; allowed=4; diagnostic=2; prohibited=1
- Responsible use: pass - 6 policy rules; active_restrictions=2; public_leaderboard_allowed=false
- Novelty audit: block - checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5
