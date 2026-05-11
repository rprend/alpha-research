#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Submit an Alpha Research Codex job to Modal.")
    parser.add_argument("--job-id", required=True, help="Stable job id; outputs land in /results/<job-id>.")
    parser.add_argument("--prompt", required=True, help="Prompt passed to Codex CLI.")
    parser.add_argument(
        "--extra-context-json",
        default="{}",
        help="Optional JSON object with callbacks, run metadata, model, and artifact spec.",
    )
    parser.add_argument(
        "--async",
        dest="async_submit",
        action="store_true",
        help="Spawn the Modal function and return immediately.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        extra_context = json.loads(args.extra_context_json)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid --extra-context-json: {exc}") from exc
    if not isinstance(extra_context, dict):
        raise SystemExit("--extra-context-json must decode to an object")

    from modal_workers.agent_worker import run_codex_job

    if args.async_submit:
        call = run_codex_job.spawn(args.job_id, args.prompt, extra_context)
        print(
            json.dumps(
                {
                    "jobId": args.job_id,
                    "callId": call.object_id,
                    "resultPath": f"/results/{args.job_id}",
                },
                indent=2,
            )
        )
        return 0

    result = run_codex_job.remote(args.job_id, args.prompt, extra_context)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
