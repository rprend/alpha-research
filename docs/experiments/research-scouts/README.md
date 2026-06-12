# Cultural Observatory Research Scouts

Research scout runs turn the publication program's current artifacts into audited study proposals.

The purpose is not to collect loose ideas. A useful scout run must name a measurable unit of analysis, plausible public sources, first runnable corpus build, failure modes, and publication angle. Weak ideas are rejected or narrowed before they enter the research backlog.

## Run

```bash
node docs/experiments/research-scouts/scripts/build-scout-run.mjs
```

By default the script writes:

```text
docs/experiments/research-scouts/2026-06-12-cultural-memory/
  prompt.md
  source-context.md
  proposals.json
  audit.md
  selected-briefs.md
```

Pass `--run-id=<date-field>` to write a different run folder.

## Acceptance Standard

A scout run is complete when:

- at least five concrete proposals exist in `proposals.json`
- each proposal has sources, unit of analysis, transformations, failure modes, and first runnable build
- the audit explicitly accepts, narrows, or rejects every proposal
- at least three selected briefs can become experiment folders
- selected briefs identify evidence that would make the study publishable

