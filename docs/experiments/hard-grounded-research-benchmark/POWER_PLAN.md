# Hard Grounded Research Power Plan

This generated plan justifies the paper-scale review target and records what the current pilot can and cannot support. It is planning evidence, not final statistical proof, because gold labels and category-scale review are still incomplete.

## Summary

- Power plan ready: true
- Method: Normal-approximation planning intervals for bounded task metrics. Detectable deltas are conservative independent-binomial approximations for two-sided alpha=0.05 and 80% power; paired model comparisons may be tighter once reviewed labels exist.
- Target reviewed items per category: 30
- Target reviewed items total: 300
- Current pilot items: 30
- Current valid reviewed items: 0
- Reviewed items remaining: 300
- Scaled public items available for review: 270
- Category scale ready: false

## Sample-Size Scenarios

| Scope | Planning n | Worst-case 95% half-width | Conservative detectable delta | Interpretation |
| --- | --- | --- | --- | --- |
| current_pilot_overall | 30 | 0.1789 | 0.3615 | Descriptive pilot diagnostics only; not enough for category-level paper claims. |
| current_pilot_per_category | 3 | 0.5658 | 1.1431 | Too wide for category-level claims; each category currently has only pilot seeds. |
| paper_target_per_category | 30 | 0.1789 | 0.3615 | Minimum category-level descriptive target; still reports uncertainty, not a fine-grained leaderboard. |
| paper_target_overall | 300 | 0.0566 | 0.1143 | Overall benchmark-level estimates become substantially tighter after all categories are reviewed. |

## Current Pilot Metric Ranges

| Metric | Systems | Min mean | Max mean | Max current CI half-width |
| --- | --- | --- | --- | --- |
| answer_correct | 5 | 0.1667 | 1 | 0.1783 |
| evidence_recall | 5 | 0.2902 | 1 | 0.1331 |
| citation_precision | 5 | 0.4333 | 1 | 0.1804 |
| citation_faithfulness | 5 | 0.4 | 1 | 0.172 |
| conclusion_support | 5 | 0.3 | 0.9 | 0.16 |
| abstention_quality | 5 | 0.4333 | 1 | 0.1804 |

## Category Targets

| Category | Target reviewed | Valid reviewed | Reviewed gap | Target 95% half-width | Target detectable delta | Ready |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| stale-vs-current document conflicts | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| appended document lifecycle changes | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| table + text reasoning | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| source authority conflicts | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| evidence insufficiency / abstention | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| citation supports fact but not conclusion | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| entity disambiguation | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| temporal questions: as of date X | 30 | 0 | 30 | 0.1789 | 0.3615 | no |
| cross-document contradiction | 30 | 0 | 30 | 0.1789 | 0.3615 | no |

## Paper Claim Guidance

| # | Guidance |
| --- | --- |
| 1 | Use current 30-item pilot only for diagnostic examples, scorer checks, and baseline smoke comparisons. |
| 2 | Require 30 double-reviewed items per category before reporting category-level benchmark results. |
| 3 | Report confidence intervals for every metric and avoid fine-grained leaderboard rankings when intervals overlap. |
| 4 | Treat the 300-item reviewed target as the minimum paper release threshold, not as evidence that all small deltas are detectable. |
