"use strict";

/**
 * Optional LLM cleanup for data/topics.json.
 *
 * Not part of the Netlify BUILD. Run locally:
 *
 *   make topics-llm
 *   node code/topics/generate.js --llm
 *
 * Credentials (any one):
 *   OPENAI_API_KEY          OpenAI Chat Completions
 *   ANTHROPIC_API_KEY       Anthropic Messages
 *   TOPICS_LLM_API_KEY      OpenAI-compatible (set TOPICS_LLM_BASE_URL)
 *
 * Optional:
 *   TOPICS_LLM_MODEL        default gpt-4o-mini or claude-3-5-haiku-latest
 *   TOPICS_LLM_BASE_URL     default https://api.openai.com/v1
 */

const { uniqueAliases } = require("./lib");

const KINDS = new Set(["person", "organization", "work", "topic"]);

function catalogForPrompt(sidecar) {
  return Object.values(sidecar.topics)
    .sort((a, b) => b.pages.length - a.pages.length || a.title.localeCompare(b.title))
    .map((topic) => ({
      slug: topic.slug,
      title: topic.title,
      kind: topic.kind,
      aliases: (topic.aliases || []).slice(0, 6),
      pages: topic.pages.length,
    }));
}

function systemPrompt() {
  return `You clean a list of auto-detected topics from Peaceful Science articles (science, faith, Adam and Eve, evolution, race, AI).

Return JSON only, no markdown, with this shape:
{
  "drop": ["slug", ...],
  "rekind": { "slug": "person|organization|work|topic" },
  "rename": { "slug": "Canonical Title" },
  "merge": [{ "keep": "canonical-slug", "from": ["duplicate-slug", ...] }]
}

Rules:
- merge only when entries are the same entity (spelling variants, "Young Earth Creationist" → Young Earth Creationism, a person extracted as a topic).
- keep the better slug (lexicon/book/author style, not a fragment).
- drop places, generic English, publisher cities, and phrases that are not a useful topic.
- rekind people, organizations, books/articles, vs conceptual topics.
- do not invent slugs. Only use slugs from the input.
- do not merge distinct people, books, or ideas.
- prefer fewer, cleaner topics.`;
}

function parsePlan(raw) {
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const parsed = JSON.parse(text);
  return {
    drop: Array.isArray(parsed.drop) ? parsed.drop.map(String) : [],
    rekind: parsed.rekind && typeof parsed.rekind === "object" ? parsed.rekind : {},
    rename: parsed.rename && typeof parsed.rename === "object" ? parsed.rename : {},
    merge: Array.isArray(parsed.merge) ? parsed.merge : [],
  };
}

function mentionsIndex(sidecar) {
  const map = new Map();
  for (const [permalink, list] of Object.entries(sidecar.pages || {})) {
    for (const item of list) {
      map.set(`${item.slug}\t${permalink}`, item.mentions || 1);
    }
  }
  return map;
}

