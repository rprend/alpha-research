#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "accelerate>=0.30.0",
#   "datasets>=2.20.0",
#   "peft>=0.11.0",
#   "transformers>=4.44.0",
#   "trl>=0.12.0",
#   "trackio",
# ]
# ///

import json
import os

import trackio
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoTokenizer
from trl import SFTConfig, SFTTrainer

DATA_URL_BASE = os.environ.get("DATA_URL_BASE", "https://gist.githubusercontent.com/rprend/6b46b4b77d7f328cd4e6964884013abe/raw")
BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
HUB_MODEL_ID = os.environ.get("HUB_MODEL_ID", "rprendergast/grounded-qa-qasper-qwen05b-lora-v1")
TRACKIO_SPACE_ID = os.environ.get("TRACKIO_SPACE_ID", "rprendergast/trackio")
MAX_LENGTH = int(os.environ.get("MAX_LENGTH", "1024"))

dataset = load_dataset("json", data_files={
    "train": f"{DATA_URL_BASE}/train.jsonl",
    "validation": f"{DATA_URL_BASE}/validation.jsonl",
})
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

def format_example(example):
    messages = example["messages"]
    if hasattr(tokenizer, "apply_chat_template"):
        try:
            return {"text": tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)}
        except Exception:
            pass
    return {"text": "\n".join(f"{m['role']}: {m['content']}" for m in messages)}

dataset = dataset.map(format_example, remove_columns=dataset["train"].column_names)

trackio.init(
    project="grounded-qa-distillation",
    run_name="qasper-repair-0-132-qwen05b-lora",
    space_id=TRACKIO_SPACE_ID,
    config={
        "base_model": BASE_MODEL,
        "data_url_base": DATA_URL_BASE,
        "hub_model_id": HUB_MODEL_ID,
        "train_rows": len(dataset["train"]),
        "validation_rows": len(dataset["validation"]),
        "max_length": MAX_LENGTH,
    },
)

config = SFTConfig(
    output_dir="grounded-qa-qwen05b-lora",
    push_to_hub=True,
    hub_model_id=HUB_MODEL_ID,
    hub_strategy="every_save",
    num_train_epochs=3,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    learning_rate=0.0002,
    max_length=MAX_LENGTH,
    logging_steps=5,
    save_strategy="steps",
    save_steps=25,
    save_total_limit=2,
    eval_strategy="steps",
    eval_steps=25,
    warmup_ratio=0.05,
    lr_scheduler_type="cosine",
    gradient_checkpointing=True,
    report_to="trackio",
    project="grounded-qa-distillation",
    run_name="qasper-repair-0-132-qwen05b-lora",
)

peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)

trainer = SFTTrainer(
    model=BASE_MODEL,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    args=config,
    peft_config=peft_config,
)
trainer.train()
trainer.push_to_hub()
trackio.finish()
print(json.dumps({"status": "complete", "hub_model_id": HUB_MODEL_ID}, indent=2))
