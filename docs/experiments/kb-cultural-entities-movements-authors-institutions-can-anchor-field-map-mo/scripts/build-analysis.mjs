import fs from "node:fs/promises";
import path from "node:path";
import {
  processedDir,
  readJsonl,
  rootDir,
  toCsv,
  writeJson,
  writeText,
} from "../../../../scripts/kb-lib.mjs";

const experimentDir = path.join(rootDir, "docs", "experiments", "kb-cultural-entities-movements-authors-institutions-can-anchor-field-map-mo");
const processedOutDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const sourceMap = JSON.parse(await fs.readFile(path.join(experimentDir, "config", "source-map.json"), "utf8"));

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const authors = await readJsonl(path.join(processedDir, "authors.jsonl"));
const canonicalPeople = await readJsonl(path.join(processedDir, "canonical_people.jsonl"));
const institutions = await readJsonl(path.join(processedDir, "institutions.jsonl"));
const topics = await readJsonl(path.join(processedDir, "topics.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const rightsById = new Map(rights.map((row) => [row.local_id, row]));

const matchedSourceIds = new Set((sourceMap.matched_sources ?? [])
  .filter((source) => ["scholarly-metadata", "journals-and-reviews", "conference-programs", "linked-open-data", "public-domain-texts", "open-text-metadata"].includes(source.source_class))
  .map((source) => source.source_id));

const matchedDocuments = sourceDocuments.filter((row) => matchedSourceIds.has(row.source_id));
const matchedWorks = works.filter((row) => matchedSourceIds.has(row.source_id));
const wikidataEntities = sourceDocuments
  .filter((row) => row.source_id === "wikidata-cultural-entities")
  .map(normalizeWikidataEntity);
const authorEntities = authors
  .filter((row) => matchedSourceIds.has(row.source_id))
  .map(normalizeAuthorEntity);
const personEntities = canonicalPeople.map(normalizeCanonicalPerson);
const institutionEntities = institutions.map(normalizeInstitutionEntity);
const topicEntities = topics.map(normalizeTopicEntity);

const entities = dedupeEntities([
  ...wikidataEntities,
  ...authorEntities,
  ...personEntities,
  ...institutionEntities,
  ...topicEntities,
]);
const evidenceRows = buildEvidenceRows(entities, matchedWorks, matchedDocuments);
const entityRows = buildEntityRows(entities, evidenceRows);
const typeRows = coverageBy(entityRows, ["entity_type"]);
const sourceRows = coverageBy(entityRows, ["source_id"]);
const categoryRows = coverageBy(entityRows, ["category"]);
const countryRows = coverageBy(entityRows.filter((row) => row.country), ["country"]);
const movementRows = coverageBy(entityRows.filter((row) => row.movement), ["movement"]);
const linkedEvidenceRows = evidenceRows
  .sort((a, b) => b.evidence_score - a.evidence_score || a.entity_label.localeCompare(b.entity_label))
  .slice(0, 250);
const anchorRows = entityRows
  .sort(compareAnchors)
  .slice(0, 200);
const findings = buildFindings({ entityRows, anchorRows, typeRows, sourceRows, categoryRows, countryRows, movementRows, linkedEvidenceRows });

const result = {
  generated_at: new Date().toISOString(),
  question: sourceMap.question,
  source_count: matchedSourceIds.size,
  entity_rows: entityRows.length,
  evidence_links: evidenceRows.length,
  entities_with_evidence: entityRows.filter((row) => row.evidence_count > 0).length,
  source_document_rows: matchedDocuments.length,
  work_rows: matchedWorks.length,
  findings,
  caveats: [
    "This is a local field-map scaffold, not final authority control. Candidate people clusters are deterministic name clusters and must be reviewed before person-level claims.",
    "Evidence links use exact normalized label matching against local titles, authors, descriptions, venues, subjects, and topic labels; absence of a link does not mean absence from the field.",
    "Wikidata categories and source-provided topics are useful anchors but contain broad cultural and public figures, so publication claims need source-specific filtering.",
    "The pipeline uses local metadata and stored KB tables only. It does not fetch new entity data or resolve external identifiers beyond existing KB rows.",
    "Rights metadata is inherited from the source document rows; quote decisions still require source-specific review.",
  ],
};

await writeText(path.join(processedOutDir, "entity-anchors.csv"), toCsv(anchorRows, ["entity_id", "entity_label", "entity_type", "category", "source_id", "source_count", "record_count", "evidence_count", "anchor_score", "country", "movement", "first_year", "last_year", "source_url", "rights_status", "notes"]));
await writeText(path.join(processedOutDir, "coverage-by-type.csv"), toCsv(typeRows, ["entity_type", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]));
await writeText(path.join(processedOutDir, "coverage-by-source.csv"), toCsv(sourceRows, ["source_id", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]));
await writeText(path.join(processedOutDir, "coverage-by-category.csv"), toCsv(categoryRows, ["category", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]));
await writeText(path.join(processedOutDir, "coverage-by-country.csv"), toCsv(countryRows, ["country", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]));
await writeText(path.join(processedOutDir, "coverage-by-movement.csv"), toCsv(movementRows, ["movement", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]));
await writeText(path.join(processedOutDir, "entity-evidence-links.csv"), toCsv(linkedEvidenceRows, ["entity_id", "entity_label", "entity_type", "evidence_local_id", "evidence_source_id", "evidence_kind", "evidence_title", "evidence_year", "evidence_score", "source_url", "rights_status"]));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "work.md"), renderWorkReport({ result, anchorRows, typeRows, sourceRows, categoryRows, countryRows, movementRows, linkedEvidenceRows }));
await writeText(path.join(reportsDir, "public-draft.md"), renderPublicDraft({ result, anchorRows, typeRows, categoryRows, linkedEvidenceRows }));