function applyCleanup(sidecar, plan) {
  const topics = { ...sidecar.topics };
  const mentions = mentionsIndex(sidecar);
  const known = new Set(Object.keys(topics));
  const log = { dropped: [], merged: [], rekinned: [], renamed: [], skipped: [] };

  const take = (slug, why) => {
    if (!known.has(slug) || !topics[slug]) {
      log.skipped.push(`${why}: unknown slug ${slug}`);
      return false;
    }
    return true;
  };

  for (const row of plan.merge || []) {
    const keep = row.keep || row.into;
    const from = row.from || row.into || [];
    if (!take(keep, "merge keep")) continue;
    const keepTopic = topics[keep];
    for (const slug of from) {
      if (slug === keep) continue;
      if (!take(slug, "merge from")) continue;
      const extra = topics[slug];
      keepTopic.aliases = uniqueAliases([
        ...(keepTopic.aliases || []),
        ...(extra.aliases || []),
        extra.title,
      ]);
      keepTopic.sameas = [...new Set([...(keepTopic.sameas || []), ...(extra.sameas || [])])];
      const pageSet = new Set(keepTopic.pages);
      for (const permalink of extra.pages) {
        pageSet.add(permalink);
        const keyKeep = `${keep}\t${permalink}`;
        const keyFrom = `${slug}\t${permalink}`;
        mentions.set(
          keyKeep,
          (mentions.get(keyKeep) || 0) + (mentions.get(keyFrom) || 0)
        );
      }
      keepTopic.pages = [...pageSet].sort();
      delete topics[slug];
      known.delete(slug);
      log.merged.push(`${slug} → ${keep}`);
    }
  }

  for (const slug of plan.drop || []) {
    if (!take(slug, "drop")) continue;
    delete topics[slug];
    known.delete(slug);
    log.dropped.push(slug);
  }

  for (const [slug, kind] of Object.entries(plan.rekind || {})) {
    if (!take(slug, "rekind")) continue;
    if (!KINDS.has(kind)) {
      log.skipped.push(`rekind: bad kind ${kind} for ${slug}`);
      continue;
    }
    if (topics[slug].kind !== kind) {
      topics[slug].kind = kind;
      log.rekinned.push(`${slug}: ${kind}`);
    }
  }

  for (const [slug, title] of Object.entries(plan.rename || {})) {
    if (!take(slug, "rename")) continue;
    const next = String(title).trim();
    if (!next) continue;
    topics[slug].title = next;
    topics[slug].aliases = uniqueAliases([next, ...(topics[slug].aliases || [])]);
    log.renamed.push(`${slug}: ${next}`);
  }

  const pages = {};
  for (const topic of Object.values(topics)) {
    topic.pages = [...new Set(topic.pages)].sort();
    for (const permalink of topic.pages) {
      const list = pages[permalink] || [];
      list.push({
        slug: topic.slug,
        title: topic.title,
        kind: topic.kind,
        mentions: mentions.get(`${topic.slug}\t${permalink}`) || 1,
      });
      pages[permalink] = list;
    }
  }

  for (const permalink of Object.keys(pages)) {
    pages[permalink].sort((a, b) => b.mentions - a.mentions || a.title.localeCompare(b.title));
  }

  const orderedPages = {};
  for (const permalink of Object.keys(pages).sort()) orderedPages[permalink] = pages[permalink];
  const orderedTopics = {};
  for (const slug of Object.keys(topics).sort()) orderedTopics[slug] = topics[slug];

  return { pages: orderedPages, topics: orderedTopics, log };
}

function llmConfig() {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY || process.env.TOPICS_LLM_API_KEY;
  if (process.env.TOPICS_LLM_PROVIDER === "anthropic" || (anthropic && !openai)) {
    if (!anthropic) return null;
    return {
      provider: "anthropic",
      key: anthropic,
      model: process.env.TOPICS_LLM_MODEL || "claude-3-5-haiku-latest",
    };
  }
  if (!openai) return null;
  return {
    provider: "openai",
    key: openai,
    model: process.env.TOPICS_LLM_MODEL || "gpt-4o-mini",
    base: (process.env.TOPICS_LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
  };
}

async function callLlm(config, catalog) {
  const user = `Clean this topic catalog:\n${JSON.stringify(catalog)}`;
  if (config.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt(),
        messages: [{ role: "user", content: user }],
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(body)}`);
    return (body.content || []).map((part) => part.text || "").join("\n");
  }

  const res = await fetch(`${config.base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: user },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI-compatible ${res.status}: ${JSON.stringify(body)}`);
  return body.choices?.[0]?.message?.content || "";
}

async function cleanupWithLlm(sidecar) {
  const config = llmConfig();
  if (!config) {
    throw new Error(
      "No LLM credentials. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or TOPICS_LLM_API_KEY."
    );
  }
  const catalog = catalogForPrompt(sidecar);
  console.log(`LLM cleanup: ${config.provider} ${config.model} (${catalog.length} topics)`);
  const raw = await callLlm(config, catalog);
  const plan = parsePlan(raw);
  const result = applyCleanup(sidecar, plan);
  console.log(
    `  merged ${result.log.merged.length}, dropped ${result.log.dropped.length}, rekinned ${result.log.rekinned.length}, renamed ${result.log.renamed.length}`
  );
  if (result.log.skipped.length) {
    console.log(`  skipped ${result.log.skipped.length}: ${result.log.skipped.slice(0, 8).join("; ")}`);
  }
  return { pages: result.pages, topics: result.topics };
}

module.exports = {
  catalogForPrompt,
  parsePlan,
  applyCleanup,
  llmConfig,
  cleanupWithLlm,
};

if (require.main === module) {
  const fs = require("fs");
  const path = require("path");
  const { ROOT } = require("./lib");
  const sidecar = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "topics.json"), "utf8"));
  const planPath = process.argv[2];
  if (!planPath) {
    console.log("Usage: node code/topics/cleanup.js <plan.json>");
    console.log("Or run: node code/topics/generate.js --llm");
    process.exit(0);
  }
  const plan = parsePlan(fs.readFileSync(planPath, "utf8"));
  const result = applyCleanup(sidecar, plan);
  console.log(JSON.stringify({
    topics: Object.keys(result.topics).length,
    pages: Object.keys(result.pages).length,
    log: result.log,
  }, null, 2));
}
