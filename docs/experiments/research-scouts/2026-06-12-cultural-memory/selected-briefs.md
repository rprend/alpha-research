# Selected Study Briefs

These briefs are ready to become experiment folders after a source-probe command is chosen.

## When Museums Started Explaining Repair

- ID: museum-annual-report-language
- Status: source-probed
- Format: what-changed
- Research question: How did museum annual reports and public accountability documents change their language around provenance, restitution, repatriation, access, and community between 2000 and 2026?
- Unit of analysis: museum annual report section or paragraph snapshot
- Primary sources: museum annual report PDFs; museum accountability or impact reports; museum archive/news pages; Internet Archive snapshots for report indexes
- First runnable build: Select 12 museums already present in museum-language-drift, fetch all public annual reports available for 2000-2026, extract text into paragraph records, and reuse the existing museum term taxonomy with a document-genre label.
- Publication angle: A follow-up to the museum language post: not just what museums say on web pages, but when repair and accountability entered their institutional record.
- Publishable evidence: Broad backfill, raw manifests, processed records, and representative audited snippets tied to every major claim.
- Quality risks: annual reports may be written for donors rather than public interpretation; PDF availability may be uneven by museum and year; report design and OCR quality may create artificial language shifts

## The Strategic Plan University

- ID: university-strategic-plan-drift
- Status: source-probed
- Format: what-changed
- Research question: Do university strategic plans show a stronger shift toward innovation, impact, global leadership, belonging, and workforce language than mission/about pages?
- Unit of analysis: university strategic-plan section or page
- Primary sources: current strategic-plan pages; strategic-plan PDFs; university president messages; Internet Archive snapshots of plan pages
- First runnable build: Use the 10 universities in university-mission-statement-drift, collect public strategic plans and president messages for 2000, 2010, 2015, 2020, and 2026 anchors, then compare against existing mission-page term families.
- Publication angle: Universities may not have changed what they say they are for as much as how they plan, manage, and justify themselves.
- Publishable evidence: Broad backfill, raw manifests, processed records, and representative audited snippets tied to every major claim.
- Quality risks: strategic plans may be episodic and not comparable year by year; universities may remove old plans from public sites; consultant-written plans can converge stylistically without reflecting institutional purpose

## What Humanities AI Actually Studies

- ID: humanities-ai-corpora-map
- Status: idea
- Format: field-map
- Research question: Which corpora, archives, languages, periods, and media types appear most often in AI-for-humanities work from 2020 onward?
- Unit of analysis: scholarly work to named corpus/archive/dataset mention
- Primary sources: humanities-literature-radar processed works; OpenAlex abstracts; arXiv abstracts; Knowledge Commons records; paper full text where open and permitted
- First runnable build: Start from the 593 quantitative/computational candidates in humanities-literature-radar, extract corpus/entity mentions from titles and abstracts, then audit the top 100 mentions before scaling to open full text.
- Publication angle: AI in the humanities is not only a method trend; it is a map of which parts of culture are becoming computationally visible.
- Publishable evidence: Audited top corpus mentions with source links and false-positive estimates.
- Quality risks: metadata abstracts may omit corpus names; full-text access may bias toward open preprints; named entity extraction can merge projects, datasets, and institutions incorrectly

## The Anthology Table Of Contents As Canon Sensor

- ID: anthology-toc-canon-pilot
- Status: idea
- Format: moving-canon
- Research question: Can public anthology tables of contents and publisher previews measure author and work turnover across editions in a narrow literary field?
- Unit of analysis: author-work appearance in an anthology edition table of contents
- Primary sources: publisher preview pages; Google Books snippets where permitted for bibliographic metadata; Internet Archive controlled metadata pages; library catalog edition metadata; public syllabi as comparison only
- First runnable build: Pick one anthology family with public TOC evidence across at least three editions, build an edition-level table, and compare against a small public syllabus control set without treating syllabi as representative.
- Publication angle: Canon drift becomes measurable only when the source is narrow enough to audit edition by edition.
- Publishable evidence: At least three editions with auditable TOC rows, edition-year metadata, and explicit missing-source notes.
- Quality risks: tables of contents may be copyrighted or not publicly extractable at scale; anthologies differ in market and course level; edition changes can reflect permissions and price rather than canon judgment

## The Afterlife Of Humanities Datasets

- ID: dataset-afterlife-study
- Status: source-probed
- Format: what-changed
- Research question: What happens to public humanities datasets after release: do they get cited, forked, reused in papers, linked from projects, or quietly disappear?
- Unit of analysis: dataset or corpus release
- Primary sources: humanities-dataset-registry candidates; Zenodo and Dataverse metadata; OpenAlex citation and related-work metadata; GitHub repository metadata where public; project pages and documentation
- First runnable build: Take the 15 dataset-registry candidates, collect DOI/URL/repository identifiers, query OpenAlex and repository metadata for reuse signals, and hand-audit the top and bottom cases.
- Publication angle: Humanities datasets are infrastructure, but their public afterlife is uneven and measurable.
- Publishable evidence: Broad backfill, raw manifests, processed records, and representative audited snippets tied to every major claim.
- Quality risks: reuse is often informal and hard to observe; citations may attach to papers rather than datasets; older datasets may predate modern DOI and repository practices
