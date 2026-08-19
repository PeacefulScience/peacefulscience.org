"use strict";

/**
 * Optional LLM cleanup for data/topics.json.
 *
 * Not part of the Netlify BUILD. Run locally:
 *
 *   make topics-llm
 *   node code/topics/generate.js --llm
 *
 * Default for testing: a local Ollama model (free, no key) if
 * `ollama serve` is running. Then free-tier hosted keys, then paid APIs:
 *   ollama                  http://127.0.0.1:11434  (llama3.2:3b)
 *   GROQ_API_KEY            Groq OpenAI-compatible (free tier)
 *   GEMINI_API_KEY          Gemini generateContent (free tier)
 *   OPENAI_API_KEY          OpenAI Chat Completions
 *   ANTHROPIC_API_KEY       Anthropic Messages
 *   TOPICS_LLM_API_KEY      OpenAI-compatible (set TOPICS_LLM_BASE_URL)
 *
 * Optional:
 *   TOPICS_LLM_PROVIDER     ollama | groq | gemini | openai | anthropic
 *   TOPICS_LLM_MODEL        override model name
 *   TOPICS_LLM_BASE_URL     override OpenAI-compatible base URL
 *   OLLAMA_HOST             default 127.0.0.1:11434
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
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return normalizePlan(raw);
  }
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  return normalizePlan(JSON.parse(text));
}

function normalizePlan(parsed) {
  return {
    drop: Array.isArray(parsed.drop) ? parsed.drop.map(String) : [],
    rekind: parsed.rekind && typeof parsed.rekind === "object" && !Array.isArray(parsed.rekind) ? parsed.rekind : {},
    rename: parsed.rename && typeof parsed.rename === "object" && !Array.isArray(parsed.rename) ? parsed.rename : {},
    merge: Array.isArray(parsed.merge) ? parsed.merge : [],
  };
}

function validatePlan(plan, knownSlugs, catalogSize) {
  const known = new Set(knownSlugs);
  const skip = [];
  const drop = [];
  for (const slug of plan.drop || []) {
    if (!known.has(slug)) skip.push(`drop unknown ${slug}`);
    else drop.push(slug);
  }
  const maxDrop = Math.max(8, Math.floor(catalogSize * 0.2));
  if (drop.length > maxDrop) {
    skip.push(`refused drop of ${drop.length} topics (max ${maxDrop})`);
    drop.length = 0;
  }

  const rekind = {};
  for (const [slug, kind] of Object.entries(plan.rekind || {})) {
    if (!known.has(slug)) skip.push(`rekind unknown ${slug}`);
    else if (!KINDS.has(kind)) skip.push(`rekind bad kind ${kind}`);
    else rekind[slug] = kind;
  }

  const rename = {};
  for (const [slug, title] of Object.entries(plan.rename || {})) {
    if (!known.has(slug)) skip.push(`rename unknown ${slug}`);
    else if (String(title).trim()) rename[slug] = String(title).trim();
  }

  const merge = [];
  for (const row of plan.merge || []) {
    const keep = row.keep || row.into;
    const from = (row.from || []).filter((slug) => slug && slug !== keep);
    if (!known.has(keep)) {
      skip.push(`merge keep unknown ${keep}`);
      continue;
    }
    const validFrom = from.filter((slug) => known.has(slug));
    for (const slug of from) {
      if (!known.has(slug)) skip.push(`merge from unknown ${slug}`);
    }
    if (validFrom.length) merge.push({ keep, from: validFrom });
  }

  return { drop, rekind, rename, merge, skipped: skip };
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

function ollamaBase() {
  const host = process.env.OLLAMA_HOST || "127.0.0.1:11434";
  return (host.startsWith("http") ? host : `http://${host}`).replace(/\/$/, "");
}

async function detectOllama() {
  const base = ollamaBase();
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(800) });
    if (!res.ok) return null;
    const body = await res.json();
    const names = (body.models || []).map((model) => model.name);
    const preferred =
      process.env.TOPICS_LLM_MODEL ||
      names.find((name) => name.startsWith("qwen2.5:3b")) ||
      names.find((name) => name.startsWith("llama3.2:3b")) ||
      names.find((name) => name.includes("qwen2.5")) ||
      names.find((name) => name.includes("llama3.2")) ||
      names[0];
    if (!preferred) return null;
    return { provider: "ollama", base, model: preferred };
  } catch {
    return null;
  }
}

async function resolveLlmConfig() {
  const forced = (process.env.TOPICS_LLM_PROVIDER || "").toLowerCase();
  const groq = process.env.GROQ_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY || process.env.TOPICS_LLM_API_KEY;

  if (forced === "ollama" || (!forced && !groq && !gemini && !anthropic && !openai)) {
    const ollama = await detectOllama();
    if (ollama) return ollama;
    if (forced === "ollama") {
      throw new Error("Ollama is not running. Start `ollama serve` and pull llama3.2:3b.");
    }
  }
  if (forced === "groq" || (!forced && groq)) {
    if (!groq) throw new Error("GROQ_API_KEY is not set.");
    return {
      provider: "openai",
      key: groq,
      model: process.env.TOPICS_LLM_MODEL || "llama-3.1-8b-instant",
      base: (process.env.TOPICS_LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, ""),
    };
  }
  if (forced === "gemini" || (!forced && gemini)) {
    if (!gemini) throw new Error("GEMINI_API_KEY is not set.");
    return {
      provider: "gemini",
      key: gemini,
      model: process.env.TOPICS_LLM_MODEL || "gemini-2.0-flash",
    };
  }
  if (forced === "anthropic" || (!forced && anthropic && !openai)) {
    if (!anthropic) throw new Error("ANTHROPIC_API_KEY is not set.");
    return {
      provider: "anthropic",
      key: anthropic,
      model: process.env.TOPICS_LLM_MODEL || "claude-3-5-haiku-latest",
    };
  }
  if (openai) {
    return {
      provider: "openai",
      key: openai,
      model: process.env.TOPICS_LLM_MODEL || "gpt-4o-mini",
      base: (process.env.TOPICS_LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    };
  }
  return null;
}

async function callLlm(config, catalog) {
  const user = `Clean this topic catalog:\n${JSON.stringify(catalog)}`;
  const messages = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: user },
  ];

  if (config.provider === "ollama") {
    const res = await fetch(`${config.base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${JSON.stringify(body)}`);
    return body.message?.content || "";
  }

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

  if (config.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(body)}`);
    return (body.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n");
  }

  const headers = { "content-type": "application/json" };
  if (config.key) headers.authorization = `Bearer ${config.key}`;
  const payload = {
    model: config.model,
    temperature: 0,
    messages,
  };
  if (!String(config.base || "").includes("groq")) payload.response_format = { type: "json_object" };
  const res = await fetch(`${config.base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI-compatible ${res.status}: ${JSON.stringify(body)}`);
  return body.choices?.[0]?.message?.content || "";
}

async function cleanupWithLlm(sidecar) {
  const config = await resolveLlmConfig();
  if (!config) {
    throw new Error(
      "No LLM available. Start `ollama serve` and `ollama pull llama3.2:3b`, or set GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY."
    );
  }
  const catalog = catalogForPrompt(sidecar);
  console.log(`LLM cleanup: ${config.provider} ${config.model} (${catalog.length} topics)`);
  const raw = await callLlm(config, catalog);
  const parsed = parsePlan(raw);
  const plan = validatePlan(parsed, Object.keys(sidecar.topics), catalog.length);
  if (plan.skipped.length) {
    console.log(`  filtered ${plan.skipped.length} unsafe/unknown actions`);
  }
  const meaningful =
    plan.drop.length || plan.merge.length || Object.keys(plan.rekind).length || Object.keys(plan.rename).length;
  if (!meaningful) {
    console.log("  no safe edits from the model; leaving catalog unchanged");
    return sidecar;
  }
  const result = applyCleanup(sidecar, plan);
  result.log.skipped = [...plan.skipped, ...result.log.skipped];
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
  validatePlan,
  applyCleanup,
  resolveLlmConfig,
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
