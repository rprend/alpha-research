# Qwen Label Ranker Miss Audit

Generated: 2026-06-28T08:38:26.620Z

Status: `ranker_misses_require_stronger_verifier`

This audit makes no OpenAI calls and launches no compute.

| Diagnostic examples | Selected supported | Selected unsupported |
| ---: | ---: | ---: |
| 8 | 4 | 4 |

## Miss Tags

| Tag | Count |
| --- | ---: |
| citation_count_not_discriminative | 4 |
| selected_unsupported_candidate | 4 |
| unsupported_overclaim_ranked_high | 4 |
| supported_answer_is_short | 3 |
| supported_candidate_ranked_far_below | 3 |
| family_shortcut_or_domain_shift | 3 |

## Conclusion

The ranker often gives high scores to unsupported Qwen answers that look contract-complete or lexically plausible, while supported alternatives are short, lower-coverage, or from a different model family.

Next step: Do not launch another generator-only GPU run. Build a stronger verifier target that compares selected-vs-supported candidate pairs directly, with features or labels that penalize unsupported overclaims and family/length shortcuts.
