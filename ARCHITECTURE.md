# Alpha Research Architecture

Alpha Research is structured as a harness engineering project: humans specify research goals, while agents operate the dashboard, control plane, remote runners, and feedback loops.

## Runtime Surfaces

- React dashboard in `src/App.tsx`
- Cloudflare Worker entrypoint in `src/worker.ts`
- Durable Object control plane in `src/control-plane.ts`
- DigitalOcean orchestration in `src/digitalocean.ts`
- Remote Codex runner in `scripts/run_remote_agent.py`
- Research job helper in `scripts/run_research_job.py`

## Harness State

The durable control plane is the source of truth for agent-operable state:

- `datasets`: registered datasets and deployment metadata
- `runs`: queued, running, completed, failed, and cancelled work
- `run_events`: human and agent-readable progress log
- `run_metadata`: config and requested artifact contracts
- `run_artifacts`: produced result files, transcripts, charts, and structured results
- `assistant_sessions`: browser and CLI assistant conversations
- `assistant_session_entries`: transcript entries for agent replay/debugging
- `runner_pool`: warm runner availability and assignment

## Dependency Direction

The intended dependency flow is:

`UI -> Worker routes -> ControlPlane -> Providers -> External infrastructure`

UI code should not know DigitalOcean, WorkOS, or object storage details. Remote runner scripts should report through the internal callback API rather than mutating control plane state directly.

## Agent Legibility

Codex should be able to answer these questions from repo-local files and local commands:

- What does a run mean?
- Which endpoint owns each state transition?
- How do I reproduce dashboard state locally without production credentials?
- What signals prove that a remote runner is alive, stuck, failed, or complete?
- Which scripts validate a change?

The `docs/` directory is the system of record for those answers.
