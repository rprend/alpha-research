# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Answer the paper question after an appended erratum/appendix section changes the method description. Distinguish original-body evidence from appended evidence. Expansion batch hgr_scale_batch_07, candidate 006. Generation instruction: Generate long-document examples where an appendix, erratum, or lifecycle note changes the controlling answer. Native prompt: what are the topics pulled from Reddit? Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Inspect appended updates before trusting the original document body.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_083_appended-document-lifecycle-changes_9cac0e",
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
