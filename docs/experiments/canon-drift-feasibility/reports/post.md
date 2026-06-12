# Canon Drift Is Not One Measurement

Status: publication draft for editorial review

Source artifact: `docs/experiments/canon-drift-feasibility/reports/result.json`

Source inventory: `docs/experiments/canon-drift-feasibility/reports/source-inventory.md`

Evidence audit: `docs/experiments/canon-drift-feasibility/reports/post-evidence-audit.json` passed 21/21 checks.

## Thesis

The literary or intellectual canon does not move in one place. It moves, if it moves, across several different institutions at once: classrooms, anthologies, libraries, citations, editions, translations, syllabi, catalogs, and public memory.

That means `canon drift` is not one dataset. It is a family of measurements.

This feasibility report does not claim that any author is rising or falling. It asks a prior question: what kinds of evidence would be needed before a public essay could responsibly say that the canon has changed?

## Corpus Note

The current artifact probes 13 sources across several signal types. Eleven probes were accessible in the latest run. Two were blocked or constrained.

The signal layers are:

| Signal Layer | Probes | Accessible | What It Can Show | What It Cannot Show Alone |
| --- | ---: | ---: | --- | --- |
| Teaching | 3 | 3 | Public courseware and syllabus-index possibilities | Representative curriculum change |
| Anthologization | 1 | 1 | Whether publisher or anthology pages expose useful metadata | Complete edition-level table-of-contents change |
| Holdings or collections | 1 | 1 | Library/catalog visibility and preservation signals | Reading, assignment, or cultural importance |
| Holdings or editions | 2 | 0 | Potential library and edition coverage if access is resolved | Anything yet; both probes were blocked |
| Citation or scholarly discussion | 6 | 6 | Open scholarly discussion around author names | Canonical status by itself |

The accessible probes are useful because they show where a larger study could begin. The blocked probes are equally useful because they show where source access will shape the research design.

## Finding 1: Teaching Is Not The Same As Public Courseware

The teaching probes included MIT OpenCourseWare literature courses, Open Yale Courses English pages, and Open Syllabus.

These sources are valuable, but they are not interchangeable. Public courseware can show examples of teaching material that universities chose to publish. Open Syllabus can become a stronger assignment-level signal if export access and terms are resolved. Neither should be treated as a representative census of classroom teaching without additional source work.

Allowed claim: public courseware and syllabus-index probes are candidate teaching signals.

Not allowed yet: Shakespeare, Morrison, Austen, Du Bois, Arendt, Foucault, or any other figure is more or less assigned on the basis of this artifact.

## Finding 2: Anthologies Need Edition-Level Tables Of Contents

The Norton Anthology probe was accessible, but it returned no usable records in this run. That is an important result. Publisher pages may confirm the existence of an anthology or edition, but canon claims require tables of contents, edition dates, author names, work titles, genres, and preferably page or selection metadata.

Anthologization is a strong canon signal because anthologies explicitly select and package works for teaching and cultural memory. It is also a high-normalization signal. Edition boundaries matter. Reprinted titles matter. Excerpts matter. Translation and modernization matter.

Allowed claim: anthology pages can support a source-access discussion.

Not allowed yet: edition-level inclusion or exclusion changed over time.

## Finding 3: Library Holdings Are Preservation Signals, Not Reading Signals

The Library of Congress collections search was accessible and returned 2,430 results for the tested query. HathiTrust returned a 403. WorldCat returned a 429.

This is exactly the kind of split a quantitative humanities project has to surface. Library metadata can be rich, but holdings and catalog records measure preservation, acquisition, cataloging, digitization, and institutional metadata practice. They do not directly measure reading or teaching.

That does not make them useless. Holdings and editions can help map cultural memory, translation, institutional collecting, and preservation. But those are not the same as classroom assignment or scholarly influence.

Allowed claim: library and catalog signals describe preservation, cataloging, and holdings.

Not allowed yet: holdings equal readership.

## Finding 4: Citation Search Is A Discussion Signal

The OpenAlex probes returned large result counts for author-name searches:

| Probe | Results |
| --- | ---: |
| Toni Morrison | 18,993 |
| Jane Austen | 23,051 |
| William Shakespeare | 68,477 |
| W. E. B. Du Bois | 98,545 |
| Hannah Arendt | 78,575 |
| Michel Foucault | 223,815 |

These numbers are tempting. They should not be used as rankings.

OpenAlex name search can include works about the author, works by people with overlapping names, loose mentions, and adjacent records. It is useful as a scholarly-discussion probe, especially after relevance filtering. It is not a standalone canon meter.

Allowed claim: OpenAlex can help map scholarly discussion around a name.

Not allowed yet: a raw OpenAlex search count measures canonical status.

## The Main Lesson

The word `canon` hides different institutions.

An author can be central in scholarly discussion and absent from undergraduate teaching. A work can be heavily anthologized and weakly cited. A text can be widely held by libraries and rarely assigned. A figure can be culturally famous but bibliographically messy because editions, translations, selections, and names are hard to normalize.

So the right first question is not:

> Who is rising or falling in the canon?

The right first question is:

> Which canon signal are we measuring?

## What A Real Pilot Should Do

The first runnable canon-drift study should choose one author cohort and one signal layer.

A good pilot would use:

- one cohort, such as Morrison, Austen, Shakespeare, Du Bois, Arendt, and Foucault
- one signal, such as Open Syllabus assignments or OpenAlex scholarly discussion
- one time window
- explicit relevance filtering
- clear exclusion rules
- source-specific caveats

That pilot should produce a narrow claim, not a universal canon index.

For example:

> In this source layer, for this cohort, during this time window, these records become more or less visible.

That is less grand than `measuring the canon`. It is also much more likely to be true.

## Why This Belongs In Archive Signals

Canon drift is a good Archive Signals topic because it sits exactly where humanities judgment and structured evidence meet.

The human question is old: what gets remembered, taught, preserved, cited, and reprinted?

The data question is newer: which source layers can show those movements without pretending that one metric captures the whole cultural process?

The answer from this feasibility run is clear. The canon is not one table. It is a set of overlapping traces.

## Limitations

This artifact is a source probe, not a completed measurement. It should not be used to rank authors, works, periods, or institutions.

Public courseware is not representative of all teaching. Publisher pages may not expose full anthology tables of contents. Library holdings measure catalog and preservation signals, not reading. OpenAlex search results need relevance review before author-level trend claims. HathiTrust and WorldCat were blocked or constrained in this run.

## Next

The next study should be a narrow pilot, not a grand canon dashboard.

Recommended first pilot:

- Signal layer: scholarly discussion through OpenAlex.
- Cohort: Morrison, Austen, Shakespeare, Du Bois, Arendt, and Foucault.
- Task: build a relevance-filtered time series of works about each figure, then manually audit a sample before making any trend claim.

Recommended second pilot:

- Signal layer: teaching through Open Syllabus, if export access and terms are resolved.
- Cohort: the same authors.
- Task: compare assignment visibility against scholarly-discussion visibility.

Only after those two layers exist should the project ask whether there is something like canon drift across institutions.
