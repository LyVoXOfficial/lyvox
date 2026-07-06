#!/usr/bin/env node
// PERF-06: fails CI when a key route's client JS grows past its committed
// budget. Turbopack (the default bundler since Next 16, including
// `next build`) doesn't emit the classic webpack-bundle-analyzer report or a
// per-route "First Load JS" table (`@next/bundle-analyzer` no-ops under
// Turbopack — see `pnpm analyze`, which forces `--webpack` for that one-off
// inspection). This script instead reads the same information Next itself
// uses to hydrate a route: each route's `page_client-reference-manifest.js`
// lists every `/_next/static/chunks/*.js` file the route's client tree needs.
// We gzip-sum the unique chunk files per route and compare against a
// committed ceiling — a real, lightweight regression gate, not a bundle
// analyzer re-implementation.
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..", "..");
const nextDir = resolve(webRoot, ".next");
const budgetPath = resolve(__dirname, "bundle-budget.json");

if (!existsSync(nextDir)) {
  console.error("check-bundle-budget: .next not found — run `pnpm build` first.");
  process.exit(1);
}

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));

const CHUNK_REF_RE = /\/_next\/static\/chunks\/[^"\\]+\.js/g;

function gzipKb(route) {
  const segments = route.split("/").filter(Boolean);
  const manifestPath = resolve(nextDir, "server", "app", ...segments, "page_client-reference-manifest.js");
  if (!existsSync(manifestPath)) {
    throw new Error(`no client-reference-manifest for route "${route}" at ${manifestPath}`);
  }
  const manifestSource = readFileSync(manifestPath, "utf8");
  const chunkFiles = new Set(manifestSource.match(CHUNK_REF_RE) ?? []);

  let totalBytes = 0;
  for (const chunkRef of chunkFiles) {
    // chunkRef looks like "/_next/static/chunks/<name>.js"
    const chunkPath = resolve(nextDir, "static", "chunks", chunkRef.replace("/_next/static/chunks/", ""));
    if (!existsSync(chunkPath)) continue; // dynamic-import chunks not always emitted for every route entry
    totalBytes += gzipSync(readFileSync(chunkPath)).length;
  }
  return totalBytes / 1024;
}

let failed = false;
const rows = [];

for (const [route, maxKb] of Object.entries(budget.routes)) {
  let actualKb;
  try {
    actualKb = gzipKb(route);
  } catch (error) {
    console.error(`check-bundle-budget: ${error.message}`);
    failed = true;
    continue;
  }
  const over = actualKb > maxKb;
  if (over) failed = true;
  rows.push({ route, actualKb: Math.round(actualKb * 10) / 10, maxKb, over });
}

console.log("\nPERF-06 bundle budget (gzipped client JS per route, from client-reference-manifest chunks):\n");
for (const row of rows) {
  const status = row.over ? "OVER BUDGET" : "ok";
  console.log(`  ${row.route.padEnd(20)} ${String(row.actualKb).padStart(7)} kB / ${String(row.maxKb).padStart(4)} kB  [${status}]`);
}
console.log("");

if (failed) {
  console.error("check-bundle-budget: one or more routes exceeded their committed budget (scripts/perf/bundle-budget.json).");
  process.exit(1);
}
