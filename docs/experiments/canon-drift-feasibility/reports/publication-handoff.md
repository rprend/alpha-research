# Canon Drift Publication Handoff

Generated at: 2026-06-12T19:01:01.127Z
Publish state: ready-for-copyedit
Readiness status: ready-for-editorial-review

## Final Draft

- Draft: `docs/experiments/canon-drift-feasibility/reports/public-draft.md`
- Structured findings: `docs/experiments/canon-drift-feasibility/reports/result.json`
- Readiness: `docs/experiments/canon-drift-feasibility/reports/readiness.json`
- Source inventory: `docs/experiments/canon-drift-feasibility/reports/source-inventory.md`
- Feasibility matrix: `docs/experiments/canon-drift-feasibility/data/processed/feasibility-matrix.csv`

## Thesis

Canon drift is not one dataset; teaching, anthologization, citation, and holdings are separate signals that need separate source layers.

## Corpus Note

The artifact probes 13 sources across 4 accessible signal types. 11 probes were accessible and 2 were blocked or constrained in the latest run.

## Evidence Blocks

### Teaching signals

Allowed claim: Public courseware and syllabus-index probes are candidate teaching signals, not representative curriculum evidence.

- MIT OpenCourseWare Literature courses: accessible, 1 records/results. Open courseware is public and reusable but not representative of all teaching.
- Open Yale Courses English: accessible, 2 records/results. Open courses are selected public offerings, not a full curriculum.
- Open Syllabus: accessible, 2 records/results. Useful canonical-teaching signal, but access/export terms need explicit review before automated use.

### Anthologization signals

Allowed claim: Anthology pages can support a source-access discussion, but edition-level TOC claims need a separate audit.

- Norton Anthology of English Literature: accessible, 0 records/results. Publisher pages may expose partial metadata; full TOC may require manual or licensed source work.

### Holdings signals

Allowed claim: Library and catalog signals describe preservation, cataloging, and holdings; they do not measure reading.

- Library of Congress collections search: accessible, 2430 records/results. Library collection counts measure preservation and cataloging, not readership or teaching.
- HathiTrust catalog: http-error, 0 records/results. Bibliographic coverage is rich but access/automation and edition normalization need review.
- WorldCat search: http-error, 0 records/results. Potentially valuable holdings signal, but automated access and licensing are likely constrained.

### Scholarly-discussion signals

Allowed claim: OpenAlex name searches can map scholarly discussion, but require relevance review before author-level trend claims.

- OpenAlex search: Toni Morrison: accessible, 18993 records/results. Search results may include works about the author, by namesakes, or loosely related mentions.
- OpenAlex search: Jane Austen: accessible, 23051 records/results. Search results may include works about the author, by namesakes, or loosely related mentions.
- OpenAlex search: William Shakespeare: accessible, 68477 records/results. Search results may include works about the author, by namesakes, or loosely related mentions.
- OpenAlex search: W. E. B. Du Bois: accessible, 98545 records/results. Search results may include works about the author, by namesakes, or loosely related mentions.
- OpenAlex search: Hannah Arendt: accessible, 78575 records/results. Search results may include works about the author, by namesakes, or loosely related mentions.
- OpenAlex search: Michel Foucault: accessible, 223815 records/results. Search results may include works about the author, by namesakes, or loosely related mentions.

## Blocked Sources

- HathiTrust catalog: http-error (403); not usable until access terms or fetchability are resolved
- WorldCat search: http-error (429); not usable until access terms or fetchability are resolved

## Public Claim Checklist

- [ ] Say this is a feasibility report based on 13 probes, not a measurement of canon change.
- [ ] Mention 11 accessible probes and 2 blocked probes.
- [ ] Keep teaching, anthology, holdings, and citation evidence separated.
- [ ] Do not rank authors or works as more or less canonical from this artifact.
- [ ] Name blocked/constrained sources before proposing the narrow pilot.
- [ ] Frame the next study as one author cohort plus one signal layer.

## Copyedit Notes

- Lead with the methodological problem: canon is an overloaded word hiding different institutions.
- Make the piece useful as a map of evidence types, not as a verdict about any author.
- Use the blocked HathiTrust and WorldCat probes as evidence that access terms shape quantitative humanities work.
- End by proposing a narrow pilot rather than a universal canon index.
