# Product goals

These are the intended direction for the site, recorded so later work (admin UI, citation quality, search, Word ingest, and any backend change) can be judged against the same list. They come from maintainers; this file maps each goal onto **what the repo does today** and **what has to change**.

Nothing here is implemented yet. Schemas, shortcodes, and the Netlify vs CLI split are documented in the rest of this folder and should be treated as constraints, not optional style.

| # | Goal | Priority |
| --- | --- | --- |
| 1 | Working **admin UI** (no local clone required) | High — unblocks daily publishing |
| 2 | Better **Crossref** reference capture | High for scholarly prints |
| 3 | Better **Algolia** index and search page | High for readers |
| 4 | Auto **topics / entity detection** | Feeds 1 and 3 |
| 5 | Auto **social media posts** | After publish pipeline is hosted |
| 6 | Possibly **split content into its own git repo** | Architectural; after ingest is stable |
| 7 | Consider a **different backend** (processed content on S3, no daily full rebuild) | Architectural; see tradeoffs |
| 8 | Automated **Word → publication format** | **Highest near-term** among implementation work |
| — | **Tracking: remove defunct GA, fix remaining tags** | **Near-term**; independent of Word/admin |

**Suggested order of implementation** (not calendar time): **tracking cleanup can ship first** (small, independent). Then **8 → pieces of 1 (DOI + validation as services) → 2 and 3 in parallel → 4 → 5**. **6 and 7** after the ingest/admin contract is clear, because a content-repo split or S3 site only helps if Word/admin already emit the same files the site expects.

**Sidecar data (DOI pattern):** auto-generated fields belong in `data/*.json` (or an equivalent store), keyed by page path or URL, **not** written back into the article’s front matter or body. `config.yml` has `enableGitInfo: true`, so Hugo `.Lastmod` (page “modified” date, sitemap, Algolia `lastmod`, JSON-LD `dateModified`) is the last **git commit of that markdown file**. Touching the article to store a DOI, detected entities, resolved citations, or a social-post id would bump “modified” even when the prose did not change. See [architecture](architecture.md) § Sidecar data.

This is also **load-bearing for images:** Netlify **does not download Git LFS files** during the Hugo build. Templates cannot open `static/img/…` to read width/height. Adding an image **requires** updating `data/imgsize.json` (`make imginfo` locally, where the real files exist) and committing that JSON with the LFS pointer. Skipping the sidecar means missing `width`/`height` on the live site (layout shift) even if ImageEngine still serves the file. Never regenerate `imgsize.json` on Netlify — Pillow would see pointer files, skip them, and wipe the map.

### Confirmed stack decisions

- **CSS: Tailwind.** Prefer Tailwind for all styling. Production still compiles Bootstrap 4 via `assets/css/main.scss`; the Tailwind pipeline (`sources/tailwind.css` → `assets/css/tw.css`) exists but is commented out of `code/production` and `head.html`. A cleanup should **migrate remaining CSS to Tailwind**, not delete the Tailwind tooling. Print/Prince CSS in `single.print.html` is a separate sheet and must keep working (or be ported deliberately).
- **AMP is defunct.** Do not emit AMP pages. `layouts/_default/baseof.amp.html` and `config/amp/outputs.yml` are deletion candidates.
- **Discourse integration is defunct.** Do not restore `share_discourse.py`, the `DISCOURSE` postbuild task, or auto-`commenturl`. Historical forum URLs in article bodies and existing `commenturl` values can stay as ordinary links until a later content pass. Goal 5 (social posts) does **not** include Discourse.
- **Page PDFs are Prince of `_prince` HTML.** On-demand Lambda for typical pages; if the PDF would be **> ~6 MB**, generate locally and commit Git LFS at `static/pdf/<section>/<slug>.pdf`. Shortcodes must work on the main site **and** in that Prince HTML.
- **Image dimensions live in `data/imgsize.json`.** Netlify does not download LFS; `make imginfo` is local (or a worker that has the bytes).
- **Near-term: tracking.** Remove defunct Universal Analytics. Keep (and fix) live tag loading so Turbo navigations count.

