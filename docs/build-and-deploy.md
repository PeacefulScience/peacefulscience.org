# Build and deploy

Pinned versions (from `netlify.toml` / `runtime.txt`):

- Hugo **0.97.3**
- Node **20.15.1** (functions runtime `nodejs20.x`)
- Python **3.8** listed in `runtime.txt`. The default production path (`BUILD` only) does **not** call Python. Python is for local CLI (`doi`, `news`, `imginfo`) and for the optional `ANALYTICS` hook. The `DISCOURSE` hook is **defunct**.

The site was written against Hugo 0.97 APIs (`getJSON`, `.Site.IsServer`, `resources.ToCSS`, etc.). Newer Hugo will likely require template updates.

**Make is two different tools in this repo.** Netlify production runs **one** target (`production` → `code/production`). Assigning DOIs, Mailchimp campaigns, image/PDF metadata, and local Crossref deposits are **other** Make targets. They are not part of a git-push deploy.

## What Netlify actually runs

From `netlify.toml`:

| Context | Command | Make? | `render.js`? |
| --- | --- | --- | --- |
| **production** (published site) | `make production` | yes | yes |
| branch-deploy | `hugo -b $DEPLOY_PRIME_URL --buildDrafts -F` | no | no |
| deploy-preview | same as branch-deploy | no | no |
| default `[build].command` | `hugo -b $URL` | no | no |

`make production` is **not** `make all`. `make all` is local (`imginfo` + `pdfinfo` + `production`). Netlify never regenerates `data/imgsize.json` or `data/pdfinfo.json`.

