#!/usr/bin/env python3
import base64
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

import requests


RUN_ID = os.environ["RUN_ID"]
RUN_TYPE = os.environ["RUN_TYPE"]
DATASET_ID = os.environ["DATASET_ID"]
PROMPT = base64.b64decode(os.environ["PROMPT_B64"]).decode("utf-8")
DATASET_MOUNT_PATH = Path(os.environ["DATASET_MOUNT_PATH"])
MANIFEST_PATH = Path(os.environ["MANIFEST_PATH"])
CODEX_HOME = Path(os.environ["CODEX_HOME"])
WORKSPACE_DIR = Path(os.environ["WORKSPACE_DIR"])
ARTIFACT_DIR = Path(os.environ["ARTIFACT_DIR"])
LAST_MESSAGE_PATH = Path(os.environ["LAST_MESSAGE_PATH"])
TRANSCRIPT_PATH = Path(os.environ["TRANSCRIPT_PATH"])
CALLBACK_EVENTS_URL = os.environ["CALLBACK_EVENTS_URL"]
CALLBACK_STATUS_URL = os.environ["CALLBACK_STATUS_URL"]
CALLBACK_ARTIFACTS_URL = os.environ["CALLBACK_ARTIFACTS_URL"]
CALLBACK_SESSION_ENTRIES_URL = os.environ["CALLBACK_SESSION_ENTRIES_URL"]
RUNNER_TOKEN = os.environ["RUNNER_TOKEN"]
REMOTE_AGENT_MODEL = os.environ.get("REMOTE_AGENT_MODEL", "gpt-5-codex")
REMOTE_AGENT_SESSION_ID = os.environ.get("REMOTE_AGENT_SESSION_ID", "").strip()
try:
    RUN_CONFIG = json.loads(base64.b64decode(os.environ.get("CONFIG_B64", "e30=")).decode("utf-8"))
except Exception:
    RUN_CONFIG = {}


SESSION_ID_RE = re.compile(r"session id:\s*([0-9a-fA-F-]{36})")
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("REMOTE_AGENT_HEARTBEAT_SECONDS", "45"))
RUN_STATE_DIR = DATASET_MOUNT_PATH / ".remote-agent" / "runs" / RUN_ID
RUN_STATUS_PATH = RUN_STATE_DIR / "status.json"
CALLBACK_RETRY_SECONDS = [0, 1, 2, 5]


def session_title() -> str:
    run_label = RUN_TYPE.replace("_", " ").replace("-", " ").strip().title() or "Remote"
    return f"{run_label} run terminal session"


def headers(content_type: str):
    return {
        "Authorization": f"Bearer {RUNNER_TOKEN}",
        "Content-Type": content_type,
    }


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def write_worker_status(status: str, output_preview: str = "", phase: str = "", callback_error: str | None = None):
    RUN_STATE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "runId": RUN_ID,
        "datasetId": DATASET_ID,
        "status": status,
        "phase": phase or status,
        "outputPreview": output_preview or None,
        "callbackError": callback_error,
        "updatedAt": utc_now(),
    }
    tmp_path = RUN_STATUS_PATH.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp_path.replace(RUN_STATUS_PATH)


def post_json_with_retries(url: str, payload=None, content_type: str = "application/json", extra_headers=None, data=None):
    last_error = None
    for delay in CALLBACK_RETRY_SECONDS:
        if delay:
            time.sleep(delay)
        try:
            response = requests.post(
                url,
                headers={**headers(content_type), **(extra_headers or {})},
                json=payload if data is None else None,
                data=data,
                timeout=20,
            )
            response.raise_for_status()
            return
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"control-plane callback failed after retries: {last_error}")


def report_callback_error(action: str, exc: Exception):
    try:
        write_worker_status("running", action, "callback_failed", str(exc))
    except Exception:
        pass


def post_event(message: str, level: str = "info"):
    try:
        post_json_with_retries(
            CALLBACK_EVENTS_URL,
            content_type="text/plain; charset=utf-8",
            extra_headers={"X-Run-Level": level},
            data=message.encode("utf-8"),
        )
    except Exception as exc:
        report_callback_error(f"event callback failed: {message[:180]}", exc)


def post_status(status: str, output_preview: str = ""):
    write_worker_status(status, output_preview, status)
    try:
        post_json_with_retries(
            CALLBACK_STATUS_URL,
            {
                "status": status,
                "outputPreview": output_preview or None,
            },
        )
    except Exception as exc:
        write_worker_status(status, output_preview, "status_callback_failed", str(exc))


def create_artifact(kind: str, title: str, content=None, url: str | None = None):
    try:
        post_json_with_retries(
            CALLBACK_ARTIFACTS_URL,
            {
                "type": kind,
                "title": title,
                "content": content,
                "url": url,
            },
        )
    except Exception as exc:
        report_callback_error(f"artifact callback failed: {title}", exc)


