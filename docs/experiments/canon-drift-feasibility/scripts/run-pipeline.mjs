import { spawn } from "node:child_process";
import path from "node:path";
import { experimentDir, today, writeJson } from "./lib.mjs";

const runDate = process.env.CANON_DRIFT_RUN_DATE ?? today();
const startedAt = new Date().toISOString();
const steps = [
  ["probe-web-sources.mjs", []],
  ["probe-openalex-authors.mjs", []],
  ["build-report.mjs", []],
  ["check-readiness.mjs", []],
];
const results = [];

for (const [script, scriptArgs] of steps) {
  const started = new Date().toISOString();
  const result = await runNode(script, scriptArgs);
  results.push({
    script,
    args: scriptArgs,
    startedAt: started,
    finishedAt: new Date().toISOString(),
    exitCode: result.exitCode,
    stdout: result.stdout.slice(-4000),
    stderr: result.stderr.slice(-4000),
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.exitCode !== 0) {
    await writePipelineManifest();
    process.exit(result.exitCode);
  }
}

await writePipelineManifest();
console.log(`Canon drift feasibility pipeline completed runDate=${runDate}`);

async function writePipelineManifest() {
  await writeJson(path.join(experimentDir, "reports", "pipeline-run.json"), {
    runDate,
    startedAt,
    finishedAt: new Date().toISOString(),
    steps: results,
  });
}

function runNode(script, scriptArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(experimentDir, "scripts", script), ...scriptArgs], {
      cwd: path.resolve(experimentDir, "..", "..", ".."),
      env: {
        ...process.env,
        CANON_DRIFT_RUN_DATE: runDate,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
