# Source Context

## Current Publication Queue

- Ready artifacts: 6 of 6
- What A Museum Collection Looks Like When It Becomes Data: field-map; A structured museum API turns a collection into analyzable records, but the first artifact is a bounded sample of one institution, not a statement about museums generally.
- Canon Drift: A Feasibility Report: moving-canon; Canon drift is not one dataset. Teaching, anthologization, citation, and holdings are separate signals that need separate source layers.
- The Language Of Museums After Decolonization: what-changed; Add annual-report/exhibition/provenance pages as separate source layers before trend claims.
- The Rise Of AI And The Humanities: field-map; The v1 literature radar is large enough for a field-map essay about AI, computational methods, and quantitative humanities signals, but source coverage remains uneven.
- What Counts As A Humanities Dataset?: research-agenda; Humanities datasets become essay-ready when they combine public access, structured metadata, clear rights, time depth, and a question that respects coverage bias.
- What Universities Say They Are For: what-changed; Audit the archived snippets by hand and add catalogs, strategic plans, and speeches as separate source layers.

## Existing Backlog Signals

### What Universities Say They Are For

- Status: corpus-built
- Unit: institution-page snapshot
- Question: How has the public language universities use to describe their purpose changed over time?
- Sources: current university mission/about pages; Internet Archive Wayback snapshots
- Next sources: university catalogs; strategic plans; president messages; commencement speeches
- Risks: Wayback coverage is sparse for exact current URLs; mission pages move or split across about/value/strategic-plan pages; short archived pages can produce false term drift

### The Rise Of AI And The Humanities

- Status: analysis-ready
- Unit: scholarly work metadata record
- Question: What are scholars publishing about AI, computation, archives, and quantitative methods in humanities-facing fields?
- Sources: OpenAlex; Crossref; DOAJ; Knowledge Commons Works / Humanities Commons; OSF Preprints / SocArXiv; arXiv
- Next sources: Project MUSE metadata where available; JSTOR Data for Research where permitted; publisher and journal feeds; conference programs
- Risks: metadata coverage underrepresents books and chapters; recent-year indexing lag can look like intellectual decline; keyword searches can overrepresent AI-explicit work and miss implicit computational methods

### The Language Of Museums After Decolonization

- Status: source-probed
- Unit: museum page or annual-report section snapshot
- Question: How have museums changed public language around civilization, world culture, provenance, restitution, repatriation, and decolonization?
- Sources: museum about pages; exhibition descriptions; collection pages; annual reports; provenance and repatriation pages; Internet Archive Wayback snapshots
- Next sources: museum press releases; education pages; collection API metadata; exhibition catalogs where metadata is public
- Risks: page redesigns can change text independently of institutional ideology; annual reports and exhibition pages represent different genres; some museums expose rich collection APIs while others expose only web copy

### Canon Drift: A Feasibility Report

- Status: analysis-ready
- Unit: author-work appearance in a syllabus, anthology, citation graph, translation record, or library-holdings record
- Question: Which sources can credibly measure changes in assigned, anthologized, cited, translated, or held authors over time?
- Sources: Open Syllabus where available; public syllabi; course catalogs; anthology tables of contents; OpenAlex citation metadata; library metadata
- Next sources: WorldCat-derived metadata where licensing permits; HathiTrust bibliographic data; publisher pages; public reading lists
- Risks: syllabi are not a representative sample of teaching; library holdings measure acquisition and preservation, not readership; anthology editions require careful edition-level normalization

### What Counts As A Humanities Dataset?

- Status: analysis-ready
- Unit: candidate dataset or corpus
- Question: What reusable corpora could support new quantitative humanities essays, and which are ready for immediate analysis?
- Sources: public dataset registries; library and archive APIs; digital humanities project pages; data papers; repository records
- Next sources: institutional repositories; Hugging Face datasets; Zenodo; Dataverse; Knowledge Commons
- Risks: dataset descriptions often overstate completeness; licenses may allow inspection but not republication; corpora may require domain-specific normalization before they are analytically useful

## Scout Direction

Prefer proposals that extend ready artifacts into second-layer source corpora or create new longitudinal public essays. Do not rely on tiny slices as final evidence. Use probes only to validate schema, access, and normalization before a broader backfill.
