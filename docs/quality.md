# Quality Gates

Alpha Research quality is measured by whether agents can safely understand, operate, and modify the system.

## Required Gates

- `pnpm build`
- `pnpm test`
- `pnpm run qa:dashboard`

## Harness Quality Bar

- The dashboard must run in deterministic harness mode without auth or cloud secrets.
- Seeded datasets, runs, artifacts, and sessions must be valid enough to exercise primary UI routes.
- Control plane debug payloads must include enough context for agents to triage a run.
- Docs should be updated when contracts change.

## Known Gaps

- Full OTLP/Vector local observability stack is not yet implemented.
- E2E browser tests are smoke-level until Playwright or gstack browse assertions are added as project-local scripts.
- Structural architecture linting is minimal and should expand as boundaries stabilize.
