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
const ingestRuns = await readJsonl(path.join(auditsDir, "ingest-runs.jsonl"));
const failedBySource = new Map();
for (const route of failedRoutes) {
  if (!route.source_id) continue;
  const existing = failedBySource.get(route.source_id) ?? [];
  existing.push(route);
  failedBySource.set(route.source_id, existing);
}
const successfulBySource = latestSuccessfulRunsBySource(ingestRuns);
const replacementPlans = buildReplacementPlans(failedBySource, sources, successfulBySource);
const resolvedFailures = buildResolvedFailures(failedBySource, sources, successfulBySource);

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
  resolved_failure_count: resolvedFailures.length,
  resolved_failures: resolvedFailures,
  replacement_plan_count: replacementPlans.length,
  replacement_plans: replacementPlans,
};

await writeJson(path.join(auditsDir, "blocked-sources.json"), report);
await writeText(path.join(auditsDir, "blocked-sources.md"), renderMarkdown(report));
await writeJson(path.join(auditsDir, "failed-route-replacements.json"), {
  generated_at: report.generated_at,
  resolved_failure_count: resolvedFailures.length,
  resolved_failures: resolvedFailures,
  replacement_plan_count: replacementPlans.length,
  replacement_plans: replacementPlans,
});
await writeText(path.join(auditsDir, "failed-route-replacements.md"), renderReplacementMarkdown(report));

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

function latestSuccessfulRunsBySource(ingestRuns) {
  const successfulBySource = new Map();
  for (const run of ingestRuns) {
    if (!run.source_id || run.status !== "success") continue;
    const completedAt = run.completed_at ?? "";
    const current = successfulBySource.get(run.source_id);
    if (!current || completedAt > (current.completed_at ?? "")) successfulBySource.set(run.source_id, run);
  }
  return successfulBySource;
}

function buildResolvedFailures(failedBySource, sources, successfulBySource) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  const resolved = [];
  for (const [sourceId, failures] of failedBySource.entries()) {
    const latestFailure = failures.at(-1);
    const latestSuccess = successfulBySource.get(sourceId);
    const source = sourceById.get(sourceId);
    const replacementResolved = knownReplacementResolvesFailures(source, latestSuccess, failures);
    if (!latestSuccess || ((latestSuccess.completed_at ?? "") <= (latestFailure?.completed_at ?? "") && !replacementResolved)) continue;
    resolved.push({
      source_id: sourceId,
      name: source?.name ?? sourceId,
      source_class: source?.source_class ?? "unknown",
      failure_count: failures.length,
      latest_failure_at: latestFailure?.completed_at ?? "",
      latest_success_at: latestSuccess.completed_at ?? "",
      successful_route: latestSuccess.access_route ?? "",
      record_count: latestSuccess.record_count ?? 0,
      resolution_note: replacementResolved
        ? "A source-specific replacement route is now documented and has a successful ingest, so later retries of the retired route are retained as historical failures but no longer require an active replacement plan."
        : "A later successful ingest exists for this source, so historical failed routes are retained in failed-routes.jsonl but no longer require an active replacement plan.",
    });
  }
  return resolved.sort((a, b) => a.source_id.localeCompare(b.source_id));
}

function buildReplacementPlans(failedBySource, sources, successfulBySource) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  const plans = [];
  for (const [sourceId, failures] of failedBySource.entries()) {
    const source = sourceById.get(sourceId) ?? {
      source_id: sourceId,
      name: sourceId,
      source_class: "unknown",
      ingest_status: "unknown",
      redistribution_status: "unknown",
    };
    const latestFailure = failures.at(-1);
    const latestSuccess = successfulBySource.get(sourceId);
    if (latestSuccess && (
      (latestSuccess.completed_at ?? "") > (latestFailure?.completed_at ?? "") ||
      knownReplacementResolvesFailures(source, latestSuccess, failures)
    )) continue;
    const errorText = failures.flatMap((failure) => failure.errors ?? []).join(" ");
    const failedRoutes = [...new Set(failures.map((failure) => failure.access_route).filter(Boolean))];
    const targetSummary = summarizeTargets(failures);
    const plan = replacementPlanFor(source, latestFailure, errorText, failedRoutes, targetSummary);
    plans.push({
      source_id: sourceId,
      name: source.name,
      source_class: source.source_class,
      ingest_status: source.ingest_status ?? "unknown",
      redistribution_status: source.redistribution_status ?? "unknown",
      failure_count: failures.length,
      latest_failure_at: latestFailure?.completed_at ?? "",
      latest_error: (latestFailure?.errors ?? []).join("; "),
      failed_routes: failedRoutes.slice(-8),
      affected_targets: targetSummary,
      replacement_status: plan.status,
      replacement_routes: plan.routes,
      next_action: plan.next_action,
      do_not_do: plan.do_not_do,
    });
  }
  return plans.sort((a, b) =>
    priority(a).localeCompare(priority(b)) ||
    b.failure_count - a.failure_count ||
    a.source_id.localeCompare(b.source_id)
  );
}