If `PRINCE=./prince` is set in the Netlify env, `make production` first downloads/unzips the Prince Lambda zip (for the on-demand PDF **function**). It does not stamp article PDFs into `public/` at build time except when a matching file already exists under `static/pdf/` (see [Article PDFs](#article-pdfs-prince)).

Netlify Dev uses `make -j 10 dev`, which only `echo built` and sleeps — it is not a real watch server.

## Production `TASKS` (inside `code/production`)

`make production` → `bash -e code/production`. That script does **not** call `make doi`, `make news`, or `make imginfo`.

Task list:

```text
TASKS = INCOMING_HOOK_BODY or $TASKS or "BUILD"

if TASKS == "DAILY":
    TASKS = "BUILD CROSSREF ALGOLIA"   # DISCOURSE omitted and defunct — do not re-add
```

| How the build is triggered | Typical `TASKS` | Side effects besides HTML |
| --- | --- | --- |
| Git push / merge to the production branch | `BUILD` | Hugo `--minify`, `render.js`, stash `.xref` + `algolia.json` + `_redirects` in `_cache/`. **No** Crossref, Algolia upload, Mailchimp, or DOI writes. |
| Scheduled function `functions/daily-build.js` (`0 14 * * *`) POSTs body `DAILY` to `BUILD_HOOK` | `BUILD CROSSREF ALGOLIA` | Same as BUILD, then **if** `_cache/hugo.log` contains `TODAY`: deposit Crossref XML and run `npm run algolia`. |
| Manual build hook with a custom body | whatever you post (`ANALYTICS`, `CACHE`, …) | See hooks below. Do not use `DISCOURSE`. |

`TODAY` is a Hugo `warnf` from `single.html` when `PublishDate` is today’s date. No new page today → daily Crossref/Algolia steps are skipped even on the DAILY hook.

`plugins/usercache` restores/saves `_cache/` across Netlify builds.

### BUILD steps (the path every production deploy takes)

1. `mkdir _cache`
2. `code/prebuild.hook` — no-ops unless `TASKS` contains `ANALYTICS` or `CACHE` (neither is on git-push or DAILY)
3. `hugo -b $URL --minify` (if `CONTEXT` is not `production`, it would use `-DF` and `$DEPLOY_URL`; Netlify production sets `CONTEXT=production` and `HUGO_ENV=production`)
4. `node code/render.js` (MathJax, `script[render]`, dropcaps/sidenotes)
5. Move `public/.xref` → `_cache/xref`, `public/algolia.json` → `_cache`, copy `_redirects`
6. `code/postbuild.hook` — Crossref / Algolia only if those tokens are in `TASKS` **and** `TODAY` is in the Hugo log. The `DISCOURSE` branch is defunct.

If `BUILD` is missing from `TASKS`, postbuild still runs but the script **exits 100** so Netlify does not publish.

### Optional hook tasks (not on a normal git deploy)

| Token | Hook | What |
| --- | --- | --- |
| `ANALYTICS` | prebuild | `update_analytics.py` (Universal Analytics v3) → `_cache/*.json` copied to `data/` |
| `CACHE` | prebuild | copy `_cache` into `public/` |
| `CROSSREF` | postbuild | `curl` each `_cache/xref/*.xml` to Crossref `doMDUpload` |
| `ALGOLIA` | postbuild | `ALGOLIA_INDEX_FILE=_cache/algolia.json npm run algolia` (`atomic-algolia`) |
| `DISCOURSE` | postbuild | **Defunct.** `share_discourse.py` for each `TODAY` path. Do not enable. |

### Deploy previews

Branch and PR deploys skip Make and `render.js`, so dropcaps, sidenotes, and MathJax will not match production.

## Local Make: operations Netlify does not run

The Makefile loads `.env` if present. Targets `doi`, `news`, and `pdf` are **only defined when `INPUT` is set**:

```bash
make doi INPUT=content/articles/foo.md
make news INPUT=content/newsletter/foo.md
```

| Target | Used by Netlify? | What it is |
| --- | --- | --- |
| `production` | **yes** (production context only) | `code/production` as above |
| `doi` | **no** | `python code/doi.py` — mint `10.54739/xxxx` into `data/doi.json` (must be committed). Converts `content/articles/foo.md` → `/articles/foo/` as the map key. Does not talk to Crossref. |
| `news` | **no** | `python -m code.newsletter` — MJML via mjml.io, create/update Mailchimp campaign, write `mailchimp.campaign_id` back into the markdown, `open newsletter.html`. Send-to-list is commented out; it sends **test** emails. Writing the id into the article is the pattern **not** to extend (use sidecar data; see [goals](goals.md)). |
| `pdf` | **no** | Makefile calls `code/pdf ${INPUT}`, but **that script is not in the repo**. Oversized PDFs: local Prince on `_prince` HTML (below). |
| `imginfo` / `pdfinfo` | **no** | Refresh `data/imgsize.json` / `data/pdfinfo.json`; commit the JSON |
| `algolia` | **no** | Separate from the DAILY task: `hugo -e index` then `npm run algolia` using `config/index/outputs.yml` |
| `crossref` / `crossref-nocheck` | **no** | Local deposit of `public/.xref/{conf,posted,book}.xml` with XSD check. Production DAILY deposits `_cache/xref/*.xml` without `xmllint`. |
| `links` | **no** | `HUGO_LINKS=1 hugo -F` dump |
| `all` | **no** | `imginfo` + `pdfinfo` + `production` |
| `dev` / `dev1` / `hugo-watch` / `tailwind-watch` | Dev only | Watchers; `dev` is a stub sleep |

### DOI: two steps, only one is on Netlify

1. **Assign (CLI):** `make doi INPUT=...` writes `data/doi.json`. Hugo `getdoi` and Crossref XML read that file at **build** time. If you skip this commit, the live page has no DOI and the XML batch has nothing new to deposit.
2. **Deposit (DAILY Netlify, gated):** postbuild uploads the XML Hugo already generated. That registers DOIs that were already in `data/doi.json`.

### Mailchimp: two unrelated paths

1. **Subscribe forms** on the live site (`layouts/partials/mailinglist.html`, modal) POST to Mailchimp’s public form endpoint. No Make, no Netlify function.
2. **Campaign compose** is **CLI only** (`make news`). The Netlify build never creates or sends campaigns. Newsletter **pages** in `content/newsletter/` still render as HTML like any other section.

### Article PDFs (Prince)

There is **one** correct PDF layout: Hugo’s `print` output format (`config.yml` `outputformats.print`, `path: _prince`). Templates: `layouts/_default/single.print.html` + `baseof.print.html`. Articles, prints, and about cascade `outputs: [HTML, print]`. The download URL is always `getpdf`: `/pdf` + permalink + `.pdf` (example: `/articles/foo/` → `/pdf/articles/foo.pdf`).

Do not print the main site HTML. Do not use a second stylesheet or Word’s PDF export for these page PDFs.

**On-demand (typical pages):** `_redirects` has `/pdf/* /.netlify/builders/pdf 200`. `functions/pdf` fetches `https://peacefulscience.org/_prince/<section>/<slug>/`, runs Prince, returns the PDF. Allowed sections: `articles`, `prints`, `about`. Netlify/AWS Lambda **response bodies max out at 6 MB**. Long, image-heavy articles produce PDFs larger than that and the function fails. The handler also base64-encodes the file, so a PDF near 6 MB can fail even if slightly under.

**Oversized fallback (commit to LFS):** run Prince **locally** on the same `_prince` HTML, write the PDF to Git LFS at the URL path under `static/`:

```text
static/pdf/<section>/<slug>.pdf
```

Example already in the repo: the Tonto Group series (`static/pdf/articles/examining-yec-claims-tonto-group-cambrian-{1,2,3}.pdf`). Hugo copies that to `public/pdf/...`. Netlify serves the static file **instead of** the function rewrite, so `/pdf/articles/<slug>.pdf` still matches `getpdf` / `citation_pdf_url`.

After adding or replacing a baked PDF:

```bash
# Prefer the live print HTML (same input the Lambda uses):
prince https://peacefulscience.org/_prince/articles/<slug>/ -o static/pdf/articles/<slug>.pdf

make pdfinfo   # updates data/pdfinfo.json (sidecar lastmod for the sitemap)
# commit the PDF (LFS) and data/pdfinfo.json — not the article markdown
```

That keeps article last-modified honest ([sidecar pattern](goals.md)). Other files under `static/pdf/` (errata, ASA letters, deleted-BioLogos captures) are **uploaded documents** linked from markdown, not Prince output of a page. Do not mix those paths with `static/pdf/articles/<slug>.pdf`.

`make pdf INPUT=...` is supposed to wrap this but `code/pdf` is missing from the tree.

**Shortcodes** must render in both `single.html` (site) and `single.print.html` (Prince). Print CSS lives in the print template (including `.d-print-none`). JS-only embeds need a print fallback. Details: [shortcodes](shortcodes.md#prince-and-the-main-site).

## Local development

```bash
npm install
# optional Python tooling (doi, news, imginfo)
pip install -r requirements.txt

hugo server -D
```

`npm run dev` starts Make hugo-watch + tailwind-watch. Production still ships Bootstrap via `main.scss`; Tailwind watch is the CSS path to turn on as the migration proceeds.

## Extra Hugo outputs

Configured in `config.yml` `outputformats` / `outputs`:

| Format | Where | Use |
| --- | --- | --- |
| `HTML` | normal pages | Site |
| `print` | `public/_prince/...` | Prince input for page PDFs (site HTML is a different output; do not print that) |
| `Algolia` | `public/algolia.json` | Search index |
| `redir` | `public/_redirects` | Aliases + function proxies |
| `xrefposted` / `xrefbook` / `xrefconf` | `public/.xref/*.xml` | Crossref deposits |
| `RSS` | home | Feed |
| `precompute` | unused in default outputs | View-count dump |

`config/index/outputs.yml` is an alternate environment (`hugo -e index`) that emits only Algolia. `config/amp/outputs.yml` would add AMP pages; **AMP is defunct** and is not in the default `outputs`.

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
| `DISCOURSE_API` | **Defunct** (was forum posting) |
| `MAILCHIMP_*` / `MJML_*` | **CLI only** (`make news`), not the Netlify build |
| `GA_SERVICE` | `ANALYTICS` task only (not on git-push or DAILY) |

The Algolia **search-only** app id / key are hardcoded in `assets/js/search.js` (normal for a public InstantSearch client).

## CSS / JS build notes

- **Intent: all CSS is Tailwind.** Production today still compiles `assets/css/main.scss` and `fontawesome.scss` through Hugo, then PostCSS. PurgeCSS scans `layouts/**` and `assets/js/*.js`. `layouts/whitelist.html` and generated `layouts/classes.html` exist so purged class names (Algolia widgets, editor notes, etc.) survive.
- `npm run tailwind` writes `assets/css/tw.css` (gitignored). `head.html` has the Tailwind `<style>` block commented out; `code/production` has `npm run tailwind` commented out. Turn this path **on** as Bootstrap/`main.scss` is migrated away, rather than deleting it.
- `npm run dev` starts Make hugo-watch + tailwind-watch. That watch is the preferred CSS workflow once Tailwind is the live sheet.

## Python packages

`requirements.txt`: YAML/HTML parsing (`ruamel.yaml`, `bs4`, `lxml`, `plim`, `mako`, `markdown2`), Mailchimp, Bottle (Plim adapter), Google API client (analytics), numpy, python-dotenv. `code/imgsize.py` uses Pillow (`PIL`) which is **not** listed in `requirements.txt`.
