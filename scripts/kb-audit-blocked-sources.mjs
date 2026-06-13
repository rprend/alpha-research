import path from "node:path";
import {
  auditsDir,
  loadRegistry,
  readJsonl,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const registry = await loadRegistry();
const sources = registry.sources ?? [];
const failedRoutes = await readJsonl(path.join(auditsDir, "failed-routes.jsonl"));
const failedBySource = new Map();
for (const route of failedRoutes) {
  if (!route.source_id) continue;
  const existing = failedBySource.get(route.source_id) ?? [];
  existing.push(route);
  failedBySource.set(route.source_id, existing);
}

const blockedSources = sources
  .filter((source) => source.ingest_status === "blocked")
  .map((source) => {
    const failures = failedBySource.get(source.source_id) ?? [];
    const latestFailure = failures.at(-1) ?? null;
    return {
      source_id: source.source_id,
      name: source.name,
      source_class: source.source_class,
      redistribution_status: source.redistribution_status,
      metadata_allowed: source.metadata_allowed,
      full_text_allowed: source.full_text_allowed,
      failure_count: failures.length,
      latest_failure: latestFailure
        ? {
            run_id: latestFailure.run_id,
            access_route: latestFailure.access_route,
            completed_at: latestFailure.completed_at,
            errors: latestFailure.errors ?? [],
          }
        : null,
      next_decision: nextDecision(source, latestFailure),
      known_risks: source.known_risks,
    };
  });

const report = {
  generated_at: new Date().toISOString(),
  blocked_source_count: blockedSources.length,
  blocked_sources: blockedSources,
};

await writeJson(path.join(auditsDir, "blocked-sources.json"), report);
await writeText(path.join(auditsDir, "blocked-sources.md"), renderMarkdown(report));

console.log(`KB blocked-source audit: ${report.blocked_source_count} blocked sources.`);

function nextDecision(source, latestFailure) {
  const errors = (latestFailure?.errors ?? []).join(" ");
  if (source.source_id === "open-syllabus") {
    return "Do not ingest until export/access terms are reviewed and a permitted metadata route is identified.";
  }
  if (/401|Unauthorized/i.test(errors)) {
    return "Requires authorized API access or a different metadata provider; do not retry anonymously.";
  }
  if (/403|Forbidden|challenge/i.test(errors)) {
    return "Requires route replacement, manual export, permissioned API access, or terms review; do not bypass access controls.";
  }
  if (/404|Not Found/i.test(errors)) {
    return "Find a current feed, sitemap, archive route, or alternate metadata source before retrying.";
  }
  return "Needs source-specific route and rights review before another automated ingest.";
}

function renderMarkdown(report) {
  return [
    "# KB Blocked Sources",
    "",
    `Generated at: ${report.generated_at}`,
    `Blocked sources: ${report.blocked_source_count}`,
    "",
    ...report.blocked_sources.flatMap((source) => [
      `## ${source.source_id}`,
      "",
      `- Name: ${source.name}`,
      `- Class: ${source.source_class}`,
      `- Redistribution: ${source.redistribution_status}`,
      `- Metadata allowed: ${source.metadata_allowed}`,
      `- Full text allowed: ${source.full_text_allowed}`,
      `- Failed route count: ${source.failure_count}`,
      `- Latest route: ${source.latest_failure?.access_route ?? "No failed route logged."}`,
      `- Latest errors: ${(source.latest_failure?.errors ?? ["No error logged."]).join("; ")}`,
      `- Next decision: ${source.next_decision}`,
      "",
    ]),
  ].join("\n");
}
