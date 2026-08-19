# Front matter schemas

Front matter is **not one schema**. It varies by **section**, and inside a section it often varies again by **subfolder** (and, for taxonomies, by *kind* of term). This file is the inventory.

**Method.** Parsed YAML on all 455 `content/**/*.md` and `*.html` files, then checked each key against `layouts/` (Hugo `.Params` is case-insensitive). Counts are “files in that folder that set the key,” not including values only inherited via `cascade:`.

**How to read the tables**

| Mark | Meaning |
| --- | --- |
| always | Every file in that folder sets it |
| usual | Most files (≥ ~70%) |
| some / rare | Present, but not the norm |
| inherited | Comes from a parent `_index.md` `cascade:` unless overridden |
| template | Read by a live layout/partial |
| unused | In the corpus; no template/script read found |
| absent | Templates read it; **zero** files in the corpus set it |

Authors are a list of **strings**. They are *sometimes* author-folder slugs (`swamidass`) and *often* display names (`Dennis Venema`, `Peaceful Science`, `C.S. Lewis`). Templates `urlize` the string and look up `content/authors/<slug>/`. Missing pages warn `AUTHOR.MISSING` and still print the string. The Cursor article rule that describes `authors: [{role, slug}]` maps does **not** match this corpus.

---

## Folder map (where schemas split)

```
content/
  _index.md, search.md, contact.html, 404.html     ← root pages, each one-off
  articles/*.md                                    ← one page schema (flat)
  books/*.md                                       ← one page schema (flat)
  newsletter/*.md                                  ← one page schema (flat)
  about/*.md                                       ← thin pages (flat)
  news/changing-faces.md                           ← leftover article-like page
  prints/*.md                                      ← preprint/postprint schema
  prints/excerpts/*.md                             ← excerpt schema (≠ parent)
  prints/deleted/*.md                              ← deleted-article schema (≠ parent)
  prints/excerpts/_index.md, prints/deleted/_index.md
  authors/<slug>/_index.md                         ← person terms (optional fields vary)
  categories/<slug>/_index.md                      ← mostly title; two are hidden
  series/<slug>/_index.md                          ← several term families, not one schema
  jsonld/                                          ← headless Organization blob
  forum/, archive/                                 ← singleton section indexes
```

Only `prints/` has **regular pages** in subfolders. `authors/`, `categories/`, and `series/` use one subfolder per taxonomy term; those term folders are not interchangeable.

---

## Shared machinery (all sections)

### Hugo built-ins (appear as front matter, special meaning)

| Key | Role |
| --- | --- |
| `title` | Page title (`.Title`). Five author terms and one series term use `Title` instead; Hugo still sees it. |
| `date` | `.Date` / default sort. Mix of quoted strings, YAML dates, and datetimes. |
| `publishdate` | `.PublishDate`. Homepage / RSS / “TODAY” log line use this. Future-dated pages need `-F`. |
| `draft` | Omitted from production unless `-D`. |
| `aliases` | Extra URLs → Netlify `_redirects`. |
| `url` | Override permalink (`404.html` only). |
| `layout` | Pick a layout (`search`, `404`, `archive`, forum `index`). |
| `cascade` | Copy params to descendants (section/nested indexes). |
| `outputs` | Extra output formats (usually via cascade: `HTML` + `print`). |
| `sitemap` | Home sets `changefreq`. |
| `description` | `.Description` (SEO, cards, RSS). |
| `linktitle` | Shorter nav/breadcrumb title. |
| `headless` | `jsonld/` only: not a public URL. |

### `headerimage` map (pages that show a hero)

| Subkey | Type | Templates | Corpus |
| --- | --- | --- | --- |
| `src` | path `/img/...` | `single.html`, cards, OG, JSON-LD, print | usual wherever the map exists |
| `youtube` | video id string | playable poster | articles 20; prints 18 (mostly conference talks) |
| `credit` | markdown string | caption under hero | articles 7; prints 11 |
| `startsec` | int | YouTube start | **prints only**, 4 files (ETS talks) |
| `position` | string | `single.html` (`main` default) | **absent** from corpus |

Casing in files is `headerimage` (not `headerImage`). Templates mix both; Hugo ignores case.

### `design` map (list/card chrome)

