# Public Draft Scaffold: What The Local Public-Domain Corpus Can Support

The local humanities knowledge base now has enough stored public-domain text to support a first essay about corpus readiness: which texts can be quoted, which genres are overrepresented, and which recurring language families are visible before doing any new scraping.

## What The Local Corpus Contains

- 200 local texts are quote-ready public-domain files, totaling 921,506 estimated words.
- 160 matched records are discovery-only metadata, mostly useful for acquisition planning rather than immediate quotation.
- 200 quote-ready texts have subject metadata and 200 have bookshelf metadata.

The source split is:

- project-gutenberg: 200 records, 200 with local text, 0 discovery-only.
- internet-archive-metadata: 160 records, 0 with local text, 160 discovery-only.

The strongest bookshelf clusters are:

- Category: Short Stories: 47 texts.
- Category: British Literature: 45 texts.
- Category: Humour: 43 texts.
- Category: American Literature: 38 texts.
- Category: Poetry: 37 texts.
- Category: Essays, Letters & Speeches: 34 texts.
- Category: French Literature: 34 texts.
- Category: Novels: 23 texts.

The clearest recurring-language signals are:

- emotion_interiority: 3012 mentions across 191 texts.
- religion_morality: 1774 mentions across 179 texts.
- social_world: 1386 mentions across 190 texts.
- genre_form: 950 mentions across 186 texts.
- empire_race_nation: 948 mentions across 159 texts.
- canon_language: 502 mentions across 158 texts.
- science_modernity: 465 mentions across 112 texts.

Representative quote-ready texts to inspect first:

- John Jacob Astor by Hubbard, Elbert, 1856-1915 (6,511 words).
- Rab and His Friends by Brown, John, 1810-1882 (6,479 words).
- Trees, and Other Poems by Kilmer, Joyce, 1886-1918 (6,282 words).
- Some Causes of the Prevailing Discontent by Warner, Charles Dudley, 1829-1900 (6,274 words).
- The Rubaiyat of Omar Khayyam Jr. by Irwin, Wallace, 1876-1959 (6,189 words).
- The City That Was: A Requiem of Old San Francisco by Irwin, Will, 1873-1948 (6,166 words).
- Goldsmith's Friend Abroad Again by Twain, Mark, 1835-1910 (6,139 words).
- First Project Gutenberg Collection of Edgar Allan Poe by Poe, Edgar Allan, 1809-1849 (6,018 words).

## What This Does Not Yet Prove

- This experiment analyzes local Project Gutenberg text files and Internet Archive metadata already stored in the KB; it performs no fresh web scraping.
- Project Gutenberg texts are quote-ready under the local KB rights rows, but source-specific Gutenberg license/trademark notes still matter for republication packaging.
- Internet Archive rows are discovery-only metadata in this experiment; they are not treated as locally quote-ready full text.
- Publication-year coverage for imported Gutenberg rows is weak, so this pass supports corpus scoping and genre/language study more strongly than chronological canon-drift claims.
- Term-family counts are transparent dictionary signals over stored text, not a topic model or literary interpretation.
