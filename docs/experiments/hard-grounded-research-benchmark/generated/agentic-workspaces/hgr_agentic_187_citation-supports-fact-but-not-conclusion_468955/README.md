# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Return an answer only if every conclusion sentence is directly supported by the cited evidence, not merely by a related fact. Expansion batch hgr_scale_batch_20, candidate 007. Generation instruction: Generate examples where cited evidence supports true subfacts but not the requested conclusion. Native prompt: Were Scott Derrickson and Ed Wood of the same nationality? Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Reject true-but-insufficient citations when they do not entail the conclusion.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_187_citation-supports-fact-but-not-conclusion_468955",
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
