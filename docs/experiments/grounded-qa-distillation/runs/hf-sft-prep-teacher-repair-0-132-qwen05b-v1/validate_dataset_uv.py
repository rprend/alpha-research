#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["datasets>=2.20.0"]
# ///

import json
import os
from datasets import load_dataset

DATA_URL_BASE = os.environ.get("DATA_URL_BASE", "https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/hf_dataset_repo")

dataset = load_dataset("json", data_files={
    "train": f"{DATA_URL_BASE}/train.jsonl",
    "validation": f"{DATA_URL_BASE}/validation.jsonl",
})
eval_dataset = load_dataset("json", data_files={"eval": f"{DATA_URL_BASE}/eval_prompts.jsonl"})["eval"]

errors = []
for split, rows in dataset.items():
    if not rows:
        errors.append(f"{split} split is empty")
    for index, row in enumerate(rows):
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) != 3:
            errors.append(f"{split}:{index}: expected exactly three messages")
            continue
        if messages[-1].get("role") != "assistant":
            errors.append(f"{split}:{index}: final message must be assistant")
        try:
            parsed = json.loads(messages[-1].get("content") or "")
        except Exception as exc:
            errors.append(f"{split}:{index}: assistant content is not JSON: {exc}")
            continue
        if parsed.get("answer_type") == "grounded_answer":
            citations = parsed.get("citations") or []
            answer = parsed.get("answer") or ""
            if not citations:
                errors.append(f"{split}:{index}: grounded answer needs citations")
            for citation in citations:
                if f"[{citation}]" not in answer:
                    errors.append(f"{split}:{index}: missing inline citation {citation}")

if len(eval_dataset) == 0:
    errors.append("eval prompt file is empty")

if errors:
    raise SystemExit("\n".join(errors))

print(json.dumps({
    "status": "ready",
    "train_rows": len(dataset["train"]),
    "validation_rows": len(dataset["validation"]),
    "eval_rows": len(eval_dataset),
    "data_url_base": DATA_URL_BASE,
}, indent=2))
