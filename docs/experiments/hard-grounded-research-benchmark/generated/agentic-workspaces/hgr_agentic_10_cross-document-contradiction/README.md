# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Identify whether the documents agree, conflict, or are insufficient; do not collapse contradictory evidence into a single synthesized answer. Native prompt: Verify this claim: Global warming is driving polar bears toward extinction You must search the corpus shard, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the corpus manifest before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. If evidence cannot be reconciled by date or authority, answer CONFLICT instead of smoothing it over.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_10_cross-document-contradiction",
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
