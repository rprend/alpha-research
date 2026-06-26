# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Answer as of a specified date X, treating later documents as unavailable and earlier documents as possibly stale. Expansion batch hgr_scale_batch_25, candidate 001. Generation instruction: Generate as-of-date questions with earlier and later snapshots; the answer must be scoped to the requested date. Native prompt: Verify this claim: Global warming is driving polar bears toward extinction Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Use only evidence available as of the requested date and mark later evidence as excluded.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_039_temporal-questions-as-of-date-x_fc8189",
  "answer": "...",
  "cited_evidence_ids": ["..."],
  "rejected_evidence_ids": ["..."],
  "search_trace": [
    {
      "query_or_action": "...",
      "files_or_evidence_ids": ["..."],
      "decision": "kept | rejected | inspected"
    }
  ],
  "evidence_assessment": "..."
}
```

You must search `corpus.json` and cite exact `document_id` values. Do not use hidden gold, previous benchmark reports, or generated scorer outputs. Do not answer from memory.
