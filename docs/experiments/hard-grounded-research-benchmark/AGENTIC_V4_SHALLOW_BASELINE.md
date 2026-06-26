# Agentic V4 Shallow Baseline

This report runs a deliberately shallow solver against the v4 candidate suite. The solver uses quoted-title lookup, task metadata roles, and category keywords.

## Result

- Tasks: 200
- Solved by shallow baseline: 180
- Solve rate: 90%
- Buyer gate passed: false

Candidate tasks are not buyer-ready: shallow metadata/role lookup solves too many tasks.

## By Category

| Category | Tasks | Solved | Solve rate |
| --- | ---: | ---: | ---: |
| multi-hop synthesis | 20 | 20 | 100% |
| stale-vs-current document conflicts | 20 | 20 | 100% |
| appended document lifecycle changes | 20 | 0 | 0% |
| table + text reasoning | 20 | 20 | 100% |
| source authority conflicts | 20 | 20 | 100% |
| evidence insufficiency / abstention | 20 | 20 | 100% |
| citation supports fact but not conclusion | 20 | 20 | 100% |
| entity disambiguation | 20 | 20 | 100% |
| temporal questions: as of date X | 20 | 20 | 100% |
| cross-document contradiction | 20 | 20 | 100% |
