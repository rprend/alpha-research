# Research Scout Template

Use this template when asking an AI agent to propose Archive Signals / Cultural Observatory studies.

## Scout Prompt

```text
You are proposing source-backed public research essays for Archive Signals / The Cultural Observatory.

Field or domain:
<FIELD>

Existing context:
<SOURCE INVENTORY OR PROCESSED RESULT SUMMARY>

Return 5 candidate studies. For each study, include:
- research question
- why the question matters
- unit of analysis
- likely sources
- required transformations
- expected charts or tables
- representative records needed
- reasons the idea might be wrong
- first runnable corpus build
- public essay angle

Do not propose a study unless the unit of analysis can plausibly be measured from public or already available sources.
```

## Audit Questions

For each proposal, answer:

1. Do the proposed sources actually exist and appear accessible?
2. Is the unit of analysis specific enough to normalize?
3. Can the proposed data distinguish at least two competing interpretations?
4. Would the result be interesting if the main hypothesis is false?
5. What source coverage caveat would need to appear in public?
6. What is the smallest runnable corpus that tests feasibility without becoming the final evidence base?
7. What evidence would make this `publishable` rather than merely `interesting`?

## Output Files

Save each scout run under:

```text
docs/experiments/research-scouts/<run-date>-<field-slug>/
  prompt.md
  source-context.md
  proposals.json
  audit.md
  selected-briefs.md
```

Strong proposals should be copied into `docs/experiments/research-backlog/backlog.json` with status `idea` or `source-probed`.
