# Gutenberg Semantic Retrieval Benchmark

## Purpose

This experiment adapts the Data Agent Benchmark idea to a huge unstructured corpus: a local Project Gutenberg mirror. The goal is to test whether an Alpha Research agent can answer interpretive, vibe-based, and relationship-based corpus questions that are not directly queryable with SQL fields or simple keyword search.

Examples of target questions:

- Find passages where people cope with death using ironic or dry humor.
- Find passages that feel like driving home from work on a rainy day: mellow, tired, inward, and slightly hopeless.
- Find scenes where affection is expressed through criticism.
- Find descriptions of a place that imply class anxiety.
- Find rhetoric that frames progress as spiritual decay.

The benchmark should measure retrieval quality, interpretive judgment, evidence selection, and citation faithfulness at corpus scale.

## DAB Analogy

The original Data Agent Benchmark studies real enterprise data-agent workloads, identifies hard patterns, builds open datasets that mimic those patterns, creates verified questions, distributes data across database systems, runs LLM agents with tools, and scores final answers.

The equivalent for Project Gutenberg is:

1. Study real semantic corpus-search workloads from scholars, journalists, editors, historians, creative researchers, search teams, and recommendation builders.
2. Identify hard unstructured-corpus patterns:
   - Evidence is split across raw text, passage chunks, metadata, embeddings, search indexes, annotations, and optional external context.
   - References do not align cleanly: editions, author names, titles, characters, places, passage boundaries, and inferred concepts vary.
   - The target signal is implicit: irony, mood, coping, class anxiety, resignation, or symbolic meaning may never be named directly.
   - Domain interpretation is required: the agent must distinguish narrator irony from character irony, melancholy from despair, gallows humor from ordinary humor, and trope from surface keyword.
3. Build 8-12 public-domain corpus task suites that mimic those patterns.
4. Create 50-100 natural-language interpretive retrieval questions with verified positives, hard negatives, graded relevance, and rationale rubrics.
5. Distribute each task across metadata tables, raw text files, a full-text index, a vector index, and an annotation store.
6. Run frontier LLM research agents with tools for metadata lookup, lexical search, vector search, passage fetch, context expansion, Python analysis, reranking, and final citation.
7. Score retrieval, ranking, span quality, interpretation quality, near-miss rejection, diversity, faithfulness, and uncertainty handling.

## Local Laptop Assumptions

Use the local Project Gutenberg mirror already present on the laptop. The exact mirror path should be recorded in `config/local.json`, which must not contain secrets and can be kept out of version control if it contains machine-specific paths.

Suggested local working layout:

```text
data/
  gutenberg/
    raw/                         # symlink or reference to local mirror texts
    metadata.duckdb              # work/book/author metadata
    passages.duckdb              # passage chunks and span offsets
    bm25/                        # full-text index
    vectors/                     # embedding index
    annotations.duckdb           # gold labels, hard negatives, rubrics
experiments/
  runs/
  reports/
```

Prefer symlinking to the mirror rather than copying the full corpus.

## Benchmark Units

Each benchmark item should be a task, not just a query string.

```json
{
  "id": "death_ironic_humor_001",
  "family": "emotion_coping_mechanisms",
  "query": "Find passages where people cope with death using ironic or dry humor.",
  "scope": {
    "corpus": "project_gutenberg_local",
    "language": "en",
    "exclude": ["nonfiction_catalog_records"]
  },
  "expected_output": {
    "min_passages": 5,
    "max_passages": 12,
    "requires_quotes": true,
    "requires_rationales": true,
    "requires_near_miss_notes": true
  },
  "gold": {
    "positives": ["work_id:chapter:span"],
    "hard_negatives": ["work_id:chapter:span"],
    "ambiguous": ["work_id:chapter:span"]
  },
  "rubric": {
    "strong_match": "Death or loss is salient, humor is ironic/dry/understated, and the humor functions as emotional deflection or coping.",
    "near_miss": "Contains death and humor but not a coping relationship, or contains irony unrelated to death."
  }
}
```

