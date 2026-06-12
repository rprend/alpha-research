import { spawn } from "node:child_process";
import path from "node:path";
import { experimentDir, today, writeJson } from "./lib.mjs";

const args = parseArgs();
const runDate = args["run-date"] ?? process.env.CLEVELAND_COLLECTION_RUN_DATE ?? today();
const limit = args.limit ?? "5000";
const pageSize = args["page-size"] ?? "1000";
const startedAt = new Date().toISOString();
const steps = [
  ["fetch-artworks.mjs", [`--run-date=${runDate}`, `--limit=${limit}`, `--page-size=${pageSize}`]],
  ["build-report.mjs", []],
  ["build-audit-packet.mjs", []],
  ["build-charts.mjs", []],
  ["build-publication-draft.mjs", []],
  ["build-publication-handoff.mjs", []],
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
console.log(`Cleveland collection pipeline completed runDate=${runDate} limit=${limit}`);

async function writePipelineManifest() {
  await writeJson(path.join(experimentDir, "reports", "pipeline-run.json"), {
    runDate,
    limit: Number(limit),
    pageSize: Number(pageSize),
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
        CLEVELAND_COLLECTION_RUN_DATE: runDate,
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}
