#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers>=4.44.0", "accelerate"]
# ///
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT_DIR = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
PACKET_DIR = EXPERIMENT_DIR / "runs" / "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1"
DATASET_DIR = Path(os.environ.get("DATASET_DIR", PACKET_DIR / "dataset"))
RUN_ID = os.environ.get("RUN_ID", "local-qwen3b-base-control-joint-action-12-v1")
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", EXPERIMENT_DIR / "runs" / RUN_ID))
BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")
MAX_EVAL_EXAMPLES = int(os.environ.get("MAX_EVAL_EXAMPLES", "12"))
MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "192"))


def read_jsonl(path):
    with path.open() as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_jsonl(path, rows):
    with path.open("w") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def parse_prediction(text):
    payload = text.strip()
    if "```" in payload:
        payload = re.sub(r"^```(?:json)?", "", payload.strip(), flags=re.IGNORECASE).strip()
        payload = re.sub(r"```$", "", payload.strip()).strip()
    if "{" in payload and "}" in payload:
        payload = payload[payload.find("{"):payload.rfind("}") + 1]
    try:
        value = json.loads(payload)
        parse_error = None
    except Exception as exc:
        value = {
            "answer_type": "abstain",
            "answer": "",
            "citations": [],
            "claim_table": [],
            "abstention_reason": "Model response was not valid JSON.",
        }
        parse_error = str(exc)
    return normalize_prediction(value), parse_error


def normalize_prediction(value):
    answer_type = "abstain" if value.get("answer_type") == "abstain" else "grounded_answer"
    citations = []
    if isinstance(value.get("citations"), list):
        for citation in value["citations"]:
            if isinstance(citation, str):
                citations.append(normalize_citation_id(citation))
            elif isinstance(citation, dict) and citation.get("evidence_id"):
                citations.append(normalize_citation_id(str(citation["evidence_id"])))
    return {
        "answer_type": answer_type,
        "answer": str(value.get("answer", "")),
        "citations": [] if answer_type == "abstain" else citations,
        "claim_table": value.get("claim_table") if isinstance(value.get("claim_table"), list) else [],
        "abstention_reason": str(value.get("abstention_reason", "")) if answer_type == "abstain" else None,
    }


def normalize_citation_id(citation):
    return citation.strip().strip("[]")


def score_prediction(row, prediction):
    reference = row["reference"]
    reference_citations = {
        citation["evidence_id"]
        for citation in reference.get("citations", [])
        if citation.get("evidence_id")
    }
    cited_gold = [citation for citation in prediction["citations"] if citation in reference_citations]
    answerable = reference["answer_type"] != "abstain"
    abstained = prediction["answer_type"] == "abstain"
    return {
        "answer_type_correct": prediction["answer_type"] == reference["answer_type"],
        "citation_precision": len(cited_gold) / len(prediction["citations"]) if prediction["citations"] else None,
        "citation_recall": len(cited_gold) / len(reference_citations) if reference_citations else None,
        "answer_token_f1": token_f1(prediction["answer"], strip_citations(reference["answer"])) if answerable and not abstained else (0 if answerable else None),
        "abstention_correct": (not abstained) if answerable else abstained,
        "inline_citation_rate": inline_citation_rate(prediction),
        "valid_json": prediction["answer_type"] in {"grounded_answer", "abstain"},
    }


def inline_citation_rate(prediction):
    if prediction["answer_type"] != "grounded_answer":
        return None
    if not prediction["citations"]:
        return 0
    return sum(1 for citation in prediction["citations"] if f"[{citation}]" in prediction["answer"]) / len(prediction["citations"])


def strip_citations(text):
    return re.sub(r"\[[^\]]+\]", "", text or "").strip()


def token_f1(prediction, reference):
    pred_tokens = tokenize(strip_citations(prediction))
    ref_tokens = tokenize(strip_citations(reference))
    if not pred_tokens and not ref_tokens:
        return 1
    if not pred_tokens or not ref_tokens:
        return 0
    counts = {}
    for token in ref_tokens:
        counts[token] = counts.get(token, 0) + 1
    overlap = 0
    for token in pred_tokens:
        if counts.get(token, 0) > 0:
            overlap += 1
            counts[token] -= 1
    if overlap == 0:
        return 0
    precision = overlap / len(pred_tokens)
    recall = overlap / len(ref_tokens)
    return 2 * precision * recall / (precision + recall)


def tokenize(text):
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def mean(values):
    filtered = [value for value in values if value is not None]
    return sum(filtered) / len(filtered) if filtered else None


