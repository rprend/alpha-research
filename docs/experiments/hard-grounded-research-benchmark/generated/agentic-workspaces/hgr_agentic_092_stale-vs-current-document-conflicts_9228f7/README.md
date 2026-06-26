# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Given an older claim document and a newer evidence document, answer as of the newer document date and explicitly mark stale statements. Expansion batch hgr_scale_batch_04, candidate 007. Generation instruction: Generate paired older/newer evidence snapshots and require the answer to reject stale claims under the newer date. Native prompt: Verify this claim: Global warming is driving polar bears toward extinction Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Prefer the current controlling document and explicitly reject stale evidence.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_092_stale-vs-current-document-conflicts_9228f7",
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
