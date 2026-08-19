# Content model

Editors work in Markdown under `content/`. Hugo taxonomies and front matter control listing, SEO, DOIs, and related articles. Public-facing writing guidance lives on the site at `/about/authors-guide/` and `/about/editorial/`. Cursor rules for article files are in `.cursor/rules/articles.mdc`.

## Sections vs taxonomies

**Sections** are folders under `content/` (articles, prints, books, …). They determine URL prefix, default layout, and which extra outputs are generated.

**Taxonomies** (from `config.yml`):

- `authors` → `content/authors/<slug>/_index.md`
- `categories` → `content/categories/<slug>/_index.md`
- `series` → `content/series/<slug>/_index.md`
- `tags` — declared but rarely used in current content

Author slugs in article front matter must match an author page (e.g. `swamidass` → `content/authors/swamidass/_index.md`).

Permalinks for articles: `/:sections/:title/` (title is the file slug). Most historical WordPress URLs are preserved with `aliases:`.

## Common front matter

### Required on articles (in practice)

```yaml
title: Human-readable title
authors:
  - swamidass          # author slugs
date: "2021-04-11"     # or a full timestamp
description: One or two sentences for SEO, cards, and RSS
headerimage:
  src: /img/2021/04/example.jpg
categories:
  - science
```

### Frequently used optional fields

| Field | Meaning |
| --- | --- |
| `publishdate` | If set, the page is not “live” until this date (`hugo -F` / `--buildFuture` on previews) |
| `aliases` | Extra paths; emitted into Netlify `_redirects` |
| `commenturl` | Discourse topic URL; drives the “Discuss on Forum” button |
| `headerimage.youtube` | YouTube video id; header becomes a playable poster |
| `headerimage.credit` | Caption/credit under the header image |
| `headerimage.startsec` | Start offset for the YouTube embed |
| `series` | Series slug; related-articles block unions that series |
| `interview` | Slugs of people interviewed (Crossref contributor role) |
| `editor` | Editor slugs (shown in byline, Crossref role) |
| `pages` | Explicit list of related permalinks (newsletters, forum page, some lists) |
| `layers` | Newsletter layout: body vs pages heading |
| `amazon` | List of ASINs; book covers and “pages that mention this book” |
| `isbn` | Book ISBN for JSON-LD |
| `doi` | Legacy per-page DOI; current source of truth is `data/doi.json` keyed by permalink |
| `pdf` | Legacy PDF URL; articles/prints/about now get `/pdf<path>.pdf` automatically |
| `podcast` | Marks interview/podcast-style articles |
| `rss` | `false` to keep a page out of RSS / homepage pools (home cascade defaults `rss: false`; articles/prints/newsletter cascade `true`) |
| `private` | Omit from Algolia and sitemap |
| `notnews` | Add `Googlebot-News` noindex |
| `canonical` | Override canonical URL |
| `deletiondate` | Visual strike-through on the title |
| `crossref.type` | e.g. `conference` for Crossref conference batches |
| `partof` | e.g. `/books/...` so prints attach to a book in Crossref |
| `mailchimp.campaign_id` | Existing Mailchimp campaign to update |
| `design.*` | List-page card layout (`style`, `layout`, `hide`, `footer`, `sort`) |
| `jsonld` / `jsonld-template` | Schema.org overrides |

Author pages also use `orcid`, `twitter`, `gscholar`, `wiki`, `sameas`.

## Content types in more detail

**Articles** (`content/articles/`) are the public blog. ~140 files. Index cascade enables HTML + print output and Article JSON-LD.

**Prints** (`content/prints/`) are scholarly pre/post-prints. They get the same print output, ScholarlyArticle JSON-LD, and are first-class for DOI deposit. Subfolders `excerpts/` and `deleted/` inherit that model.

**Books** (`content/books/`) are not blog posts. They list related articles by Amazon ASIN backrefs (`pages_include_backrefs`) and optional explicit `pages`. Covers are fetched via `/img/bookcover/<ASIN>` (Netlify function).

**Newsletters** (`content/newsletter/`) are dated issues. Body Markdown plus a `pages:` list. `python -m code.newsletter content/newsletter/foo.md` builds HTML with MJML and upserts a Mailchimp campaign. The production site also lists them like articles.

**Authors / categories / series** are mostly `_index.md` with a title (and a bio for authors). Series grouping is by the `series:` field on articles, not by putting files inside the series folder.

## Writing conventions the templates expect

- Start article body at `##` (H2). The first paragraph after the header may get a dropcap via a `script[render]` block in `single.html`.
- Editor notes: `<div class="editor-note">...</div>` (skipped for dropcap, styled distinctly in print CSS).
- Images: Markdown `![alt](/img/...)` or the `{{% image "/img/..." "aside-xl-wide" %}}` shortcode. Paths should be site-root (`/img/...`), not `static/img/...`.
- YouTube: `headerimage.youtube` or `{{< youtube ID >}}`.
- Citations: Markdown footnotes (`[^1]`) become sidenotes on wide screens; DOI links without link text are rendered with `partials/doi.html`.
- Internal links should be site paths or full `peacefulscience.org` URLs so the render hook can resolve titles and track backrefs.

## Generated / derived URLs

| Pattern | Source |
| --- | --- |
| `/articles/<slug>/` | Article file slug |
| `/prints/<slug>/` | Print file slug |
| `/pdf/articles/<slug>.pdf` | On-demand Prince PDF (function) |
| `/authors/<slug>/` | Author term |
| `/categories/<slug>/` | Category term |
| `/search/` | Algolia UI |
| `/cite/doi.org/<doi>` | Citation JSON function |

## Editorial workflow

**Git / GitHub is the only working editor today.** There is no functioning in-site CMS.

- On-page **Suggest Changes** opens GitHub’s editor for that Markdown file (`…/edit/master/content/…`). **Revision History** opens the GitHub commits view. That matches the public README and `/about/editorial/`.
- **Decap CMS** files live at `static/admin/` (`/admin/`) but the admin UI is **not working yet**.
- **Forestry** config in `.forestry/` is leftover from a discontinued product. Do not treat it as a publishing path.

New articles: copy an existing file or use `hugo new` (`archetypes/default.md` is a stub: title, date, draft). Author and category pages should exist before they are referenced.

## Media

Put images in `static/img/` (often `static/img/YYYY/MM/`). They are Git LFS objects. After adding images, regenerate sizes:

```bash
make imginfo
```

PDFs that should be statically hosted go in `static/pdf/` (`make pdfinfo`). On-demand article PDFs do not live in git; they are generated from the `print` output format under `public/_prince/`.
