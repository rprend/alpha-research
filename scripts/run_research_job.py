#!/usr/bin/env python3
import base64
import gzip
import json
import os
from pathlib import Path
from urllib.parse import urlparse

import requests


def decode_b64(value: str, fallback):
    if not value:
        return fallback
    return json.loads(base64.b64decode(value).decode("utf-8"))


RUN_ID = os.environ["RUN_ID"]
RUN_TYPE = os.environ["RUN_TYPE"]
DATASET_ID = os.environ["DATASET_ID"]
PROMPT = base64.b64decode(os.environ["PROMPT_B64"]).decode("utf-8")
CONFIG = decode_b64(os.environ.get("CONFIG_B64", ""), {})
ARTIFACT_SPEC = decode_b64(os.environ.get("ARTIFACT_SPEC_B64", ""), [])
MANIFEST_PATH = Path(os.environ["MANIFEST_PATH"])
CALLBACK_EVENTS_URL = os.environ["CALLBACK_EVENTS_URL"]
CALLBACK_STATUS_URL = os.environ["CALLBACK_STATUS_URL"]
CALLBACK_ARTIFACTS_URL = os.environ["CALLBACK_ARTIFACTS_URL"]
RUNNER_TOKEN = os.environ["RUNNER_TOKEN"]
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = os.environ.get("RESEARCH_AGENT_MODEL", "gpt-5")


def headers(content_type: str):
    return {
        "Authorization": f"Bearer {RUNNER_TOKEN}",
        "Content-Type": content_type,
    }


def post_event(message: str, level: str = "info"):
    requests.post(
        CALLBACK_EVENTS_URL,
        headers={**headers("text/plain; charset=utf-8"), "X-Run-Level": level},
        data=message.encode("utf-8"),
        timeout=20,
    ).raise_for_status()


def post_status(status: str, output_preview: str = ""):
    requests.post(
        CALLBACK_STATUS_URL,
        headers=headers("application/json"),
        json={
            "status": status,
            "outputPreview": output_preview or None,
        },
        timeout=20,
    ).raise_for_status()


def create_artifact(kind: str, title: str, content=None, url: str | None = None):
    requests.post(
        CALLBACK_ARTIFACTS_URL,
        headers=headers("application/json"),
        json={
            "type": kind,
            "title": title,
            "content": content,
            "url": url,
        },
        timeout=20,
    ).raise_for_status()
    print(f"ARTIFACT {kind}: {title}")


def load_manifest():
    return json.loads(MANIFEST_PATH.read_text())


def sample_records(limit: int = 10):
    manifest = load_manifest()
    samples = list(manifest.get("samples", {}).get("records", []))
    if len(samples) >= limit:
        return samples[:limit]
    for shard in manifest.get("shards", []):
        if shard.get("kind") != "records":
            continue
        shard_path = MANIFEST_PATH.parent / shard["path"]
        if shard["compression"] == "gzip":
            fh = gzip.open(shard_path, "rt", encoding="utf-8")
        else:
            fh = shard_path.open("r", encoding="utf-8")
        with fh:
            for line in fh:
                if not line.strip():
                    continue
                samples.append(json.loads(line))
                if len(samples) >= limit:
                    return samples
    return samples


def inspect_dataset():
    manifest = load_manifest()
    return {
        "datasetId": manifest["descriptor"]["id"],
        "displayName": manifest["descriptor"]["displayName"],
        "description": manifest["descriptor"]["description"],
        "fields": manifest["descriptor"].get("fields", []),
        "measures": manifest["descriptor"].get("measures", []),
        "capabilities": manifest["descriptor"].get("capabilities", {}),
        "stats": manifest.get("stats", {}),
        "sampleRows": sample_records(8),
    }


def fetch_url_to_artifact(url: str):
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    parsed = urlparse(url)
    filename = Path(parsed.path).name or "download"
    text = response.text[:20000]
    create_artifact("fetched_source", f"Fetched {filename}", {"url": url, "preview": text})
    return {"url": url, "status": response.status_code, "preview": text[:1000]}


def responses_call(payload: dict):
    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    return response.json()


