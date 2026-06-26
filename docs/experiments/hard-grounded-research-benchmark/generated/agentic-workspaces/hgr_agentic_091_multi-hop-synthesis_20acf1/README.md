# Agentic Hard Grounded Research Task

You are evaluating a frontier tool-using research agent. Use only files in this task workspace.

## Task

Using only the cited documents, answer the bridge question and name both supporting pages. Do not cite a page unless it supplies one required hop. Expansion batch hgr_scale_batch_02, candidate 003. Generation instruction: Generate questions where at least two cited documents are jointly necessary; include one plausible but nonessential distractor citation. Native prompt: What science fantasy young adult series, told in first person, has a set of companion books narrating the stories of enslaved worlds and alien species? Search the corpus, cite exact evidence ids, reject misleading evidence, and obey the category-specific rule.

## Rule

Search the full corpus before answering. Return JSON with answer, cited_evidence_ids, rejected_evidence_ids, search_trace, and evidence_assessment. Find every required hop. A citation that supports only one hop is not enough.

## Required Output

Write a JSON file named `answer.json` in this directory with:

```json
{
  "task_id": "hgr_agentic_091_multi-hop-synthesis_20acf1",
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
