# Extended Temporal Future Holdout

Generated: 2026-06-26T07:51:16.953Z

## Purpose

This split reserves a fresh paper-disjoint holdout after constructing claim-pruned teacher labels. It is meant for evaluating students trained on `teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1` without reusing the same papers.

## Selection

- Source split: `extended_temporal_test`
- Output split: `extended_temporal_future_holdout`
- Minimum month: 2020-03
- Excluded teacher-label prefix: `teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1`
- Excluded papers: 7
- Excluded examples: 40

## Summary

| Examples | Papers | Answerable | Abstentions | First month | Last month |
| ---: | ---: | ---: | ---: | --- | --- |
| 389 | 77 | 254 | 135 | 2020-03 | 2020-04 |

## Use

Use this split for downstream evaluation after training or fitting on claim-pruned labels. Do not use it for teacher-label construction or selector calibration.