console.log(`Built cultural entity field map: ${entityRows.length} entity anchors, ${evidenceRows.length} local evidence links.`);

function normalizeWikidataEntity(row) {
  return {
    entity_id: row.local_id,
    entity_label: cleanField(row.title),
    entity_type: "linked_entity",
    category: cleanField(row.wikidata_category || "wikidata"),
    source_id: row.source_id,
    source_url: row.source_url || "",
    source_count: 1,
    record_count: 1,
    country: cleanField(row.country),
    movement: cleanField(row.movement),
    first_year: parseYear(row.birth_year || row.publication_year),
    last_year: parseYear(row.death_year),
    rights_status: rightsById.get(row.local_id)?.redistribution_status ?? "derived-metadata-ok",
    notes: cleanField(row.description || row.tags),
  };
}

function normalizeAuthorEntity(row) {
  return {
    entity_id: row.local_id,
    entity_label: cleanField(row.name),
    entity_type: "source_author",
    category: cleanField(row.occupation || "author"),
    source_id: row.source_id,
    source_url: row.source_url || "",
    source_count: 1,
    record_count: 1,
    country: "",
    movement: "",
    first_year: parseYear(row.birth_year),
    last_year: parseYear(row.death_year),
    rights_status: rightsById.get(row.local_id)?.redistribution_status ?? "metadata-ok",
    notes: cleanField(row.institution),
  };
}

function normalizeCanonicalPerson(row) {
  return {
    entity_id: row.canonical_person_id,
    entity_label: cleanField(row.canonical_name),
    entity_type: "candidate_person_cluster",
    category: cleanField(row.confidence || "candidate-person"),
    source_id: cleanField(row.source_ids || "canonical_people"),
    source_url: "",
    source_count: Number(row.source_count) || 0,
    record_count: Number(row.record_count) || 0,
    country: "",
    movement: "",
    first_year: parseYear(row.birth_year),
    last_year: parseYear(row.death_year),
    rights_status: "derived-metadata-ok",
    notes: cleanField(row.notes || row.institution_hints),
  };
}

