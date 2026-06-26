# Hard Grounded Research Model Baselines

This benchmark separates prompt generation, external model execution, and scoring so frontier or open-model baselines can be reproduced without editing benchmark submissions by hand.

## Generate Prompt Packets

```bash
node scripts/hard-grounded-research-openai-baseline.mjs
node scripts/hard-grounded-research-openai-baseline.mjs --calibration
```

Each JSONL row contains a stable `custom_id` matching the benchmark task id. External batch runners should preserve that id in their output.

## Import External Model Output

```bash
node scripts/hard-grounded-research-import-model-results.mjs \
  --system-id=openai-grounded-baseline-v1 \
  --input=path/to/model-output.jsonl \
  --suite=pilot
```

The importer accepts JSONL rows shaped like OpenAI Responses output, chat completions output, or minimal rows with `custom_id` and `output_text`. The output text must be benchmark JSON with `answer`, `citations`, `abstained`, `confidence`, and `evidence_assessment`.

The importer writes:

- `runs/<system-id>/submission.json`
- `runs/<system-id>/report.json`
- `runs/<system-id>/import-manifest.json`

Invalid model JSON is scored as `ABSTAIN` and counted in the import manifest.
