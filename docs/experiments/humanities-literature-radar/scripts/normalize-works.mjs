import fs from "node:fs/promises";
import path from "node:path";
import {
  appendJsonl,
  classifyWork,
  decodeXml,
  ensureDir,
  experimentDir,
  hasTerm,
  listFiles,
  normalizeWhitespace,
  readJson,
  stableWorkId,
  stripTags,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const rawDir = path.join(experimentDir, "data", "raw");
const interimDir = path.join(experimentDir, "data", "interim");
const processedDir = path.join(experimentDir, "data", "processed");
const normalizedPath = path.join(interimDir, "normalized-works.jsonl");

await ensureDir(interimDir);
await ensureDir(processedDir);
await fs.rm(normalizedPath, { force: true });

const rawFiles = await listFiles(rawDir, (file) => /\.(json|xml|html)$/.test(file) && !file.endsWith("manifest.json"));
const works = [];

for (const file of rawFiles) {
  const rel = path.relative(experimentDir, file);
  if (rel.includes("data/raw/openalex/") && file.endsWith(".json")) {
    const json = await readJson(file);
    for (const item of json.results ?? []) works.push(fromOpenAlex(item, rel));
  } else if (rel.includes("data/raw/crossref/") && file.endsWith(".json")) {
    const json = await readJson(file);
    for (const item of json.message?.items ?? []) works.push(fromCrossref(item, rel));
  } else if (rel.includes("data/raw/doaj/") && file.endsWith(".json")) {
    const json = await readJson(file);
    for (const item of json.results ?? []) works.push(fromDoaj(item, rel));
  } else if (rel.includes("data/raw/doaj-oai/") && file.endsWith(".xml")) {
    const xml = await fs.readFile(file, "utf8");
    for (const item of fromDoajOai(xml, rel)) works.push(item);
  } else if (rel.includes("data/raw/osf-preprints/") && file.endsWith(".json")) {
    const json = await readJson(file);
    for (const item of json.data ?? []) works.push(fromOsfPreprint(item, rel));
  } else if (rel.includes("data/raw/hcommons/") && file.endsWith(".json")) {
    const json = await readJson(file);
    for (const item of json.hits?.hits ?? []) works.push(fromHcommons(item, rel));
  } else if (rel.includes("data/raw/arxiv/") && file.endsWith(".xml")) {
    const xml = await fs.readFile(file, "utf8");
    for (const item of fromArxiv(xml, rel)) works.push(item);
  } else if (rel.includes("data/raw/nber/") && file.endsWith(".html")) {
    const html = await fs.readFile(file, "utf8");
    for (const item of fromNber(html, rel)) works.push(item);
  }
}

const deduped = new Map();
for (const work of works) {
  const id = stableWorkId(work);
  const existing = deduped.get(id);
  if (!existing) {
    deduped.set(id, { ...work, work_id: id, duplicate_sources: [work.source_name] });
  } else {
    existing.duplicate_sources = [...new Set([...existing.duplicate_sources, work.source_name])];
    existing.abstract ||= work.abstract;
    existing.doi ||= work.doi;
    existing.url ||= work.url;
    existing.open_access_url ||= work.open_access_url;
    existing.cited_by_count = Math.max(Number(existing.cited_by_count ?? 0), Number(work.cited_by_count ?? 0));
    existing.concepts = [...new Set([...(existing.concepts ?? []), ...(work.concepts ?? [])])];
  }
}

const finalWorks = [...deduped.values()]
  .map((work) => {
    const labels = classifyWork(work);
    return {
      ...work,
      relevance_score: relevanceScore(work),
      disciplines: labels.disciplines,
      methods: labels.methods,
      quantitative_signals: labels.quantitativeSignals,
      is_quantitative_humanities_candidate: labels.methods.length > 0 || labels.quantitativeSignals.length > 0,
    };
  })
  .filter((work) => {
    if (work.source_name === "arxiv") return work.relevance_score >= 2;
    if (work.source_name === "doaj-oai") return work.relevance_score >= 1;
    return true;
  })
  .sort((a, b) => String(b.publication_date ?? "").localeCompare(String(a.publication_date ?? "")));

await appendJsonl(normalizedPath, finalWorks);
await writeJson(path.join(processedDir, "works.json"), finalWorks);
await writeText(
  path.join(processedDir, "works.csv"),
  toCsv(finalWorks, [
    "work_id",
    "source_name",
    "title",
    "publication_date",
    "year",
    "venue_name",
    "doi",
    "url",
    "cited_by_count",
    "is_quantitative_humanities_candidate",
  ]),
);

const representative = finalWorks
  .filter((work) => work.title)
  .sort((a, b) => Number(b.cited_by_count ?? 0) - Number(a.cited_by_count ?? 0))
  .slice(0, 100);
await writeText(
  path.join(processedDir, "representative-works.csv"),
  toCsv(representative, ["title", "publication_date", "venue_name", "source_name", "doi", "url", "cited_by_count"]),
);

const topicRows = buildTopicRows(finalWorks);
await writeJson(path.join(processedDir, "topics.json"), topicRows);
await writeText(path.join(processedDir, "topics.csv"), toCsv(topicRows, ["label", "kind", "count", "representative_titles"]));

const opportunityRows = buildOpportunityRows(finalWorks);
await writeText(
  path.join(processedDir, "quantitative-humanities-opportunities.csv"),
  toCsv(opportunityRows, ["opportunity", "format", "source_basis", "first_study", "risk"]),
);

console.log(`Normalized ${works.length} raw records into ${finalWorks.length} deduped works`);

function fromOpenAlex(item, rawPath) {
  const abstract = item.abstract_inverted_index ? invertAbstract(item.abstract_inverted_index) : "";
  const publicationDate = item.publication_date ?? (item.publication_year ? `${item.publication_year}-01-01` : "");
  return {
    source_name: "openalex",
    source_record_id: item.id,
    title: normalizeWhitespace(item.display_name),
    abstract,
    publication_date: publicationDate,
    year: item.publication_year ?? "",
    doi: String(item.doi ?? "").replace(/^https:\/\/doi.org\//, ""),
    url: item.primary_location?.landing_page_url ?? item.id ?? "",
    open_access_url: item.open_access?.oa_url ?? "",
    venue_name: item.primary_location?.source?.display_name ?? "",
    publisher: item.primary_location?.source?.host_organization_name ?? "",
    work_type: item.type ?? "",
    authors: (item.authorships ?? []).map((author) => author.author?.display_name).filter(Boolean),
    institutions: (item.authorships ?? []).flatMap((author) => (author.institutions ?? []).map((inst) => inst.display_name)).filter(Boolean),
    concepts: (item.concepts ?? []).map((concept) => concept.display_name).filter(Boolean),
    references: item.referenced_works ?? [],
    cited_by_count: item.cited_by_count ?? 0,
    license: item.primary_location?.license ?? "",
    raw_path: rawPath,
  };
}

function fromCrossref(item, rawPath) {
  const dateParts = item.published?.["date-parts"]?.[0] ?? item["published-print"]?.["date-parts"]?.[0] ?? item.created?.["date-parts"]?.[0] ?? [];
  const publicationDate = dateParts.length ? [dateParts[0], dateParts[1] ?? 1, dateParts[2] ?? 1].map((part, index) => index === 0 ? String(part).padStart(4, "0") : String(part).padStart(2, "0")).join("-") : "";
  return {
    source_name: "crossref",
    source_record_id: item.DOI ?? item.URL,
    title: normalizeWhitespace(item.title?.[0]),
    abstract: stripTags(item.abstract ?? ""),
    publication_date: publicationDate,
    year: dateParts[0] ?? "",
    doi: item.DOI ?? "",
    url: item.URL ?? "",
    open_access_url: "",
    venue_name: item["container-title"]?.[0] ?? "",
    publisher: item.publisher ?? "",
    work_type: item.type ?? "",
    authors: (item.author ?? []).map((author) => normalizeWhitespace(`${author.given ?? ""} ${author.family ?? ""}`)).filter(Boolean),
    institutions: [],
    concepts: item.subject ?? [],
    references: (item.reference ?? []).map((ref) => ref.DOI ?? ref.article_title).filter(Boolean),
    cited_by_count: item["is-referenced-by-count"] ?? 0,
    license: item.license?.[0]?.URL ?? "",
    raw_path: rawPath,
  };
}

function fromDoaj(item, rawPath) {
  const bib = item.bibjson ?? {};
  const identifiers = bib.identifier ?? [];
  const doi = identifiers.find((identifier) => identifier.type === "doi")?.id ?? "";
  const link = (bib.link ?? []).find((candidate) => candidate.type === "fulltext" || candidate.url)?.url ?? "";
  const year = bib.year ?? "";
  const month = monthNumber(bib.month);
  const publicationDate = year ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01` : "";
  return {
    source_name: "doaj",
    source_record_id: item.id ?? doi ?? link,
    title: normalizeWhitespace(bib.title),
    abstract: normalizeWhitespace(bib.abstract),
    publication_date: publicationDate,
    year,
    doi,
    url: link || (doi ? `https://doi.org/${doi}` : ""),
    open_access_url: link,
    venue_name: bib.journal?.title ?? "",
    publisher: bib.journal?.publisher ?? "",
    work_type: "journal-article",
    authors: (bib.author ?? []).map((author) => author.name).filter(Boolean),
    institutions: [],
    concepts: [...(bib.keywords ?? []), ...(bib.subject ?? []).map((subject) => subject.term).filter(Boolean)],
    references: [],
    cited_by_count: 0,
    license: bib.license?.[0]?.type ?? "",
    raw_path: rawPath,
  };
}

function fromDoajOai(xml, rawPath) {
  const records = [];
  for (const record of xml.matchAll(/<record[\s\S]*?<\/record>/gi)) {
    const fragment = record[0];
    if (/<header[^>]*\sstatus=["']deleted["']/i.test(fragment)) continue;
    const metadata = fragment.match(/<metadata[\s\S]*?<\/metadata>/i)?.[0] ?? "";
    if (!metadata) continue;
    const identifiers = dcValues(metadata, "identifier");
    const doi = identifiers.map(cleanIdentifier).find((identifier) => /^10\.\S+\/\S+/.test(identifier)) ?? "";
    const url = identifiers.map(cleanIdentifier).find((identifier) => /^https?:\/\//i.test(identifier)) ?? (doi ? `https://doi.org/${doi}` : "");
    const date = normalizePublicationDate(dcValues(metadata, "date")[0] ?? "");
    const subjects = dcValues(metadata, "subject")
      .map((subject) => subject.replace(/^CLASSIFICATION:/i, "").trim())
      .filter(Boolean);
    records.push({
      source_name: "doaj-oai",
      source_record_id: dcValues(fragment.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? "", "identifier")[0] ?? doi ?? url,
      title: normalizeWhitespace(dcValues(metadata, "title")[0]),
      abstract: normalizeWhitespace(dcValues(metadata, "description").join(" ")),
      publication_date: date,
      year: date.slice(0, 4),
      doi,
      url,
      open_access_url: url,
      venue_name: dcValues(metadata, "source")[0] ?? "",
      publisher: dcValues(metadata, "publisher")[0] ?? "",
      work_type: dcValues(metadata, "type")[0] ?? "journal-article",
      authors: dcValues(metadata, "creator"),
      institutions: [],
      concepts: subjects,
      references: [],
      cited_by_count: 0,
      license: dcValues(metadata, "rights")[0] ?? "",
      raw_path: rawPath,
    });
  }
  return records;
}

function dcValues(xml, tag) {
  const values = [];
  const pattern = new RegExp(`<(?:[^:>]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, "gi");
  for (const match of xml.matchAll(pattern)) {
    const value = normalizeWhitespace(decodeXml(stripTags(match[1])));
    if (value) values.push(value);
  }
  return values;
}

function cleanIdentifier(value) {
  return String(value ?? "")
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/doi\.org\//i, "")
    .trim();
}

function fromOsfPreprint(item, rawPath) {
  const attrs = item.attributes ?? {};
  const date = attrs.date_published ?? attrs.original_publication_date ?? attrs.date_created ?? "";
  const provider = item.relationships?.provider?.links?.related?.href?.split("/").filter(Boolean).at(-1) ?? "osf";
  return {
    source_name: "osf-preprints",
    source_record_id: item.id,
    title: normalizeWhitespace(attrs.title),
    abstract: normalizeWhitespace(attrs.description),
    publication_date: String(date).slice(0, 10),
    year: String(date).slice(0, 4),
    doi: attrs.doi ?? "",
    url: attrs.preprint_doi_created && attrs.doi ? `https://doi.org/${attrs.doi}` : `https://osf.io/preprints/${provider}/${String(item.id).split("_")[0]}`,
    open_access_url: `https://osf.io/preprints/${provider}/${String(item.id).split("_")[0]}`,
    venue_name: provider === "socarxiv" ? "SocArXiv" : "OSF Preprints",
    publisher: "Center for Open Science",
    work_type: "preprint",
    authors: [],
    institutions: [],
    concepts: (attrs.tags ?? []).map((tag) => String(tag)),
    references: [],
    cited_by_count: 0,
    license: attrs.license_record?.name ?? "",
    raw_path: rawPath,
  };
}

function fromHcommons(item, rawPath) {
  const meta = item.metadata ?? {};
  const date = meta.publication_date ?? item.created ?? "";
  const doi = item.pids?.doi?.identifier ?? "";
  const urlIdentifier = (meta.identifiers ?? []).find((identifier) => identifier.scheme === "url")?.identifier ?? "";
  const subjects = (meta.subjects ?? []).map((subject) => subject.subject).filter(Boolean);
  return {
    source_name: "hcommons",
    source_record_id: item.id,
    title: normalizeWhitespace(meta.title),
    abstract: stripTags(meta.description ?? ""),
    publication_date: normalizePublicationDate(date),
    year: String(date).slice(0, 4),
    doi,
    url: item.links?.self_html ?? urlIdentifier,
    open_access_url: item.links?.self_html ?? urlIdentifier,
    venue_name: meta.publisher ?? "Knowledge Commons Works",
    publisher: meta.publisher ?? "Knowledge Commons Works",
    work_type: meta.resource_type?.title?.en ?? meta.resource_type?.id ?? "repository-record",
    authors: (meta.creators ?? []).map((creator) => creator.person_or_org?.name).filter(Boolean),
    institutions: (meta.creators ?? []).flatMap((creator) => (creator.affiliations ?? []).map((affiliation) => affiliation.name)).filter(Boolean),
    concepts: subjects,
    references: [],
    cited_by_count: 0,
    license: meta.rights?.[0]?.title?.en ?? meta.rights?.[0]?.id ?? "",
    raw_path: rawPath,
  };
}

function fromArxiv(xml, rawPath) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
    const entry = match[1];
    const id = text(entry, "id");
    const published = text(entry, "published").slice(0, 10);
    return {
      source_name: "arxiv",
      source_record_id: id,
      title: normalizeWhitespace(decodeXml(text(entry, "title"))),
      abstract: normalizeWhitespace(decodeXml(text(entry, "summary"))),
      publication_date: published,
      year: published.slice(0, 4),
      doi: "",
      url: id,
      open_access_url: id,
      venue_name: "arXiv",
      publisher: "arXiv",
      work_type: "preprint",
      authors: [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map((author) => decodeXml(author[1]).trim()),
      institutions: [],
      concepts: [...entry.matchAll(/<category term="([^"]+)"/g)].map((cat) => cat[1]),
      references: [],
      cited_by_count: 0,
      license: "",
      raw_path: rawPath,
    };
  });
}

function fromNber(html, rawPath) {
  const rows = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]+href="\/papers\/(w\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = stripTags(decodeXml(match[2]));
    if (!title || title.length < 8) continue;
    rows.push({
      source_name: "nber",
      source_record_id: id,
      title,
      abstract: "",
      publication_date: "",
      year: "",
      doi: "",
      url: `https://www.nber.org/papers/${id}`,
      open_access_url: `https://www.nber.org/papers/${id}`,
      venue_name: "NBER Working Papers",
      publisher: "National Bureau of Economic Research",
      work_type: "working-paper",
      authors: [],
      institutions: [],
      concepts: ["economic history", "economics"],
      references: [],
      cited_by_count: 0,
      license: "",
      raw_path: rawPath,
    });
  }
  return rows;
}

