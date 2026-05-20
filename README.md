# alpha-research

Worker-backed landing page and auth/orchestration edge for alpha-research.

Purpose: enable decision makers to test 100x more hypotheses.

We built an open-source research platform for large datasets.

## Scripts

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm run cf:deploy`

## Cloudflare

- Worker: `alpha-research`
- Production domain: `alpharesearch.nyc`
- Account: `Founders@zenobiapay.com's Account`
- Production deploy: `pnpm run cf:deploy`
- The site now runs as a Cloudflare Worker with static assets bound through Wrangler

## Auth

The Worker includes:

- `GET /api/auth/start`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/auth/callback`
- `GET /cli/login`
- `POST /api/cli/plan`
- `GET /api/cli/me`
- `GET/POST /api/cli/datasets`
- `POST /api/cli/datasets/:id/source-upload`
- `POST /api/cli/datasets/:id/source-complete`
- `POST /api/cli/datasets/:id/deploy`
- `GET /api/cli/runs`
- `GET /api/cli/runs/:id`
- `GET /api/cli/runs/:id/events`
- `POST /api/admin/canonical-datasets/bootstrap`
- `POST /api/admin/subscriptions/grant`

These are implemented in Worker-routed handlers under `functions/` and surfaced through [src/worker.ts](/Users/ryanprendergast/Documents/Zenobia%20Pay/alpha-research/src/worker.ts).

Required Worker secrets:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `ALPHA_RESEARCH_SESSION_SECRET`
- `WORKOS_REDIRECT_URI`
- `OPENAI_API_KEY` for backend planning/proxying
- `RESEARCH_INTERNAL_RUNNER_TOKEN` for ingest runner callbacks
- `MODAL_AGENT_ENDPOINT_URL` for remote worker submission
- `MODAL_AGENT_SUBMIT_TOKEN` when the Modal endpoint requires a bearer token
- `ALPHA_RESEARCH_ADMIN_TOKEN` for service/admin canonical dataset bootstrap calls
- object-store credentials: `OBJECT_STORE_BUCKET`, `OBJECT_STORE_ENDPOINT`, `OBJECT_STORE_ACCESS_KEY_ID`, and `OBJECT_STORE_SECRET_ACCESS_KEY`

Optional Worker vars/secrets:

- `RESEARCH_DATASET_REPO_REF` default `codex/initial-substrate`

The RESEARCH CLI opens a browser to `https://alpharesearch.nyc/cli/login`, and that endpoint mints a short-lived CLI token if the user already has a valid site session. The CLI planner should call `/api/cli/plan` so signed-in users do not need a local OpenAI key.

## Remote Dataset Deploy Flow

1. `research` registers dataset metadata with the Worker.
2. The CLI requests a pre-signed object-store upload URL and uploads the raw source file.
3. The Worker submits a Modal dataset job with the shared dataset volume mounted at `/data`.
4. The Modal worker downloads the raw source file, runs `normalize_dataset.py`, and writes the normalized dataset under `/data/datasets/<dataset_id>`.
5. The Modal worker reports run events and final manifest location back to the Worker.
7. The CLI persists the deploy run id and polls event/status updates on reopen.

Remote research jobs run on Modal with `/data` mounted read-only for analysis, `/workspace` as writable scratch, and `/results/<job_id>/` for final outputs.

Canonical public datasets are added through `POST /api/admin/canonical-datasets/bootstrap` with a bearer `ALPHA_RESEARCH_ADMIN_TOKEN`. The endpoint creates or updates the platform-owned dataset row, provisions `/data/datasets/<dataset_id>` on the shared Modal dataset volume, and starts a service-owned `canonical-dataset-bootstrap` Codex job. These jobs write dataset maintenance artifacts such as `dataset_briefing.md`, source inventories, docs mirrors, and Slack briefings rather than user-facing `report.html` research reports.

Admin subscription grants are added through `POST /api/admin/subscriptions/grant` with the same bearer token. The endpoint accepts `email` or `userId` and writes an active Pro subscription record for the account.

## Local Testing

Build the site:

```bash
pnpm build
```

For full auth route testing, run via Wrangler Worker dev so the routed auth handlers and worker secrets are active.

## Codex Plugin

The Alpha Research Codex plugin is published as a Codex plugin marketplace:

```bash
codex plugin marketplace add rprend/alpha-research-codex-plugin
```

Then open the Codex desktop app plugin page, find **Alpha Research**, and install or enable it.

The marketplace repository is:

```text
https://github.com/rprend/alpha-research-codex-plugin
```

The plugin MCP server is standalone and uses the saved `research login` session at `~/.research/session.json`. It does not require a local `alpha-datasets` checkout.

Smoke-test a checkout of the marketplace manually:

```bash
git clone https://github.com/rprend/alpha-research-codex-plugin.git
cd alpha-research-codex-plugin
node plugins/alpha-research/mcp/server.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
EOF
```

The plugin must not print session tokens, auth headers, or signed upload/download URLs. See `docs/codex-plugin-smoke-report.md` for the latest live-account verification transcript.

## Notes

- This project now runs as a Worker with static assets.
- `wrangler.jsonc` stores Worker route and asset configuration.
