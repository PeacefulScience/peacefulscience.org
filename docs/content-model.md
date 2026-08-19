# Content model

Editors work in Markdown under `content/`. Hugo taxonomies and front matter control listing, SEO, DOIs, and related articles. Public-facing writing guidance lives on the site at `/about/authors-guide/` and `/about/editorial/`. Cursor rules for article files are in `.cursor/rules/articles.mdc` (those rules are incomplete relative to the live corpus).

**Front matter is per folder, not per site.** Subfolders of a section often use a different schema than the parent (especially `prints/excerpts/` vs `prints/deleted/`, and the various `series/<slug>/` term types). The inventory is in [front-matter.md](front-matter.md).

## Sections vs taxonomies

**Sections** are folders under `content/` (articles, prints, books, …). They determine URL prefix, default layout, and which extra outputs are generated.

**Taxonomies** (from `config.yml`):

- `authors` → `content/authors/<slug>/_index.md`
- `categories` → `content/categories/<slug>/_index.md`
- `series` → `content/series/<slug>/_index.md`
- `tags` — declared in config; **no content file sets `tags:`**

Author values in front matter are strings. They *may* be a folder slug (`swamidass`) or a display name with no author page. Templates `urlize` the string and look up `content/authors/<slug>/`.

Permalinks for articles: `/:sections/:title/` (title is the file slug). Most historical WordPress URLs are preserved with `aliases:`.

## Common front matter

There is no single required block for the whole site. The closest “article-shaped” core (articles and most prints) is:

```yaml
title: Human-readable title
authors:
  - swamidass          # slug or display name
date: "2021-04-11"     # or a YAML date / timestamp
description: One or two sentences for SEO, cards, and RSS
headerimage:
  src: /img/2021/04/example.jpg
categories:
  - science
```

Books, newsletters, author/category/series terms, and `prints/deleted/` do not follow that block. Optional keys and frequencies: [front-matter.md](front-matter.md).

**Generated fields do not belong in the article file.** DOIs live in `data/doi.json`; citation caches, image sizes, and (planned) auto topics / social ids follow the same sidecar pattern so git last-modified stays “the prose changed.” See [architecture](architecture.md) and [goals](goals.md). Editor-chosen `categories`, bylines, and body links *are* editorial and may live in the markdown.

## Content types in more detail

**Articles** (`content/articles/`) are the public blog. ~140 files. Index cascade enables HTML + print output and Article JSON-LD (live graph has known key bugs; [seo.md](seo.md)).

**Prints** (`content/prints/`) are scholarly pre/post-prints. They get print output and ScholarlyArticle JSON-LD. **Subfolders are different types:** `prints/*.md` (talks/preprints), `prints/excerpts/` (book excerpts with `partof`), `prints/deleted/` (fair-use republications with `deletiondate` and `rss: false`).

**Books** (`content/books/`) are not blog posts. They list related articles by Amazon ASIN backrefs (`cascade.pages_include_backrefs`) and inbound links. Covers are fetched via `/img/bookcover/<ASIN>` (Netlify function).

**Newsletters** (`content/newsletter/`) are dated issues. Body Markdown plus a `pages:` list. They build as HTML on Netlify like any other section. Creating the Mailchimp campaign is a **local** command (`make news INPUT=content/newsletter/foo.md`), not part of `make production`.

**Authors / categories / series** are taxonomy term folders (`<slug>/_index.md`). Series grouping is by the `series:` field on articles/prints. Series *term* folders themselves split into several schemas (conference Crossref metadata vs title-only vs deleted-source archives).

## Writing conventions the templates expect

- Start article body at `##` (H2). The first paragraph after the header may get a dropcap via a `script[render]` block in `single.html`.
- Editor notes: `<div class="editor-note">...</div>` (skipped for dropcap, styled distinctly in print CSS).
- Images: Markdown `![alt](/img/...)` or the `image` / `mediatext` shortcodes. Paths should be site-root (`/img/...`), not `static/img/...`.
- YouTube in the body: `{{< youtube ID >}}` (custom shortcode → site player). Header videos use `headerimage.youtube`.
- Book covers in the body: `{{< amazon ASIN >}}`.
- Full shortcode list, arguments, and usage counts: [shortcodes.md](shortcodes.md).
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
- **“Discuss on Forum”** (`commenturl`) is leftover Discourse UI. Integration is defunct; do not require new `commenturl` values.
- **Decap CMS** files live at `static/admin/` (`/admin/`) but the admin UI is **not working yet**.
- **Forestry** config in `.forestry/` is leftover from a discontinued product. Do not treat it as a publishing path.

New articles: copy an existing file in the same folder (not a different prints subfolder) or use `hugo new` (`archetypes/default.md` is only title/date/draft). Author pages are optional; missing slugs render as plain text.

## Media

Put images in `static/img/` (often `static/img/YYYY/MM/`). They are Git LFS objects. **Netlify does not download LFS**, so the production Hugo build cannot read width/height from the files. After adding or changing images, you **must** refresh the sidecar and commit it with the image:

```bash
make imginfo    # writes data/imgsize.json from the real files on your machine
```

Skipping that step ships pages with no `width`/`height` on `<img>` even if the picture appears via ImageEngine. Never run `make imginfo` on Netlify.

PDFs:

- **Page PDFs** (the download chip on articles/prints/about): always Prince of the `_prince` HTML. Typical pages: on-demand Lambda. If the PDF would be **> ~6 MB**, generate locally with Prince and commit Git LFS at `static/pdf/<section>/<slug>.pdf` (same URL). Then `make pdfinfo`. See [build-and-deploy](build-and-deploy.md#article-pdfs-prince). Examples: Tonto Group articles. **`/_prince/` is not indexed** — Prince intermediate only.
- **Uploaded documents** (errata, letters, scans): `static/pdf/…` as well, but **not** named like `articles/<slug>.pdf`. Linked from markdown / the `pdf` shortcode.

Do not round-trip a page PDF into the article file.