function invertAbstract(index) {
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words[pos] = word;
  }
  return normalizeWhitespace(words.join(" "));
}

function text(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1] : "";
}

function monthNumber(value) {
  if (!value) return 1;
  const textValue = String(value).toLowerCase();
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const index = months.findIndex((month) => month.startsWith(textValue.slice(0, 3)));
  return index === -1 ? 1 : index + 1;
}

function normalizePublicationDate(value) {
  const textValue = String(value ?? "");
  if (/^\d{4}$/.test(textValue)) return `${textValue}-01-01`;
  if (/^\d{4}-\d{2}$/.test(textValue)) return `${textValue}-01`;
  return textValue.slice(0, 10);
}

function buildTopicRows(items) {
  const counts = new Map();
  for (const item of items) {
    const labels = [...(item.disciplines ?? []), ...(item.methods ?? []), ...(item.quantitative_signals ?? [])];
    for (const label of labels) {
      const key = label.toLowerCase();
      const row = counts.get(key) ?? { label: key, kind: inferKind(key), count: 0, titles: [] };
      row.count += 1;
      if (row.titles.length < 3 && item.title) row.titles.push(item.title);
      counts.set(key, row);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      label: row.label,
      kind: row.kind,
      count: row.count,
      representative_titles: row.titles.join(" | "),
    }));
}

