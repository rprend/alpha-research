# Humanities Dataset Study Specs

Generated at: 2026-06-12T18:36:22.149Z

These specs turn the registry's ready-now candidates into first runnable studies. They are study starts, not publication claims.

## What A Museum Collection Looks Like When It Becomes Data

- Dataset: Cleveland Museum of Art Open Access API
- Domain: museum-collections
- Format: what-changed
- Unit of analysis: artwork metadata record
- Readiness: ready-now (103)
- Launched experiment: `docs/experiments/cleveland-museum-collection-shape/`

Research question: What acquisition, creation-date, department, geography, and medium patterns become visible in a fully open museum API?

First runnable build: Fetch the first 5,000 Cleveland Museum of Art API records, normalize dates/departments/creators, and produce acquisition/date/department tables.

Expected outputs:

- department counts
- creation-date distribution
- acquisition-date distribution
- public-domain/image-availability counts

Publication angle: A practical demonstration of how museum collections become analyzable once metadata is open and structured.

Known risk: One museum collection is analytically rich but institution-specific.

## The Public Knowledge Graph Of Culture

- Dataset: Wikidata
- Domain: linked-open-data
- Format: research-agenda
- Unit of analysis: Wikidata entity and statement
- Readiness: ready-now (96)

Research question: How are authors, artworks, institutions, movements, languages, and places connected in public linked data?

First runnable build: Run bounded SPARQL queries for authors, artworks, movements, languages, and institutions, then inspect missingness and relation density.

Expected outputs:

- entity counts by class
- relationship graph
- missingness table
- starter query library

Publication angle: A field guide to what public linked data can and cannot say about cultural history.

Known risk: Wikidata reflects contributor attention and ontology gaps.

## What The Library Of Congress Has Digitized

- Dataset: Library of Congress Digital Collections
- Domain: archives-library
- Format: field-map
- Unit of analysis: collection or item metadata record
- Readiness: ready-now (93)

Research question: Which subjects, formats, periods, and collection types dominate digitized public collections?

First runnable build: Fetch LOC collection metadata and one item sample per collection, normalize subjects/formats/dates, and rank collection visibility.

Expected outputs:

- collection inventory
- subject counts
- format counts
- date coverage table

Publication angle: A map of digitized cultural memory that distinguishes collection visibility from historical importance.

Known risk: Collection metadata reflects digitization and cataloging priorities.

## The Shape Of The Met Collection

- Dataset: Metropolitan Museum of Art Collection API
- Domain: museum-collections
- Format: field-map
- Unit of analysis: object metadata record
- Readiness: ready-now (93)

Research question: How do object dates, geographies, departments, acquisition histories, and public-domain availability differ across the Met collection?

First runnable build: Fetch object IDs and a bounded object-detail sample, normalize department/culture/period/date/acquisition fields, and produce collection-shape charts.

Expected outputs:

- department counts
- culture/geography table
- object-date distribution
- public-domain counts

Publication angle: A source-backed essay on what a major museum collection looks like through its public API.

Known risk: Collection API records vary in completeness and public-domain image availability.

## What Teaching Data Can And Cannot Tell Us About The Canon

- Dataset: Open Syllabus
- Domain: teaching-syllabi
- Format: moving-canon
- Unit of analysis: assigned work or author appearance
- Readiness: ready-now (86)

Research question: Which works and authors appear in syllabi across institutions, fields, and time, and what access limits constrain public claims?

First runnable build: Resolve access/export terms, then build a narrow pilot around one author cohort and one discipline.

Expected outputs:

- author/work appearance table
- field/institution coverage notes
- access constraints memo

Publication angle: A careful methods essay separating syllabus evidence from broad claims about cultural value.

Known risk: Public access and export terms need explicit review before automated collection.
