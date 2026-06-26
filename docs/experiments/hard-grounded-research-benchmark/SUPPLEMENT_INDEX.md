# Hard Grounded Research Supplement Index

This generated index maps the manuscript-facing supplement to source artifacts, claim boundaries, paper tables, and checksumed package state. It is a navigation artifact for reviewers; it does not clear the human-review, scale, or novelty gates.

## Summary

- Supplement index ready: true
- Version: supplement-index-v2
- Sections: 6
- Paper tables: 6
- Claims: 8
- Novelty watchlist sources: 4
- Novelty resolution sources: 4
- Novelty resolution unresolved sources: 4
- Version-manifest artifact hashes: 43
- Public package findings: 0
- Artifact classes: 37
- Model reporting fields: 11
- Citation caveats: 4
- Review rows remaining: 600
- Review packet findings: 0
- Review return findings: 0
- Review return missing files: 30
- Review return checklist packets: 30
- Reproduction commands: 42
- Release checks: 68/75
- Completion claim allowed: false

## Supplement Sections

| Section | Files | Purpose |
| --- | --- | --- |
| benchmark_definition | README.md<br>benchmark-spec.json<br>rubrics.json<br>CONSTRUCT_MAP.md | Define the hard-grounded taxonomy, source datasets, rubrics, and construct operationalization. |
| data_package | DATASET_CARD.md<br>DATA_STATEMENT.md<br>PUBLIC_PACKAGE_MANIFEST.md<br>PUBLIC_PACKAGE_INTEGRITY.md<br>VERSION_MANIFEST.md<br>CITATION.md | Document composition, licensing, package policy, package integrity, exact artifact hashes, and citation caveats. |
| evaluation_contract | SUBMISSION_CONTRACT.md<br>SCORING_CONTRACT.md<br>MODEL_REPORTING_CARD.md<br>ERROR_CODEBOOK.md<br>MODEL_BASELINES.md | Define model input/output, scoring metrics, result reporting, qualitative error codes, and baseline import surfaces. |
| paper_evidence | PAPER_TABLES.md<br>PAPER_CLAIM_LEDGER.md<br>NOVELTY_RESOLUTION_MATRIX.md<br>ANALYSIS_PLAN.md<br>POWER_PLAN.md | Tie manuscript tables and claims to current evidence and blocked claims. |
| review_and_release_gates | ANNOTATION_PROTOCOL.md<br>REVIEWER_HANDOFF.md<br>REVIEW_EXECUTION_PLAN.md<br>REVIEW_RETURN_PREFLIGHT.md<br>REVIEW_RETURN_CHECKLIST.md<br>RELEASE_GATE.md<br>THREATS_TO_VALIDITY.md | Expose reviewer workflow, remaining workload, acceptance gates, blockers, and validity risks. |
| artifact_reproduction | REPRODUCTION_CAPSULE.md<br>ARTIFACT_CHECKLIST.md<br>VERSION_MANIFEST.md<br>RELEASE_GATE.md | Record start-here reproduction commands, package-critical hashes, and current release readiness state. |

## Paper Tables

| Table | Title | Source |
| --- | --- | --- |
| taxonomy_constructs | Benchmark Taxonomy and Construct Operationalization | generated/paper-tables.json |
| baseline_macro_results | Pilot Baseline Macro Results | generated/paper-tables.json |
| challenge_type_heatmap | Challenge-Type Diagnostic Matrix | generated/paper-tables.json |
| failure_mode_atlas | Observed Pilot Failure Modes | generated/paper-tables.json |
| novelty_claim_boundaries | Allowed and Prohibited Novelty Claims | generated/paper-tables.json |
| paper_readiness_blockers | Remaining Paper-Readiness Blockers | generated/paper-tables.json |

## Claim Map

| Claim | Status | Text |
| --- | --- | --- |
| taxonomy_scope_claim | allowed | The benchmark operationalizes 10 hard-grounded research categories beyond simple fact lookup. |
| hf_grounding_claim | allowed | The benchmark is grounded in Hugging Face datasets and fetched source rows rather than only hand-written toy examples. |
| large_corpus_design_claim | diagnostic_only | The current artifacts define a large-corpus source-diversity target and executable acquisition substrate. |
| baseline_diagnostic_claim | diagnostic_only | Pilot baselines expose qualitative failure modes that motivate the hard-grounded taxonomy. |
| category_effect_claim | prohibited_until_gates_pass | Category-level differences identify which grounded-research tasks are hardest. |
| publishable_gold_claim | prohibited_until_gates_pass | The benchmark has publishable gold labels for paper-scale evaluation. |
| annotation_quality_claim | allowed | The annotation workflow has pre-registered quality-control rules for reviewer eligibility and label admissibility. |
| novelty_completion_claim | prohibited_until_gates_pass | The benchmark is genuinely novel as of June 2026 and ready for completion/submission. |