| Subkey | Type | Used by |
| --- | --- | --- |
| `layout` | Bootstrap col classes | `list.html` |
| `style` | `vertical` / `horizontal` / `newsletter_detail` | `list.html`, `render` |
| `hide` | string **or** list | `list.html`; `single.html` tests `in design.hide "joinconversation"` |
| `sort` | `most-pages` | `listpages.html` (books index) |
| `linklist` | bool | `linklist.html` (prints cascade `false`) |
| `footer` | bool | `baseof.html` (search sets false) |

Newsletter index uses `hide: image authors date` as a **single string**, not a YAML list. Contact uses a list.

### JSON-LD mini-language

Values that are strings starting with `= ` are directives resolved by `layouts/partials/jsonld/<token>.html` (e.g. `= permalink`, `= authors`, `= copy /jsonld/peacefulscience`). Maps merge. `jsonld-template: /articles` copies the articles cascade template. `jsonld-extend` deep-merges extra nodes (conference series).

Live JSON-LD is this system. Older `layouts/partials/seo/structured/*.html` and `social/*.html` look unused by `head.html`.

### DOI and PDF (not really front matter anymore)

`partials/getdoi.html` prefers `data/doi.json[RelPermalink]`, then `.Params.doi` (warns `DOI.OLD`). `getpdf.html` synthesizes `/pdf<path>.pdf` for sections `articles`, `prints`, `about`. A page-level `pdf:` key is **absent** from the corpus.

---

## `content/articles/` (flat, 141 pages + index)

No subfolders. Section index `articles/_index.md` cascades `rss: true`, outputs `HTML`+`print`, and the Article JSON-LD template.

### Page schema

| Key | Freq | Type | Templates |
| --- | --- | --- | --- |
| `title` | 141/141 | string | always |
| `authors` | 141/141 | list of strings (1 slug, or 2) | byline, JSON-LD, Crossref, Algolia, RSS |
| `date` | 141/141 | string (121), date (17), datetime (3) | dates, TODAY warning |
| `description` | 141/141 | string | SEO, cards |
| `headerimage` | 139/141 | map `src` required in practice | hero, OG, RSS enclosure |
| `categories` | 129/141 | list of slugs | pills, related, homepage buckets, Algolia |
| `aliases` | 121/141 | list of paths | redirects |
| `commenturl` | 94/141 | Discourse URL | “Discuss on Forum” |
| `series` | 45/141 | series slug | prev/next aside, related union |
| `podcast` | 17/141 | bool | **unused** in templates (often overlaps `headerimage.youtube`, 13/17) |
| `draft` | 4/141 | bool | Hugo |
| `canonical` | 3/141 | URL | `<link rel=canonical>` (WSJ / syndicated) |
| `publishdate` | 3/141 | string/date | `.PublishDate` |
| `partof` | 2/141 | list of `/books/...` paths | Crossref book batch, JSON-LD isPartOf |
| `doi` | 1/141 | string | fallback if not in `data/doi.json` |
| `editor` | 1/141 | list of slugs | byline “with editor”; Crossref editor role |
| `interview` | 1/141 | list of slugs | same as editor in templates (mislabeled “with editor”) |
| `endnote` | 1/141 | list of markdown strings | extra editor-note blocks after body |
| `about` | 1/141 | list of URLs/paths | JSON-LD `about` |

Two drafts have no `headerimage`. Twelve pages have no `categories`. Author strings that are not slugs exist (`Akaninyene Ruffin`, etc.).

**Not in this folder (templates still accept them):** `math`, `deletiondate`, `sameas`, `basedon`, `sources`, `fullurl`, `hypothesis`, `page_title`, `private`.

---

## `content/prints/` — three page schemas

Same Hugo section (`prints`), same `single.html` + print output, **different front matter**. Nested `_index.md` cascade also differs: `prints/deleted/` sets `rss: false`, which overrides the parent `rss: true`.

### `prints/_index.md`

`pages_filter_rss: true` (list only RSS-true children). Cascade: `rss: true`, `HTML`+`print`, `jsonld-template: /articles`, `jsonld.@type: ScholarlyArticle`, `design.linklist: false`.

### `prints/*.md` (26 pages) — conference talks, essays, preprints

