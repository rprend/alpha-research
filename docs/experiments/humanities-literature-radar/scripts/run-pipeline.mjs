import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { experimentDir, parseArgs, writeJson } from "./lib.mjs";

const args = parseArgs();
const profile = args.profile ?? "smoke";
const runDate = args["run-date"] ?? new Date().toISOString().slice(0, 10);
const profiles = {
  smoke: {
    openalex: 40,
    crossref: 40,
    doaj: 40,
    osf: 40,
    hcommons: 40,
    arxiv: 20,
    nber: 20,
    departments: 5,
  },
  v1: {
    openalex: 500,
    crossref: 500,
    doaj: 500,
    osf: 500,
    hcommons: 500,
    arxiv: 200,
    nber: 200,
    departments: 25,
  },
};
const selected = profiles[profile] ?? profiles.smoke;
const startedAt = new Date().toISOString();
const steps = [
  ["fetch-openalex.mjs", [`--limit=${args.openalex ?? selected.openalex}`, `--run-date=${runDate}`]],
  ["fetch-crossref.mjs", [`--limit=${args.crossref ?? selected.crossref}`, `--run-date=${runDate}`]],
  ["fetch-doaj.mjs", [`--limit=${args.doaj ?? selected.doaj}`, `--run-date=${runDate}`]],
  ["fetch-osf-preprints.mjs", [`--limit=${args.osf ?? selected.osf}`, `--run-date=${runDate}`]],
  ["fetch-hcommons.mjs", [`--limit=${args.hcommons ?? selected.hcommons}`, `--run-date=${runDate}`]],
  ["fetch-arxiv.mjs", [`--limit=${args.arxiv ?? selected.arxiv}`, `--run-date=${runDate}`]],
  ["fetch-nber.mjs", [`--limit=${args.nber ?? selected.nber}`, `--run-date=${runDate}`]],
  ["fetch-department-pages.mjs", [`--limit=${args.departments ?? selected.departments}`, `--run-date=${runDate}`]],
  ["normalize-works.mjs", []],
  ["build-report.mjs", []],
];
const results = [];
const sourceDirs = ["openalex", "crossref", "doaj", "osf-preprints", "hcommons", "arxiv", "nber", "department-pages"];

for (const source of sourceDirs) {
  await fs.rm(path.join(experimentDir, "data", "raw", source, runDate), { recursive: true, force: true });
}

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
console.log(`Humanities literature radar pipeline completed with profile=${profile} runDate=${runDate}`);

async function writePipelineManifest() {
  await writeJson(path.join(experimentDir, "reports", "pipeline-run.json"), {
    profile,
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
      env: process.env,
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
