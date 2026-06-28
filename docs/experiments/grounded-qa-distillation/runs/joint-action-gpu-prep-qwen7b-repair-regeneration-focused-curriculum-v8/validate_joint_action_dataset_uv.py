#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# ///
import json
from pathlib import Path

root = Path(__file__).resolve().parent
dataset = root / "dataset"
errors = []

def read_jsonl(name):
    rows = []
    with (dataset / name).open() as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows

for name in ["sft_train.jsonl", "sft_validation.jsonl"]:
    rows = read_jsonl(name)
    if not rows:
        errors.append(f"{name} is empty")
    for i, row in enumerate(rows):
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) != 3:
            errors.append(f"{name}:{i}: expected 3 messages")
            continue
        target = json.loads(messages[-1]["content"])
        if target.get("answer_type") == "grounded_answer":
            for citation in target.get("citations") or []:
                if f"[{citation}]" not in target.get("answer", ""):
                    errors.append(f"{name}:{i}: missing inline citation {citation}")

for name in ["dpo_train.jsonl", "dpo_validation.jsonl"]:
    rows = read_jsonl(name)
    if not rows:
        errors.append(f"{name} is empty")
    for i, row in enumerate(rows):
        if not isinstance(row.get("prompt"), list) or len(row["prompt"]) != 2:
            errors.append(f"{name}:{i}: expected 2-message prompt")
        for key in ["chosen", "rejected"]:
            parsed = json.loads(row[key])
            if parsed.get("answer_type") not in ["grounded_answer", "abstain"]:
                errors.append(f"{name}:{i}: bad {key} answer_type")
        if json.loads(row["chosen"]) == json.loads(row["rejected"]):
            errors.append(f"{name}:{i}: chosen and rejected are identical")

if len(read_jsonl("eval_prompts.jsonl")) == 0:
    errors.append("eval_prompts.jsonl is empty")

if errors:
    raise SystemExit("\n".join(errors))

print(json.dumps({"status": "ready", "dataset_dir": str(dataset)}, indent=2))
