# Agentic V11 Retrieval Shortcut Audit

This audit ranks each task corpus with a cheap question-token-overlap score. It is intentionally weaker than a modern embedding retriever; it exists to catch tasks that are too easy before running expensive frontier-agent baselines.

## Result

- Tasks: 200
- Passed: 200
- Failed: 0
- Buyer gate passed: true

## Finding Counts

| Finding | Count |
| --- | ---: |
| none | 0 |

## By Category

| Category | Tasks | Passed | Mean required rank | Required docs in top 10 |
| --- | ---: | ---: | ---: | ---: |
| multi-hop synthesis | 20 | 20 | 345.5 | 0 |
| stale-vs-current document conflicts | 20 | 20 | 288.15 | 0 |
| appended document lifecycle changes | 20 | 20 | 237.1 | 0 |
| table + text reasoning | 20 | 20 | 177.2 | 0 |
| source authority conflicts | 20 | 20 | 189.28 | 0 |
| evidence insufficiency / abstention | 20 | 20 | 344.4 | 0 |
| citation supports fact but not conclusion | 20 | 20 | 345.07 | 0 |
| entity disambiguation | 20 | 20 | 338.35 | 0 |
| temporal questions: as of date X | 20 | 20 | 247.35 | 0 |
| cross-document contradiction | 20 | 20 | 241.15 | 0 |