---

## Tracking (near-term)

**Intent:** stop shipping dead Google Analytics, and make the remaining tags actually record visits on this Turbo site.

### What exists

- **GTM** `GTM-KDF8R85` in `layouts/partials/head.html` and a noscript iframe in `baseof.html` (skipped on `hugo server`). Injection is gated on `config.yml` `googleAnalytics: G-BHPH29YM44` (a GA4 id used only as a truthy flag).
- On `turbo:load`, the same script calls **`ga('send', 'pageview', …)`** — Universal Analytics. UA shut down in 2023; that call does nothing useful. Turbo already swapped the page, so GTM’s default first-load pageview also misses in-app navigations.
- **`code/update_analytics.py`** talks to Analytics Reporting API **v3** (`ga:pageviews`, profile `125738398`). Dead. Optional `ANALYTICS` prebuild task; not on git-push or DAILY.
- **`layouts/partials/byviews.html`** `getJSON`s `PeacefulScience/analytics` (`mostread.json` / `trending.json`). Homepage “by views” in `single.html` is commented out.

### What to do

1. **Remove defunct UA:** `ga('send')`; `update_analytics.py`; `ANALYTICS` / `GA_SERVICE`; `byviews.html` and the unused `PeacefulScience/analytics` fetch; Python Analytics client deps if nothing else uses them.
2. **Improve tracking:** keep GTM (or a single GA4 `gtag`) and push a page_view on `turbo:load` with the new path (`dataLayer` or `gtag('event','page_view')`). Load tags independently of the old `googleAnalytics` Hugo param, or rename that param so it is not a UA leftover.
3. Do not restore view-count widgets from UA data.

This does not need Word ingest or an admin UI.

---

## 1. Admin UI (no local repo)

**Intent:** editors publish from a browser. Today every controlled operation that is not “edit a markdown file on GitHub” still needs a laptop: DOI minting, Mailchimp campaigns, and image/PDF metadata.

### What exists

- GitHub file editor via **Suggest Changes** (`layouts/_default/single.html` → `edit/master/content/...`).
- Dead CMS: Decap at `static/admin/`, Forestry at `.forestry/`.
- Local Make: `make doi`, `make news`, `make imginfo` / `pdfinfo` ([build-and-deploy](build-and-deploy.md)).

### Hard parts (these are the product, not polish)