function inferKind(label) {
  if (taxonomyLike("disciplines", label)) return "discipline";
  if (taxonomyLike("methods", label)) return "method";
  return "quantitative-signal";
}

function taxonomyLike(key, label) {
  const values = key === "disciplines"
    ? ["literature", "history", "philosophy", "classics", "religious studies", "art history", "cultural studies", "digital humanities", "linguistics", "anthropology", "sociology", "economics", "political science"]
    : ["close reading", "archival history", "philology", "intellectual history", "reception history", "canon", "translation", "cultural analytics", "stylometry", "network", "topic model", "gis", "spatial", "large language model", "llm", "bibliometric", "corpus"];
  return values.includes(label);
}

function buildOpportunityRows(items) {
  const has = (needle) => items.some((item) => `${item.title} ${item.abstract} ${(item.concepts ?? []).join(" ")}`.toLowerCase().includes(needle));
  const rows = [
    {
      opportunity: "The rise of AI and the humanities",
      format: "field-map",
      source_basis: "Works mentioning AI, LLMs, archives, digital humanities, and computational humanities.",
      first_study: "Map 2020-present publication growth, methods, venues, and representative works.",
      risk: "AI terminology is noisy and may include technical papers with thin humanities relevance.",
    },
    {
      opportunity: "Canon drift",
      format: "moving-canon",
      source_basis: "Works mentioning canon, syllabi, reception, anthologies, citation, or literary history.",
      first_study: "Compare authors and texts across syllabi, anthologies, and citation metadata.",
      risk: "Syllabus and anthology coverage may be uneven and institutionally biased.",
    },
    {
      opportunity: "Concept drift in humanities keywords",
      format: "what-changed",
      source_basis: "Works using historically loaded keywords such as democracy, civilization, empire, labor, race, and nature.",
      first_study: "Track contextual terms over time and show representative passages.",
      risk: "Metadata abstracts may be too short; full-text or excerpt corpora may be needed.",
    },
  ];
  if (has("translation")) {
    rows.push({
      opportunity: "Translation as cultural change",
      format: "what-changed",
      source_basis: "Translation-studies records in the corpus.",
      first_study: "Compare translation topics, source languages, and methods over time.",
      risk: "Publication metadata may miss language pairs and edition details.",
    });
  }
  if (has("environmental humanities")) {
    rows.push({
      opportunity: "Environmental humanities field map",
      format: "field-map",
      source_basis: "Environmental humanities records in OpenAlex, Crossref, and OA sources.",
      first_study: "Map topics, regions, periods, and methods in 2020-present work.",
      risk: "Climate and environmental social science may swamp humanities-specific work.",
    });
  }
  return rows;
}

function relevanceScore(work) {
  const haystack = `${work.title ?? ""} ${work.abstract ?? ""} ${(work.concepts ?? []).join(" ")}`.toLowerCase();
  const humanitiesTerms = [
    "humanities",
    "literature",
    "literary",
    "history",
    "historical",
    "philosophy",
    "classics",
    "archive",
    "archival",
    "culture",
    "cultural",
    "canon",
    "translation",
    "reception",
    "museum",
    "religion",
    "textual",
    "philology",
    "art history",
    "public history",
  ];
  const methodTerms = [
    "digital humanities",
    "computational humanities",
    "cultural analytics",
    "distant reading",
    "stylometry",
    "corpus",
    "citation",
    "bibliometric",
    "large language model",
    "llm",
    "topic model",
  ];
  return humanitiesTerms.filter((term) => hasTerm(haystack, term)).length +
    methodTerms.filter((term) => hasTerm(haystack, term)).length;
}
