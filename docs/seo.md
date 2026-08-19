# SEO, JSON-LD, and AI utilization

Review of how the live site presents itself to **Google Search / Scholar**, other crawlers, and **AI systems** that retrieve or ground on pages. This is the inventory for [goal 9](goals.md#9-seo-json-ld-and-ai-utilization). Nothing here is implemented yet.

Two audiences share most of the same work:

| Audience | What they need from this site |
| --- | --- |
| **Search ranking** | Unique titles/descriptions, canonical URLs, crawlable HTML, E-E-A-T (real authors, dates, publisher), valid structured data, internal links |
| **AI utilization** | The same plus: stable identifiers (DOI, ORCID), citations as data, entities (`about` / `mentions`), clean extractable prose, optional machine-readable copies (`llms.txt`, markdown) |

The live structured-data path is the **JSON-LD mini-language** (`layouts/partials/jsonld*`). Older `layouts/partials/seo/structured/*.html` is unused. Do not revive it; improve the live system.

---

## What exists today

### HTML head (`layouts/partials/head.html`)

Emitted on every HTML page:

- Canonical (`params.canonical` or permalink)
- `<title>`, `meta name="description"`, Open Graph, Twitter cards
- Highwire `citation_*`, Dublin Core, Prism (aimed at **Google Scholar** more than web ranking)
- DOI metas when `data/doi.json` (or leftover `params.doi`) has a value
- `citation_pdf_url` + `rel="alternate"` PDF when `getpdf` applies
- `Googlebot-News` `noindex` when page-level `notnews: true`
- GTM (pageviews on Turbo navigations are broken; see tracking in [goals](goals.md#tracking-near-term))

Description fallback chain: `description` → `subtitle` → `.Summary` → **`.Kind`** (`page` / `section` / `home`). The last fallback is unusable as a snippet.

Twitter image uses the raw `absURL`; OG image goes through ImageEngine (`imgcdn`). Authors without a `content/authors/<slug>/` page emit **no** `citation_author` / `og:author`. `twitter:creator` is rewritten per author and becomes `@` when `twitter` is empty.

### Robots and sitemap

- `layouts/robots.txt`: `Disallow: **/page/*` (pagination) and **`Disallow: /_prince/`** (Prince PDF input — not a public page). Sitemap pointer. No AI-crawler rules (`GPTBot`, `Google-Extended`, etc.).
- `static/_headers`: `X-Robots-Tag: noindex, nofollow, noarchive` on `/_prince/*` (Prince and the PDF Lambda still fetch; they are not search crawlers).
- `layouts/sitemap.xml`: skips `private`. Floors `<lastmod>` at `params.sitemap_min_date` (`2021-09-10`). Also lists HTML PDF URLs (`/pdf/…`) and every file in `data/pdfinfo.json`. Print HTML (`/_prince/…`) is **not** in the sitemap.
- `layouts/_default/baseof.print.html`: `noindex, nofollow, noarchive`. **Keep Schema.org microdata** (`itemscope` / `itemtype`) — Prince uses it when building the PDF. Still no `head.html`, so no public canonical, OG, or JSON-LD on the print URL. `config.yml` `outputformats.print` is `notAlternative` / `permalinkable: false`.

Google largely ignores `changefreq`. Flooring lastmod hides real git dates on older pages (sidecar policy still wants those dates honest when they *are* shown).

### JSON-LD mini-language (live)

`layouts/partials/jsonld.html` resolves a template map, then prints one `<script type="application/ld+json">`. Directives are strings starting with `= ` → `layouts/partials/jsonld/<token>.html`. Cascade templates live on section `_index` files ([front-matter](front-matter.md#json-ld-mini-language)).

| Section | `@type` | Source |
| --- | --- | --- |
| Home | `WebSite` + `SearchAction` | `content/_index.md` |
| Default pages | `WebPage` | home cascade |
| Articles, about, newsletter | `Article` | `articles/_index.md` (copied via `jsonld-template`) |
| Prints | `ScholarlyArticle` | `prints/_index.md` |
| Books | `Book` | `books/_index.html` |
| Authors | `Person` | `authors/_index.html` |
| Series | `CreativeWorkSeries` | `series/_index.md` |
| Publisher blob | `Organization` | headless `content/jsonld/peacefulscience.md` |

Article-shaped pages also set `headline`, `datePublished` / `dateModified`, `image`, `mentions`, `publisher`, `isAccessibleForFree`, `mainEntityOfPage`.

**DOI** is not a JSON-LD `identifier`. It is appended by `sameas.html` as `https://doi.org/…` (alongside ORCID, Twitter, aliases, Amazon, ISBN, PDF).

**`mentions`** walks scratch `"Links"` only (same set as Crossref). External URLs become `{url, @id}`; internal URLs become `{@id}`. Footnotes, `amazon` ASINs, and unstructured citations are omitted.

**Authors** are inlined Person graphs only when `content/authors/<slug>/` exists. Display-name bylines drop out of JSON-LD.

### Unused SEO templates

`layouts/partials/seo/main.html` and `seo/structured/{article,post,breadcrumb,website,organization}.html` are **not** included from `head.html`. They use `params.author` (singular), `tags`, and `http://schema.org`. Safe to delete in a cleanup; do not merge them with the live mini-language.

---

## JSON-LD defects (highest leverage)

These are template/cascade bugs. Fixing them does not need Word ingest or an admin UI.

### 1. `sameas` vs Schema.org `sameAs`

Articles, books, series, and the default WebPage cascade emit the key **`sameas`** (all lowercase). Schema.org and Google expect **`sameAs`**. Person and Organization templates already use the correct case.

Until that is renamed, Google (and most AI extractors) will **ignore** the DOI, aliases, Amazon, ISBN, and canonical URLs on articles and books. ORCID on *Person* pages still works.

### 2. `notnews` leaked into Person JSON-LD

`content/authors/_index.html` puts `notnews: true` **inside** `cascade.jsonld`. Consequences:

- Person graphs include an invalid `"notnews": true` property.
- Page-level `params.notnews` is **not** set, so author (and likely author-term) pages do **not** get `Googlebot-News` `noindex`. Books do this correctly (`cascade.notnews: true` beside `jsonld`, not inside it).

### 3. DOI is not `identifier`

Highwire `citation_doi` is in the head. JSON-LD should also emit something like:

```json
"identifier": { "@type": "PropertyValue", "propertyID": "DOI", "value": "10.54739/xxxx" }
```

(or `sameAs` **and** `identifier`). ScholarlyArticle pages should not rely on a misspelled `sameas` list.

### 4. `image` is a bare URL

`headerimage.html` returns an ImageEngine URL string. Google’s Article guidance prefers an `ImageObject` with `url`, `width`, and `height`. Those sizes already live in `data/imgsize.json`.

### 5. SearchAction does not drive search

Home `WebSite.potentialAction` targets:

`https://peacefulscience.org/search/?PeacefulScience[query]={search_term}`

The nav form uses the same query name. InstantSearch is initialized with **`routing: false`**, so the query string is ignored. Sitelinks search and shared search URLs do not populate the box. Goal 3 (Algolia UI routing) and this SearchAction should be one change.

### 6. Organization `@id` collides with the homepage

`content/jsonld/peacefulscience.md` uses `"@id": "https://peacefulscience.org/"`. Home `WebSite` uses the homepage URL as `@id` as well (`= permalink webpage`). Distinct ids (for example `https://peacefulscience.org/#organization` vs the WebSite `@id`) avoid merging Organization and WebSite in a knowledge graph.

Organization `sameAs` lists Facebook, YouTube, Twitter only. Nav also links Patreon; YouTube in nav is a `/channel/` URL while JSON-LD uses `/c/PeacefulscienceOrg/`.

### 7. Missing properties that help both Scholar and AI

| Gap | Why it matters |
| --- | --- |
| `inLanguage`: `en` | Standard on Article |
| `wordCount` / `articleBody` (or a short `abstract`) | Extractors; keep `articleBody` off if the payload is huge |
| `citation` on ScholarlyArticle | Goal 2’s resolved references should feed this, not only Crossref XML |
| `license` / `copyrightHolder` | Reuse policy for humans and models |
| `about` as `Thing`/`Person` with `@id` | Goal 4 entities; today `about.html` emits raw URL strings |
| `mentions` as typed entities | Today: every markdown link, including nav-noise if it hits the render hook |
| Book: `publisher`, `datePublished`, `author` when the byline has no author page | Book graphs are thin |
| BreadcrumbList | Unused old partial is also wrong (skips position 2). Add a correct one in the live system if wanted |
| `speakable` | Low value; Google support is narrow — skip unless there is a specific product need |

JSON-LD `description` / `title` partials run `htmlEscape` **before** `jsonify`, which can produce `&amp;` inside JSON strings. Let `jsonify` be the only escaper.

---

## Search-ranking gaps (beyond JSON-LD)

| Area | Issue |
| --- | --- |
| Titles | `<title>` is the page title only (no site name). Distinct article titles are fine; thin taxonomy titles are weaker. |
| Snippets | Fallback to `.Kind` on pages with no description. Most articles have `description:`; enforce it in the admin validator (goal 1 / 8). |
| Duplicate PDFs | Sitemap includes `/pdf/…` at the same priority as HTML. Google may index the PDF instead of the article. Prefer HTML as canonical; PDF as alternate (already a `rel="alternate"`). Consider dropping PDF locs from the sitemap or giving them lower priority. |
| `_prince` HTML | **Prince intermediate only — must not be indexed.** Public page is the article HTML; public download is `/pdf/…`. Block with `robots.txt` Disallow, meta `noindex`, and `X-Robots-Tag`. Do not sitemap, do not emit JSON-LD or a self-canonical, do not advertise as `rel=alternate`. **Keep Schema.org microdata** on the print layout; Prince uses it. Production **`render.js` still runs** on these files (scripts stripped; inline TeX **rendered** to SVG) before Prince fetches them. |
| AMP | Defunct; not in outputs. Do not revive for SEO. |
| Pagination | Disallowed in robots; good. |
| Internal links | Related module + series help. Entity detection (goal 4) should suggest links into sidecar data, not rewrite bodies on a loop. |
| Author E-E-A-T | Strong when a slug page exists (ORCID, sameAs). Weak for display-name bylines. |
| Core Web Vitals | ImageEngine + width/height from `imgsize.json` help CLS. Turbo SPA: GTM misses in-app pageviews (tracking goal). Font preload is a single face from the live origin. |
| News | `notnews` on books is correct. Authors likely intended the same and missed because `notnews` is inside `jsonld`. |
| Scholar | `citation_journal_title` is always “Peaceful Science”, including books. Fine for essays; noisy for Book pages. Highwire dates use `.Date`, JSON-LD `datePublished` uses `PublishDate` — keep those aligned. |

Algolia on-site search (goal 3) does not change Google rankings, but a working SearchAction and shareable `/search/` URLs do.

---

## AI utilization

Ranking work already helps retrieval: canonical URL, authors, dates, DOI, visible citations.

Extra, AI-specific layers (decide which to ship; see [open questions](open-questions.md)):

1. **Make JSON-LD actually parse** (case, identifier, Person, Organization ids). This is the cheapest “AI SEO” change.
2. **Citations as `citation` / `mentions`.** Same sidecar as Crossref (goal 2). Models and Google both prefer cited sources over a bag of outbound links.
3. **Entities as `about`.** Goal 4 sidecar → JSON-LD `Thing` nodes with Wikipedia/Wikidata/`@id` when known. Do not write tags into article markdown on every run.
4. **Machine-readable copies (optional):**
   - `/llms.txt` (and optionally `/llms-full.txt`) listing cornerstone URLs and a one-line description of the site.
   - Optional `text/markdown` alternate or a `/raw/…` path so crawlers are not forced through Turbo/Bootstrap HTML. Hugo can emit a markdown output format; keep it off print/PDF layouts.
5. **Visible structure:** real `h1` (page title), heading hierarchy, author byline in HTML not only JSON-LD. AI browsers and overviews quote visible text.
6. **Crawler policy:** today’s `robots.txt` allows all user-agents except pagination (`**/page/*`) and **`/_prince/`** (Prince input). Decide whether to allow training crawlers (`GPTBot`, `Google-Extended`, `CCBot`, …) or only retrieval crawlers. That is a policy choice, not a ranking trick. Do not lift the `/_prince/` disallow for AI.
7. **Do not** block Googlebot while allowing AI bots, or the opposite, without an explicit decision. AMP, Discourse, and UA leftovers are irrelevant to this.

Sidecar rule still applies: generated SEO fields (entities, resolved citations, maybe an `abstract`) go in `data/*.json`, not the article file, so git lastmod stays “the prose changed.”

---

## Suggested implementation slices

Independent of Word ingest. Order is technical, not calendar.

1. **JSON-LD hygiene:** rename `sameas` → `sameAs` in cascades; move author `notnews` out of `jsonld`; distinct Organization `@id`; DOI `identifier`; `ImageObject` from `imgsize.json`; drop `htmlEscape` in jsonld string partials; stop emitting empty `twitter:creator`.
2. **SearchAction + InstantSearch routing** (shared with goal 3).
3. **Head/snippet quality:** never fall back to `.Kind`; consistent OG/Twitter image CDN; optional BreadcrumbList in the live jsonld system; PDF sitemap policy.
4. **Delete unused** `layouts/partials/seo/structured/` (and `seo/main.html` if still unreferenced).
5. **Scholarly `citation` + entity `about`:** after goals 2 and 4 have a sidecar to read.
6. **`llms.txt` / markdown alternate** only if maintainers want AI-specific copies.

Validate with [Google Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/) on an article, a print, a book, an author, and the homepage — not only on one type.

---

## Constraints

- Keep the **mini-language** (`= permalink`, `= authors`, `= copy /jsonld/…`). Do not go back to hard-coded `seo/structured/*.html`.
- Generated fields stay in **sidecar** JSON ([goals](goals.md) sidecar rule).
- Print HTML (`/_prince/`) is **Prince input only**. Keep it out of search and AI indexes: `robots.txt` Disallow, meta `noindex`, `X-Robots-Tag`. Do not add JSON-LD or a self-canonical there. **Do keep Schema.org microdata** (`itemscope` / `itemtype` on `baseof.print.html`); Prince uses that when generating the PDF.
- AMP stays defunct.
- Highwire metas can stay for Scholar unless a later pass proves they conflict with JSON-LD; they are not a substitute for valid `sameAs` / `identifier`.
