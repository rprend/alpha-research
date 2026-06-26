# Hard Grounded Research License Clearance

This generated report verifies the public redistribution view of the scaled benchmark package. It does not change upstream license metadata; it proves that unknown-license expansion candidates are either replaced by known-license candidates or shipped pointer-only without source text.

## Summary

- Source license impact: generated/license-impact.json
- Source remediation plan: generated/license-remediation-plan.json
- Source scaled public package: generated/public-package/hard-grounded-research-scaled-public-suite.json
- Public redistribution clearance ready: true
- Impacted candidates: 135
- Remediated replacements: 54
- Pointer-only candidates: 81
- Scaled public items: 270

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_impacted_candidates_packaged | yes | 135/135 impacted candidates covered by replacement or pointer-only package policy |
| pointer_only_text_stripped | yes | 0 pointer-only packaged items leaked text |
| unknown_license_text_stripped | yes | 0 impacted items include unknown-license text |
| remediated_replacements_packaged | yes | 54/54 remediated replacements present in scaled public package |

## Package Modes

| Mode | Items |
| --- | --- |
| license_remediated_replacement | 54 |
| pointer_only_unknown_license_evidence | 81 |
| redistributable_known_license_evidence | 135 |

## Remediation Policy

| Category | Impacted candidates | Policy |
| --- | --- | --- |
| stale-vs-current document conflicts | 27 | pointer_only_public_package_until_source_replacement |
| source authority conflicts | 27 | pointer_only_public_package_until_source_replacement |
| evidence insufficiency / abstention | 27 | replace_blocked_sources_with_known_license_sources |
| temporal questions: as of date X | 27 | pointer_only_public_package_until_source_replacement |
| cross-document contradiction | 27 | replace_blocked_sources_with_known_license_sources |