def extract_text(payload: dict) -> str:
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"].strip()
    chunks = []
    for item in payload.get("output", []):
        if item.get("type") == "message":
            for content in item.get("content", []):
                if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                    chunks.append(content["text"].strip())
    return "\n".join([chunk for chunk in chunks if chunk]).strip()


def extract_calls(payload: dict):
    return [item for item in payload.get("output", []) if item.get("type") == "function_call"]


def run_agentic_job():
    if not OPENAI_API_KEY:
        raise RuntimeError("Missing OPENAI_API_KEY for remote research run")

    instructions = "\n".join(
        [
            "You are a remote RESEARCH run executor operating inside a dataset-attached cloud environment.",
            "Use tools to inspect datasets, fetch public data, and create artifacts.",
            "Be concise and produce useful result artifacts.",
            f"Run type: {RUN_TYPE}",
        ]
    )

    tools = [
        {
            "type": "function",
            "name": "inspect_dataset",
            "description": "Inspect the mounted dataset, including fields, measures, stats, and sample rows.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
        {
            "type": "function",
            "name": "sample_records",
            "description": "Read sample rows from the mounted dataset.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer"}},
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "fetch_url",
            "description": "Fetch a public URL and store a preview as an artifact.",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string"}},
                "required": ["url"],
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "create_artifact",
            "description": "Create a structured run artifact like a summary, chart spec, table spec, or result bundle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "title": {"type": "string"},
                    "content": {},
                },
                "required": ["type", "title"],
                "additionalProperties": False,
            },
        },
    ]

    tool_outputs = []
    response = responses_call(
        {
            "model": MODEL,
            "instructions": instructions,
            "input": {
                "prompt": PROMPT,
            "prompt": PROMPT,
            "config": CONFIG,
            "artifactSpec": ARTIFACT_SPEC,
        },
        "tools": tools,
        "parallel_tool_calls": False,
        }
    )

    for _ in range(10):
        calls = extract_calls(response)
        if not calls:
            break
        tool_outputs = []
        for call in calls:
            name = call["name"]
            arguments = json.loads(call.get("arguments") or "{}")
            if name == "inspect_dataset":
                output = inspect_dataset()
            elif name == "sample_records":
                output = sample_records(int(arguments.get("limit", 10)))
            elif name == "fetch_url":
                output = fetch_url_to_artifact(arguments["url"])
            elif name == "create_artifact":
                create_artifact(arguments["type"], arguments["title"], arguments.get("content"))
                output = {"ok": True}
            else:
                output = {"error": f"Unknown tool {name}"}
            tool_outputs.append(
                {
                    "type": "function_call_output",
                    "call_id": call["call_id"],
                    "output": json.dumps(output),
                }
            )
            print(f"STEP tool:{name}")
        response = responses_call(
            {
                "model": MODEL,
                "previous_response_id": response["id"],
                "input": tool_outputs,
                "tools": tools,
                "parallel_tool_calls": False,
            }
        )

    final_text = extract_text(response) or "Run complete."
    create_artifact("summary", f"{RUN_TYPE.title()} Summary", {"text": final_text})
    print(f"RESULT {final_text[:200]}")


def run_fetch_job():
    source_description = CONFIG.get("sourceDescription", "") if isinstance(CONFIG, dict) else ""
    urls = []
    for token in f"{source_description} {PROMPT}".split():
        if token.startswith("http://") or token.startswith("https://"):
            urls.append(token.strip(".,)"))
    if not urls:
        create_artifact("fetch_plan", "Fetch Plan", {"prompt": PROMPT, "config": CONFIG})
        print("RESULT No explicit URL found; created a fetch plan artifact.")
        return
    fetched = [fetch_url_to_artifact(url) for url in urls[:5]]
    create_artifact("fetch_result", "Fetched Sources", fetched)
    print(f"RESULT fetched {len(fetched)} source(s)")


def main():
    post_event(f"STEP starting {RUN_TYPE} run")
    post_status("running", f"{RUN_TYPE} run started")
    if RUN_TYPE == "fetch":
        run_fetch_job()
    else:
        run_agentic_job()
    post_event("DONE run complete")
    post_status("ready", "run complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        post_event(f"ERROR {exc}", "error")
        post_status("failed", str(exc))
        raise