def post_session_entry(role: str, kind: str, content: str, title: str | None = None, metadata=None):
    try:
        post_json_with_retries(
            CALLBACK_SESSION_ENTRIES_URL,
            {
                "sessionKind": "remote_codex",
                "sessionTitle": session_title(),
                "role": role,
                "kind": kind,
                "title": title,
                "content": content[:20000],
                "metadata": metadata,
            },
        )
    except Exception as exc:
        report_callback_error(f"session callback failed: {(title or kind)[:180]}", exc)


def safe_post_event(message: str, level: str = "info"):
    post_event(message, level)


def safe_post_status(status: str, output_preview: str = ""):
    post_status(status, output_preview)


def collapse_whitespace(value: str, limit: int = 180) -> str:
    compact = " ".join(value.split())
    return compact[: limit - 1].rstrip() + "..." if len(compact) > limit else compact


def fenced(label: str, language: str, value: str) -> str:
    text = value.rstrip() or "No output."
    return f"{label}:\n\n```{language}\n{text}\n```"


def summarize_codex_json_line(line: str) -> str | None:
    try:
        payload = json.loads(line)
    except Exception:
        return None
    item = payload.get("item") if isinstance(payload, dict) else None
    if not isinstance(item, dict):
        return None
    item_type = item.get("type")
    item_status = item.get("status")
    if item_type == "command_execution":
        command = collapse_whitespace(str(item.get("command") or ""))
        if item_status == "in_progress":
            return f"Running command: {command}"
        if item_status == "completed":
            return f"Completed command: {command}"
        if item_status == "failed":
            return f"Command failed: {command}"
    if item_type == "todo_list":
        todos = item.get("items")
        if isinstance(todos, list):
            incomplete = [str(todo.get("text")) for todo in todos if isinstance(todo, dict) and not todo.get("completed")]
            if incomplete:
                return f"Next: {incomplete[0]}"
    return None


def format_codex_session_entry(line: str):
    try:
        payload = json.loads(line)
    except Exception:
        return None
    item = payload.get("item") if isinstance(payload, dict) else None
    if not isinstance(item, dict):
        return None
    item_type = item.get("type")
    item_status = item.get("status")
    item_id = str(item.get("id") or "")
    if item_type == "command_execution":
        command = str(item.get("command") or "").strip()
        output = str(item.get("aggregated_output") or "").rstrip()
        exit_code = item.get("exit_code")
        metadata = {"itemId": item_id, "itemType": item_type, "status": item_status, "exitCode": exit_code}
        if item_status == "in_progress":
            return ("assistant", "command_started", "Running command", fenced("Command", "bash", command), metadata)
        title = "Command completed" if item_status == "completed" else "Command failed"
        role = "assistant" if item_status == "completed" else "system"
        status_line = f"{title}" + (f" with exit code {exit_code}" if exit_code is not None else "") + "."
        body_parts = [status_line, fenced("Command", "bash", command)]
        if output:
            body_parts.append(fenced("Output", "text", output[-12000:]))
        else:
            body_parts.append("Output: No output.")
        return (role, "command_completed" if item_status == "completed" else "command_failed", title, "\n\n".join(body_parts), metadata)
    if item_type == "todo_list":
        todos = item.get("items")
        if not isinstance(todos, list):
            return None
        lines = []
        for todo in todos:
            if not isinstance(todo, dict):
                continue
            marker = "x" if todo.get("completed") else " "
            text = str(todo.get("text") or "").strip()
            if text:
                lines.append(f"- [{marker}] {text}")
        if lines:
            return ("assistant", "plan_update", "Plan update", "\n".join(lines), {"itemId": item_id, "itemType": item_type})
    if item_type in {"message", "assistant_message"}:
        text = item.get("text") or item.get("content")
        if isinstance(text, str) and text.strip():
            return ("assistant", "assistant_message", "Assistant update", text.strip(), {"itemId": item_id, "itemType": item_type})
    return None