| Concern | Why it is hard in this repo | What an admin must do |
| --- | --- | --- |
| **DOI control** | `code/doi.py` mints `10.54739/xxxx` into `data/doi.json` (sidecar; not front matter). Deposit is a **later** DAILY Netlify step, and only if Hugo logged `TODAY`. Assigning twice, assigning the wrong path, or depositing without a commit all break Crossref. | Explicit “assign DOI” with preview of the path key (`/articles/foo/`), collision check, and a commit of `doi.json` **before** the page is treated as published. Never mint as a silent side effect of save. Never write the DOI into the article file. |
| **Front matter** | Schemas differ by **section and subfolder** ([front-matter](front-matter.md)). Authors are **lists of strings** (slugs or display names), not `{role, slug}` maps. `prints/` vs `prints/excerpts/` vs `prints/deleted/` are three page types. | Form (or generated YAML) **per folder**, validated against the corpus schema. Cascade from `_index.md` must stay visible (e.g. `prints/deleted` sets `rss: false`). |
| **Shortcodes** | Custom `amazon`, `image`, `youtube` (overrides Hugo), `mediatext`, `pdf`, `facebook`, `footnotes2refs`, plus built-in `tweet` / `vimeo`. One broken `twitter` tag. ([shortcodes](shortcodes.md)) | Palette / helpers that insert the **site** shortcodes, not generic Markdown. `amazon` must stash ASINs (book backrefs). `youtube` must use the site player overlay, not Hugo’s embed. **Every shortcode must also render in Prince `_prince` HTML** (print CSS / fallbacks for JS embeds). |
| **Autofill from the web** | Hard-to-find fields: Amazon ASIN, ISBN, Crossref/DOI metadata, YouTube IDs, author affiliations, book covers (`functions/bookcover.js`). `functions/cite.js` already resolves DOI.org + Manubot → CSL-JSON. `data/citation.json` is a cache. | Lookups land in **sidecar** JSON (extend `citation.json` / new maps). The admin may *propose* shortcodes or ISBN in the article; committing those is an editorial save (and *should* bump lastmod). Do not silently patch published files with resolved metadata. |
| **Internal links** | Link render hook records destinations on page scratch. Related content uses Hugo `related` + `series`. Editorial policy already says editors may add related links without asking. | Auto-suggested related URLs live in sidecar data; templates can inject a “related” module without touching the article. Inserting links **into the body** is an editorial accept and should update lastmod. |
| **Categories** | Taxonomy pages in `content/categories/`. `featured` and `gae` are `hidden: true`. `tags` is in `config.yml` but unused. Homepage buckets are **hard-coded** in `layouts/index.html`. | Auto-suggest into sidecar (or an admin review queue). Editor-chosen `categories:` in front matter is editorial, not generated. Do not invent slugs that have no `_index.md`. |
| **New authors** | Missing `content/authors/<slug>/` warns `AUTHOR.MISSING`. Corpus mixes slugs (`swamidass`) and display names (`Dennis Venema`, `Peaceful Science`). | Create author page (bio, affiliation, optional `orcid` / social) when a byline is new; keep display-name bylines valid until a slug exists. |
| **Page PDFs** | Lambda Prince of `_prince` HTML fails when the PDF is **> ~6 MB**. Those files must be generated locally and committed to LFS at `static/pdf/<section>/<slug>.pdf`. | Host Prince or a worker that writes LFS; do not invent a second layout. Same `_prince` HTML as the Lambda. |
| **Images** | Files in `static/img/` are Git LFS. **Netlify does not download LFS** in the build, so Hugo cannot measure them. `image` / `mediatext` / Markdown images / header images read `data/imgsize.json`. | Any upload path must write the LFS object **and** patch `imgsize.json` (Pillow on the real bytes). Do not run `make imginfo` in the Netlify build. |

### Design implication

The admin cannot be “Decap with the current `config.yml`.” It has to own **git writes** for human edits under `content/` **and** generated maps under `data/` (`doi.json` today; later entities, citations, social ids), plus **hosted** equivalents of `make doi` / image metadata. Mailchimp campaign compose can stay out of v1 if newsletters remain rare; subscribe forms already work in the browser. Campaign ids currently written into newsletter front matter (`mailchimp.campaign_id`) are the pattern **not** to copy — they belong in sidecar data too.

A Word ingest (goal 8) is the primary **create** path; the admin is the **review / enrich / assign DOI / publish** path.

---

## 2. Crossref files that capture references accurately

**Intent:** deposited XML should list the works a page actually cites, not only a subset of Markdown links that happen to be DOI or ISBN URLs.

### What exists

Hugo always emits three batches during BUILD: `layouts/_default/home.xref{posted,book,conf}.xml`. Deposit is DAILY + `TODAY` only.

Citations today:

1. The **link render hook** appends destinations to page scratch `"Links"`.
2. `layouts/partials/xref/citation_list.xml` walks that list.
3. `citation.xml` emits a `<citation>` only if:
   - the URL is `https://peacefulscience.org/...` **and** that page has a DOI in `data/doi.json` or an `isbn`, or
   - the URL contains `doi.org/10.`

`citation_url.xml` stubs a `getJSON` to `/cite/` and does **not** emit citation XML. Footnotes, `amazon` ASINs, unstructured bibliography lines, and Zotero-style notes are ignored. `citeproc` and `zotero-translators` are in `package.json` and unused. `functions/cite.js` can resolve a URL to CSL-JSON but is not on the deposit path.

### What “more accurately” has to cover

- Footnote / reference sections (including pages that use `footnotes2refs`).
- `{{< amazon ASIN >}}` (215 uses) → ISBN/ASIN citations.
- Bare DOIs and `doi.org` links (already partly handled).
- Internal PS links to prints/books (already partly handled).
- Unstructured citations (author-year, journal names) via cite/Manubot/Crossref lookup, with a **review** step so wrong matches are not deposited.
- Deduping the same work cited as both a link and a footnote.

