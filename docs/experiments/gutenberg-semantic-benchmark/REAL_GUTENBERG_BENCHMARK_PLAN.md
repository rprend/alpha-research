# Real Gutenberg Semantic Benchmark Plan

This plan starts from the actual benchmark requirement: acquire real Project Gutenberg books, clean and index them, design semantic retrieval tasks from real passages, label those passages, then run and score baselines and agents. Synthetic scale tests do not satisfy this plan.

## Current Status

The real medium-scale implementation is now in place:

- `pnpm run benchmark:gutenberg:acquire` downloads and cleans real Project Gutenberg text works into ignored `.local/` storage.
- The current local corpus has 5,000 usable Project Gutenberg works, 2.09 GB of cleaned text, and about 351M words.
- `pnpm run benchmark:gutenberg:medium` streams over the real corpus and indexes 730,226 passages without synthetic works.
- The current run writes real retrieval candidates, metrics, trace, machine-mined real labels, verifier results, and error analysis.
- The current generated label set has 348 machine-mined labels from real Project Gutenberg passages.

Remaining quality work: the generated labels are not yet human-adjudicated. They are useful for running and debugging the benchmark, but they should be reviewed before publication-quality claims.

## 1. Acquire The Corpus

- Download the Project Gutenberg metadata/catalog.
- Select English-language public-domain text works.
- Download 5,000-20,000 real book texts from Project Gutenberg mirrors.
- Store raw files locally outside git.
- Make downloads resumable, checksummed, and polite to the source.

## 2. Normalize And Clean Books

- Strip Gutenberg headers and footers.
- Normalize encoding, whitespace, chapter boundaries, and line breaks.
- Remove catalog stubs, license-only files, duplicates, non-English texts, and very short works.
- Preserve raw source paths and cleaned text paths.

## 3. Build Metadata

Create a metadata store with:

- Gutenberg ID
- title
- author
- language
- subjects
- release date or publication year where available
- raw text URL
- local raw path
- local cleaned path

Record corpus inventory:

- count
- size
- exclusions
- cleaning failures

## 4. Chunk The Corpus

- Split cleaned books into stable 250-600 word passages with overlap.
- Preserve offsets into cleaned text.
- Generate stable IDs, such as `pg-1342` and `pg-1342-p000123`.
- Save passage text, work ID, chapter or section guess, offsets, token count, and chunking version.

## 5. Build Retrieval Indexes

- Build BM25/full-text index over passages plus title, author, and subject metadata.
- Build vector/semantic index over passages.
- Save index metadata: model, dimensions, date, corpus version, and chunking version.
- Add tools to fetch passages and surrounding context.

## 6. Design Benchmark Task Families

Use the README task families as the benchmark shape:

- tone and vibe retrieval
- emotion coping
- relationship dynamics
- symbolic landscape and place
- class, status, and money anxiety
- narrator stance and irony
- moral, religious, and existential framing
- genre motifs and historical drift

For each family, draft natural-language interpretive retrieval questions.

## 7. Mine Candidate Passages

For each question, run broad candidate mining:

- lexical searches
- semantic searches
- hybrid searches
- metadata-constrained searches

Pull top candidates plus diverse lower-ranked candidates.

Deliberately mine near misses: passages with keyword or semantic overlap that do not satisfy the target relationship.

## 8. Label The Benchmark

For each task, create real labels from real Gutenberg passages:

- positives
- hard negatives
- ambiguous examples
- out-of-scope examples when relevant

Store:

- quote
- passage ID
- work metadata
- rationale
- adjudication status

Use graded relevance where appropriate.

Iterate question wording when candidates show that a task is too vague, too easy, or impossible.

## 9. Create Gold Sets

Start with 10 pilot questions.

Then expand toward medium scale:

- 50-100 questions
- 8-12 task families
- 5,000-20,000 indexed works

Minimum per task:

- 5-20 positives
- 10-30 hard negatives
- 3-10 ambiguous examples

Keep rubrics explicit enough to judge rationales, not just retrieval.

## 10. Run Baselines

- Run BM25 baseline.
- Run vector baseline.
- Run hybrid baseline.
- Run agent baseline with retrieval tools.
- Run agent plus verifier.
- Save candidates, final answers, traces, latency, costs, metrics, and failures.

## 11. Score The Benchmark

Retrieval:

- Recall@20
- Precision@10
- nDCG@10

Span quality:

- correct passage
- usable quote
- not over-broad

Interpretation:

- rationale matches rubric
- rationale distinguishes hard negatives

Faithfulness:

- every quote exists in fetched passage
- citations match source text

Diversity:

- results are not all from one work unless required

Uncertainty:

- ambiguous examples are treated as ambiguous

## 12. Error Analysis And Iteration

Classify failures:

- retrieval miss
- bad chunk boundary
- hard negative accepted
- vague query
- unsupported rationale
- metadata constraint ignored
- duplicate edition issue

Revise:

- chunking
- index config
- task wording
- labels
- rubrics
- verifier prompts/checks

## 13. Package The Benchmark Release

Save release artifacts:

- corpus manifest
- metadata store
- passage store
- index manifests
- task items
- gold labels
- rubrics
- baseline results
- agent results
- error analysis

The README must clearly state:

- corpus source
- acquisition date
- number of real Gutenberg works
- exclusions
- known limitations
- exact commands to reproduce

## 14. Validation Gate

The benchmark is not done until:

- real Project Gutenberg corpus is downloaded
- at least 5,000 works are cleaned and indexed
- benchmark questions are based on real candidate passages
- gold labels cite real passage IDs
- baselines run against real indexes
- scoring artifacts exist
- a reproducible command rebuilds the run
