# Temporal Grounded QA Data Card

Generated: 2026-06-26T07:50:09.739Z

## Purpose

This view turns the QASPER-derived grounded-QA corpus into a chronological, paper-disjoint proxy for an evolving private knowledge base. It is still a proxy: dates are inferred from arXiv-style paper ids, not from a live enterprise corpus.

## Policy

- Date source: arXiv-style QASPER paper ids parsed as YYMM.
- Split policy: Sort unique inferred paper_month values, assign earliest months to temporal_train, middle months to temporal_validation, and latest months to temporal_test. Keep all examples from a paper and all papers from a month in the same temporal split.
- Source examples read: 5628
- Source papers read: 1142
- Source months read: 53

## Splits

| Split | Papers | Examples | Answerable | Abstentions | First month | Last month |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| extended_temporal_train | 469 | 2213 | 1448 | 765 | 2015-03 | 2018-12 |
| extended_temporal_validation | 153 | 733 | 465 | 268 | 2019-01 | 2019-07 |
| extended_temporal_test | 520 | 2682 | 1766 | 916 | 2019-08 | 2020-04 |

## Evaluation Use

Train cheap student scaffolds on `temporal_train`, tune on `temporal_validation`, and reserve `temporal_test` for latest-paper evaluation. This measures update transfer more directly than treating the original QASPER train/validation/test names as time.