## Task Families

Start with 8 task families. Each family should include direct positives, hard negatives, ambiguous examples, and at least one query that requires metadata constraints.

1. Tone and vibe retrieval
   - Example: passages that feel mellow, tired, inward, and slightly hopeless.
   - Hard negatives: rainy scenes that are cheerful; hopeless scenes that are melodramatic or violent; mellow scenes that are content.

2. Emotion-coping mechanisms
   - Example: grief handled through dry humor, chores, silence, ritual, religion, or social performance.
   - Hard negatives: grief without coping behavior; humor without grief; narrator irony without character coping.

3. Social relationship dynamics
   - Example: affection expressed through criticism, contempt masked as politeness, dependence disguised as duty.
   - Hard negatives: explicit affection; explicit hostility; politeness without hidden contempt.

4. Symbolic landscape and place
   - Example: weather or landscape mirroring emotional numbness, urban spaces implying moral confusion, domestic spaces becoming threatening.
   - Hard negatives: literal scenery with no interpretive role.

5. Class, status, and money anxiety
   - Example: characters interpreting morality through wealth, embarrassment around poverty, social rank enforced through etiquette.
   - Hard negatives: money mentions with no social interpretation.

6. Narrator stance and irony
   - Example: narrator undercuts a character's self-image, uses bathos, or frames solemnity comically.
   - Hard negatives: character sarcasm; straightforward comic dialogue; authorial exposition without stance.

7. Moral, religious, and existential framing
   - Example: resignation rather than despair, providence used to explain suffering, industrial progress framed as spiritual decay.
   - Hard negatives: explicit sermonizing without narrative evidence.

8. Genre motifs and historical concept drift
   - Example: Gothic dread without supernatural events, sentimental deathbed scenes, adventure passages where empire is treated as destiny.
   - Hard negatives: modern keyword matches that do not fit period usage.

## Data Preparation

Build separate representations so the agent must integrate them.

1. Metadata store
   - Use DuckDB or SQLite.
   - Tables: `works`, `authors`, `editions`, `subjects`, `languages`.
   - Fields: `work_id`, `gutenberg_id`, `title`, `author`, `year`, `language`, `subjects`, `text_path`.

2. Passage store
   - Chunk texts into stable spans.
   - Store `passage_id`, `work_id`, `chapter_id`, `start_char`, `end_char`, `text`, `token_count`.
   - Keep chunk sizes large enough for literary context, such as 250-600 words with overlap.

3. Full-text index
   - Use BM25 for lexical candidate generation.
   - Index passage text plus optional normalized title, author, and subject fields.

4. Vector index
   - Embed passages for semantic candidate generation.
   - Store model name, dimensions, date, and chunking version.

5. Annotation store
   - Store gold positives, hard negatives, ambiguous examples, labels, rationales, annotator notes, and adjudication status.

6. Optional relationship/context store
   - Store detected characters, places, events, and chapter-level summaries if available.
   - Treat these as helper signals, not ground truth.

## Gold Labeling Strategy

Use contrastive labeling. A benchmark item is only useful if it includes examples that are close but wrong.

For each query, label:

- Positive: the passage strongly matches the requested relationship, tone, or vibe.
- Hard negative: the passage shares surface keywords or partial themes but fails the relationship.
- Ambiguous: the passage has plausible but disputable relevance.
- Out-of-scope: the passage should not be considered because of language, genre, metadata, or edition constraints.

Use graded relevance for vibe tasks:

```text
3 = strong match
2 = plausible match
1 = weak overlap
0 = miss
```

Record the reason for each label. The reason becomes the basis for judging agent rationales.

## Agent Tools

The benchmark agent should not receive the corpus in context. It should receive tools.

Minimum tools:

- `list_sources`: show available stores and schemas.
- `query_metadata`: run SQL against metadata.
- `bm25_search`: search passages lexically.
- `vector_search`: search passages semantically.
- `fetch_passage`: fetch exact passage text.
- `fetch_context`: fetch surrounding passages or chapter context.
- `python`: run local analysis, clustering, deduping, scoring, and reranking.
- `final_answer`: return cited passage IDs, quotes, rationales, confidence, and near-miss notes.