| Key | Freq | Notes |
| --- | --- | --- |
| `title` `description` `authors` `date` `headerimage` | 26/26 | Core |
| `series` | 20/26 | Often a conference series (`aar-gae`, `ets-gae`, …) |
| `publishdate` | 19/26 | Online date; `date` is sometimes the talk date |
| `categories` | 17/26 | |
| `sameas` | 7/26 | Canonical / original URLs (JSON-LD) |
| `about` | 5/26 | Usually the GAE book path |
| `design.linklist` | 4/26 | `false` (also cascaded) |
| `headerimage.youtube` | many | Talk recordings |
| `headerimage.startsec` | 4 | ETS recordings |
| `aliases` `commenturl` `doi` | 3 each | |
| `draft` | 3 | ASA workshop talks |
| `math` | 2 | Loads MathJax (`[mathjax]` / `.Params.math`) |
| `basedon` | 1 | JSON-LD `isBasedOn` |
| `publicationdate` | 1 | **unused** in page templates (`mere-theistic-evolution.md`; conference series use `crossref.publicationdate` instead) |

### `prints/excerpts/` (20 pages + `_index.md`)

Excerpt of a **book**. Almost always points at that book.

| Key | Freq | Notes |
| --- | --- | --- |
| `title` `authors` `categories` `description` | 20/20 | |
| `publishdate` | 19/20 | Site publication |
| `partof` | 19/20 | `/books/<slug>/` — Crossref book component + JSON-LD |
| `date` | 18/20 | Original book/excerpt date (often years earlier than `publishdate`) |
| `headerimage` | 18/20 | `src` + often `credit`; youtube rare |
| `series` | 13/20 | e.g. `faith-across-multiverse` |
| `aliases` | 10/20 | Old `/articles/...` paths |
| `draft` | 2 | |
| `commenturl` | 2 | |
| `basedon` `sameas` | 1 each | |

Index cascade repeats ScholarlyArticle + `linklist: false` (does **not** force `rss: false`).

### `prints/deleted/` (7 pages + `_index.md`)

Fair-use republication of articles deleted elsewhere. Visual strike-through uses `deletiondate`.

| Key | Freq | Notes |
| --- | --- | --- |
| `title` `description` `authors` `date` `headerimage` `publishdate` `deletiondate` | 7/7 | `date` = original pub; `publishdate` = our posting; `deletiondate` = when it vanished |
| `sameas` | 6/7 | Original / Wayback URLs |
| `rss` | 6/7 | `false` (also cascaded from folder index) |
| `series` | 6/7 | `deleted-biologos` or `buggs-venema` |
| `partof` | 2/7 | |
| `aliases` `basedon` `math` | 1 each | |

Folder index: `linktitle: Deleted`, cascade **`rss: false` only** (does not set JSON-LD; pages still inherit ScholarlyArticle from `prints/_index.md`).

Authors here are often **display names** (`Dennis Venema`) with no matching author folder.

---

## `content/books/` (flat, 116 pages + index)

No subfolders. Book pages use `layouts/books/single.html`. Related articles come from Amazon ASIN backrefs (`cascade.pages_include_backrefs`) plus inbound links, not from `pages:` on the book (that key is unused here).

### Index `books/_index.html`

`reverse: false`. `design.style/layout/sort: most-pages`. Cascade: `rss: false`, `notnews: true`, `pages_include_backrefs: true`, card `design`, Book JSON-LD template.

### Page schema

| Key | Freq | Type / notes |
| --- | --- | --- |
| `title` | 115/116 | One file has a leading blank line before `---` (`perspectives-adam.md`) so Hugo may miss front matter |
| `authors` | 115/116 | Mix of slugs and full names; many names have **no** author page |
| `amazon` | 115/116 | List of ASINs. YAML often parses numeric ASINs as **int** (5 files mixed). First ASIN → cover via `/img/bookcover/` |
| `isbn` | 115/116 | **Inconsistent:** list of strings (103), string (8), int (2), list of int (2). JSON-LD/Crossref expect a value |
| `description` | 112/116 | |
| `date` | 12/116 | YAML date |
| `publisher` | 11/116 | Citation / Crossref book meta; default “Peaceful Science” otherwise |
| `aliases` | 1 | GAE historical URL |
| `erratum` | 1 | PDF link on GAE page |
| `description:` | 3 | **Typo key** (extra colon) in `adam-genome.md`, `traced.md`, `when-sin-begin.md` — real `description` is missing |

---

## `content/newsletter/` (flat, 29 pages + index)

### Index

