# Trusted Dated KB Snapshot

Split: `extended_temporal_future_holdout`

This artifact verifies the final future-holdout KB window against arXiv API `published` dates rather than relying only on parsed arXiv id prefixes.

## Coverage

| Papers checked | Trusted arXiv dates | Missing records | Inferred-month mismatches |
| ---: | ---: | ---: | ---: |
| 77 | 77 | 0 | 3 |

## Trusted Months

| Month | Papers |
| --- | ---: |
| 2020-02 | 2 |
| 2020-03 | 47 |
| 2020-04 | 28 |

## Evaluation Boundary

- extended_temporal_future_holdout rows 321-389 are drawn from this dated snapshot.
- Dates are fetched from arXiv paper metadata only; no final-window answers or judgments are used.
- This upgrades the final future-holdout KB window from arXiv-id-prefix inference to a trusted dated arXiv API snapshot. It is still public arXiv metadata, not a private KB.

## Missing Records

None.

## Month Mismatches

- 2003.04978: inferred 2020-03, trusted 2020-02
- 2003.08769: inferred 2020-03, trusted 2020-02
- 2004.00139: inferred 2020-04, trusted 2020-03

## Budget

No OpenAI calls, no GPU jobs, and no new spend.
