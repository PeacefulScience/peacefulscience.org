#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib");

const SIDECAR = path.join(ROOT, "data", "topics.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(SIDECAR)) fail("missing data/topics.json");
  const data = JSON.parse(fs.readFileSync(SIDECAR, "utf8"));
  if (!data.pages || !data.topics) fail("sidecar needs pages and topics maps");

  for (const [permalink, list] of Object.entries(data.pages)) {
    if (!permalink.startsWith("/")) fail(`bad page key ${permalink}`);
    if (!Array.isArray(list)) fail(`page ${permalink} is not a list`);
    for (const item of list) {
      const topic = data.topics[item.slug];
      if (!topic) fail(`page ${permalink} references missing topic ${item.slug}`);
      if (!topic.pages.includes(permalink)) {
        fail(`topic ${item.slug} missing back-link to ${permalink}`);
      }
    }
  }

  for (const [slug, topic] of Object.entries(data.topics)) {
    if (topic.slug !== slug) fail(`topic slug mismatch ${slug}`);
    if (!topic.title || !topic.kind) fail(`topic ${slug} missing title/kind`);
    if (!Array.isArray(topic.pages) || !topic.pages.length) fail(`topic ${slug} has no pages`);
    for (const permalink of topic.pages) {
      const list = data.pages[permalink] || [];
      if (!list.some((item) => item.slug === slug)) {
        fail(`page ${permalink} missing topic ${slug}`);
      }
    }
  }

  console.log(`ok: ${Object.keys(data.topics).length} topics, ${Object.keys(data.pages).length} pages`);
}

main();