`design.hide: image authors date` (string), `layout: col-12`, `style: newsletter_detail`. Cascade `rss: true`, `jsonld-template: /articles`.

### Page schema

| Key | Freq | Notes |
| --- | --- | --- |
| `title` `description` `authors` `date` | 29/29 | `authors` is always the string `Peaceful Science` (no author page) |
| `layers` | 27/29 | List of `{type: body}` and `{type: pages, heading: ...}`. `type: pages` renders the `pages` list as cards (`single.html`) |
| `pages` | 27/29 | Permalinks of included articles/prints. Newsletter CLI and `render/newsletter_detail.html` |
| `mailchimp.campaign_id` | 6/29 | Written back by `python -m code.newsletter` |
| `aliases` | 1 | |

Two issues (`aaas-fellow-swamidass.md`, `wheaton-fellows.md`) have **no** `layers`/`pages` — body-only.

---

## `content/about/` (flat, 3 pages + index)

Index cascades `rss: false`, `HTML`+`print`, `jsonld-template: /articles`, `jsonld.@type: Article`.

Pages are thin: always `title`+`description`. `aliases`+`commenturl` on two; `headerimage` only on the author's guide. No `authors`/`date`/`categories`.

---

## `content/authors/<slug>/` (56 term folders)

One file per folder (`_index.md`). **Same layout**, optional identity fields. Body markdown is the bio.

| Key | Freq | Templates |
| --- | --- | --- |
| `title` or `Title` | 56/56 | Display name. Five files use `Title` (`jmtour`, `jokamoto`, `joshua-march`, `rcanfield`, `tcade`) |
| `sameas` | 32/56 | list of profile URLs → JSON-LD `sameAs` |
| `twitter` | 22/56 | handle; `head.html` `twitter:creator` |
| `orcid` | 18/56 | byline icon, Crossref ORCID |
| `gscholar` | 10/56 | list page icon |
| `wiki` | 9/56 | Wikipedia URL; list page icon |
| `aliases` | 1 | |

Section index cascades Person JSON-LD + `notnews: true`.

There is **no** `name` key in the corpus; leftover `headers/article.html` reads `.Params.name` on author terms.

---

## `content/categories/<slug>/` (20 term folders)

Almost uniform.

| Key | Freq | Notes |
| --- | --- | --- |
| `title` | 20/20 | |
| `hidden` | 2/20 | `featured` and `gae`. Tag pills skip hidden terms (`single.html`, cards). Homepage still queries `categories` intersect `featured` / `gae`. |

No section `_index.md`. `tags` taxonomy is configured in `config.yml` but **no file sets `tags:`**.

---

## `content/series/<slug>/` (19 term folders) — several schemas

Grouping is by the `series:` field on articles/prints, not by putting those files inside the series folder. Term `_index` files are **not one schema**. Section index cascades `reverse: false`, horizontal cards, CreativeWorkSeries JSON-LD.

### Family A — conference proceedings (4)

`aar-gae`, `ets-gae`, `ets-mte`, `asa-workshop-2022`

| Key | Role |
| --- | --- |
| `title` `date` `description` | |
| `about` | 3 of 4; book permalink for JSON-LD |
| `headerimage.src` | `ets-gae`, `ets-mte` only |
| `crossref` | **required for Crossref conference XML** |
| `crossref.type` | must be `conference` (`conference_meta.xml` warns otherwise) |
| `crossref.name` `number` `title` | proceeding metadata |
| `crossref.startdate` `enddate` `publicationdate` | YAML dates |
| `jsonld-extend.workFeatured` | Event + `superEvent` (location shape varies: map vs string; `enddate` vs `endDate`; `sameas` sometimes null) |

Prints in these series are the conference papers in the Crossref batch.

### Family B — deleted-source archives (2)

`deleted-biologos`, `buggs-venema`

`title`, `deletiondate`, plus `sameas` (BioLogos) or `description` (Buggs). Used with `prints/deleted/` pages.

### Family C — book excerpt series (2)

`faith-across-multiverse`, `flat-earths-fake-footnotes`

`title` + `partof: [/books/...]`. Pages live under `prints/excerpts/`.

### Family D — explicit page list (1)

`public-evolution`: `title` + `pages:` (article permalinks). Unusual; most series rely on the taxonomy reverse index.

### Family E — title only (10)

