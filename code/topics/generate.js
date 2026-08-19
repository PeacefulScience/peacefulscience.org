#!/usr/bin/env node
"use strict";

/**
 * Refresh data/topics.json from article/print text.
 *
 * This is a local CLI, like `make doi`. It does not run on every Netlify
 * build, and it never writes content/topics/_index.md (that index is
 * committed once). Generated per-topic Hugo stubs are a separate build
 * step: `node code/topics/pages.js`.
 */

const fs = require("fs");
const path = require("path");
const { ROOT, sourceDocuments } = require("./lib");
const { buildSidecar } = require("./extract");

const OUT = path.join(ROOT, "data", "topics.json");

function main() {
  const docs = sourceDocuments();
  const sidecar = buildSidecar(docs);
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

main();