def build_remote_agent_prompt():
    private_sources = RUN_CONFIG.get("privateSources") if isinstance(RUN_CONFIG, dict) else None
    public_sources = RUN_CONFIG.get("publicSources") if isinstance(RUN_CONFIG, dict) else None
    source_instructions = []
    if isinstance(private_sources, list) and private_sources:
        source_instructions.extend([
            "Private uploaded sources are listed in run_config.json under privateSources.",
            f"Download each private source into {DATASET_MOUNT_PATH / 'sources' / 'private'} before normalizing it.",
            "Treat private source download URLs as sensitive temporary credentials; do not copy them into final artifacts or the manifest.",
            "In the manifest, record private source filenames, sizes, schemas, and provenance notes, but not presigned URLs.",
        ])
    if isinstance(public_sources, list) and public_sources:
        source_instructions.extend([
            "Public source hints are listed in run_config.json under publicSources.",
            "Fetch the public/API data needed for the requested environment and document source URLs, retrieval timestamps, schemas, and refresh instructions in the manifest.",
        ])
    if not source_instructions:
        source_instructions.append(
            "For public-data environment creation, fetch data from the internet into the mounted dataset path, normalize it into durable Parquet/CSV/JSON files, and document source URLs, retrieval timestamps, schemas, and refresh instructions in the manifest."
        )
    artifact_contract = "\n".join(
        [
            "You are executing an Alpha Research remote agent run inside a dataset-attached cloud workspace.",
            f"Run type: {RUN_TYPE}",
            f"Dataset id: {DATASET_ID}",
            f"Dataset mount path: {DATASET_MOUNT_PATH}",
            f"Manifest path: {MANIFEST_PATH}",
            f"Workspace path: {WORKSPACE_DIR}",
            f"The dataset is also available at {WORKSPACE_DIR / 'dataset'} inside the workspace.",
            f"Artifact directory: {ARTIFACT_DIR}",
            "",
            "You may inspect files, run shell commands, write scripts, and produce result files.",
            "Use the mounted dataset and manifest to understand the corpus before acting.",
            "If the manifest path does not exist yet, this is a new environment: create the dataset files, then write a manifest at the manifest path.",
            f"Run config path: {WORKSPACE_DIR / 'run_config.json'}",
            *source_instructions,
            "For any command or script expected to run longer than 30 seconds, print progress at least every 30 seconds.",
            "If you generate deliverables, write them into the artifact directory.",
            "Required outputs:",
            "- summary.md: a concise human-readable summary of what you found or built, unless the user explicitly requests a self-contained HTML report",
            "- report.html: the primary human-readable deliverable when the user explicitly requests a self-contained HTML report",
            "- result.json: structured machine-readable output when appropriate",
            "Optional outputs:",
            "- tables as .csv",
            "- charts as .png or .svg",
            "- scripts as .py, .sql, or .sh",
            "",
            "At the end, make sure the requested primary human-readable artifact exists: report.html for self-contained HTML report requests, otherwise summary.md. If you create structured results, also write result.json.",
            "In your final response, state exactly which files you created in the artifact directory.",
            "",
            "User request:",
            PROMPT,
        ]
    )
    return artifact_contract


def artifact_content_for_path(path: Path):
    suffix = path.suffix.lower()
    if suffix in {".json"}:
        try:
            return json.loads(path.read_text())
        except Exception:
            return {"path": str(path), "preview": path.read_text()[:5000]}
    if suffix in {".html", ".htm", ".md", ".txt", ".csv", ".sql", ".py", ".sh", ".svg"}:
        return {"path": str(path), "text": path.read_text()[:20000]}
    return {"path": str(path), "note": "binary-or-unsupported-preview"}


