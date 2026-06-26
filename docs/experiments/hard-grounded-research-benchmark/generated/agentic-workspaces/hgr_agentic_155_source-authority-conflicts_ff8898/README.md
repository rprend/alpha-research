# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Resolve a conflict between a crowd explanation, a claim page, and an evidence page. Prefer the highest-authority source and explain why. Expansion batch hgr_scale_batch_14, candidate 004. Generation instruction: Generate examples with a lower-authority source and a higher-authority source that disagree; mark the controlling authority. Native prompt: Verify this claim: Global warming is driving polar bears toward extinction Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Apply the provided authority order instead of picking the clearest prose.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_155_source-authority-conflicts_ff8898",
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
