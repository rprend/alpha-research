# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Return an answer only if every conclusion sentence is directly supported by the cited evidence, not merely by a related fact. Native prompt: Were Scott Derrickson and Ed Wood of the same nationality? You must search the corpus shard, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the corpus manifest before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Reject true-but-insufficient citations when they do not entail the conclusion.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_07_citation-supports-fact-but-not-conclusion",
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