def summarize(predictions, elapsed_seconds):
    scores = [row["scores"] for row in predictions]
    answered = [row for row in predictions if row["prediction"]["answer_type"] == "grounded_answer"]
    valid_json = [row for row in predictions if row["parse_error"] is None]
    return {
        "examples": len(predictions),
        "answered": len(answered),
        "abstained": len(predictions) - len(answered),
        "answer_rate": len(answered) / len(predictions) if predictions else 0,
        "answer_type_accuracy": mean([score["answer_type_correct"] for score in scores]),
        "citation_precision": mean([score["citation_precision"] for score in scores]),
        "citation_recall": mean([score["citation_recall"] for score in scores]),
        "answer_token_f1": mean([score["answer_token_f1"] for score in scores]),
        "abstention_accuracy": mean([score["abstention_correct"] for score in scores]),
        "inline_citation_rate": mean([score["inline_citation_rate"] for score in scores]),
        "valid_json_rate": len(valid_json) / len(predictions) if predictions else 0,
        "elapsed_seconds": elapsed_seconds,
        "seconds_per_example": elapsed_seconds / len(predictions) if predictions else None,
    }


def pct(value):
    return "n/a" if value is None else f"{100 * value:.1f}%"


def render_report(result):
    metrics = result["eval"]
    return f"""# Local Qwen 3B Base-Control Eval

Run: `{result["run_id"]}`

This is a no-training base-model control on the joint-action future-window prompt. It is not a substitute for the missing trained Qwen 3B smoke.

| Model | Examples | Answered | Abstained | Valid JSON | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Seconds/example |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `{result["base_model"]}` | {metrics["examples"]} | {metrics["answered"]} | {metrics["abstained"]} | {pct(metrics["valid_json_rate"])} | {pct(metrics["answer_type_accuracy"])} | {pct(metrics["citation_precision"])} | {pct(metrics["citation_recall"])} | {pct(metrics["answer_token_f1"])} | {pct(metrics["inline_citation_rate"])} | {metrics["seconds_per_example"]:.2f} |

## Interpretation

- This run tests whether the 3B base model can follow the evidence/JSON/citation contract before LoRA training.
- It makes no OpenAI API calls and creates no paid GPU job.
- The paper-critical blocker remains the trained joint-action Qwen 3B smoke plus grounded-correctness judge.
"""


def select_device():
    if torch.backends.mps.is_available():
        return torch.device("mps"), torch.float16
    if torch.cuda.is_available():
        return torch.device("cuda"), torch.float16
    return torch.device("cpu"), torch.float32


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
eval_rows = read_jsonl(DATASET_DIR / "eval_prompts.jsonl")
if MAX_EVAL_EXAMPLES > 0:
    eval_rows = eval_rows[:MAX_EVAL_EXAMPLES]

device, dtype = select_device()
started = time.time()
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=dtype)
model.to(device)
model.eval()

predictions = []
for row in eval_rows:
    prompt = tokenizer.apply_chat_template(row["messages"], tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    inputs = {key: value.to(device) for key, value in inputs.items()}
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    generated = tokenizer.decode(output[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
    prediction, parse_error = parse_prediction(generated)
    predictions.append({
        "example_id": row["example_id"],
        "prediction": prediction,
        "reference": row["reference"],
        "scores": score_prediction(row, prediction),
        "raw_output": generated,
        "parse_error": parse_error,
        "metadata": {
            "base_model": BASE_MODEL,
            "trained_adapter": None,
            "device": str(device),
            "dtype": str(dtype).replace("torch.", ""),
        },
    })

elapsed = time.time() - started
result = {
    "run_id": RUN_ID,
    "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "control_type": "local_qwen3b_base_no_training",
    "model_family": "qwen2_5_3b_base_control",
    "base_model": BASE_MODEL,
    "trained_adapter": None,
    "dataset_dir": str(DATASET_DIR),
    "eval": summarize(predictions, elapsed),
    "runtime": {
        "device": str(device),
        "dtype": str(dtype).replace("torch.", ""),
        "max_eval_examples": MAX_EVAL_EXAMPLES,
        "max_new_tokens": MAX_NEW_TOKENS,
    },
    "cost": {
        "openai_calls": 0,
        "openai_cost_usd": 0,
        "external_compute_cost_usd": 0,
        "note": "Local base-control inference only; no paid GPU job and no API calls.",
    },
    "conclusion": "Base-model control only. Use as scale/contract evidence, not as trained-student evidence.",
    "next_required_step": "Run the bounded trained joint-action Qwen 3B smoke on a verified remote backend, then run grounded-correctness judging.",
}

write_jsonl(OUTPUT_DIR / "predictions.jsonl", predictions)
(OUTPUT_DIR / "result.json").write_text(json.dumps(result, indent=2) + "\n")
(OUTPUT_DIR / "report.md").write_text(render_report(result))
print(json.dumps(result, indent=2))
