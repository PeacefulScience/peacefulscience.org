"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

const SOURCE_DIRS = [
  path.join(ROOT, "content", "articles"),
  path.join(ROOT, "content", "prints"),
];

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "for", "to", "as", "at",
  "by", "from", "with", "this", "that", "these", "those", "is", "are", "was",
  "were", "be", "been", "being", "it", "its", "we", "our", "they", "their",
]);

const CATEGORY_SKIP = new Set([
  "news", "featured", "video", "forum", "science", "society", "policy",
  "history", "theology", "dialogue", "design", "art", "confession",
]);

const LAST_NAME_SKIP = new Set([
  "march", "april", "june", "august", "white", "king", "wood", "young",
  "science", "faith", "miller",
]);

const TITLE_SKIP = new Set([
  "peaceful science",
]);

const PHRASE_SKIP = new Set([
  "united states", "grand rapids", "downers grove", "middle east",
  "many christians", "christian faith", "jesus christ", "human origins",
  "washington university", "oxford university press", "cambridge university",
  "science education", "peaceful science forum", "theology and science",
]);

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function yamlQuote(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(String(value));
}

function parseFrontMatter(raw) {
  const match = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: String(raw) };

  const data = {};
  let currentKey = null;
  let currentList = null;

  for (const line of match[1].split("\n")) {
    const item = line.match(/^\s*-\s+(.*)$/);
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);

    if (pair && !line.startsWith(" ") && !line.startsWith("\t")) {
      currentKey = pair[1].toLowerCase();
      const val = stripQuotes(pair[2].trim());
      if (val === "") {
        currentList = [];
        data[currentKey] = currentList;
      } else {
        currentList = null;
        data[currentKey] = coerce(val);
      }
    } else if (item && currentList) {
      currentList.push(stripQuotes(item[1].trim()));
    }
  }

  return { data, body: match[2] };
}

function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, "");
}

function coerce(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function toPlain(markdown) {
  return String(markdown)
    .replace(/\{\{[<%][\s\S]*?[%>]\}\}/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\^[^\]]+\]/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function permalinkFromContent(filePath) {
  const rel = path.relative(path.join(ROOT, "content"), filePath).replace(/\\/g, "/");
  return "/" + rel.replace(/\/_?index\.md$/, "/").replace(/\.md$/, "/");
}

function readMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontMatter(raw);
  return {
    path: filePath,
    permalink: permalinkFromContent(filePath),
    data: parsed.data,
    body: parsed.body,
    plain: toPlain([parsed.data.title, parsed.data.description, parsed.body].filter(Boolean).join("\n")),
  };
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "_index.md")
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile());
}

function sourceDocuments() {
  const docs = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of listMarkdown(dir)) {
      const doc = readMarkdown(file);
      if (doc.data.draft) continue;
      docs.push(doc);
    }
  }
  return docs.sort((a, b) => a.permalink.localeCompare(b.permalink));
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionCount(text, alias) {
  if (!alias || alias.length < 2) return 0;
  const flags = alias.length <= 4 && alias === alias.toUpperCase() ? "g" : "gi";
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(alias)}(?![A-Za-z0-9])`, flags);
  const matches = String(text).match(pattern);
  return matches ? matches.length : 0;
}

function uniqueAliases(aliases) {
  const seen = new Set();
  const out = [];
  for (const alias of aliases) {
    const trimmed = String(alias || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

module.exports = {
  ROOT,
  STOPWORDS,
  CATEGORY_SKIP,
  LAST_NAME_SKIP,
  TITLE_SKIP,
  PHRASE_SKIP,
  slugify,
  yamlQuote,
  parseFrontMatter,
  toPlain,
  permalinkFromContent,
  readMarkdown,
  listMarkdown,
  sourceDocuments,
  mentionCount,
  uniqueAliases,
};
