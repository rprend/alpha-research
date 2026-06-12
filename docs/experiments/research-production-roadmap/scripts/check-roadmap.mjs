import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("docs", "experiments", "research-production-roadmap");
const roadmapPath = path.join(root, "roadmap.json");
const reportsDir = path.join(root, "reports");
const roadmap = JSON.parse(await fs.readFile(roadmapPath, "utf8"));

const terminalStatuses = new Set(["artifact-ready", "publication-ready", "blocked"]);
const tracks = roadmap.tracks.map((track) => {
  const requiredEvidence = Array.isArray(track.requiredEvidence) ? track.requiredEvidence : [];
  const nextActions = Array.isArray(track.nextActions) ? track.nextActions : [];
  const complete = terminalStatuses.has(track.status);
  return {
    id: track.id,
    title: track.title,
    priority: track.priority,
    status: track.status,
    complete,
    sourceExperiment: track.sourceExperiment,
    requiredEvidenceCount: requiredEvidence.length,
    nextActionCount: nextActions.length,
    missingRequiredEvidenceList: requiredEvidence.length === 0,
    missingNextActions: nextActions.length === 0,
  };
});

const incomplete = tracks.filter((track) => !track.complete);
const readiness = {
  generatedAt: new Date().toISOString(),
  roadmap: roadmap.generatedFor,
  status: incomplete.length ? "active" : "complete",
  trackCount: tracks.length,
  completeTrackCount: tracks.filter((track) => track.complete).length,
  incompleteTrackCount: incomplete.length,
  tracks,
  nextImplementationQueue: incomplete
    .sort((a, b) => a.priority - b.priority)
    .map((track) => ({
      id: track.id,
      title: track.title,
      status: track.status,
      sourceExperiment: track.sourceExperiment,
    })),
};

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, "roadmap-readiness.json"), `${JSON.stringify(readiness, null, 2)}\n`);
await fs.writeFile(path.join(reportsDir, "roadmap-readiness.md"), buildMarkdown(readiness));

console.log(`Research production roadmap: ${readiness.status} (${readiness.completeTrackCount}/${readiness.trackCount} complete)`);
if (process.argv.includes("--strict") && readiness.status !== "complete") {
  process.exit(1);
}

function buildMarkdown(readiness) {
  return [
    "# Research Production Roadmap Readiness",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Status: ${readiness.status}`,
    `Complete tracks: ${readiness.completeTrackCount}/${readiness.trackCount}`,
    "",
    "| Priority | Track | Status | Complete | Source Experiment |",
    "| ---: | --- | --- | --- | --- |",
    ...readiness.tracks
      .sort((a, b) => a.priority - b.priority)
      .map((track) => `| ${track.priority} | ${track.title} | ${track.status} | ${track.complete ? "yes" : "no"} | \`${track.sourceExperiment}\` |`),
    "",
    "## Next Implementation Queue",
    "",
    ...(
      readiness.nextImplementationQueue.length
        ? readiness.nextImplementationQueue.map((track, index) => `${index + 1}. ${track.title} (${track.status})`)
        : ["No remaining roadmap tracks."]
    ),
    "",
  ].join("\n");
}
