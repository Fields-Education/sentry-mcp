#!/usr/bin/env node
/**
 * Align the `packages/mcp-cloudflare-fields` lockfile importer with
 * `packages/mcp-cloudflare`.
 *
 * Why this exists:
 *   The fork package symlinks upstream's `src/`, `vite.config.ts` and tsconfigs,
 *   so both workspaces must resolve to the *same* physical dependency instances.
 *   `pnpm install` resolves vite's optional peers (jiti/yaml/...) independently
 *   per importer, which yields two distinct `vite` instances and breaks
 *   `tsc -b` with "Two different types with this name exist".
 *
 * What it does:
 *   For every dependency the two importers share with an identical specifier,
 *   rewrite the fork importer's resolved `version:` to upstream's value.
 *
 * Run after any `pnpm install` that regenerates the lockfile (e.g. upstream syncs):
 *   node packages/mcp-cloudflare-fields/scripts/align-lockfile.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const lockPath = join(repoRoot, "pnpm-lock.yaml");

const SOURCE_IMPORTER = "  packages/mcp-cloudflare:";
const TARGET_IMPORTER = "  packages/mcp-cloudflare-fields:";

const lines = readFileSync(lockPath, "utf8").split("\n");

/** Returns [startIndex, endIndex) of an importer block's body. */
function findImporterBody(header) {
  const start = lines.indexOf(header);
  if (start === -1) {
    throw new Error(`Importer not found in pnpm-lock.yaml: ${header.trim()}`);
  }
  let end = start + 1;
  while (end < lines.length && !/^ {2}\S/.test(lines[end])) {
    end += 1;
  }
  return [start + 1, end];
}

/**
 * Parses `name -> { specifier, version, versionLineIndex }` from an importer
 * body. Entries live at 6-space indentation under dependency groups:
 *
 *   dependencies:
 *     vite:
 *       specifier: 'catalog:'
 *       version: 6.3.5(...)
 */
function parseEntries(body) {
  const entries = new Map();
  let current = null;

  for (const index of body) {
    const line = lines[index];
    const nameMatch = line.match(/^ {6}('?[^'\s:]+'?):$/);
    if (nameMatch) {
      current = { name: nameMatch[1].replace(/'/g, ""), specifier: null };
      entries.set(current.name, current);
      continue;
    }
    if (!current) continue;

    const specifierMatch = line.match(/^ {8}specifier: (.*)$/);
    if (specifierMatch) {
      current.specifier = specifierMatch[1];
      continue;
    }
    const versionMatch = line.match(/^ {8}version: (.*)$/);
    if (versionMatch) {
      current.version = versionMatch[1];
      current.versionLineIndex = index;
    }
  }

  return entries;
}

const range = (from, to) =>
  Array.from({ length: to - from }, (_, offset) => from + offset);

const source = parseEntries(range(...findImporterBody(SOURCE_IMPORTER)));
const target = parseEntries(range(...findImporterBody(TARGET_IMPORTER)));

const changed = [];
for (const [name, entry] of target) {
  const upstream = source.get(name);
  if (!upstream || upstream.specifier !== entry.specifier) continue;
  if (!upstream.version || upstream.version === entry.version) continue;

  lines[entry.versionLineIndex] = `        version: ${upstream.version}`;
  changed.push(name);
}

if (changed.length === 0) {
  console.log("pnpm-lock.yaml: fields importer already aligned");
} else {
  writeFileSync(lockPath, lines.join("\n"));
  console.log(
    `pnpm-lock.yaml: aligned ${changed.length} entrie(s) with @sentry/mcp-cloudflare:\n  ${changed.join("\n  ")}`,
  );
}