Useful optional tools:

- `rerank`: cross-encoder or LLM reranking over candidate passages.
- `cluster_candidates`: group candidates by subtype.
- `compare_passages`: compare a candidate against the rubric and hard-negative criteria.

## Baselines

Run simple baselines before running LLM agents.

1. Keyword baseline
   - BM25 query generated from the user query.
   - Measures how far lexical search alone gets.

2. Embedding baseline
   - Vector search over the raw query.
   - Measures generic semantic retrieval.

3. Hybrid baseline
   - Merge BM25 and vector candidates, then rerank.

4. Agent baseline
   - ReAct-style agent with metadata, BM25, vector search, passage fetch, and Python.

5. Agent plus verifier
   - Same as agent baseline, but add a second pass that rejects near misses using the rubric.

## Scoring

Score multiple surfaces instead of a single exact answer.

Retrieval:

- Recall@20 over known positives.
- Precision@10 over top returned passages.
- nDCG@10 using graded relevance.

Span quality:

- Correct passage ID.
- Correct start/end boundary or acceptable nearby context.
- Quote is long enough to support the claim and short enough to avoid padding.

Interpretation:

- Rationale identifies the requested relationship, not just overlapping words.
- Rationale distinguishes the target concept from hard-negative alternatives.
- Rationale is supported by the quoted evidence.

Near-miss handling:

- Agent rejects candidates that have surface overlap but fail the rubric.
- Agent explains why rejected examples are wrong or weaker.

Diversity:

- Results are not all from one work unless the query scope requires it.
- Results span multiple authors, periods, or subtypes when requested.

Faithfulness:

- Every claim has a passage citation.
- Quotes match fetched text.
- Metadata constraints are respected.

Uncertainty:

- Ambiguous examples are marked as ambiguous rather than forced into confident positives.

## Laptop Implementation Plan

### Current Implementation Status

This directory now contains the executable benchmark seed:

- `schema.sql` for the benchmark stores.
- `data/task_items.jsonl` with 10 pilot task items across the intended families.
- `data/gold_labels.jsonl` with the first contrastive label set for `death_ironic_humor_001`.
- `scripts/gutenberg-semantic-benchmark.mjs`, exposed as `pnpm run benchmark:gutenberg`, for chunking local texts, running BM25/vector/hybrid baselines, and writing metrics, candidates, traces, manifests, and error analysis.
- `config/local.example.json` for machine-local mirror configuration. The real `config/local.json` is intentionally ignored.

This is a runnable seed benchmark, not the completed 100-500 work pilot. The next level is to replace fixture labels with adjudicated labels mined from the local mirror and to run against 100-500 English works.

### Phase 0: Confirm Local Mirror

Find the local Project Gutenberg mirror path and record:

```text
mirror_path
file_count
text_extensions
approx_size
metadata_source
```

Do not commit machine-specific absolute paths unless they are deliberately part of the repo.

### Phase 1: Build a Small Pilot Corpus

Start with 100-500 English-language works. Prefer a mix of famous and less-famous works to avoid overfitting to canonical examples.

Create:

- `metadata.duckdb`
- `passages.duckdb`
- BM25 index
- vector index
- `annotations.duckdb`

Validate:

- every passage maps to one work
- every work maps to a text path
- passage IDs are stable across rebuilds
- chunking version is recorded

### Phase 2: Create 10 Pilot Questions

Use 3 task families first:

- emotion-coping mechanisms
- tone and vibe retrieval
- narrator stance and irony

For each question, create:

- 5-20 positive labels
- 10-30 hard negatives
- 3-10 ambiguous labels
- a one-paragraph rubric

This is enough to expose whether the benchmark is measuring semantic interpretation instead of keyword overlap.

### Phase 3: Run Baselines