function knownReplacementResolvesFailures(source, latestSuccess, failures) {
  if (!source || !latestSuccess || !latestSuccess.record_count) return false;
  const failedRoutes = failures.map((failure) => failure.access_route ?? "");
  if (source.source_id === "lareviewofbooks") {
    return /lareviewofbooks\.org\/?$/i.test(latestSuccess.access_route ?? "") &&
      failedRoutes.length > 0 &&
      failedRoutes.every((route) => /lareviewofbooks\.org\/feed\/?$/i.test(route));
  }
  if (source.source_id === "smithsonian-open-access") {
    const errorText = failures.flatMap((failure) => failure.errors ?? []).join(" ");
    return /429|Too Many Requests|OVER_RATE_LIMIT/i.test(errorText);
  }
  return false;
}

function replacementPlanFor(source, latestFailure, errorText, failedRoutes, targetSummary) {
  const sourceId = source.source_id;
  if (/403|Forbidden/i.test(errorText) && source.source_class === "university-department-web") {
    return {
      status: "replacement-needed",
      routes: [
        "Use already responding same-domain department pages discovered from successful homepages.",
        "Try official school search, sitemap.xml, RSS/news feeds, or department directory pages before retrying blocked homepages.",
        "Use Wayback CDX metadata for historical coverage; do not store archived page text unless rights are reviewed.",
      ],
      next_action: `Create source-specific alternate target entries for ${targetSummary.length ? targetSummary.join(", ") : sourceId} using public about/news/events/faculty routes that return 200.`,
      do_not_do: "Do not bypass 403 responses, spoof browsers, solve challenges, or scrape behind access controls.",
    };
  }
  if (/404|Not Found/i.test(errorText) && source.source_class === "university-department-web") {
    return {
      status: "replacement-needed",
      routes: [
        "Try source-specific sitemap locations such as /sitemap_index.xml, /sitemap.xml.gz, or CMS-provided XML indexes where public.",
        "Use already responding same-domain department pages and their discovered internal links.",
        "Use official school directories, RSS/news feeds, or Wayback CDX metadata when current sitemap routes are absent.",
      ],
      next_action: `Create source-specific alternate sitemap/directory targets for ${targetSummary.length ? targetSummary.join(", ") : sourceId}; keep missing sitemap routes logged as failed metadata routes.`,
      do_not_do: "Do not repeatedly retry absent sitemap.xml routes or infer page text from sitemap URL metadata.",
    };
  }
  if (sourceId === "lareviewofbooks" || /404|Not Found/i.test(errorText)) {
    return {
      status: "replacement-needed",
      routes: [
        "Find the current RSS/feed URL from the site homepage or sitemap.",
        "Use WordPress discovery endpoints such as /wp-json/wp/v2/posts only if public and allowed.",
        "Use Crossref/OpenAlex/Internet Archive metadata as fallback for bibliographic discovery.",
      ],
      next_action: "Replace the stale feed URL before another automated ingest.",
      do_not_do: "Do not repeatedly retry the known 404 feed route.",
    };
  }
  if (/401|Unauthorized/i.test(errorText) || sourceId.includes("ssrn")) {
    return {
      status: "permission-needed",
      routes: [
        "Use an authorized export or API route if credentials/terms permit.",
        "Use OpenAlex, Crossref, NBER, or publisher metadata as alternate discovery sources.",
      ],
      next_action: "Keep the source blocked until an authorized metadata route or allowed export is available.",
      do_not_do: "Do not ask for secrets in chat or retry unauthorized API routes anonymously.",
    };
  }
  if (sourceId === "hathitrust-bibliographic-metadata") {
    return {
      status: "route-review-needed",
      routes: [
        "Use documented HathiTrust bibliographic data files or metadata exports rather than blocked catalog result pages.",
        "Store metadata only and keep rights fields attached before any text access decisions.",
      ],
      next_action: "Replace catalog-page scraping with documented metadata download/export workflow after terms review.",
      do_not_do: "Do not scrape blocked catalog pages or store restricted full text.",
    };
  }
  if (sourceId === "wayback-machine-cdx" || /aborted|Unexpected end/i.test(errorText)) {
    if (sourceId !== "wayback-machine-cdx") {
      return {
        status: "partial-route-retry",
        routes: [
          "Retry the documented source API route with smaller page sizes and source-specific timeout/backoff.",
          "Keep successful local records and treat this as a partial route failure, not a source-wide block.",
        ],
        next_action: "Use the source-specific ingest audit to identify which route/page failed, then retry only that route with lower limits.",
        do_not_do: "Do not discard successful local records or reclassify the whole source as blocked because one route timed out.",
      };
    }
    return {
      status: "retry-with-smaller-route",
      routes: [
        "Use exact URL CDX queries before wildcard queries.",
        "Reduce limits and avoid collapse parameters for unstable routes.",
        "Persist partial CDX responses and retry failed targets individually.",
      ],
      next_action: "Split wildcard CDX targets into exact canonical URLs and retry with smaller limits.",
      do_not_do: "Do not treat archived page text as redistributable without separate rights review.",
    };
  }
  if (/429|Too Many Requests/i.test(errorText)) {
    return {
      status: "rate-limit-backoff",
      routes: [
        "Retry with lower per-source limits and longer backoff.",
        "Prefer bulk/download routes if the source documents one.",
      ],
      next_action: "Schedule a polite retry with lower page size and source-specific backoff.",
      do_not_do: "Do not increase concurrency or rotate identities.",
    };
  }
  if (/403|Forbidden/i.test(errorText) && source.ingest_status === "active") {
    return {
      status: "partial-route-review",
      routes: [
        "Check whether the failed route is an individual item/detail endpoint while broader search/list endpoints still work.",
        "Keep successful local records and mark missing detail routes in the source-specific ingest audit.",
        "Prefer documented bulk/list APIs or lower-volume detail retries where terms allow.",
      ],
      next_action: "Review source-specific audit output before retrying; retry only the failed route class, not the entire source.",
      do_not_do: "Do not bypass 403 responses or treat item-level blocks as permission to scrape alternate restricted pages.",
    };
  }
  return {
    status: "source-specific-review-needed",
    routes: [
      "Review source terms, robots, documented APIs, sitemaps, and public exports.",
      "Prefer metadata routes over page scraping where available.",
    ],
    next_action: "Write a source-specific acquisition note before retrying.",
    do_not_do: "Do not repeatedly retry the same failed route without a changed route or terms decision.",
  };
}

