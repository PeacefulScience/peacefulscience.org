"use strict";

const fs = require("fs");
const path = require("path");
const {
  ROOT,
  STOPWORDS,
  CATEGORY_SKIP,
  LAST_NAME_SKIP,
  TITLE_SKIP,
  PHRASE_SKIP,
  slugify,
  readMarkdown,
  listMarkdown,
  sourceDocuments,
  mentionCount,
  uniqueAliases,
} = require("./lib");

const KIND_FROM_LEXICON = {
  people: "person",
  organizations: "organization",
  works: "work",
  topics: "topic",
};

function loadLexicon() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "lexicon.json"), "utf8"));
}

function addEntity(entities, entry) {
  const title = entry.title && String(entry.title).trim();
  if (!title) return null;
  if (TITLE_SKIP.has(title.toLowerCase())) return null;

  const slug = entry.slug || slugify(title);
  if (!slug) return null;

  const aliases = uniqueAliases([title, ...(entry.aliases || [])]);
  const existing = entities.get(slug);
  if (existing) {
    existing.aliases = uniqueAliases([...existing.aliases, ...aliases]);
    existing.sameas = unique(existing.sameas.concat(entry.sameas || []));
    if (!existing.kind) existing.kind = entry.kind;
    return existing;
  }

  const entity = {
    slug,
    title,
    kind: entry.kind || "topic",
    aliases,
    sameas: unique(entry.sameas || []),
    source: entry.source || "lexicon",
  };
  entities.set(slug, entity);
  return entity;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function lastName(title) {
  const parts = String(title).trim().split(/\s+/);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1].replace(/[.,]/g, "");
  if (last.length < 6) return null;
  const lower = last.toLowerCase();
  if (STOPWORDS.has(lower) || LAST_NAME_SKIP.has(lower)) return null;
  return last;
}

function personAliases(title) {
  const aliases = [title];
  const noInitials = title.replace(/(^|\s)[A-Z]\.\s+/g, "$1").replace(/\s+/g, " ").trim();
  if (noInitials && noInitials !== title) aliases.push(noInitials);
  return aliases;
}

