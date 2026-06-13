import { existsSync } from "node:fs";
import {
  ingestSchemaPath,
  kbDir,
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

if (errors.length) {
  throw new Error(`KB validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(`KB validation passed (${registry.sources.length} sources).`);
