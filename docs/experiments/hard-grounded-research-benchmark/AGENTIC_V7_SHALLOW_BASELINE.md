# Agentic V7 Shallow Baseline

This report runs a deliberately shallow solver against the v7 candidate suite. The solver uses quoted phrase lookup, visible short-result prose, visible dates, visible appendix markers, visible review-status markers, and category keywords.

## Result

- Tasks: 200
- Solved by shallow baseline: 50
- Solve rate: 25%
- Buyer gate passed: false

Candidate tasks are not buyer-ready: shallow metadata/role lookup solves too many tasks.

## By Category

| Category | Tasks | Solved | Solve rate |
| --- | ---: | ---: | ---: |
| multi-hop synthesis | 20 | 2 | 10% |
| stale-vs-current document conflicts | 20 | 0 | 0% |
| appended document lifecycle changes | 20 | 0 | 0% |
| table + text reasoning | 20 | 10 | 50% |
| source authority conflicts | 20 | 0 | 0% |
| evidence insufficiency / abstention | 20 | 0 | 0% |
| citation supports fact but not conclusion | 20 | 0 | 0% |
| entity disambiguation | 20 | 18 | 90% |
| temporal questions: as of date X | 20 | 0 | 0% |
| cross-document contradiction | 20 | 20 | 100% |