Run keyword, vector, and hybrid retrieval. Save:

- candidate passage IDs
- scores
- command logs
- metrics
- obvious false positives and false negatives

If the hybrid baseline already solves a task, make the task harder by adding near misses or asking for a more specific relationship.

### Phase 4: Run Agents

Run each agent 3-5 times per query. Save:

- final answer JSON
- cited passage IDs
- quotes
- rationales
- tool trace
- execution cost and latency
- verifier decisions if used

Use repeated runs because interpretive retrieval is stochastic and one run can hide instability.

### Phase 5: Error Analysis

Classify failures:

- query misunderstood
- lexical search missed candidates
- vector search missed candidates
- candidate found but wrongly rejected
- hard negative accepted
- passage boundary too broad or too narrow
- quote does not support rationale
- metadata constraint ignored
- answer lacks diversity
- hallucinated citation or unsupported claim

Use this to decide whether Alpha Research needs better tools, better prompts, better indexes, or better benchmark labels.

### Phase 6: Scale Levels

Use explicit scale gates rather than jumping directly to the full mirror.

#### Pilot: 100-500 Works

Build task labels, chunking, BM25/vector search, and scoring.

Required before leaving this level:

- Index 100-500 English-language works from the local mirror.
- Keep passage chunk IDs stable across rebuilds.
- Complete labels for the pilot tasks, including positives, hard negatives, ambiguous examples, and rationales.
- Run BM25, vector, and hybrid baselines for each task.
- Save candidates, metrics, traces, and error analysis for every task.
- Confirm the benchmark exposes failures beyond keyword overlap.

#### Medium Scale: 5,000-20,000 Works

Test whether retrieval and agents still behave well.

Required before leaving this level:

- Measure indexing time, search latency, memory use, and artifact size.
- Check whether BM25/vector/hybrid candidate quality degrades as near misses increase.
- Run agent and verifier baselines on repeated trials.
- Audit metadata constraints, citation faithfulness, diversity, and hard-negative rejection at larger scale.
- Update task design or labels when medium-scale retrieval makes a task too easy, too broad, or too noisy.

#### Full Mirror: All Available Gutenberg Texts

Use only after the task design, labeling, and metrics are solid.

Required before using this level for claims:

- Freeze the chunking version and schema version.
- Record mirror coverage, file count, text extensions, approximate size, and metadata source.
- Handle duplicate editions, translations, non-English works, catalog records, and malformed texts.
- Run baselines and agents with reproducible configs.
- Publish release artifacts with task items, labels, rubrics, baseline results, agent results, and error analysis.

Keep the small pilot as a fast regression suite.

## Expected Artifacts

Each run should produce:

```text
benchmark_item.json
agent_answer.json
retrieval_candidates.json
metrics.json
trace.jsonl
error_analysis.md
```

Each benchmark release should include:

```text
README.md
schema.sql
task_items.jsonl
gold_labels.jsonl
rubrics.md
baseline_results/
agent_results/
```

## Open Design Questions

- Which local embedding model is acceptable for laptop-scale indexing?
- Should vibe tasks use only human labels, or can candidate mining use LLM assistance followed by human adjudication?
- How much surrounding context should agents see before scoring a passage?
- Should results be evaluated at passage, paragraph, chapter, or quote span level?
- How should duplicate editions and translations be handled?
- Should the benchmark reward surprising but valid discoveries outside the original gold set?

## First Concrete Experiment

Build one pilot task:

```text
Task family: Emotion-coping mechanisms
Query: Find passages where people cope with death using ironic or dry humor.
Corpus: 200 English Project Gutenberg works
Target: 10 returned passages
Gold: 10 positives, 25 hard negatives, 5 ambiguous examples
Baselines: BM25, vector, hybrid
Agents: baseline ReAct, ReAct plus verifier
Metrics: recall@20, precision@10, nDCG@10, rationale faithfulness, hard-negative rejection
```

This is the fastest way to learn whether the benchmark design can separate shallow keyword search from real semantic corpus research.