`100-year-tree`, `academic-freedom-creationism`, `biologos`, `dover-15`, `publishing-practices`, `rtb`, `scientists-resurrection`, `tonto`, plus `confident-faith` (`Title:` only) and `corrections-gae` (`title`+`about`).

`biologos` and `rtb` are HTML `_index.html` with the same thin YAML as markdown terms.

---

## Singleton sections and root pages

| Path | Front matter |
| --- | --- |
| `content/_index.md` | `title`, `description`, `headerimage.src`, `sitemap.changefreq`, home JSON-LD, cascade `rss: false`, `defaultimg`, WebPage JSON-LD |
| `content/search.md` | `layout: search`, `design.footer: false`, WebPage JSON-LD |
| `content/contact.html` | `design.hide: [joinconversation]`, Netlify form in body |
| `content/404.html` | `layout: 404`, `url: /404.html` |
| `content/archive/_index.html` | `layout: archive`, `linktitle` |
| `content/forum/_index.html` | `layout: index`, `articles:` list of permalinks (forum landing cards) |
| `content/news/changing-faces.md` | Article-like: `title` `authors` `date` `description` `headerimage` `aliases` `commenturl` `categories: [news]` — **not** in the articles section |
| `content/jsonld/index.html` | `headless: true`, cascade `headless` |
| `content/jsonld/peacefulscience.md` | `headless: true`, Organization JSON-LD (copied via `= copy /jsonld/peacefulscience`) |

`layouts/genealogical-adam-eve/index.html` reads `.Params.Articles.Featured` / `.Mistakes`. **No content file** uses that layout anymore (GAE is a book page).

---

## Keys templates read that the corpus never sets

Safe to treat as unused *data*, but removing template branches is a product decision.

| Key | Where read |
| --- | --- |
| `private` | Algolia index skip; sitemap skip |
| `feature` | sitemap priority 1.0 |
| `page_title` | override visible H1 |
| `subtitle` | meta description fallback; old headers |
| `sources` + `fullurl` | byline “on \<source\>” + “Read Full Article” |
| `hypothesis` | Hypothesis.is embed |
| `headerimage.position` | hero placement (`main` default) |
| `rss_guid` | RSS guid |
| `listtitle` | books related-heading |
| `headerType` | unused header switcher |
| `share_img` / `image` / `seo` / `schemas` | old social/SEO partials |
| `pdf` | legacy PDF URL (now synthesized) |
| `tags` | taxonomy + old SEO keywords |
| `Params.name` on authors | old header partial |

---

## Keys in the corpus with no template use found

| Key | Where |
| --- | --- |
| `podcast` | 17 articles |
| `publicationdate` on a print page | 1 file (series `crossref.publicationdate` *is* used) |
| `description:` | 3 books (typo; not `description`) |

`math: true` **is** used (`single.html` / print MathJax).

---

## Cascade cheat sheet

Descendants inherit unless they override. Nested indexes override parents.

| Source | What children get |
| --- | --- |
| Home `_index.md` | `rss: false`, `defaultimg`, WebPage JSON-LD (then section indexes override) |
| `articles/_index.md` | `rss: true`, print output, Article JSON-LD |
| `prints/_index.md` | `rss: true`, print, ScholarlyArticle, `linklist: false` |
| `prints/excerpts/_index.md` | same JSON-LD/linklist; still RSS-true |
| `prints/deleted/_index.md` | **`rss: false`** |
| `newsletter/_index.md` | `rss: true`, article JSON-LD template |
| `about/_index.md` | `rss: false`, print, Article |
| `books/_index.html` | `rss: false`, `notnews`, backrefs, Book JSON-LD |
| `authors/_index.html` | Person JSON-LD, `notnews` |
| `series/_index.md` | `reverse: false`, series JSON-LD, card design |

---

## Implications for a later cleanup

1. Do not collapse `prints/excerpts` and `prints/deleted` into the top-level prints schema (`partof` vs `deletiondate`/`rss: false` vs conference youtube).
2. Do not assume `series/<slug>` is one type; conference terms are Crossref metadata objects.
3. Author lists are not a foreign key. A schema that requires slugs would fail a large share of books and several prints.
4. `.cursor/rules/articles.mdc` does not match the corpus (no `role:` author maps; `podcast` unused; DOI lives in `data/doi.json`).
5. Book `isbn`/`amazon` types and the `description:` typo are the messiest machine-readable fields.
