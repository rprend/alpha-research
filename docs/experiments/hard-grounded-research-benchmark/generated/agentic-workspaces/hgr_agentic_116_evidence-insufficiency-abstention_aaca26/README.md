# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Answer only if the provided evidence establishes the claim. Otherwise abstain and list the missing evidence. Expansion batch hgr_scale_batch_16, candidate 009. Generation instruction: Generate answerable-looking contexts where one required fact is absent; the correct answer must abstain. Native prompt: what are the topics pulled from Reddit? Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Answer ABSTAIN unless the corpus contains direct evidence for the requested conclusion.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_116_evidence-insufficiency-abstention_aaca26",
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
