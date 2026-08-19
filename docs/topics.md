# Auto topics (goal 4 prototype)

Handoff for whoever finishes [PR #60](https://github.com/PeacefulScience/peacefulscience.org/pull/60). This is a working prototype of auto topic/entity pages. The architecture is settled; the remaining work is **catalog quality** (optional LLM cleanup with a real hosted model) and a review pass before merge.

Previous agent run: https://cursor.com/agents/bc-01a01b14-5fa1-73e4-8526-cbfe82bf5026  
Branch: `cursor/auto-topics-sidecar-5026`

## Do not violate these constraints

These came from the maintainer after several rounds. Breaking them is a regression, not a cleanup.

1. **Topics live in a JSON sidecar**, like `data/doi.json`. Not article front matter. Not article bodies.
2. **Do not alter any git-controlled markdown** except the one-time committed index `content/topics/_index.md`. Scripts must **never overwrite that index**. Do not regenerate it on every build.
3. **Page↔topic linking is Hugo templates** reading the sidecar (`layouts/partials/gettopics.html`), same pattern as `getdoi`. Do **not** rewrite HTML or markdown in `code/render.js`.
4. **Do not enable LLM on Netlify BUILD.** `make topics` / `make topics-llm` are local CLI, like `make doi`. Production only runs `node code/topics/pages.js` to materialize gitignored stubs from the **committed** sidecar.
5. **Do not drop the `t-` folder prefix** on generated stubs. Hugo 0.97.3 `GetPage` was ambiguous when a topic slug matched a book or category basename (example: `genealogical-adam-eve`). Stubs live in `content/topics/t-<slug>/_index.md` and set `url: /topics/<slug>/`.
6. **Do not put API keys in the repo**, `.cursor/environment.json`, or chat. Use Cursor Secrets or a gitignored `.env`.

Editorial `categories:` on articles stay as-is.

## What is implemented

| Piece | Location | When it runs |
| --- | --- | --- |
| Sidecar | `data/topics.json` | Local `make topics` (committed; **not** on Netlify) |
| Gazetteer + phrase extract | `code/topics/extract.js` + `lexicon.json` | Same as `make topics` |
| Optional LLM merge/drop/rekind | `code/topics/cleanup.js` | Local `make topics-llm` only |
| Section index | `content/topics/_index.md` | Committed once; never rewritten |
| Per-topic Hugo stubs | `content/topics/t-<slug>/_index.md` | **Build:** `node code/topics/pages.js` (gitignored) |
| Article chips | `layouts/partials/topics.html` via `gettopics` | Hugo |
| Topic list + reverse pages | `layouts/topics/list.html` | Hugo, from sidecar + `site.GetPage` |
| JSON-LD `about` | `layouts/partials/jsonld/about.html` | Hugo |
| Nav | `config/_default/menu.yml` → `/topics/` | Always |
| Gitignore | `content/topics/*/` | Stubs only; keeps `_index.md` and `data/topics.json` |

**Corpus:** `content/articles/*.md` and top-level `content/prints/*.md` only. Not excerpts, not `prints/deleted/`, not drafts. ~160 docs scanned.

**Sidecar shape:**

```json
{
  "pages": { "/articles/foo/": [{ "slug": "biologos", "title": "BioLogos", "kind": "organization" }] },
  "topics": { "biologos": { "slug": "biologos", "title": "BioLogos", "kind": "organization", "aliases": [], "sameas": [], "pages": ["/articles/foo/"] } }
}
```

Kinds: `person`, `organization`, `work`, `topic`. Page chips show the first **8** sidecar entries. Book pages are entity *targets*, not sources, so they get no chips.

Current committed catalog (gazetteer only; LLM did **not** change it): **145 topics across 153 pages** — 50 ideas, 44 people, 41 works, 10 organizations.

## Commands

```bash
make topics            # rewrite data/topics.json from text (no LLM)
make topics-llm        # same, then optional LLM cleanup
make topic-pages       # gitignored stubs from the sidecar
node code/topics/verify.js
hugo                   # after topic-pages; this repo uses Hugo 0.97.3
```

`code/production` and `netlify.toml` preview commands already run `pages.js` before Hugo when building. `make hugo-watch` does too.

## Remaining work to finalize the PR

1. **Run LLM cleanup with a hosted model, not Ollama 3B.** On this agent VM, Ollama `qwen2.5:3b` echoed the schema and made no safe edits; `llama3.2:3b` tried to drop everything (validator refused). The sidecar was left unchanged. Useful cleanup needs **Groq** (`GROQ_API_KEY` → `llama-3.1-8b-instant`) or **Gemini** (`GEMINI_API_KEY` → `gemini-2.0-flash`), or a larger local model. GitHub Models API was retired 2026-07-30; do not use it.
2. **Force a hosted provider** if Ollama is still running on the VM, otherwise `make topics-llm` will pick Ollama first:
   ```bash
   TOPICS_LLM_PROVIDER=groq make topics-llm
   ```
3. **Inspect the plan before committing.** `cleanup.js` prints what it applied. Unknown slugs are skipped. Drop lists larger than 20% of the catalog are refused. Empty/unsafe plans leave `data/topics.json` unchanged. After a good run: commit the sidecar, run `make topic-pages`, Hugo spot-check, then `node code/topics/verify.js`.
4. **Known gazetteer noise** still in the sidecar (examples, not exhaustive): places (`San Francisco`); generic phrases (`Reading Scripture`); people stored as `kind: topic` (`Richard Buggs`, `Ken Keathley`, `Wayne Grudem`, `Henry Morris`, `Jack Collins`, `Derek Kidner`). Young Earth Creationist → YEC was merged via **lexicon aliases**, not LLM. Prefer lexicon aliases for durable merges; use the LLM for a one-shot cleanup pass.
5. **Do not regenerate `content/topics/_index.md`.** Do not edit existing article markdown.

Optional later (not required to merge the prototype): Algolia facets from the sidecar; admin UI suggestions (goal 1); reuse the entity store for Crossref unstructured citations.

## Secrets for a follow-up Cloud Agent

The previous run had **no linked Cursor environment** (`environment-info.environment` was `null`), so dashboard environment-scoped secrets were not available there.

Add a **Runtime Secret** (redacted from the transcript) in [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents), then **start a new agent**. Existing VMs do not pick up new secrets.

Names the CLI already checks: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `TOPICS_LLM_API_KEY`. Locally, the Makefile `include`s a gitignored `.env`.

Do not enable LLM on Netlify. Do not commit `.env`.

## Verification already done

- After `pages.js`, Hugo 0.97.3 built **1106 pages**, no errors.
- Reverse lists matched the sidecar: BioLogos 29/29, GAE book 58/58, Adam and Eve 75/75.
- Article chips on `/articles/genealogical-rapprochement/` matched the first 8 sidecar entries.
- Book pages get no chips (correct: books are not in the source corpus).

If you change `data/topics.json`, re-run `make topic-pages` and spot-check those same pages plus `/topics/`.

## Landmines

- **`code/extract.js` is RDF extract** (commented out of production). Topic extraction is **`code/topics/extract.js`**. Do not mix them up.
- Stub folders must stay `t-<slug>` even though public URLs are `/topics/<slug>/`.
- `listMarkdown` only sees top-level `*.md` in a directory (not subfolders). That is why excerpts/deleted are excluded.
- `data/dates.json` gained an entry for `content/topics/_index.md` from the Husky content pre-commit hook. Harmless; leave it unless you are rewriting that file.
- Phrase extraction keeps title-case phrases that appear on **≥4 pages**. That is the main source of leftover place/generic noise.
