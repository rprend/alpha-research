# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Answer the paper question after an appended erratum/appendix section changes the method description. Distinguish original-body evidence from appended evidence. Native prompt: which multilingual approaches do they compare with? You must search the corpus shard, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the corpus manifest before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Inspect appended updates before trusting the original document body.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_03_appended-document-lifecycle-changes",
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