Resolved citation metadata (CSL-JSON, Crossref matches, Amazon → ISBN) belongs in sidecar data (`data/citation.json` already caches URL lookups). The deposit XML is generated at build time from that map plus the page’s links/footnotes — not by rewriting each article.

DOI **assignment** stays a separate, gated action (goal 1). Improving XML must not auto-mint DOIs.

---

## 3. Algolia indexing and search page

**Intent:** search should stay current, cover the right corpus, and be usable (filters, ranking, pagination, shareable URLs).

### What exists

- Index built every production BUILD: `layouts/_default/list.algolia.json` for sections `articles`, `prints`, `about`, `newsletter`.
- Fields include up to 90k characters of `.Plain`, a full HTML `render` card, author **titles**, category **titles**, and a duplicate `"section"` key in the dict (harmless in Go but sloppy).
- **Upload** only on DAILY when Hugo logged `TODAY`. Editing an old article and pushing to git **does not** update Algolia.
- Search UI: `layouts/_default/search.html` + `assets/js/search.js` InstantSearch. Facets: **categories** and **authors** only. Pagination widget is commented out (infinite scroll instead). `routing: false`. Search-only keys are hardcoded in the JS bundle.

### Gaps to close

| Area | Gap |
| --- | --- |
| Freshness | Upload on every production deploy (or on content change), not only “something published today.” Goal 7’s “no daily rebuild” requires **incremental** index updates. |
| Corpus | Books, authors, series, and maybe forum marketing pages are omitted. Prints excerpts/deleted may need different ranking. |
| Ranking / snippet | Huge `content` field vs `summary` / `description`; HTML `render` in the index is large. Consider searchable attributes + highlight, not shipping a full card blob. |
| Facets | Add section, date, series, and later **topics/entities** (goal 4). |
| UI | Restore pagination or keep infinite scroll but add URL routing; don’t hardcode keys if they rotate; mobile layout (filters are `d-none d-lg-block`). |
| Privacy | `private` is already excluded; drafts are excluded. Confirm deleted/fair-use prints should be searchable. |

---

## 4. Automatically generated topics / entity detection

**Intent:** detect people, works, organizations, and topic labels from the body so category suggestion, internal linking, search facets, and maybe JSON-LD mentions are not purely manual.

### What exists

- `@google-cloud/language` is in `package.json` and **never imported**.
- `tags` taxonomy is configured and unused.
- JSON-LD `mentions` already walks scratch `"Links"`.
- Homepage topic slices are hard-coded, not data-driven.

### Design notes

- Write detections to **sidecar** JSON keyed by page path (DOI pattern). Do not add `topics:` / `entities:` / `tags:` to the article on every re-run.
- The admin shows suggestions; an editor may copy a subset into front matter (`categories:`) only when they are making an editorial choice (that save may bump lastmod — that is intended).
- Reuse the same entity store for Crossref unstructured-citation matching and Algolia facets.
- Do not require Google Cloud specifically; the unused package is only a hint that this was already considered.

---

## 5. Auto social media posts

**Intent:** when a page goes live, post to the channels the organization actually uses, without a local script.

### What exists

- `share_discourse.py` and the `DISCOURSE` postbuild task are **defunct**. Do not restore them. DAILY already omits `DISCOURSE`.
- `data/tweet.json` / `tweetAPI.json` are **embed caches**, not a posting API.
- OneSignal web push is still injected (WordPress SDK paths); that is not social posting.
- Front matter `commenturl` is a leftover “Discuss on Forum” link on many articles. It is not a live integration.

### Design notes

- Pick networks (X, Facebook, Bluesky, Mastodon, Mailchimp “campaign is live”) explicitly. **Not Discourse.** Do not revive OneSignal-as-Twitter.
- Same gate as DOI: **publish** is distinct from **announce**. Drafts and `private` must not post.
- Copy should be editable in the admin (title + description + permalink + image). Auto-generated text is a draft.
- Store remote post ids in sidecar data, not by rewriting article front matter on every share.
- Daily full-site rebuild is a bad trigger; post on the publish event (git merge, admin “publish”, or S3 object create).

