# Oracle-Edge Tournament Audit

Generated: 2026-06-28T13:35:46.171Z

Status: `oracle_edge_tournament_not_deployable`

This audit aggregates pairwise margins over the labeled supported-vs-unsupported contrast graph. It is an upper-bound diagnostic, not a deployable selector.

## Selection

- Raw pointwise selection: 19/49 supported
- Oracle-edge win-count selection: 49/49 supported
- Labeled edges: 865
- Deployable without labels: no

## Decision

- Promote tournament selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Build a deployable all-candidate-pairs tournament that scores every candidate pair without using support labels to choose graph edges.
- Reason: Oracle-edge tournament selection recovers supported candidates, proving the pairwise signal is useful, but it uses label-derived supported-vs-unsupported edges and is not deployable.
