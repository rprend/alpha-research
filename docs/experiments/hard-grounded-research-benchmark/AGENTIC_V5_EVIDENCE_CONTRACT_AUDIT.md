# Agentic V5 Evidence Contract Audit

This audit checks whether v5 task workspaces have inspectable evidence contracts without leaking hidden gold, marker-role shortcuts, visible control-label shortcuts, or synthetic required evidence.

## Result

- Tasks: 200
- Passed: 100
- Failed: 100
- Buyer gate passed: false

## Gates

| Gate | Pass |
| --- | --- |
| no_public_raw_provenance_leaks | true |
| no_public_marker_or_role_shortcuts | true |
| no_public_visible_control_shortcuts | false |
| no_required_synthetic_control_documents | true |
| no_non_required_exact_answer_leaks | true |

## Finding Counts

| Finding | Count |
| --- | ---: |
| corpus_contains_visible_control_shortcut | 100 |

## By Category

| Category | Tasks | Passed | Findings | Required synthetic rate |
| --- | ---: | ---: | ---: | ---: |
| multi-hop synthesis | 20 | 20 | 0 | 0 |
| stale-vs-current document conflicts | 20 | 0 | 20 | 0 |
| appended document lifecycle changes | 20 | 0 | 20 | 0 |
| table + text reasoning | 20 | 20 | 0 | 0 |
| source authority conflicts | 20 | 0 | 20 | 0 |
| evidence insufficiency / abstention | 20 | 20 | 0 | 0 |
| citation supports fact but not conclusion | 20 | 20 | 0 | 0 |
| entity disambiguation | 20 | 20 | 0 | 0 |
| temporal questions: as of date X | 20 | 0 | 20 | 0 |
| cross-document contradiction | 20 | 0 | 20 | 0 |