---

## 6. Separate content git repo

**Intent:** website code (layouts, JS, functions) can change without mixing thousands of markdown/LFS files, and content editors need not see Hugo internals.

### What exists

One repo. Build-time coupling is tight:

- `content/` + `layouts/` + `data/doi.json` + `data/imgsize.json` + `static/` (Git LFS images/PDFs).
- Suggest Changes URLs point at **this** repo’s `master`.
- Netlify Large Media is bound to this repo.

### Tradeoffs

A submodule, sparse checkout, or “content repo → GitHub Action that opens a PR here” all work **if** the admin writes the same paths (`content/articles/...` for editorial files, `data/doi.json` and other sidecars for generated maps). Splitting **before** Word ingest and DOI-as-a-service just moves the laptop requirement to two clones. Generated sidecars can live in the code repo even if prose lives elsewhere.

Images/PDFs are the painful part (LFS / Large Media). A content repo that still LFS-stores binaries is only a partial split; S3 for media (goal 7) is the cleaner cut.

---

## 7. Different backend / no daily full rebuild

**Intent:** stop rebuilding the entire site every day. A favorable pattern: **process new or changed content**, store the result (HTML or JSON) on **S3** (or similar), and serve a **dynamic JS** site that reads that store. Building one article is enough to update the live site.

Metalsmith and Next.js have been considered in other Peaceful Science repos. This repo is Hugo 0.97.3 on Netlify with a post-render Node pass (`code/render.js`) and on-demand functions (PDF, cite, bookcover).

### Why a daily rebuild exists today

`functions/daily-build.js` POSTs `DAILY` so Crossref deposit and Algolia **upload** can run when Hugo logs `TODAY`. Git-push production already builds HTML but **does not** deposit or reindex. The daily job is a side-effect scheduler, not a requirement of Hugo itself.

### What a port must still provide

| Capability | Today | After a port |
| --- | --- | --- |
| Markdown + per-folder front matter + shortcodes | Hugo | Parser + the same shortcode semantics (`amazon`, `youtube`, `image`, …) |
| DOI / citation / entity maps | `data/*.json` sidecars | Same: generated maps stay off the article files so source lastmod stays honest |
| Print/PDF | Prince from `/_prince/` HTML; LFS override when >6 MB | Same print HTML. Lambda 6 MB limit still applies unless PDFs are stored as objects. |
| Cite / book covers | Netlify functions | Any origin (Lambda, S3+CloudFront functions) |
| Redirects, aliases, ImageEngine | Hugo + `_redirects` | Equivalent routing |
| MathJax / dropcaps / sidenotes | `render.js` | Same post-process or a component |
| Incremental Crossref + Algolia + social | Full XML + full index, gated on TODAY | Per-document deposit and partial index update |

### When a port is justified

Stay on Hugo if the admin + Word pipeline can commit markdown here and only the **side effects** (DOI mint, Algolia partial update, Crossref per-doi, social) move off the daily rebuild.

Port (Next, Metalsmith, or S3+JS) if the goal is **true incremental publish** and avoiding Hugo’s full graph (related pages, taxonomy lists, Crossref batches, Algolia dump). That is a large rewrite of templates and shortcodes; do it **after** the content contract (front matter + shortcodes + DOI + citations) is encoded so the new engine cannot drift.

Processed-content-on-S3 is compatible with **keeping** Hugo as the processor: Hugo (or a worker) renders **one** page → upload HTML/JSON → the public app does not rebuild. Related-article modules and homepage slices then need a small index document, not a full site generate. Those derived objects are sidecars too: do not round-trip generated topics/citations back into the source markdown.

---

## 8. Word → publication format (highest near-term)

