# Temporal Grounded QA Data Card

Generated: 2026-06-26T01:27:39.747Z

## Purpose

This view turns the QASPER-derived grounded-QA corpus into a chronological, paper-disjoint proxy for an evolving private knowledge base. It is still a proxy: dates are inferred from arXiv-style paper ids, not from a live enterprise corpus.

## Policy

- Date source: arXiv-style QASPER paper ids parsed as YYMM.
- Split policy: Sort unique inferred paper_month values, assign earliest months to temporal_train, middle months to temporal_validation, and latest months to temporal_test. Keep all examples from a paper and all papers from a month in the same temporal split.
- Source examples read: 584
- Source papers read: 120
- Source months read: 40

## Splits

| Split | Papers | Examples | Answerable | Abstentions | First month | Last month |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| temporal_train | 53 | 244 | 164 | 80 | 2016-03 | 2019-04 |
| temporal_validation | 33 | 168 | 117 | 51 | 2019-05 | 2019-10 |
| temporal_test | 34 | 172 | 118 | 54 | 2019-11 | 2020-04 |

## Evaluation Use

Train cheap student scaffolds on `temporal_train`, tune on `temporal_validation`, and reserve `temporal_test` for latest-paper evaluation. This measures update transfer more directly than treating the original QASPER train/validation/test names as time.
