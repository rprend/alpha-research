#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers>=4.44.0", "peft>=0.11.0", "accelerate"]
# ///
import json
import os
import re
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
ADAPTER_DIR = os.environ.get("ADAPTER_DIR", "joint-action-dpo-adapter")
DATASET_DIR = Path(os.environ.get("DATASET_DIR", Path(__file__).resolve().parent / "dataset"))
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "joint-action-qwen3b-eval"))
MAX_EVAL_EXAMPLES = int(os.environ.get("MAX_EVAL_EXAMPLES", "0"))
MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "384"))
MODEL_DEVICE_MAP = os.environ.get("MODEL_DEVICE_MAP", "auto").lower()


def model_kwargs():
    kwargs = {"torch_dtype": "auto"}
    if MODEL_DEVICE_MAP in {"none", "false", "off"}:
        kwargs["device_map"] = None
    else:
        kwargs["device_map"] = MODEL_DEVICE_MAP
    return kwargs


def read_jsonl(path):
    with path.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def write_jsonl(path, rows):
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


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
        value = {"answer_type": "abstain", "answer": "", "citations": [], "claim_table": [], "abstention_reason": "Model response was not valid JSON."}
        parse_error = str(exc)
    prediction = normalize_prediction(value)
    return prediction, parse_error


def normalize_prediction(value):
    answer_type = "abstain" if value.get("answer_type") == "abstain" else "grounded_answer"
    citations = []
    if isinstance(value.get("citations"), list):
        for citation in value["citations"]:
            if isinstance(citation, str):
                citations.append(citation)
            elif isinstance(citation, dict) and citation.get("evidence_id"):
                citations.append(str(citation["evidence_id"]))
    return {
        "answer_type": answer_type,
        "answer": str(value.get("answer", "")),
        "citations": [] if answer_type == "abstain" else citations,
        "claim_table": value.get("claim_table") if isinstance(value.get("claim_table"), list) else [],
        "abstention_reason": str(value.get("abstention_reason", "")) if answer_type == "abstain" else None,
    }


def score_prediction(row, prediction):
    reference = row["reference"]
    reference_citations = set()
    for citation in reference.get("citations", []):
        if isinstance(citation, str):
            reference_citations.add(citation)
        elif isinstance(citation, dict) and citation.get("evidence_id"):
            reference_citations.add(citation["evidence_id"])
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


def summarize(predictions):
    scores = [row["scores"] for row in predictions]
    answered = [row for row in predictions if row["prediction"]["answer_type"] == "grounded_answer"]
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
        "valid_json_rate": mean([score["valid_json"] for score in scores]),
    }


def render_report(result):
    metrics = result["eval"]
    return f"""# Joint-Action Qwen 7B Span/Claim Adapter Eval

Adapter: `{result["adapter_dir"]}`

| Examples | Answered | Abstained | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| {metrics["examples"]} | {metrics["answered"]} | {metrics["abstained"]} | {pct(metrics["answer_type_accuracy"])} | {pct(metrics["citation_precision"])} | {pct(metrics["citation_recall"])} | {pct(metrics["answer_token_f1"])} | {pct(metrics["inline_citation_rate"])} |

This evaluator makes no OpenAI calls. A grounded-correctness judge run is still required before paper claims.
"""


def pct(value):
    return "n/a" if value is None else f"{100 * value:.1f}%"


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
eval_rows = read_jsonl(DATASET_DIR / "eval_prompts.jsonl")
if MAX_EVAL_EXAMPLES > 0:
    eval_rows = eval_rows[:MAX_EVAL_EXAMPLES]

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, **model_kwargs())
model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
model.eval()

predictions = []
for row in eval_rows:
    prompt = tokenizer.apply_chat_template(row["messages"], tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    inputs = {key: value.to(model.device) for key, value in inputs.items()}
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
            "adapter_dir": ADAPTER_DIR,
        },
    })

result = {
    "run_id": OUTPUT_DIR.name,
    "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "model_family": "qwen2_5_7b_v13_support_delta_joint_action_lora",
    "base_model": BASE_MODEL,
    "adapter_dir": ADAPTER_DIR,
    "eval": summarize(predictions),
    "cost": {
        "openai_calls": 0,
        "openai_cost_usd": 0,
        "external_compute_cost_usd": 0,
        "note": "Adapter evaluation uses local/remote GPU inference only; actual GPU cost is tracked by the launch ledger.",
    },
    "next_required_step": "Run grounded-correctness judging over predictions.jsonl.",
}

write_jsonl(OUTPUT_DIR / "predictions.jsonl", predictions)
(OUTPUT_DIR / "result.json").write_text(json.dumps(result, indent=2) + "\n")
(OUTPUT_DIR / "report.md").write_text(render_report(result))
print(json.dumps(result, indent=2))