**Intent:** authors already submit **Word**; editors already use **Google Docs** ([Author's Guide](https://peacefulscience.org/authors-guide-and-call-for-submissions/)). There is **no** conversion pipeline in this repo. Manual copy into Hugo markdown is the bottleneck the admin UI cannot skip.

### Target output

A file that would pass a future admin validator:

- Correct **folder** (`articles/`, `prints/`, `prints/excerpts/`, …) and **front matter** for that folder.
- Authors as string list; new authors flagged.
- `headerimage`, `description`, `publishdate` / `date`, `categories`, `commenturl` when known.
- Body as Goldmark markdown (`unsafe` HTML only where the site already allows it).
- Shortcodes: `image` for figures, `amazon` for books, `youtube` / `vimeo` for video, footnotes that match **both** `single.html` sidenotes and `single.print.html` (Prince). JS embeds need a print fallback.
- Internal links suggested, not silently rewritten.
- Images extracted, named, placed under `static/img/`, and **`data/imgsize.json` updated from the real files** (Netlify will not have LFS bytes to measure). Then ImageEngine / `imgcdn`.

### Pipeline sketch

1. Accept `.docx` (and optionally a Google Doc export).
2. Convert to markdown (pandoc or equivalent), preserving footnotes and heading levels.
3. Classify figures vs inline images; emit `{{< image ... >}}`; write files under `static/img/` and update `data/imgsize.json` from the real bytes.
4. Detect ISBNs, Amazon URLs, DOIs, YouTube URLs → shortcodes in the **new** file (first ingest) and citation lookups in sidecar JSON.
5. Draft YAML from the author’s guide fields (bio → author page; topic areas → category suggestions in the admin, not a generated `tags:` rewrite loop).
6. Open in the admin for human edit, DOI assign (sidecar), and publish.

Zotero is already recommended to authors; if the Word file contains a Zotero bibliography, prefer that over regex for Crossref (goal 2).

---

## Cross-cutting constraints

- **Page PDFs are Prince of `_prince` HTML**, not the main site and not Word export. Lambda for normal sizes; **> ~6 MB → local Prince + `static/pdf/<section>/<slug>.pdf` (LFS)**. Shortcodes must render in both HTML outputs.
- **Sidecar data for generated fields:** follow `data/doi.json`. Auto topics, resolved citations, social ids, image metrics, and similar must not be written into article markdown. That keeps `.Lastmod` (git info) as “the prose last changed.” First-time Word ingest **creates** the article, so that commit *should* set lastmod. Later enrichment must not. Baked PDFs go in `static/pdf/`, not the article. **New images always update `data/imgsize.json`** — Netlify never sees LFS bytes.
- **DOI minting is two-phase:** write `data/doi.json` (or successor store), then deposit XML. The admin and any S3 pipeline must not collapse those phases. The DOI never needs to live in front matter (`getdoi` already warns `DOI.OLD` when it does).
- **Per-folder schemas and shortcodes are the publication format.** Word ingest and any new backend emit that format; they do not invent a parallel CMS schema.
- **TODAY-gated DAILY tasks** are the current way to avoid depositing/indexing on every push. Incremental side effects should replace that gate rather than adding more full-site rebuilds.
- **CSS is Tailwind.** New UI and any CSS cleanup migrate off Bootstrap 4 / `main.scss` onto Tailwind. Do not treat `sources/tailwind.css` as dead code.
- **AMP and Discourse integration are defunct.** Do not spend implementation time reviving them.
- **Universal Analytics is defunct.** Remove it in the near-term tracking pass; do not rebuild features on UA Reporting API v3.
- **Git remains the audit log** until a port says otherwise. Suggest Changes / pull requests should keep working for readers even after editors get an admin.

## Decisions still needed

See [open questions](open-questions.md) § Product direction. The blocking ones for implementation:

1. Admin stack (custom app vs GitHub-backed CMS vs hosted Git gateway).
2. Who may mint DOIs, and whether prints-only vs articles too.
3. Which social networks to post to (**not Discourse**).
4. Whether a content-repo split is required before admin, or only after.
5. Stay on Hugo with incremental side effects vs S3+JS vs Next.
6. Word path: `.docx` only vs Google Docs API as well.
7. Tracking: keep GTM `GTM-KDF8R85` + GA4 vs a single `gtag` snippet (UA is out either way).
