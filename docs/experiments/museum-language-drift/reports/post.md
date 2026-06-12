# The Language Of Museums Is A Source Layer

Status: publication draft for editorial review

Source artifact: `docs/experiments/museum-language-drift/reports/result.json`

Source inventory: `docs/experiments/museum-language-drift/reports/source-inventory.md`

Audit packet: `docs/experiments/museum-language-drift/reports/audit-packet.json`

Evidence audit: `docs/experiments/museum-language-drift/reports/post-evidence-audit.json` passed 28/28 checks.

## Thesis

Museum language can be studied as a changing public record, but it has to be treated as language first. About pages, collection pages, exhibition pages, research pages, and annual reports are different source genres. They should not be collapsed into a single measure of what museums believe or do.

This source probe asks a narrower question: what can we learn by collecting public museum pages and tracking the language families that appear in them?

The answer is promising but bounded. The corpus is large enough to show a source layer worth studying. It is not large enough to make strong claims about museum practice or to declare a field-wide shift after decolonization.

## Corpus Note

The current artifact contains 40 processed pages:

- 28 current public museum pages
- 12 historical Wayback snapshots
- 14 museums
- 5 page genres: about, collection, education, exhibition, and research
- year range: 2005-2026

The processed publication corpus excludes weak extracted pages. The audit packet reports 0 automatic flags after those exclusions.

## Finding 1: Access And Research Language Dominate The Current Probe

Across the processed corpus, the largest term families are:

| Term Family | Count |
| --- | ---: |
| access/public | 143 |
| research/scholarship | 134 |
| community/inclusion | 54 |
| provenance/ownership | 9 |
| civilization/world culture | 4 |
| restitution/repatriation | 3 |
| decolonization/reckoning | 3 |

This should not be read as a verdict about museum priorities. It is a map of words in collected pages. Still, the shape is useful: public-facing pages in this corpus repeatedly use access, public, research, and community language, while provenance, restitution, and decolonization terms appear much less often in this first layer.

That difference creates a research question for a larger study. Are provenance and restitution terms concentrated in specialized pages, annual reports, collection records, and policy documents rather than about pages? If so, the apparent absence of those terms from general pages may be a genre effect, not an institutional silence.

## Finding 2: Page Genre Matters

The current probe makes page genre impossible to ignore.

About pages carry the largest amount of access, research, and community language in the processed table: 13 about pages contain 97 access/public terms, 68 research/scholarship terms, and 52 community/inclusion terms.

Collection pages look different. In 8 collection pages, research/scholarship terms appear 25 times, while provenance/ownership appears 4 times and restitution/repatriation appears 2 times.

Research pages look different again. In 3 research pages, research/scholarship appears 31 times, with provenance/ownership appearing 4 times.

The point is not that one page type is more honest than another. The point is that source genres have different jobs. About pages explain an institution to the public. Collection pages expose catalog and object language. Research pages describe scholarly infrastructure. Exhibition pages often introduce programs or displays.

Any quantitative humanities study of museum language has to keep those genres separate.

## Finding 3: Historical Snapshots Are Useful, But Thin

The artifact includes 12 historical snapshots from 2005 through 2020, all about pages. The strongest historical years in this run are 2012, with 2 museums, and 2015, with 3 museums.

Historical snapshots in the source inventory include the J. Paul Getty Museum, Whitney Museum of American Art, San Francisco Museum of Modern Art, Museum of Contemporary Art Chicago, Natural History Museum London, Walker Art Center, and Tate.

That is enough to prove that the Wayback layer can work. It is not enough to claim a broad historical trend.

The right next move is to expand historical coverage at fixed checkpoints, such as 2000, 2010, 2015, 2020, and current pages, then compare like with like: about page against about page, annual report against annual report, provenance page against provenance page.

## Finding 4: Term Counts Are Audit Leads

The term counts are useful because they identify where to read. They are not interpretations by themselves.

For example, a term family like `community/inclusion` can contain ordinary public-engagement language, formal diversity commitments, accessibility language, or broader civic framing. `Provenance/ownership` can refer to research infrastructure, legal status, collection documentation, or restitution debates. `Civilization/world culture` can signal older universal-museum language, but it can also appear in ordinary descriptive text.

The audit packet preserves snippets for review. Public quotations or stronger interpretive claims should be checked against those snippets and source pages, not inferred from counts alone.

## What This Can Support

This artifact can support a source-caveated methods post:

- museum public language is measurable
- source genres must remain separate
- Wayback snapshots can support a historical layer
- term families can identify pages and snippets for human review
- annual reports, provenance pages, exhibition text, and collection records should be added as separate layers

It should not support claims that museums as institutions have changed practice. It should not support a broad claim that museum language moved from civilization to decolonization. It should not compare about pages, collection pages, and research pages as if they were the same kind of document.

## Why This Matters

Museums are public memory institutions. They explain what they collect, who they serve, what kinds of knowledge they produce, and how they understand their public role.

Those explanations change. But the changes are spread across many documents: mission pages, collection pages, exhibition texts, education pages, research pages, provenance pages, annual reports, strategic plans, press releases, and catalog records.

The useful quantitative humanities move is not to flatten those documents into one bag of words. It is to build source layers carefully enough that change over time becomes inspectable.

## Next

The next version of this study should add:

- annual reports as a separate source layer
- provenance and repatriation pages where they are fetchable without browser challenges
- exhibition descriptions with explicit date ranges
- source-genre-specific trend lines
- manual snippet review before public quotation

The first strong public claim should come from a like-for-like comparison. About pages over time can support one kind of essay. Annual reports can support another. Provenance pages can support a third.

The lesson from this probe is simple: museum language is measurable, but only if the source layers stay visible.
