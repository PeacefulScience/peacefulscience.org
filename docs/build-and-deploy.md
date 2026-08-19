# Build and deploy

Pinned versions (from `netlify.toml` / `runtime.txt`):

- Hugo **0.97.3**
- Node **20.15.1** (functions runtime `nodejs20.x`)
- Python **3.8** (Netlify `runtime.txt`; local Python is used for DOI, analytics, newsletters)

The site was written against Hugo 0.97 APIs (`getJSON`, `.Site.IsServer`, `resources.ToCSS`, etc.). Newer Hugo will likely require template updates.

## Local development

```bash
npm install
# optional Python tooling
pip install -r requirements.txt

# CSS once (if you are changing SCSS/Tailwind)
npm run build:style

# Watch Hugo + Tailwind (package.json "dev")
npm run dev

# or Hugo only
hugo server -D
```

`make hugo-watch` / `make tailwind-watch` are the Make equivalents. `make dev` is a no-op sleep used as Netlify Dev’s process (`netlify.toml` `[dev]`).

Copy secrets into `.env` if you need Crossref, Algolia, Mailchimp, Discourse, or MJML. The Makefile auto-loads `.env`.

### Useful Make targets

| Target | What |
| --- | --- |
| `make` / `make all` | `imginfo`, `pdfinfo`, then `production` |
| `make imginfo` | `data/imgsize.json` from `static/img` |
| `make pdfinfo` | `data/pdfinfo.json` from `static/pdf` |
| `make algolia` | `hugo -e index` then `npm run algolia` |
| `make links` | Dump every rendered link (`HUGO_LINKS=1`) |
| `make production` | Full production script (downloads Prince if `PRINCE=./prince`) |
| `make pdf INPUT=content/articles/foo.md` | Local Prince proof PDF |
| `make doi INPUT=content/articles/foo.md` | Assign a DOI in `data/doi.json` |
| `make news INPUT=content/newsletter/foo.md` | Build newsletter HTML and Mailchimp campaign |
| `make crossref` | Validate and deposit `public/.xref/*.xml` |

## Production pipeline

Netlify **production** context runs `make production` → `code/production`.

Task selection:

1. `TASKS` defaults to `BUILD`.
2. Incoming build hook body (`INCOMING_HOOK_BODY`) can override `TASKS`.
3. If that body is `DAILY`, tasks become `BUILD CROSSREF ALGOLIA` (Discourse sharing is commented out).

Steps when `TASKS` includes `BUILD`:

1. `code/prebuild.hook`
   - `ANALYTICS`: `update_analytics.py` → `_cache/*.json` copied into `data/`
   - `CACHE`: restore `_cache` into `public/`
2. `hugo -b $URL --minify` (or with `-DF` on non-production)
3. `node code/render.js` over `public/**/*.html`
4. Move `public/.xref` and `public/algolia.json` into `_cache/`
5. `code/postbuild.hook`
   - `CROSSREF` + log contains `TODAY`: deposit each XML file to Crossref
   - `ALGOLIA` + `TODAY`: `atomic-algolia` from `_cache/algolia.json`
   - `DISCOURSE` + `TODAY`: `share_discourse.py` for each today-path

If `BUILD` is not in `TASKS`, postbuild still runs but the script **exits 100** so Netlify does not publish.

Other Netlify contexts:

| Context | Command |
| --- | --- |
| Default / unspecified | `hugo -b $URL` (no render.js, no Make) |
| `production` | `make production` |
| `branch-deploy` / `deploy-preview` | `hugo -b $DEPLOY_PRIME_URL --buildDrafts -F` |

**Important:** deploy previews skip `code/render.js`, so `script[render]` (dropcaps, sidenotes) and MathJax will not match production.

`plugins/usercache` restores/saves `_cache/` across builds so Algolia JSON, redirects, and Crossref XML can be reused.

`HUGO_ENV` is `development` in the default build environment and `production` in the production context.

## Extra Hugo outputs

Configured in `config.yml` `outputformats` / `outputs`:

| Format | Where | Use |
| --- | --- | --- |
| `HTML` | normal pages | Site |
| `print` | `public/_prince/...` | Prince input for PDFs |
| `Algolia` | `public/algolia.json` | Search index |
| `redir` | `public/_redirects` | Aliases + function proxies |
| `xrefposted` / `xrefbook` / `xrefconf` | `public/.xref/*.xml` | Crossref deposits |
| `RSS` | home | Feed |
| `precompute` | unused in default outputs | View-count dump |

`config/index/outputs.yml` is an alternate environment (`hugo -e index`) that emits only Algolia. `config/amp/outputs.yml` would add AMP pages; AMP is not in the default `outputs`.

## Git hooks

Husky (installed on `npm install`):

- **pre-commit:** `git-date-extractor` writes `data/dates.json` for files under `content/`
- **pre-push / post-checkout / post-commit / post-merge:** Git LFS

`.gitattributes` sends `*.pdf`, `*.jpg`, `*.jpeg`, `*.png`, `*.webp` (and a broken `gif` line) to LFS. `.lfsconfig` points LFS at Netlify Large Media (`https://<site-id>.netlify.app/.netlify/large-media`).

## Environment variables

Used by Make, functions, or Python (typically Netlify UI + local `.env`):

| Variable | Used by |
| --- | --- |
| `URL` | Hugo `--baseURL` in production |
| `CONTEXT`, `DEPLOY_URL`, `DEPLOY_PRIME_URL` | Netlify contexts |
| `TASKS` / `INCOMING_HOOK_BODY` | Which production tasks run |
| `PRINCE` | Path to Prince binary |
| `CROSSREF_ID`, `CROSSREF_PASS` | DOI deposits |
| `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `ALGOLIA_INDEX_NAME`, `ALGOLIA_INDEX_FILE` | Index upload |
| `BUILD_HOOK` | Daily rebuild function |
| `DISCOURSE_API` | Forum posting |
| `MAILCHIMP_API`, `MAILCHIMP_USER`, `MAILCHIMP_AUDIENCE`, `MAILCHIMP_TEST_EMAILS` | Newsletter CLI |
| `MJML_API_ID`, `MJML_SECRET_KEY` | MJML render API |
| `GA_SERVICE` | JSON key for Universal Analytics (or `client_secrets.json`) |

The Algolia **search-only** app id / key are hardcoded in `assets/js/search.js` (normal for a public InstantSearch client).

## CSS / JS build notes

- Production pages compile `assets/css/main.scss` and `fontawesome.scss` through Hugo, then PostCSS. PurgeCSS scans `layouts/**` and `assets/js/*.js`. `layouts/whitelist.html` and generated `layouts/classes.html` exist so purged class names (Algolia widgets, editor notes, etc.) survive.
- `npm run tailwind` writes `assets/css/tw.css` (gitignored). `head.html` has the Tailwind `<style>` block commented out.
- `code/production` also has `npm run tailwind` commented out.

## Python packages

`requirements.txt`: YAML/HTML parsing (`ruamel.yaml`, `bs4`, `lxml`, `plim`, `mako`, `markdown2`), Mailchimp, Bottle (Plim adapter), Google API client (analytics), numpy, python-dotenv. `code/imgsize.py` uses Pillow (`PIL`) which is **not** listed in `requirements.txt`.
