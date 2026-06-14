import { existsSync } from "node:fs";
import path from "node:path";
import {
  auditsDir,
  ingestSchemaPath,
  indexesDir,
  kbDir,
  processedDir,
  readJson,
  registryPath,
  rightsTaxonomyPath,
  sourceSchemaPath,
  validateRegistry,
} from "./kb-lib.mjs";

const requiredPaths = [
  kbDir,
  registryPath,
  rightsTaxonomyPath,
  sourceSchemaPath,
  ingestSchemaPath,
];

const missing = requiredPaths.filter((file) => !existsSync(file));
if (missing.length) {
  throw new Error(`Missing KB paths:\n${missing.join("\n")}`);
}

const { registry, errors } = await validateRegistry();
if (registry.sources.length < 30) {
  errors.push(`source registry must contain at least 30 sources; found ${registry.sources.length}`);
}

await validateOperationalAudits(registry, errors);
validateLocalArtifacts(errors);

if (errors.length) {
  throw new Error(`KB validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(`KB validation passed (${registry.sources.length} sources).`);

async function validateOperationalAudits(registry, errors) {
  const sourceIds = new Set(registry.sources.map((source) => source.source_id));
  const replacementsPath = path.join(auditsDir, "failed-route-replacements.json");
  const blockedPath = path.join(auditsDir, "blocked-sources.json");
  const coveragePath = path.join(auditsDir, "source-coverage.json");
  if (!existsSync(replacementsPath)) errors.push("missing failed-route replacement audit; run pnpm kb:audit:blocked");
  if (!existsSync(blockedPath)) errors.push("missing blocked-source audit; run pnpm kb:audit:blocked");
  if (!existsSync(coveragePath)) errors.push("missing source coverage audit; run pnpm kb:audit");
  if (errors.length) return;

  const replacements = await readJson(replacementsPath);
  const blocked = await readJson(blockedPath);
  const coverage = await readJson(coveragePath);

  for (const plan of replacements.replacement_plans ?? []) {
    if (!sourceIds.has(plan.source_id)) errors.push(`failed-route replacement plan references unknown source: ${plan.source_id}`);
    if (!plan.next_action) errors.push(`failed-route replacement plan lacks next_action: ${plan.source_id}`);
    if (!plan.do_not_do) errors.push(`failed-route replacement plan lacks do_not_do: ${plan.source_id}`);
  }
  for (const failure of replacements.resolved_failures ?? []) {
    if (!sourceIds.has(failure.source_id)) errors.push(`resolved failed-route entry references unknown source: ${failure.source_id}`);
  }
  if (Number(replacements.replacement_plan_count ?? 0) !== (replacements.replacement_plans ?? []).length) {
    errors.push("failed-route replacement audit count does not match replacement_plans length");
  }

  const blockedSources = blocked.blocked_sources ?? [];
  if (Number(blocked.blocked_source_count ?? 0) !== blockedSources.length) {
    errors.push("blocked-source audit count does not match blocked_sources length");
  }
  for (const source of registry.sources.filter((entry) => entry.ingest_status === "blocked")) {
    const memo = blockedSources.find((entry) => entry.source_id === source.source_id);
    if (!memo) errors.push(`blocked registry source lacks blocked-source memo: ${source.source_id}`);
    if (memo && !memo.next_decision) errors.push(`blocked-source memo lacks next_decision: ${source.source_id}`);
  }

  const sourcesWithDocuments = Number(coverage.source_count_with_local_documents ?? 0);
  const sourceCount = Number(coverage.source_count ?? registry.sources.length);
  if (sourceCount !== registry.sources.length) {
    errors.push(`source coverage audit source_count ${sourceCount} does not match registry source count ${registry.sources.length}`);
  }
  if (sourcesWithDocuments < registry.sources.length - blockedSources.length) {
    errors.push(`source coverage is too low: ${sourcesWithDocuments}/${registry.sources.length} sources have local documents with ${blockedSources.length} blocked`);
  }
  const blockedIds = new Set(blockedSources.map((source) => source.source_id));
  for (const source of coverage.sources_without_local_documents ?? []) {
    if (!blockedIds.has(source.source_id)) {
      errors.push(`source lacks local documents and is not covered by blocked-source audit: ${source.source_id}`);
    }
  }
  for (const row of coverage.source_class_quality ?? []) {
    if (row.status !== "pass") {
      errors.push(`source-class quality gate failed for ${row.source_class}: ${row.sources_with_documents}/${row.required_sources_with_documents} sources and ${row.document_count}/${row.required_document_count} documents`);
    }
  }
}

function validateLocalArtifacts(errors) {
  const requiredArtifacts = [
    path.join(processedDir, "knowledge-base.sqlite"),
    path.join(processedDir, "source_documents.jsonl"),
    path.join(processedDir, "rights.jsonl"),
    path.join(processedDir, "works.parquet"),
    path.join(processedDir, "pages.parquet"),
    path.join(indexesDir, "source-documents-keyword-index.json"),
    path.join(indexesDir, "semantic-hash-index.json"),
  ];
  for (const artifact of requiredArtifacts) {
    if (!existsSync(artifact)) errors.push(`missing local KB artifact: ${artifact}`);
  }
}