function normalizeInstitutionEntity(row) {
  return {
    entity_id: row.local_id,
    entity_label: cleanField(row.name),
    entity_type: "institution",
    category: cleanField(row.type || "institution"),
    source_id: row.source_id,
    source_url: row.source_url || "",
    source_count: 1,
    record_count: 1,
    country: cleanField(row.country),
    movement: "",
    first_year: "",
    last_year: "",
    rights_status: rightsById.get(row.local_id)?.redistribution_status ?? "metadata-ok",
    notes: cleanField(row.region),
  };
}

function normalizeTopicEntity(row) {
  return {
    entity_id: row.local_id,
    entity_label: cleanField(row.label),
    entity_type: "source_topic",
    category: cleanField(row.vocabulary || "topic"),
    source_id: row.source_id,
    source_url: row.source_url || "",
    source_count: 1,
    record_count: 1,
    country: "",
    movement: "",
    first_year: "",
    last_year: "",
    rights_status: rightsById.get(row.local_id)?.redistribution_status ?? "metadata-ok",
    notes: cleanField(row.parent_label || row.confidence),
  };
}

function dedupeEntities(rows) {
  const groups = new Map();
  for (const row of rows.filter((entry) => usableLabel(entry.entity_label))) {
    const key = `${row.entity_type}\t${normalizeKey(row.entity_label)}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...row });
      continue;
    }
    current.source_count = Math.max(Number(current.source_count) || 0, Number(row.source_count) || 0);
    current.record_count += Number(row.record_count) || 1;
    current.country ||= row.country;
    current.movement ||= row.movement;
    current.first_year ||= row.first_year;
    current.last_year ||= row.last_year;
    current.notes = joinUnique([current.notes, row.notes]);
  }
  return [...groups.values()];
}

function buildEvidenceRows(entities, workRows, documentRows) {
  const candidateMap = new Map();
  for (const row of [...workRows, ...documentRows]) {
    if (!candidateMap.has(row.local_id)) candidateMap.set(row.local_id, row);
  }
  const candidates = [...candidateMap.values()].map((row) => ({
    local_id: row.local_id,
    source_id: row.source_id,
    title: cleanField(row.title),
    source_url: row.source_url || "",
    year: parseYear(row.publication_year || row.content_year_start || row.content_year_end),
    rights_status: rightsById.get(row.local_id)?.redistribution_status ?? "unknown",
    text: normalizeSearchText([
      row.title,
      row.author,
      row.creator,
      row.description,
      row.venue,
      row.subjects,
      row.bookshelves,
      row.wikidata_category,
      row.country,
      row.movement,
      row.tags,
    ].filter(Boolean).join(" ")),
  }));
  const evidence = [];
  for (const entity of entities) {
    const labelKey = normalizeKey(entity.entity_label);
    if (!strongEnoughForMatching(labelKey)) continue;
    const phrase = new RegExp(`(^|[^a-z0-9])${escapeRegex(labelKey).replace(/\s+/g, "\\s+")}([^a-z0-9]|$)`, "i");
    let links = 0;
    for (const candidate of candidates) {
      if (candidate.local_id === entity.entity_id) continue;
      if (!phrase.test(candidate.text)) continue;
      const titleMatch = phrase.test(normalizeSearchText(candidate.title));
      evidence.push({
        entity_id: entity.entity_id,
        entity_label: entity.entity_label,
        entity_type: entity.entity_type,
        evidence_local_id: candidate.local_id,
        evidence_source_id: candidate.source_id,
        evidence_kind: titleMatch ? "title-match" : "metadata-match",
        evidence_title: candidate.title,
        evidence_year: candidate.year,
        evidence_score: titleMatch ? 2 : 1,
        source_url: candidate.source_url,
        rights_status: candidate.rights_status,
      });
      links += 1;
      if (links >= 12) break;
    }
  }
  return evidence;
}

function buildEntityRows(rows, evidenceRows) {
  const evidenceById = new Map();
  for (const row of evidenceRows) {
    const current = evidenceById.get(row.entity_id) ?? { count: 0, score: 0 };
    current.count += 1;
    current.score += row.evidence_score;
    evidenceById.set(row.entity_id, current);
  }
  return rows.map((row) => {
    const evidence = evidenceById.get(row.entity_id) ?? { count: 0, score: 0 };
    const baseScore = (row.entity_type === "linked_entity" ? 3 : 0)
      + (row.entity_type === "institution" ? 2 : 0)
      + (row.entity_type === "source_topic" ? -1 : 0)
      + (row.entity_type === "candidate_person_cluster" && row.source_count > 1 ? 1 : 0)
      + (row.source_count > 1 ? 1 : 0)
      + (row.first_year ? 0.5 : 0)
      + (row.country ? 0.25 : 0)
      + (row.movement ? 0.25 : 0);
    return {
      ...row,
      evidence_count: evidence.count,
      anchor_score: Number((baseScore + evidence.score).toFixed(2)),
    };
  });
}

function compareAnchors(a, b) {
  const priority = (row) => {
    if (row.entity_type === "linked_entity") return 5;
    if (row.entity_type === "institution") return 4;
    if (row.entity_type === "candidate_person_cluster" && row.source_count > 1) return 3;
    if (row.entity_type === "source_author" && row.evidence_count > 0) return 2;
    if (row.entity_type === "source_topic") return 1;
    return 0;
  };
  return priority(b) - priority(a)
    || b.anchor_score - a.anchor_score
    || b.evidence_count - a.evidence_count
    || a.entity_label.localeCompare(b.entity_label);
}

function coverageBy(rows, keys) {
  const groups = new Map();
  for (const row of rows) {
    const key = keys.map((field) => row[field] || "unknown").join("\t");
    const current = groups.get(key) ?? {
      ...Object.fromEntries(keys.map((field) => [field, row[field] || "unknown"])),
      entities: 0,
      with_evidence: 0,
      evidence_links: 0,
      anchor_score_total: 0,
      examples: [],
    };
    current.entities += 1;
    if (row.evidence_count > 0) current.with_evidence += 1;
    current.evidence_links += row.evidence_count;
    current.anchor_score_total += row.anchor_score;
    if (current.examples.length < 5) current.examples.push(row.entity_label);
    groups.set(key, current);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    avg_anchor_score: (row.anchor_score_total / row.entities).toFixed(2),
    example_entities: row.examples.join("; "),
  })).sort((a, b) => b.entities - a.entities || String(keys.map((field) => a[field]).join()).localeCompare(String(keys.map((field) => b[field]).join())));
}

function buildFindings({ entityRows, anchorRows, typeRows, sourceRows, categoryRows, countryRows, movementRows, linkedEvidenceRows }) {
  return {
    corpus: [
      `${entityRows.length} candidate entity anchors are available across linked entities, author rows, person clusters, institutions, and source topics.`,
      `${entityRows.filter((row) => row.evidence_count > 0).length} anchors have exact-label links into local works or source-document metadata.`,
      `${linkedEvidenceRows.length} top evidence links are written for manual inspection.`,
    ],
    top_types: typeRows.slice(0, 8).map((row) => `${row.entity_type}: ${row.entities} entities, ${row.with_evidence} with evidence`),
    top_sources: sourceRows.slice(0, 8).map((row) => `${row.source_id}: ${row.entities} entities`),
    top_categories: categoryRows.slice(0, 8).map((row) => `${row.category}: ${row.entities} entities`),
    top_countries: countryRows.slice(0, 8).map((row) => `${row.country}: ${row.entities} entities`),
    top_movements: movementRows.slice(0, 8).map((row) => `${row.movement}: ${row.entities} entities`),
    top_anchors: anchorRows.slice(0, 10).map((row) => `${row.entity_label} (${row.entity_type}, score ${row.anchor_score})`),
  };
}

function renderWorkReport({ result, anchorRows, typeRows, sourceRows, categoryRows, countryRows, movementRows, linkedEvidenceRows }) {
  return [
    "# Cultural Entity Field-Map Analysis",
    "",
    `Generated at: ${result.generated_at}`,
    "",
    "## Corpus",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    `- Matched source-document rows: ${result.source_document_rows}`,
    `- Matched work rows: ${result.work_rows}`,
    "",
    "## Entity Type Coverage",
    "",
    table(typeRows, ["entity_type", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]),
    "",
    "## Source Coverage",
    "",
    table(sourceRows.slice(0, 30), ["source_id", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]),
    "",
    "## Category Coverage",
    "",
    table(categoryRows.slice(0, 30), ["category", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]),
    "",
    "## Country And Movement Coverage",
    "",
    table(countryRows.slice(0, 20), ["country", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]),
    "",
    table(movementRows.slice(0, 20), ["movement", "entities", "with_evidence", "evidence_links", "avg_anchor_score", "example_entities"]),
    "",
    "## Top Candidate Anchors",
    "",
    table(anchorRows.slice(0, 30), ["entity_label", "entity_type", "category", "source_id", "source_count", "record_count", "evidence_count", "anchor_score", "country", "movement"]),
    "",
    "## Evidence Links",
    "",
    table(linkedEvidenceRows.slice(0, 30), ["entity_label", "entity_type", "evidence_source_id", "evidence_kind", "evidence_title", "evidence_year", "rights_status"]),
    "",
    "## Output Tables",
    "",
    "- `data/processed/entity-anchors.csv`",
    "- `data/processed/coverage-by-type.csv`",
    "- `data/processed/coverage-by-source.csv`",
    "- `data/processed/coverage-by-category.csv`",
    "- `data/processed/coverage-by-country.csv`",
    "- `data/processed/coverage-by-movement.csv`",
    "- `data/processed/entity-evidence-links.csv`",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function renderPublicDraft({ result, anchorRows, typeRows, categoryRows, linkedEvidenceRows }) {
  return [
    "# Public Draft Scaffold: A Field Map From Local Cultural Entities",
    "",
    "The local humanities knowledge base can now produce a first field map of cultural anchors without going back to the web. The map combines linked entities, source-provided authors, candidate person clusters, institutions, and source topics, then asks which of those anchors also appear in local works or source-document metadata.",
    "",
    "## What The Local Map Contains",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    "",
    "The largest entity layers are:",
    "",
    ...typeRows.slice(0, 6).map((row) => `- ${row.entity_type}: ${row.entities} entities, ${row.with_evidence} with local evidence links.`),
    "",
    "The largest categories are:",
    "",
    ...categoryRows.slice(0, 8).map((row) => `- ${row.category}: ${row.entities} entities.`),
    "",
    "Candidate anchors to inspect first:",
    "",
    ...anchorRows.slice(0, 10).map((row) => `- ${row.entity_label} (${row.entity_type}; ${row.evidence_count} evidence links).`),
    "",
    "Representative local evidence links:",
    "",
    ...linkedEvidenceRows.slice(0, 8).map((row) => `- ${row.entity_label} -> ${row.evidence_title} (${row.evidence_source_id}).`),
    "",
    "## What This Does Not Yet Prove",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function table(rows, columns) {
  if (!rows.length) return "No rows.";
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escapeMd(row[column])).join(" | ")} |`),
  ].join("\n");
}

function usableLabel(label) {
  const key = normalizeKey(label);
  return key.length >= 3 && !/^\d+$/.test(key) && !["unknown", "untitled"].includes(key);
}

function strongEnoughForMatching(labelKey) {
  return labelKey.length >= 5 && !/^\d+$/.test(labelKey) && !/^[a-z] /.test(labelKey);
}

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeSearchText(value) {
  return ` ${normalizeKey(value)} `;
}

function parseYear(value) {
  const match = String(value ?? "").match(/\b(1[0-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : "";
}

function joinUnique(values) {
  return [...new Set(values.flatMap((value) => String(value || "").split(";").map(cleanField)).filter(Boolean))].join("; ");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanField(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeMd(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
