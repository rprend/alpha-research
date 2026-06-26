# Hard Grounded Research Public Package Schema

This generated report verifies that the public JSON package artifacts expose the field-level contract needed by downstream evaluators. It checks item, source-example, and evidence-unit fields, non-empty evidence arrays, and pointer-only text handling.

## Summary

- Schema ready: true
- Version: public-package-schema-v1
- Suites checked: 2
- Items checked: 300
- Source examples checked: 546
- Evidence units checked: 996
- Pointer-only evidence units: 126
- Text-included evidence units: 870
- Schema violations: 0
- Completion claim allowed: false

## Required Fields

| Object | Required fields |
| --- | --- |
| Item | id, category, construction, transform, question, source_examples, expected_answer, expected_failure, review_status, scoring_focus, public_package |
| Source example | source_dataset, source_row_id, row_offset, evidence_units |
| Evidence unit | id, title, locator, package_policy, text_included_in_public_package, text_sha256, text_length, license_status |

## Suites

| Suite | Ready | Items | Source examples | Evidence units | Pointer-only units | Violations |
| --- | --- | --- | --- | --- | --- | --- |
| pilot_public_package | yes | 30 | 60 | 105 | 18 | 0 |
| scaled_public_package | yes | 270 | 486 | 891 | 108 | 0 |

## Violations

No schema violations.
