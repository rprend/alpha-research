# Hugging Face Qwen 3B Smoke Launch Attempt

Status: `failed_before_creation`

The bounded Qwen 3B smoke was attempted on Hugging Face Jobs using `a10g-large`, a two-hour timeout, exact git commit `773ddf0ea4248633e66a9087667f49f8a21dc116`, `MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`, `PUSH_TO_HUB=false`, and `REPORT_TO=none`.

Hugging Face rejected job creation with `403 Forbidden` because the active token is missing `job.write` permission for namespace `rprendergast`. No backend job id was created and no compute cost was incurred.

This changes the diagnosis from the earlier HF `402` failure: the current observed blocker is token permission, not proven insufficient balance. The remaining executable paths are to use an HF token with `job.write` or repair Prime auth, then rerun the same bounded smoke under the `$100` total budget cap.
