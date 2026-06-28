# Deployable Tournament Audit

Generated: 2026-06-28T13:35:21.242Z

Status: `deployable_tournament_not_sufficient`

This audit builds a complete candidate graph per example using only deployable selector scores. It does not use support labels to choose edges.

## Selection

- Raw-score selection: 19/49 supported
- All-pairs win-count selection: 19/49 supported
- Oracle-edge win-count selection: 49/49 supported
- Oracle-edge gap: 30 examples
- Deployable without labels: yes

## Decision

- Promote tournament selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Treat pairwise scoring as useful but insufficient; design a deployable graph/listwise objective that can select candidates without label-derived supported-vs-unsupported edges.
- Reason: The complete deployable graph collapses to the same weak candidate selection as raw pointwise ranking, while the oracle-edge graph succeeds only because labels choose informative edges.