def infer_artifact_type(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".json":
        return "structured_result"
    if suffix == ".csv":
        return "table"
    if suffix in {".html", ".htm"}:
        return "html_report"
    if suffix in {".png", ".svg"}:
        return "chart"
    if suffix in {".py", ".sql", ".sh"}:
        return "script"
    return "file"


def collect_artifacts():
    created = []
    if LAST_MESSAGE_PATH.exists():
        summary_text = LAST_MESSAGE_PATH.read_text()
        create_artifact(
            "remote_agent_summary",
            "Remote Agent Summary",
            {"text": summary_text},
        )
        post_session_entry("assistant", "final_summary", summary_text, "Synthesis")
        created.append("last-message")
    if TRANSCRIPT_PATH.exists():
        transcript_text = TRANSCRIPT_PATH.read_text()[-50000:]
        create_artifact(
            "remote_agent_transcript",
            "Remote Agent Transcript",
            {"text": transcript_text},
        )
        created.append("transcript")
    if ARTIFACT_DIR.exists():
        for path in sorted(ARTIFACT_DIR.rglob("*")):
            if not path.is_file():
                continue
            create_artifact(
                infer_artifact_type(path),
                path.name,
                artifact_content_for_path(path),
            )
            created.append(path.name)
    return created


def collect_deliverable_paths():
    if not ARTIFACT_DIR.exists():
        return []
    return [
        path
        for path in sorted(ARTIFACT_DIR.rglob("*"))
        if path.is_file()
    ]


def expected_primary_artifact_name():
    prompt = PROMPT.lower()
    if "report.html" in prompt or "html report" in prompt or "self-contained html" in prompt:
        return "report.html"
    return "summary.md"


def run_codex():
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    (WORKSPACE_DIR / "run_config.json").write_text(json.dumps(RUN_CONFIG, indent=2), encoding="utf-8")
    dataset_link = WORKSPACE_DIR / "dataset"
    if not dataset_link.exists():
        dataset_link.symlink_to(DATASET_MOUNT_PATH, target_is_directory=True)
    prompt_text = build_remote_agent_prompt()
    command = [
        "codex",
        "exec",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
        "--json",
        "--output-last-message",
        str(LAST_MESSAGE_PATH),
        "-C",
        str(WORKSPACE_DIR),
        "-m",
        REMOTE_AGENT_MODEL,
    ]
    if REMOTE_AGENT_SESSION_ID:
        command.extend(["resume", REMOTE_AGENT_SESSION_ID, prompt_text])
    else:
        command.append(prompt_text)

    env = os.environ.copy()
    env["CODEX_HOME"] = str(CODEX_HOME)
    env["ARTIFACT_DIR"] = str(ARTIFACT_DIR)
    env["DATASET_MOUNT_PATH"] = str(DATASET_MOUNT_PATH)
    env["MANIFEST_PATH"] = str(MANIFEST_PATH)
    env["RUN_TYPE"] = RUN_TYPE

    post_event("Starting remote agent executor.")
    post_status("running", "Starting remote agent executor.")
    post_session_entry("user", "prompt", PROMPT, "Remote run request", {
        "runType": RUN_TYPE,
        "datasetId": DATASET_ID,
    })

    session_id = None
    started_at = time.monotonic()
    last_output_at = started_at
    last_status = "Starting remote agent executor."
    stop_heartbeat = threading.Event()

    def heartbeat_loop():
        while not stop_heartbeat.wait(HEARTBEAT_INTERVAL_SECONDS):
            elapsed = int(time.monotonic() - started_at)
            idle_for = int(time.monotonic() - last_output_at)
            preview = f"Remote agent running for {elapsed}s. Last activity {idle_for}s ago. {last_status}"
            safe_post_status("running", preview[:500])
            safe_post_event(f"Remote agent heartbeat: {preview[:500]}")

    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()
    with TRANSCRIPT_PATH.open("w", encoding="utf-8") as transcript:
      process = subprocess.Popen(
          command,
          stdout=subprocess.PIPE,
          stderr=subprocess.STDOUT,
          text=True,
          env=env,
      )
      assert process.stdout is not None
      for line in process.stdout:
          transcript.write(line)
          transcript.flush()
          stripped = line.strip()
          if not stripped:
              continue
          last_output_at = time.monotonic()
          match = SESSION_ID_RE.search(stripped)
          if match and not session_id:
              session_id = match.group(1)
              create_artifact("remote_agent_session", "Remote Agent Session", {"sessionId": session_id})
              post_event(f"Remote agent session {session_id} started.")
              post_session_entry("assistant", "session", f"Remote agent session {session_id} started.", "Session started", {
                  "sessionId": session_id,
              })
          if stripped.startswith("{"):
              summary = summarize_codex_json_line(stripped)
              if summary:
                  last_status = summary
                  safe_post_status("running", summary)
                  post_event(summary)
              formatted_entry = format_codex_session_entry(stripped)
              if formatted_entry:
                  role, kind, title, content, metadata = formatted_entry
                  post_session_entry(role, kind, content, title, metadata)
          elif stripped.startswith("ERROR:"):
              post_event(stripped, "error")
              post_session_entry("system", "stderr", stripped[:5000], "Remote error")
          elif "session id:" in stripped.lower():
              post_event(stripped)
              post_session_entry("assistant", "stdout", stripped[:5000], "Session output")
          else:
              post_session_entry("assistant", "stdout", stripped[:5000], "Remote output")
      return_code = process.wait()
      stop_heartbeat.set()
      heartbeat_thread.join(timeout=2)
    if return_code != 0:
        raise RuntimeError(f"codex exec failed with exit code {return_code}")
    return session_id


def main():
    session_id = run_codex()
    created = collect_artifacts()
    deliverables = collect_deliverable_paths()
    if not deliverables:
        raise RuntimeError(
            "Remote agent run completed without producing deliverables in ARTIFACT_DIR; "
            "bookkeeping artifacts do not count as completion"
        )
    expected_primary = expected_primary_artifact_name()
    if not any(path.name == expected_primary for path in deliverables):
        raise RuntimeError(f"Remote agent run completed without required primary artifact: {expected_primary}")
    summary = f"Remote agent run completed with {len(deliverables)} deliverable artifact(s)."
    if session_id:
        summary += f" Session: {session_id}."
    post_event(summary)
    post_status("ready", summary)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        write_worker_status("failed", str(exc), "failed", str(exc))
        post_event(f"Remote agent run failed: {exc}", "error")
        post_status("failed", str(exc))
        raise
