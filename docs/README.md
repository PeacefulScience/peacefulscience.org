# Developer documentation

This folder describes how [peacefulscience.org](https://peacefulscience.org/) is built and published. The live site is a **Hugo** static site deployed on **Netlify**, with extra Node and Python tooling around search, DOIs, PDFs, newsletters, and analytics. There is **no working front-end admin**; content is edited in Git.

| Doc | What it covers |
| --- | --- |
| [Architecture](architecture.md) | System overview: content, templates, assets, serverless functions, and external services |
| [Content model](content-model.md) | Sections, taxonomies, and how pages relate |
| [Front matter](front-matter.md) | Per-section and per-subfolder YAML schemas (corpus scan + template check) |
| [Shortcodes](shortcodes.md) | Custom and built-in Hugo shortcodes actually used in content |
| [Build and deploy](build-and-deploy.md) | What Netlify `make production` actually runs vs local-only Make (DOI, Mailchimp) |
| [Product goals](goals.md) | Admin UI, Crossref, Algolia, entities, social, content-repo split, backend/S3, Word ingest |
| [Legacy and unused code](legacy.md) | Likely-dead paths to confirm before a cleanup refactor |
| [Open questions](open-questions.md) | Things to confirm with maintainers before changing behavior |

The public README at the repo root is aimed at **readers** (copyright and how to suggest corrections). This folder is aimed at **people changing the site**.

## Quick map of the repo

```
content/     Markdown and HTML pages (the site)
layouts/     Hugo templates, partials, shortcodes
assets/      SCSS and JS bundled by Hugo
static/      Images, fonts, PDFs, unused CMS admin UI (Git LFS)
data/        Generated and hand-maintained JSON used at build time
code/        Build scripts (production pipeline, DOI, newsletter, analytics)
functions/   Netlify Functions (PDF, cite, book cover, daily rebuild)
plugins/     Netlify plugin that caches `_cache/` between builds
config.yml   Hugo site config
netlify.toml Deploy commands and function settings
```