function gazetteerFromSite(entities) {
  const authorRoot = path.join(ROOT, "content", "authors");
  const authorFiles = fs.readdirSync(authorRoot, { withFileTypes: true })
    .filter((ent) => ent.isDirectory())
    .map((ent) => path.join(authorRoot, ent.name, "_index.md"))
    .filter((file) => fs.existsSync(file));

  const lastNames = new Map();
  const authors = [];

  for (const file of [...new Set(authorFiles)]) {
    const doc = readMarkdown(file);
    const title = doc.data.title;
    if (!title) continue;
    const folder = path.basename(path.dirname(file));
    const entity = addEntity(entities, {
      title,
      kind: "person",
      aliases: personAliases(title),
      sameas: [`/authors/${folder}/`],
      source: "author",
    });
    authors.push({ entity, title, last: lastName(title) });
    if (entity && authors[authors.length - 1].last) {
      const key = authors[authors.length - 1].last.toLowerCase();
      lastNames.set(key, (lastNames.get(key) || 0) + 1);
    }
  }

  for (const row of authors) {
    if (row.last && lastNames.get(row.last.toLowerCase()) === 1) {
      row.entity.aliases = uniqueAliases([...row.entity.aliases, row.last]);
    }
  }

  for (const file of listMarkdown(path.join(ROOT, "content", "books"))) {
    const doc = readMarkdown(file);
    const title = doc.data.title;
    if (!title) continue;
    const words = title.split(/\s+/);
    if (title.length < 12 && words.length < 2) continue;
    addEntity(entities, {
      title,
      slug: path.basename(file, ".md"),
      kind: "work",
      aliases: [title],
      sameas: [`/books/${path.basename(file, ".md")}/`],
      source: "book",
    });
  }

  const categoryRoot = path.join(ROOT, "content", "categories");
  if (fs.existsSync(categoryRoot)) {
    for (const ent of fs.readdirSync(categoryRoot, { withFileTypes: true })) {
      if (!ent.isDirectory() || CATEGORY_SKIP.has(ent.name)) continue;
      const file = path.join(categoryRoot, ent.name, "_index.md");
      if (!fs.existsSync(file)) continue;
      const doc = readMarkdown(file);
      const title = doc.data.title;
      if (!title) continue;
      addEntity(entities, {
        title,
        slug: slugify(title),
        kind: "topic",
        aliases: [title],
        sameas: [`/categories/${ent.name}/`],
        source: "category",
      });
    }
  }

  const seriesRoot = path.join(ROOT, "content", "series");
  if (fs.existsSync(seriesRoot)) {
    for (const ent of fs.readdirSync(seriesRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const file = path.join(seriesRoot, ent.name, "_index.md");
      if (!fs.existsSync(file)) continue;
      const doc = readMarkdown(file);
      const title = doc.data.title;
      if (!title || title.length < 8) continue;
      addEntity(entities, {
        title,
        kind: "topic",
        aliases: [title],
        sameas: [`/series/${ent.name}/`],
        source: "series",
      });
    }
  }
}

function gazetteerFromLexicon(entities) {
  const lexicon = loadLexicon();
  for (const [group, kind] of Object.entries(KIND_FROM_LEXICON)) {
    for (const entry of lexicon[group] || []) {
      addEntity(entities, {
        ...entry,
        kind: entry.kind || kind,
        source: "lexicon",
      });
    }
  }
}

const SOURCE_RANK = {
  lexicon: 4,
  book: 3,
  author: 3,
  category: 2,
  series: 2,
  extracted: 1,
};

function mergeEntities(keep, extra) {
  keep.aliases = uniqueAliases([...keep.aliases, ...extra.aliases]);
  keep.sameas = unique(keep.sameas.concat(extra.sameas || []));
  if ((SOURCE_RANK[extra.source] || 0) > (SOURCE_RANK[keep.source] || 0)) {
    keep.source = extra.source;
    keep.title = extra.title;
    keep.kind = extra.kind;
  }
}

function mergeByAlias(entities) {
  let changed = true;
  while (changed) {
    changed = false;
    const byAlias = new Map();
    for (const entity of [...entities.values()]) {
      for (const alias of entity.aliases) {
        const key = alias.toLowerCase();
        const other = byAlias.get(key);
        if (other && other.slug !== entity.slug) {
          const keep = (SOURCE_RANK[other.source] || 0) >= (SOURCE_RANK[entity.source] || 0) ? other : entity;
          const drop = keep === other ? entity : other;
          mergeEntities(keep, drop);
          entities.delete(drop.slug);
          changed = true;
          break;
        }
        byAlias.set(key, entity);
      }
      if (changed) break;
    }
  }
}

function matchEntities(docs, entities) {
  const hits = new Map();

  for (const entity of entities.values()) {
    const pages = [];
    let mentions = 0;
    for (const doc of docs) {
      let count = 0;
      for (const alias of entity.aliases) {
        count += mentionCount(doc.plain, alias);
      }
      if (count > 0) {
        pages.push({ permalink: doc.permalink, mentions: count });
        mentions += count;
      }
    }
    if (!pages.length) continue;
    hits.set(entity.slug, { entity, pages, mentions });
  }

  return hits;
}

function extractPhrases(docs, existing) {
  const aliasSet = new Set();
  for (const entity of existing.values()) {
    for (const alias of entity.aliases) aliasSet.add(alias.toLowerCase());
  }

  const leadSkip = new Set(["if", "many", "most", "some", "this", "that", "our", "these", "those", "both", "such"]);
  const counts = new Map();
  const phraseRe = /\b([A-Z][a-zA-Z]+(?:\s+(?:(?:of|and|the|v\.|vs\.)\s+)?[A-Z][a-zA-Z]+){1,3})\b/g;

  for (const doc of docs) {
    const seen = new Set();
    let match;
    const text = doc.plain;
    phraseRe.lastIndex = 0;
    while ((match = phraseRe.exec(text))) {
      const phrase = match[1].trim();
      if (phrase.length < 12) continue;
      const lower = phrase.toLowerCase();
      if (aliasSet.has(lower) || seen.has(lower) || PHRASE_SKIP.has(lower)) continue;
      const first = phrase.split(/\s+/)[0].toLowerCase();
      if (STOPWORDS.has(first) || leadSkip.has(first)) continue;
      const last = phrase.split(/\s+/).pop().toLowerCase();
      if (["meeting", "research", "center", "critique", "press", "science", "garden"].includes(last)) continue;
      if (isNearDuplicate(lower, aliasSet)) continue;
      seen.add(lower);
      const row = counts.get(lower) || { title: phrase, pages: new Set() };
      row.pages.add(doc.permalink);
      counts.set(lower, row);
    }
  }

  const extras = [];
  for (const row of counts.values()) {
    if (row.pages.size < 4) continue;
    extras.push({
      title: row.title,
      kind: "topic",
      aliases: [row.title],
      source: "extracted",
    });
  }
  return extras;
}

function isNearDuplicate(lower, aliasSet) {
  const words = lower.split(/\s+/);
  for (const alias of aliasSet) {
    if (alias === lower) return true;
    if (alias.startsWith(lower + " ") || lower.startsWith(alias + " ")) return true;
    const aw = alias.split(/\s+/);
    if (
      words.length >= 2 &&
      aw.length >= 2 &&
      words[0] === aw[0] &&
      words[1] === aw[1]
    ) {
      return true;
    }
  }
  return false;
}

function buildSidecar(docs) {
  const entities = new Map();
  gazetteerFromLexicon(entities);
  gazetteerFromSite(entities);
  mergeByAlias(entities);

  for (const extra of extractPhrases(docs, entities)) {
    addEntity(entities, extra);
  }
  mergeByAlias(entities);

  const hits = matchEntities(docs, entities);
  const topics = {};
  const pages = {};

  const ranked = [...hits.values()].sort((a, b) => {
    const seed = (x) => (x.entity.source === "extracted" ? 0 : 1);
    return seed(b) - seed(a) || b.pages.length - a.pages.length || b.mentions - a.mentions;
  });

  const maxExtracted = 25;
  let extracted = 0;
  const maxDf = Math.ceil(docs.length * 0.5);

  for (const hit of ranked) {
    if (hit.entity.source === "extracted") {
      extracted += 1;
      if (extracted > maxExtracted) continue;
      if (hit.pages.length < 4) continue;
    } else if (hit.entity.source === "book" || hit.entity.source === "author") {
      if (hit.pages.length < 2) continue;
    } else if (hit.pages.length < 1) {
      continue;
    }

    if (hit.pages.length > maxDf && hit.entity.source !== "lexicon" && hit.entity.kind !== "work") {
      continue;
    }

    const topic = {
      slug: hit.entity.slug,
      title: hit.entity.title,
      kind: hit.entity.kind,
      aliases: hit.entity.aliases,
      sameas: hit.entity.sameas,
      pages: hit.pages
        .sort((a, b) => b.mentions - a.mentions || a.permalink.localeCompare(b.permalink))
        .map((row) => row.permalink),
    };
    topics[topic.slug] = topic;

    for (const row of hit.pages) {
      const list = pages[row.permalink] || [];
      list.push({
        slug: topic.slug,
        title: topic.title,
        kind: topic.kind,
        mentions: row.mentions,
      });
      pages[row.permalink] = list;
    }
  }

  for (const permalink of Object.keys(pages)) {
    pages[permalink].sort((a, b) => b.mentions - a.mentions || a.title.localeCompare(b.title));
  }

  const orderedPages = {};
  for (const permalink of Object.keys(pages).sort()) {
    orderedPages[permalink] = pages[permalink];
  }

  const orderedTopics = {};
  for (const slug of Object.keys(topics).sort()) {
    orderedTopics[slug] = topics[slug];
  }

  return { pages: orderedPages, topics: orderedTopics };
}

module.exports = { buildSidecar };
