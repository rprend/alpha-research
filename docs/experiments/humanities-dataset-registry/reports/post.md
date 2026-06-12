# What Counts As A Humanities Dataset?

Status: publication draft for editorial review

Source artifact: `docs/experiments/humanities-dataset-registry/reports/result.json`

Source inventory: `docs/experiments/humanities-dataset-registry/reports/source-inventory.md`

Study specs: `docs/experiments/humanities-dataset-registry/reports/study-specs.md`

Evidence audit: `docs/experiments/humanities-dataset-registry/reports/post-evidence-audit.json` passed 21/21 checks.

## Thesis

A humanities dataset is not just a pile of cultural material. It becomes analytically useful when access, rights, structure, time depth, entity richness, normalization burden, and coverage bias are legible together.

That is the point of a dataset registry. It does not merely list sources. It asks which sources can support a study, what kind of study they can support, and which claims would be irresponsible.

## Corpus Note

The current registry probes 15 candidate humanities corpora. In the latest run:

- 11 candidates were accessible
- 6 were ranked `ready-now`
- 5 needed source work
- 4 were blocked or constrained
- 5 study specs were generated from ready-now candidates

This is not a census of all humanities datasets. It is a source-probed shortlist for Archive Signals / The Cultural Observatory.

## The Readiness Test

The registry scores sources across several practical dimensions:

- Can the source be accessed?
- Are rights and redistribution conditions clear enough?
- Is the metadata structured?
- Is there enough time depth for longitudinal work?
- Are people, works, places, dates, institutions, or objects represented as usable entities?
- How much normalization is required before analysis?
- Is there a public essay question worth asking?

The most important distinction is between availability and usefulness. A source can be public and still analytically weak. A source can be rich and still impossible to reuse. A source can be large and still unrepresentative.

## Ready-Now Sources

The registry identified six ready-now candidates:

| Dataset | Domain | Score | Starter Question | Main Risk |
| --- | --- | ---: | --- | --- |
| Cleveland Museum of Art Open Access API | museum collections | 103 | What acquisition, creation-date, and department patterns appear in open museum data? | One museum collection is analytically rich but institution-specific. |
| Wikidata | linked open data | 96 | How are authors, artworks, institutions, languages, and movements connected in public linked data? | Wikidata reflects contributor attention and ontology gaps. |
| Library of Congress Digital Collections | archives/library | 93 | Which subjects, formats, and eras dominate digitized public collections? | Collection metadata reflects digitization and cataloging priorities. |
| Metropolitan Museum of Art Collection API | museum collections | 93 | How do object dates, geographies, departments, and acquisition histories differ across the Met collection? | API records vary in completeness and public-domain image availability. |
| Open Syllabus | teaching syllabi | 86 | Which works and authors appear in syllabi across institutions, fields, and time? | Export terms need explicit review before automated collection. |
| Project Gutenberg | books/literature | 86 | How do genres, publication dates, and author cohorts shape public-domain literary corpora? | Public-domain availability is not literary representativeness. |

The Cleveland source already produced a first study: `What A Museum Collection Looks Like When It Becomes Data`. That matters because the registry should not remain an abstract list. A useful registry should turn into experiments.

## Blocked Or Constrained Sources Are Findings Too

The latest run also found blocked or constrained candidates:

- Smithsonian Open Access returned an HTTP 403 in this probe.
- Chronicling America returned an HTTP 404 for the tested JSON route.
- Rijksmuseum API returned an HTTP error for the tested route.
- Digital Public Library of America was blocked or constrained in the latest probe.

That does not mean these sources are bad. It means the access route, API key requirements, endpoint choice, or terms need more work before they can support an automated study.

For quantitative humanities, this is part of the result. Source access shapes what can be studied.

## Five Studies The Registry Can Launch

The registry generated five study specs from ready-now sources:

1. `What A Museum Collection Looks Like When It Becomes Data`
   - Dataset: Cleveland Museum of Art Open Access API
   - Unit: artwork metadata record
   - First build: fetch and normalize a bounded museum API corpus

2. `The Public Knowledge Graph Of Culture`
   - Dataset: Wikidata
   - Unit: entity and statement
   - First build: query authors, artworks, movements, languages, and institutions

3. `What The Library Of Congress Has Digitized`
   - Dataset: Library of Congress Digital Collections
   - Unit: collection or item metadata record
   - First build: fetch collection metadata and item samples

4. `The Shape Of The Met Collection`
   - Dataset: Metropolitan Museum of Art Collection API
   - Unit: object metadata record
   - First build: fetch object IDs and object-detail samples

5. `What Teaching Data Can And Cannot Tell Us About The Canon`
   - Dataset: Open Syllabus
   - Unit: assigned work or author appearance
   - First build: resolve access and export terms, then run a narrow author-cohort pilot

These are not final claims. They are runnable starts.

## What Makes A Dataset Essay-Ready?

For Archive Signals, a dataset becomes essay-ready when it supports a public question and a reproducible evidence path.

The minimum standard is:

- a clear unit of analysis
- a source inventory
- rights and access notes
- raw or source-stable records
- normalized tables
- caveats about coverage and bias
- representative records for inspection
- a public claim narrow enough for the evidence

That last requirement matters most. The Cleveland Museum API can support a claim about a sampled Cleveland API corpus. It cannot support a claim about museums in general. Project Gutenberg can support a study of public-domain availability. It cannot stand in for literature. Open Syllabus can support teaching-signal work if access terms are resolved. It cannot become `the canon` by itself.

## Why This Belongs In The Cultural Observatory

The Cultural Observatory needs a research backlog that is constrained by source reality. Otherwise every essay idea sounds plausible and none of them become durable.

A dataset registry turns vague ambition into an operating surface:

- What can be fetched now?
- What requires permissions or API keys?
- What is structured enough to analyze?
- What is rich but biased?
- What should become a first post?
- What should stay a source-access memo?

The registry is therefore not administrative overhead. It is the mechanism that keeps the publication honest.

## Limitations

This registry probes 15 candidate corpora, not the whole universe of humanities data. Scores are operational readiness scores, not cultural importance scores.

Public availability does not equal representativeness. API richness does not equal interpretive neutrality. Aggregators mix institutions, schemas, rights, and collection practices. Many humanities corpora become usable only after domain-specific normalization.

Licensing and redistribution need explicit review before derived datasets are published.

## Next

The next registry-driven studies should be:

1. A full or larger Cleveland Museum API backfill, replacing the bounded sample.
2. A Library of Congress digitized-collections field map.
3. A Wikidata cultural-knowledge graph probe.
4. A Met collection-shape comparison against Cleveland.
5. An Open Syllabus access memo before any assignment-level canon claim.

The broader lesson is simple: in quantitative humanities, the question is not only `what can we measure?` It is `what does this source actually let us know?`
