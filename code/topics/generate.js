#!/usr/bin/env node
"use strict";

/**
 * Refresh data/topics.json from article/print text.
 *
 * This is a local CLI, like `make doi`. It does not run on every Netlify
 * build, and it never writes content/topics/_index.md (that index is
 * committed once). Generated per-topic Hugo stubs are a separate build
 * step: `node code/topics/pages.js`.
 *
 * Optional LLM merge/cleanup (not on Netlify). Defaults to local Ollama:
 *   make topics-llm
 *   node code/topics/generate.js --llm
 */

const fs = require("fs");
const path = require("path");
const { ROOT, sourceDocuments } = require("./lib");
const { buildSidecar } = require("./extract");
const { cleanupWithLlm } = require("./cleanup");

const OUT = path.join(ROOT, "data", "topics.json");
const wantLlm = process.argv.includes("--llm") || process.env.TOPICS_LLM === "1";

async function main() {
  const docs = sourceDocuments();
  let sidecar = buildSidecar(docs);
  if (wantLlm) {
    sidecar = await cleanupWithLlm(sidecar);
  }

  const payload = {
    pages: sidecar.pages,
    topics: sidecar.topics,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 4) + "\n");

  const topicCount = Object.keys(sidecar.topics).length;
  const pageCount = Object.keys(sidecar.pages).length;
  console.log(`Wrote ${OUT}`);
  console.log(`  ${topicCount} topics across ${pageCount} pages (${docs.length} scanned)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
