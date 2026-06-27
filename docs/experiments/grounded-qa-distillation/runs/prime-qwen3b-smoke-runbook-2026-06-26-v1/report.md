# Prime Qwen 3B Smoke Runbook

Generated: 2026-06-27T03:12:44.121Z

Status: `ready_after_prime_auth_and_live_price`

## Checks

- PASS prime_create_supports_noninteractive_flags: Prime pods create exposes noninteractive launch flags.
- PASS prime_status_supports_json: Prime pod status can emit JSON for SSH/pod metadata capture.
- PASS prime_availability_supports_json_and_price: Prime availability can emit JSON with pricing fields.
- PASS bootstrap_bash_syntax_passes: Passed: bash -n /Users/ryanprendergast/Documents/Zenobia Pay/alpha-research/docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_prime_qwen3b_smoke_on_pod.sh
- PASS bootstrap_is_executable: Pod bootstrap script has execute bits.
- PASS script_contract_ready: Current script contract status: script_contract_ready_for_paid_smoke.
- PASS launch_plan_within_budget: Estimated total if launched: $9.896385600000016.
- PASS cost_finalizer_waiting: Current finalizer status: waiting_for_smoke_artifacts.

## Budget

- Actual total spend: $5.896386
- Actual external compute spend: $0.000000
- Planned GPU estimate: $4.000000
- Estimated total if launched: $9.896386
- Remaining budget: $94.103614

## Steps

1. verify_prime_auth

   ```bash
   prime --plain whoami && prime --plain wallet
   ```

   Guard: Must succeed before any pod creation.

2. query_live_l4_price

   ```bash
   prime --plain availability list --gpu-type L4 --gpu-count 1 --output json | jq '.gpu_resources[] | {id, cloud_id, gpu_type, gpu_count, provider, location, price_per_hour, price_value, stock_status}'
   ```

   Guard: Choose an available resource whose estimated total keeps OpenAI plus GPU spend under $100.

3. create_bounded_pod

   ```bash
   prime --plain pods create --id <availability-id> --name qwen3b-grounded-qa-smoke --disk-size 160 --gpu-count 1 --image pytorch/pytorch:2.4.1-cuda12.1-cudnn9-devel --yes
   ```

   Guard: Only run after live price and total budget are checked. Record the returned pod id.

4. capture_pod_status

   ```bash
   prime --plain pods status <pod-id> --output json > docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/prime_pod_status.json
   ```

   Guard: Keep provider, GPU, image, created_at, and SSH metadata with the prediction artifacts.

5. sync_repo_to_pod

   ```bash
   Use the SSH target from pod status to rsync this repo to the pod, excluding node_modules, dist, .git, and unrelated large artifacts.
   ```

   Guard: Do not copy secrets or .env files. The smoke does not need OpenAI credentials.

6. run_remote_bootstrap

   ```bash
   bash docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_prime_qwen3b_smoke_on_pod.sh
   ```

   Guard: Run inside the synced repo on the GPU pod.

7. fetch_prediction_artifacts

   ```bash
   rsync -az <pod-ssh-target>:<remote-repo>/docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/ docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/
   ```

   Guard: Must fetch predictions.jsonl, result.json, report.md, smoke_manifest.json, and remote_smoke_bootstrap_manifest.json.

8. record_actual_compute_cost

   ```bash
   node scripts/grounded-qa-distillation-joint-action-smoke-ledger-finalizer.mjs --record=true --status=completed --actual-cost-usd=<backend-cost> --backend-run-id=<pod-id>
   ```

   Guard: Only after artifacts exist and Prime billing/cost is known.

9. terminate_pod

   ```bash
   prime --plain pods terminate <pod-id>
   ```

   Guard: Terminate immediately after artifacts are fetched or on any failure.

This runbook makes no OpenAI calls, launches no GPU jobs, and records no spend.
