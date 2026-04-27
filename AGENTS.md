# Alpha Research Agent Map

Alpha Research is an agent-operated research control plane. Keep this file short and use it as the map for deeper repository-local knowledge.

## Start Here

- Product and domain: `docs/product/dashboard.md`
- System architecture: `ARCHITECTURE.md`
- Control plane contract: `docs/control-plane.md`
- Remote agent runner contract: `docs/remote-agent-runner.md`
- Observability and debug payloads: `docs/observability.md`
- Run lifecycle: `docs/run-lifecycle.md`
- Quality gates: `docs/quality.md`
- Active execution plans: `docs/exec-plans/active/`

## Working Rules

- Prefer repository-local docs, schemas, scripts, and tests over external context.
- Treat datasets, runs, run events, artifacts, assistant sessions, and remote Codex transcripts as the core harness state.
- Every user-visible change should be verifiable with `pnpm build` and the relevant harness checks in `pnpm test`.
- When behavior changes, update the corresponding document in `docs/`.
- Keep agent-facing instructions enforceable with scripts or tests when possible.

## Standard Validation

Run these before shipping changes:

```bash
pnpm build
pnpm test
pnpm run qa:dashboard
```

If a change touches Cloudflare Worker routing or deployment behavior, also run:

```bash
pnpm run cf:deploy:preview
```
