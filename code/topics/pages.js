#!/usr/bin/env node
"use strict";

/**
 * Materialize gitignored Hugo stubs under content/topics/<slug>/ from
 * data/topics.json. Does not regenerate the committed section index
 * (content/topics/_index.md) and does not rewrite article markdown.
 *
 * Page↔topic links are rendered by Hugo templates from the sidecar,
 * not copied into these stubs.
 */

const fs = require("fs");
const path = require("path");
const { ROOT, yamlQuote } = require("./lib");

const SIDECAR = path.join(ROOT, "data", "topics.json");
const TOPICS_DIR = path.join(ROOT, "content", "topics");
const INDEX = path.join(TOPICS_DIR, "_index.md");

function loadSidecar() {
  if (!fs.existsSync(SIDECAR)) {
    throw new Error(`Missing ${path.relative(ROOT, SIDECAR)}. Run: node code/topics/generate.js`);
  }
  return JSON.parse(fs.readFileSync(SIDECAR, "utf8"));
}

function cleanGenerated(keepIndex) {
  if (!fs.existsSync(TOPICS_DIR)) return;
  for (const ent of fs.readdirSync(TOPICS_DIR, { withFileTypes: true })) {
    const full = path.join(TOPICS_DIR, ent.name);
    if (ent.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
    } else if (ent.name !== "_index.md") {
      fs.unlinkSync(full);
    }
  }
  if (!keepIndex && fs.existsSync(INDEX)) {
    // Never delete the committed index; keepIndex is always true.
  }
}

function stubMarkdown(topic) {
  const sameas = (topic.sameas || []).map((url) => `  - ${yamlQuote(url)}`).join("\n");
  return [
    "---",
    `title: ${yamlQuote(topic.title)}`,
    `url: ${yamlQuote("/topics/" + topic.slug + "/")}`,
    `topic_slug: ${yamlQuote(topic.slug)}`,
    `kind: ${yamlQuote(topic.kind)}`,
    "generated: true",
    "rss: false",
    sameas ? `sameas:\n${sameas}` : "sameas: []",
    "---",
    "",
  ].join("\n");
}

function main() {
  const sidecar = loadSidecar();
  const topics = sidecar.topics || {};

  fs.mkdirSync(TOPICS_DIR, { recursive: true });
  if (!fs.existsSync(INDEX)) {
    console.warn(`Note: ${path.relative(ROOT, INDEX)} is missing; not creating it.`);
  }

  cleanGenerated(true);

  let n = 0;
  for (const topic of Object.values(topics)) {
    const dir = path.join(TOPICS_DIR, `t-${topic.slug}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "_index.md"), stubMarkdown(topic));
    n += 1;
  }

  console.log(`Wrote ${n} generated topic pages under content/topics/ (index left untouched)`);
}

main();
