# AI Is Now A Humanities Object

Subtitle: A first field map from Archive Signals / The Cultural Observatory.

Status: publication draft for editorial review

Source artifact: `docs/experiments/humanities-literature-radar/reports/result.json`

Remote proof: `docs/experiments/humanities-literature-radar/registration/remote-smoke-run.json`

## Thesis

AI is no longer just something humanists react to from outside the field. In the first Humanities Literature Radar corpus, AI, LLMs, and computational methods show up as objects of interpretation, tools for pedagogy and archives, infrastructure for data cleaning, and methods for studying language, culture, and heritage.

That does not mean the corpus represents all humanities publishing. It does not. It is a metadata corpus built from open and semi-open scholarly indexes, repositories, and preprint sources. But it is large enough to make one practical claim: there is already enough public metadata to map where AI and quantitative methods are entering humanities work, and to turn that map into a recurring research beat.

## Corpus Note

This field map uses 1,951 deduped metadata records in the `humanities-literature-radar` dataset.

The corpus includes 1,155 records dated 2024-present and 593 records flagged as quantitative, computational, corpus, citation, AI, or method candidates. The source families represented in processed records are HCommons / Knowledge Commons Works, Crossref, DOAJ, OpenAlex, arXiv, and OSF Preprints / SocArXiv.

Source counts in the current corpus:

| Source | Works |
| --- | ---: |
| HCommons / Knowledge Commons Works | 500 |
| Crossref | 500 |
| DOAJ | 468 |
| OpenAlex | 455 |
| arXiv | 19 |
| OSF Preprints / SocArXiv | 9 |

The strongest way to read these numbers is not as a ranking of the field. They are a map of what this collection process can currently see.

## Finding 1: AI Has Become A Humanities Topic

The corpus contains recent records that treat AI as a subject for philosophical, literary, historical, educational, and institutional analysis. Some are direct critiques of AI-produced humanities research. Others examine AI literacy, multilingualism, writing evaluation, or historical-language generation.

The remote Alpha Research smoke run on the registered dataset counted 98 AI/LLM-related records dated 2024-present. That is 8.5% of the 2024-2026 records it inspected. This is not a field-wide percentage, because the corpus is intentionally tuned toward AI, digital humanities, and method signals. But it is enough to show that the topic is not marginal inside the collected sources.

Representative records from the remote smoke run:

| Title | Source | Year | Why It Matters |
| --- | --- | ---: | --- |
| AI-Produced Humanities Research: On the Dangers of Technical Incrementalism | OpenAlex | 2026 | A direct humanities-theory critique of AI-produced scholarship. |
| AI Does Not Hallucinate - The Unverifying Human Does | HCommons | 2026 | Treats generative AI as an epistemology and literacy problem. |
| AI-Driven Generation of Old English: A Framework for Low-Resource Languages | DOAJ | 2026 | Connects LLM methods to historical language work. |
| Are We There Yet? Notes Towards Benchmarking an Experimental AI-Assisted Workflow for Humanities Data Cleaning and Reconciliation | Crossref | 2026 | Treats AI as infrastructure for humanities data work. |

The important pattern is the spread of roles. AI appears as method, object, threat, aid, workflow, and pedagogical problem. That gives the publication an obvious recurring question: which parts of the humanities are treating AI as a tool, and which are treating it as a cultural object?

## Finding 2: Computational Humanities Is Broader Than AI

The field map should not collapse quantitative humanities into LLM discourse. The remote run counted 379 quantitative or computational candidates dated 2024-present, or 32.8% of the 2024-2026 records it inspected.

Those signals include network analysis, corpus work, classification, citation analysis, embeddings, topic modeling, bibliometrics, cultural analytics, and digital heritage systems. Some records are plainly humanities-native. Others are adjacent: education, social science, information science, or computational linguistics touching humanities questions.

That adjacency is a feature to study, not a bug to hide. The Cultural Observatory can ask where methods are entering from outside the humanities, where they are being translated into humanities questions, and where they are merely being imported without much interpretive gain.

## Finding 3: The Source Mix Is The Story

The current corpus does not reveal "the humanities" in the abstract. It reveals an ecosystem of sources:

- Crossref and DOAJ surface journal articles and open-access publications.
- OpenAlex adds broad bibliographic coverage, citation counts, and cross-source metadata.
- HCommons / Knowledge Commons Works surfaces repository objects, preprints, essays, and field-specific material.
- arXiv contributes concentrated technical and computational experiments.
- OSF Preprints / SocArXiv adds a small but useful preprint layer.

This matters because apparent trends can come from source coverage as much as from intellectual movement. A rise in AI records might reflect field interest, better indexing, a source-specific burst, or query design. The right editorial posture is to show the source mix before making claims from it.

The corpus is therefore best used for field mapping and research direction selection right now, not for ranking departments, journals, or disciplines.

## What This Makes Possible

The literature radar creates a pipeline for several recurring Archive Signals pieces:

1. `The Rise Of AI And The Humanities`

   A recurring field map of AI as object, method, and infrastructure across humanities publishing.

2. `Where Quantitative Humanities Already Exists`

   A methods map separating corpus analysis, citation work, network analysis, bibliometrics, digital heritage, and LLM-assisted workflows.

3. `The Humanities Data Cleaning Problem`

   A focused essay on reconciliation, metadata repair, OCR, named-entity cleanup, dedupe, and the quiet labor behind cultural datasets.

4. `AI As A Canon Problem`

   A study of which authors, languages, periods, and archives become more visible when AI workflows enter the humanities, and which become less visible.

5. `The Source Coverage Beat`

   A methodological series about what OpenAlex, Crossref, DOAJ, HCommons, arXiv, and preprint repositories do and do not show.

## Limitations

This is a metadata corpus, not a full-text corpus. Titles, abstracts, venue metadata, source concepts, and repository records are enough for scouting and field mapping, but not enough for close interpretive claims about arguments inside the works.

The corpus underrepresents books, book chapters, paywalled journals, non-English scholarship, small journals, and many humanities venues that are weakly indexed in open bibliographic systems.

The method and topic labels are heuristic. They are useful for finding patterns and selecting records for review, but public claims should cite representative records and preserve uncertainty.

The current source harvest is still bounded. The next backfill should expand DOAJ through a public dump or OAI-PMH route, broaden HCommons and OSF/SocArXiv collection, improve NBER coverage for humanities-adjacent economic history, and manually audit representative works.

## Why This Is The First Field Map

The point of Archive Signals is not to prove that a research tool can produce charts. The point is to build a public habit of asking measurable questions about cultural and intellectual change.

This first field map is useful because it turns a vague editorial instinct into an inspectable object:

- there is a corpus
- there are source labels
- there are representative records
- there are caveats
- there is a registered Alpha Research dataset
- there is a remote run proving the dataset can answer a question from its mounted files

That is enough to start publishing, with humility about coverage and confidence about direction.

## Next

The next piece should not be another manifesto. It should be a sharper essay from the same pipeline:

`The Rise Of AI And The Humanities`

The claim to test is simple: AI has become both a method and an object of study in humanities publishing, but those two roles are unevenly distributed across sources, fields, and publication types.

The next run should expand the corpus, audit representative records by hand, and split AI records into at least four buckets:

- AI as object of critique or interpretation
- AI as research method
- AI as pedagogy or writing infrastructure
- AI as cultural heritage, archive, or language technology

That would turn this field map into a first proper Archive Signals essay: not "quantitative humanities" as a slogan, but cultural change made visible through a corpus.
