# Overexpansion Tradeoff Audit

Generated: 2026-06-28T11:14:34.762Z

Status: `conditional_gate_needed_for_overexpansion_signal`

This audit makes no OpenAI calls and launches no compute. Final-window labels are diagnostic only.

| Final examples | D262 supported | D265 supported | D266 supported |
| ---: | ---: | ---: | ---: |
| 8 | 4 | 5 | 4 |

## D265-Only Recoveries

- `2004.03744:a08b5018943d4428f067c08077bfff1af3de9703`: D262 `qwen3b_v3` unsupported, D265 `qwen7b_v5` supported. Gate features: `baseline_misses_best_supported`, `baseline_selected_existing_unsupported_claims`, `overexpansion_recovers_supported_candidate`, `overexpansion_selected_low_list_scope`, `overexpansion_selects_best_supported`.
- `2004.03744:f33236ebd6f5a9ccb9b9dbf05ac17c3724f93f91`: D262 `qwen3b_v3` unsupported, D265 `qwen7b_v7` supported. Gate features: `baseline_misses_best_supported`, `baseline_selected_existing_unsupported_claims`, `overexpansion_recovers_supported_candidate`, `overexpansion_selects_best_supported`, `same_citation_count_between_selected`.

## D265 Regressions

- `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a`: D262 `qwen3b_v4` supported, D265 `qwen7b_v5` unsupported. Gate features: `overexpansion_regresses_supported_candidate`, `overexpansion_selected_low_list_scope`, `same_citation_count_between_selected`.

## Decision

Integrate gate now: `false`

Next step: Build a leakage-safe non-final gate that activates the overexpansion score only for short low-risk candidates and rejects cases like the D265 regression on 2004.04060.
