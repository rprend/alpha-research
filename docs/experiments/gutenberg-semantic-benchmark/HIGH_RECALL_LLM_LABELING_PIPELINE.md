# High-Recall LLM Labeling Pipeline

The goal of this pipeline is to build a comprehensive collection of interpretive Project Gutenberg passages while minimizing false negatives. The core strategy is retrieval-heavy, LLM-reranked, and recall-oriented: find too many plausible candidates first, then use LLMs and human review to clean precision later.

## 1. Build Better Candidate Pools

For each task, generate 20-50 query variants:

- direct wording
- synonym expansions
- period-language variants
- trope-specific variants
- negative or near-miss variants
- author/title seeded variants

Run each variant through:

- BM25
- embedding search
- hybrid search
- metadata-constrained search

Keep a large pool per task, such as the top 5,000-20,000 passages before dedupe.

## 2. Deduplicate And Diversify

- Deduplicate near-identical passages.
- Collapse overlapping chunks from the same work.
- Keep neighboring context available.
- Preserve diversity by work, author, period, genre/subject, and retrieval method.

Expected output: 1,000-3,000 candidates per task.

## 3. Cheap Reranking Pass

Use a cross-encoder/reranker or cheaper LLM to sort candidates.

The goal is not final judgment. The goal is to avoid losing plausible positives.

Use broad buckets:

- likely positive
- possible positive
- hard negative
- obvious miss

Do not discard `possible positive` candidates at this stage.

## 4. LLM Labeling Pass

Use a strong model on the top 1,000-2,000 candidates per task.

Give the model:

- query
- rubric
- near-miss definition
- passage
- surrounding context
- metadata

Ask for structured output:

- label: `positive`, `hard_negative`, `ambiguous`, or `miss`
- relevance: `0-3`
- evidence quote
- rationale
- why it is not a near miss
- confidence
- whether more context is needed

## 5. Adversarial Verifier Pass

Run a second model pass on:

- positives
- ambiguous examples
- high-confidence hard negatives
- model-disagreed cases

Verifier questions:

- Could this be a false positive?
- Does the quote actually prove the requested relationship?
- What would make this a near miss?

Keep disagreements for human review.

## 6. False Negative Expansion Loop

Take accepted positives and extract:

- recurring vocabulary
- authors
- works
- genres
- settings
- relationship patterns

Generate new query variants from those positives.

Search again and add newly found candidates to the pool.

Repeat until marginal yield drops, such as when the new positive rate falls below 2-5%.

## 7. Human Review Layer

Humans should not review every candidate.

Humans review:

- all final positives
- all ambiguous examples
- model disagreements
- sampled hard negatives
- sampled misses from each retrieval method

Human decisions become stable gold labels.

## 8. Coverage Estimation

Estimate false negatives by checking:

- overlap between BM25, vector, hybrid, seeded, and expanded pools
- capture-recapture estimates
- positive yield from random lower-ranked samples
- positive yield from seeded known-author searches
- positive yield after each expansion loop

Stop only when:

- new query variants find few new positives
- random lower-ranked samples have low positive yield
- seeded known works stop adding unseen positives

## 9. Final Gold Set

For each task, store:

- positives
- hard negatives
- ambiguous examples
- rejected near misses
- rationales
- adjudication status
- source passage/context

Include the discovery path for each label:

- BM25
- vector
- seeded author search
- LLM expansion loop
- human-added

## Model Strategy

Candidate mining can be local/free retrieval.

For LLM labeling, use a strong model. This benchmark requires interpretive literary judgment, not just keyword matching. Cheaper models can help triage, but subtle labels should go through a stronger verifier and human review.

Recommended setup:

- candidate mining: local/free retrieval
- first LLM label pass: cheaper strong-ish model
- verifier/adjudication pass: strongest available model
- final gold: human-reviewed

Do not run an LLM over every passage. Run LLMs over candidate pools.

## Call Volume Estimate

Per task:

- 2,000 candidate label calls
- 200-500 verifier calls
- 2-4 expansion loops

For 10 tasks:

- about 20,000 first-pass calls
- about 2,000-5,000 verifier calls

This is manageable if prompts are compact and passages are kept around 300-800 words plus focused context.

## Core Principle

Optimize for recall first:

- let the candidate pool be too big
- let the first LLM pass be generous
- use verifier and human review to clean precision later
- keep sampling lower-ranked pools until new positives dry up

This is how the benchmark becomes a comprehensive collection rather than a neat but incomplete set.
