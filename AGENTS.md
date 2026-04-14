# Peaceful Science Repo Summary

This repository is the source for the [peacefulscience.org](https://peacefulscience.org) site. It is primarily a Hugo project, but it also includes custom Node, Python, and Netlify tooling for PDFs, citations, newsletters, Crossref XML, Algolia indexing, and Word-to-Markdown conversion.

## Mental Model

- Hugo is the main application framework.
- `content/` is the center of gravity. Most work is editorial or metadata-driven.
- `layouts/` contains the Hugo templates and partials that shape rendering, JSON-LD, redirects, and special outputs.
- `assets/` and `sources/tailwind.css` drive site styling; Tailwind output is written to `assets/css/tw.css`, and SCSS builds `assets/css/main.css`.
- `functions/` contains Netlify serverless functions, especially for PDF generation and citation lookup.
- `code/` contains custom support scripts used in build and editorial workflows.

## Build And Deploy

- Local dev is usually `npm run dev`, which runs Hugo watch plus Tailwind watch.
- `make production` runs the real production pipeline through [`code/production`](/Users/swamidass/Workspaces/ps/peacefulscience.org/code/production:1).
- Production build flow is roughly:
  1. Run prebuild hook.
  2. Build the site with Hugo.
  3. Run post-processing in `code/render.js`.
  4. Move generated `.xref` XML and `algolia.json` into `_cache`.
  5. Run postbuild hook.
- Netlify uses Hugo `0.97.3` and Node `20.15.1`; branch previews build drafts/future content.
- `make imginfo` and `make pdfinfo` generate `data/imgsize.json` and `data/pdfinfo.json`.
- `make crossref` validates and submits Crossref XML generated into `public/.xref/`.

## Content Structure

The `content/` tree is not uniform. Check the section before editing.

- `content/_index.md` defines site-wide cascade defaults, SEO, and JSON-LD defaults.
- `content/articles/*.md` are the main article pages. Section-level defaults live in [`content/articles/_index.md`](/Users/swamidass/Workspaces/ps/peacefulscience.org/content/articles/_index.md:1).
- `content/books/*.md` are flat book pages with rich metadata like `amazon`, `isbn`, `about`, and backlinks from related articles. The section landing page is unusually [`content/books/_index.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/content/books/_index.html:1), not Markdown.
- `content/authors/<slug>/_index.md` stores author profiles as branch bundles. These are important because article frontmatter usually references author slugs, not free-form names.
- `content/categories/<slug>/_index.md` and `content/series/<slug>/_index.md` are lightweight taxonomy pages.
- `content/newsletter/*.md` are newsletter issue pages; the Python newsletter tooling reads these and joins them to `public/algolia.json`.
- `content/prints/*.md` and `content/prints/excerpts/*.md` are scholarly/preprint-style pages with DOI/Crossref-oriented behavior and different JSON-LD defaults.
- `content/news/*.md` exists but is small and looks article-like.
- `content/comics/` mixes section `_index.md` files with nested subseries like `confessingscientist/`.
- `content/forum/_index.html` is a custom landing page written in HTML frontmatter style, not a typical Markdown section page.
- `content/jsonld/peacefulscience.md` is headless structured data used by templates; do not treat it like visible page content.
- Some sections use `_index.md`; some use `_index.html`; a few leaf pages also use `.html`. Match the existing pattern in that section.

## Common Frontmatter Patterns

For articles and article-like content, common fields are:

- `title`
- `authors`
- `date`
- `description`
- `categories`
- `headerimage.src`

Frequently used optional fields:

- `publishdate` for scheduled publication
- `series`
- `aliases`
- `about`
- `commenturl`
- `headerimage.youtube`
- `design`
- `sameas`
- `interview`

Important convention:

- `authors` is usually a list of author slugs such as `swamidass`, but some older or special pages use display names instead. Follow the local pattern for the section/file you are editing instead of forcing normalization blindly.

## Authoring And Editorial Workflows

- There is repo-local Codex skill guidance for adding authors at [`/.codex/skills/add-author/SKILL.md`](/Users/swamidass/Workspaces/ps/peacefulscience.org/.codex/skills/add-author/SKILL.md:1).
- Cursor rules in `.cursor/rules/` describe article-writing expectations, but they are incomplete and should be treated as hints, not canonical truth.
- The Word import path matters here: [`code/docx_to_article.py`](/Users/swamidass/Workspaces/ps/peacefulscience.org/code/docx_to_article.py:1) converts `.docx` files into article-style Markdown, normalizes DOI/URL links, and extracts images into `static/img/...`.
- Newsletters are generated from content files via [`code/newsletter/__main__.py`](/Users/swamidass/Workspaces/ps/peacefulscience.org/code/newsletter/__main__.py:1), which reads `public/algolia.json`, renders MJML/HTML, and can persist Mailchimp campaign IDs back into frontmatter.

## Templating And Outputs

- Core templates are in `layouts/_default/`.
- Many behaviors are driven by partials in `layouts/partials/`, especially JSON-LD, authors, categories, image handling, redirects, and metadata lookup.
- The base page shell is [`layouts/_default/baseof.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/_default/baseof.html:1). It wires in `head.html`, the main nav/footer, a background block, and the video/modal UI chrome used site-wide.
- Normal content pages render through [`layouts/_default/single.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/_default/single.html:1). This template is opinionated: it emits Hugo warnings for suspicious descriptions/content, renders breadcrumbs, authors, category tags, PDF/DOI badges, series navigation, optional layered related-page sections, and various metadata displays.
- Section and taxonomy pages usually render through [`layouts/_default/list.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/_default/list.html:1), which paginates the result of `partial "listpages"` and renders cards through `partial "render"`. Infinite-scroll style pagination is implemented with `turbo-frame`.
- Print output uses [`layouts/_default/baseof.print.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/_default/baseof.print.html:1) plus [`layouts/_default/single.print.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/_default/single.print.html:1), with heavy Prince-specific CSS and XMP metadata for PDF generation.
- The home page is custom in [`layouts/index.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/index.html:1), not just a stock list page. It hand-selects sections like latest prints, latest articles, featured posts, AI, race/origins, and books using Hugo queries and `partial "render"`.
- The forum landing page is also custom in [`layouts/forum/index.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/forum/index.html:1).
- Hugo is configured for extra outputs beyond HTML:
  - Algolia JSON
  - Netlify `_redirects`
  - Crossref XML variants under `.xref`
  - print HTML under `_prince`
- PDF generation is handled by the Netlify function in [`functions/pdf/index.js`](/Users/swamidass/Workspaces/ps/peacefulscience.org/functions/pdf/index.js:1), which renders print pages through Prince.

## Important Hugo Partials

- [`layouts/partials/head.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/head.html:1) builds most metadata: canonical URL, Open Graph, Twitter cards, citation metadata, DOI/PDF tags, stylesheets, Turbo, OneSignal, and GTM.
- [`layouts/partials/listpages.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/listpages.html:1) is a key logic hub. It composes page collections from:
  - a section's regular pages
  - explicit `pages` references in frontmatter
  - Amazon backrefs
  - backlink discovery via `.Scratch.Get "Links"`
  - optional sorting like `design.sort: most-pages`
- [`layouts/partials/render.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/render.html:1) dispatches to card partials based on page type or requested style. The actual card implementations live under `layouts/partials/render/`.
- [`layouts/partials/render/_default.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/render/_default.html:1) is the standard content card renderer; there are section/style-specific variants for books and newsletter detail.
- [`layouts/partials/authors.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/authors.html:1) resolves author slugs to author taxonomy pages and warns when authors are missing.
- [`layouts/partials/getdoi.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/getdoi.html:1) and [`layouts/partials/getpdf.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/getpdf.html:1) centralize DOI/PDF lookup and compatibility behavior.
- [`layouts/partials/imgurl.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/imgurl.html:1) and [`layouts/partials/imgcdn.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/imgcdn.html:1) normalize image paths and CDN URLs and emit warnings for broken image references.
- [`layouts/partials/jsonld-template.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/jsonld-template.html:1) and [`layouts/partials/jsonld.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/jsonld.html:1) merge section/page JSON-LD templates into final structured data.
- [`layouts/partials/params_override_lookup.html`](/Users/swamidass/Workspaces/ps/peacefulscience.org/layouts/partials/params_override_lookup.html:1) shows there is a data-driven params override mechanism via `site.Data.overrides`, even if it is not used in every code path.

## Sharp Edges

- Do not assume a section is plain Markdown just because it lives under `content/`; check whether it uses `_index.md`, `_index.html`, or a headless page.
- Do not freely rename author slugs, category slugs, or series slugs. They are referenced throughout content and structured data.
- A lot of validation happens through Hugo `warnf` calls in templates and partials. If a build starts complaining about `AUTHOR.MISSING`, `BROKEN.IMG`, `PAGES.MISSING`, `DOI.OLD`, `PDF.OLD`, or content-format warnings, start by reading the corresponding partial instead of patching symptoms blindly.
- Page list behavior is often not a simple section listing; `listpages.html` can pull in explicit related pages, backlinks, or Amazon-linked pages.
- `public/`, `_cache/`, and generated artifacts may exist locally; avoid editing them unless the task is explicitly about generated output.
- There are existing uncommitted user changes in this repo; be careful not to overwrite unrelated newsletter or rule-file work.
- If a task touches books, prints, or newsletters, inspect nearby examples first because those sections have section-specific conventions.

## Good First Checks For Future Tasks

- Read the closest sibling files in the same content section before editing.
- Check the relevant section `_index.*` file for cascade defaults.
- If output shape seems odd, inspect the matching template in `layouts/` and related partials.
- If the task mentions authors, newsletters, PDFs, DOI/Crossref, or Word docs, search `code/` and `functions/` before making assumptions.
