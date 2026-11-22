#!/usr/bin/env node
// Fails when upstream's wrangler configs declare a binding (UPPER_CASE name)
// that the matching Fields config lacks, so upstream binding changes are
// caught before deploy instead of at runtime.
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const upstream = path.join(here, "../mcp-cloudflare");

const bindingNames = (file) =>
  new Set(
    [
      ...fs
        .readFileSync(file, "utf8")
        .matchAll(/"(?:binding|name)":\s*"([A-Z][A-Z0-9_]*)"/g),
    ].map((m) => m[1]),
  );

let missing = false;
for (const config of ["wrangler.jsonc", "wrangler.canary.jsonc"]) {
  const ours = bindingNames(path.join(here, config));
  for (const name of bindingNames(path.join(upstream, config))) {
    if (!ours.has(name)) {
      console.error(`${config}: missing upstream binding ${name}`);
      missing = true;
    }
  }
}
process.exit(missing ? 1 : 0);
