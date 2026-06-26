# Hard Grounded Research Version Manifest

This generated manifest records the package-critical artifacts and SHA-256 digests for the current benchmark state. It makes paper tables, release surfaces, and package metadata auditable without implying that blocked paper claims are complete.

## Summary

- Version manifest ready: true
- Version: version-manifest-v1
- Benchmark id: `hard-grounded-research-benchmark`
- Artifacts hashed: 33
- Total bytes: 449159
- Release checks: 63/70
- Release blockers: 7
- Completion claim allowed: false

## Package State

- Public package items: 30
- Public pointer-only evidence units: 18
- Scaled public items: 270
- Scaled pointer-only evidence units: 108

## Artifact Digests

| Artifact | Bytes | SHA-256 prefix |
| --- | --- | --- |
| benchmark-spec.json | 13787 | ce28290a0e7e1329 |
| rubrics.json | 7454 | b56e897003bbe7c4 |
| README.md | 13250 | ffff31712d0981b2 |
| DATASET_CARD.md | 20356 | e0bcac287025408d |
| DATA_STATEMENT.md | 3406 | 53c0fdb92d59d44e |
| SUBMISSION_CONTRACT.md | 1909 | e42938a388ca958c |
| SCORING_CONTRACT.md | 4651 | 7efab9f885c49129 |
| MODEL_REPORTING_CARD.md | 2742 | bb3d53d0ffbf6982 |
| REVIEW_EXECUTION_PLAN.md | 3356 | 8df69dc8cfc7fb5e |
| REVIEW_PACKET_AUDIT.md | 6376 | 28125ac7d5ead378 |
| REPRODUCTION_CAPSULE.md | 6198 | 042197362fe60ba4 |
| CITATION.md | 1454 | 9f6d66f3608c6fc6 |
| PUBLIC_PACKAGE_SCHEMA.md | 1335 | 481ac48a47e7bdd8 |
| ERROR_CODEBOOK.md | 5880 | 2f803c3a1909f118 |
| PAPER_DRAFT.md | 46386 | 3251279aaa8e4261 |
| generated/pilot-suite.json | 129445 | b656e9340b010da6 |
| generated/public-package/summary.json | 346 | 9590d9997c4ac185 |
| generated/public-package/scaled-summary.json | 575 | 498a5ecf2436c0c8 |
| generated/public-package-manifest.json | 63726 | ba80f4c3b8cf925a |
| generated/public-package-integrity.json | 2204 | 88beb924cf130de2 |
| generated/public-package-schema.json | 4156 | 7a18187c6d18ac06 |
| generated/data-statement.json | 4767 | b67402e161c81fc6 |
| generated/submission-contract.json | 3356 | 51c3db4c3684a228 |
| generated/scoring-contract.json | 9236 | aab7009484e22a7f |
| generated/model-reporting-card.json | 4604 | a96a389e3a835be9 |
| generated/review-execution-plan.json | 4851 | c1caa720c68fc876 |
| generated/review-packet-audit.json | 15143 | 02b9ad6de9add3d7 |
| generated/reproduction-capsule.json | 10560 | b02567f76aca6a0b |
| generated/citation-metadata.json | 2115 | da357001bb832ced |
| generated/error-codebook.json | 9822 | 33155f5500c0aa0b |
| generated/novelty-audit.json | 17230 | 2ac5ea3b44cc798c |
| generated/novelty-evidence.json | 22604 | 3775abdf9a18f353 |
| generated/paper-claim-ledger.json | 5879 | b13efb36673002bd |

## Active Release Blockers

| Check | Detail | Required action |
| --- | --- | --- |
| gold_review_complete | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| review_preflight_ready | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| expansion_review_preflight_ready | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| review_merge_ready | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
