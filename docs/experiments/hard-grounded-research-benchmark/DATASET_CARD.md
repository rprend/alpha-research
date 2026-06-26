# Hard Grounded Research Dataset Card

Status: pilot benchmark card generated from repository artifacts. This is not a final public release card until gold review is complete.

## Dataset Summary

Hard Grounded Research is a pilot benchmark for grounded research QA failure modes that go beyond simple fact lookup. Items are derived from public Hugging Face datasets and transformed into tasks that test document-state reasoning, source authority, temporal validity, evidence sufficiency, table/text interpretation, citation overreach, entity disambiguation, and contradiction handling.

- Benchmark id: `hard-grounded-research-benchmark`
- Pilot items: 30
- Categories: 10
- Source Hugging Face datasets: 5
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
| tdiggelm/climate_fever | unknown | https://hf.co/datasets/tdiggelm/climate_fever | source authority conflicts<br>evidence insufficiency / abstention<br>cross-document contradiction<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| Pavithree/eli5 | unknown | https://hf.co/datasets/Pavithree/eli5 | multi-hop synthesis<br>source authority conflicts<br>citation supports fact but not conclusion |

## Category Coverage

| Category | Datasets | Seed tasks | Dataset ids |
| --- | --- | --- | --- |
| multi-hop synthesis | 3 | 1 | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 |
| stale-vs-current document conflicts | 1 | 1 | tdiggelm/climate_fever |
| appended document lifecycle changes | 1 | 1 | allenai/qasper |
| table + text reasoning | 1 | 1 | danwakeem/wikitablequestions-wtq |
| source authority conflicts | 2 | 1 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| evidence insufficiency / abstention | 2 | 1 | allenai/qasper<br>tdiggelm/climate_fever |
| citation supports fact but not conclusion | 4 | 1 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>Pavithree/eli5 |
| entity disambiguation | 2 | 1 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq |
| temporal questions: as of date X | 1 | 1 | tdiggelm/climate_fever |
| cross-document contradiction | 2 | 1 | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever |

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

The evaluator reports answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality. Challenge-type diagnostics are present for 3 scored baseline systems in `generated/baseline-analysis.json`.

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
4. The novelty audit is preliminary and must be refreshed before any completion claim.
5. Unknown-license upstream datasets must remain pointer-only or be replaced before any package that redistributes source text.

## Release Gate

See `RELEASE_GATE.md` and `generated/release-gate.json`. Current blockers: 7.

Key release checks:

- Gold review: block - 0/30 valid reviewed items
- Review preflight: block - 0/60 complete review rows
- Reviewer handoff: pass - 124 handoff rows across 30 files; gates=5/5
- Review progress: pass - 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300
- Annotation export: pass - 124 exported rows across 30 files; pilot=24; expansion=100
- Annotation import path: pass - 124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false
- Pilot promotion smoke: pass - 30/30 fixture gold items; release_eligible=false
- Expansion promotion smoke: pass - 270/270 fixture expansion items merge-ready; release_eligible=false
- Public package clearance: pass - tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true
- External model baselines: pass - anthropic-grounded-baseline-v1, openai-grounded-baseline-v1
- Novelty audit: block - checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5