function summarizeTargets(failures) {
  return [...new Set(failures.map((failure) =>
    [failure.target_school, failure.target_department, failure.target_page_type].filter(Boolean).join(" ")
  ).filter(Boolean))].slice(0, 10);
}

function priority(plan) {
  const order = {
    "replacement-needed": "0",
    "permission-needed": "1",
    "retry-with-smaller-route": "2",
    "rate-limit-backoff": "3",
    "route-review-needed": "4",
    "source-specific-review-needed": "5",
  };
  return order[plan.replacement_status] ?? "9";
}

function renderMarkdown(report) {
  return [
    "# KB Blocked Sources",
    "",
    `Generated at: ${report.generated_at}`,
    `Blocked sources: ${report.blocked_source_count}`,
    `Resolved historical failures: ${report.resolved_failure_count}`,
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
    "## Failed Route Replacement Plans",
    "",
    `See \`data/knowledge-base/audits/failed-route-replacements.md\` for ${report.replacement_plan_count} source-level replacement plans.`,
    "",
  ].join("\n");
}

function renderReplacementMarkdown(report) {
  return [
    "# KB Failed Route Replacement Plans",
    "",
    `Generated at: ${report.generated_at}`,
    `Resolved historical failures: ${report.resolved_failure_count}`,
    `Replacement plans: ${report.replacement_plan_count}`,
    "",
    ...(report.resolved_failures.length ? [
      "## Resolved Historical Failures",
      "",
      ...report.resolved_failures.flatMap((failure) => [
        `- ${failure.source_id}: latest successful route ${failure.successful_route || "unknown"} at ${failure.latest_success_at || "unknown"} (${failure.record_count} records).`,
      ]),
      "",
    ] : []),
    ...report.replacement_plans.flatMap((plan) => [
      `## ${plan.source_id}`,
      "",
      `- Name: ${plan.name}`,
      `- Class: ${plan.source_class}`,
      `- Ingest status: ${plan.ingest_status}`,
      `- Replacement status: ${plan.replacement_status}`,
      `- Failure count: ${plan.failure_count}`,
      `- Latest failure: ${plan.latest_failure_at || "unknown"}`,
      `- Latest error: ${plan.latest_error || "No error text."}`,
      `- Affected targets: ${plan.affected_targets.length ? plan.affected_targets.join("; ") : "No target metadata."}`,
      "- Failed routes:",
      ...(plan.failed_routes.length ? plan.failed_routes.map((route) => `  - ${route}`) : ["  - No route recorded."]),
      "- Replacement routes:",
      ...plan.replacement_routes.map((route) => `  - ${route}`),
      `- Next action: ${plan.next_action}`,
      `- Do not do: ${plan.do_not_do}`,
      "",
    ]),
  ].join("\n");
}
