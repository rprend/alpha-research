import { existsSync } from "node:fs";
import path from "node:path";
import {
  auditsDir,
  listFilesRecursive,
  relative,
  rootDir,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const experimentsDir = path.join(rootDir, "docs", "experiments");
const experimentDirs = listImmediateDirs(experimentsDir);
const inventory = [];

for (const dir of experimentDirs) {
  const files = listFilesRecursive(dir);
  const relativeDir = relative(dir);
  const reports = files.filter((file) => file.includes(`${path.sep}reports${path.sep}`));
  const data = files.filter((file) => file.includes(`${path.sep}data${path.sep}`));
  const derived = files.filter((file) => file.includes(`${path.sep}derived-datasets${path.sep}`));
  const scripts = files.filter((file) => file.includes(`${path.sep}scripts${path.sep}`));
  inventory.push({
    experiment: path.basename(dir),
    path: relativeDir,
    readme: existsSync(path.join(dir, "README.md")) ? relative(path.join(dir, "README.md")) : null,
    readiness_report: firstExisting([
      path.join(dir, "reports", "readiness.json"),
      path.join(dir, "dataset-bundle", "reports", "readiness.json"),
    ]),
    result_report: firstExisting([
      path.join(dir, "reports", "result.json"),
      path.join(dir, "dataset-bundle", "reports", "result.json"),
    ]),
    data_file_count: data.length,
    report_file_count: reports.length,
    derived_file_count: derived.length,
    script_file_count: scripts.length,
    kb_seed_potential: classifyPotential({ data, reports, derived, scripts }),
    candidate_seed_paths: [...data, ...derived, ...reports]
      .filter((file) => /\.(json|jsonl|csv|md|parquet)$/.test(file))
      .slice(0, 12)
      .map(relative),
  });
}

const output = {
  generated_at: new Date().toISOString(),
  experiment_count: inventory.length,
  inventory,
};

await writeJson(path.join(auditsDir, "existing-experiment-inventory.json"), output);
await writeText(path.join(auditsDir, "existing-experiment-inventory.md"), renderMarkdown(output));

console.log(`Inventoried ${inventory.length} experiments into ${relative(path.join(auditsDir, "existing-experiment-inventory.md"))}`);

function listImmediateDirs(dir) {
  if (!existsSync(dir)) return [];
  return listFilesAndDirs(dir).filter((entry) => entry.isDirectory).map((entry) => entry.path).sort();
}

function listFilesAndDirs(dir) {
  return Array.from(new Set(listFilesRecursive(dir).map((file) => path.dirname(file)).concat([dir])))
    .filter((entry) => path.dirname(entry) === dir && entry !== dir)
    .map((entry) => ({ path: entry, isDirectory: existsSync(entry) }));
}

function firstExisting(paths) {
  const found = paths.find((file) => existsSync(file));
  return found ? relative(found) : null;
}

function classifyPotential({ data, reports, derived, scripts }) {
  if (derived.length) return "derived-dataset-seed";
  if (data.length && reports.length && scripts.length) return "pipeline-seed";
  if (data.length || reports.length) return "artifact-seed";
  return "documentation-only";
}

function renderMarkdown(output) {
  return [
    "# Existing Experiment Inventory",
    "",
    `Generated at: ${output.generated_at}`,
    `Experiments inventoried: ${output.experiment_count}`,
    "",
    "| Experiment | Seed Potential | Data Files | Report Files | Derived Files | Scripts |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...output.inventory.map((entry) =>
      `| ${entry.experiment} | ${entry.kb_seed_potential} | ${entry.data_file_count} | ${entry.report_file_count} | ${entry.derived_file_count} | ${entry.script_file_count} |`
    ),
    "",
    "## Candidate Seed Paths",
    "",
    ...output.inventory.flatMap((entry) => [
      `### ${entry.experiment}`,
      "",
      ...(entry.candidate_seed_paths.length ? entry.candidate_seed_paths.map((file) => `- \`${file}\``) : ["No candidate seed paths found."]),
      "",
    ]),
  ].join("\n");
}
