# Build and deploy

Pinned versions (from `netlify.toml` / `runtime.txt`):

- Hugo **0.97.3**
- Node **20.15.1** (functions runtime `nodejs20.x`)
- Python **3.8** listed in `runtime.txt`. The default production path (`BUILD` only) does **not** call Python. Python is for local CLI (`doi`, `news`, `imginfo`) and for optional `ANALYTICS` / `DISCOURSE` tasks that the daily hook does not enable.

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

If `PRINCE=./prince` is set in the Netlify env, `make production` first downloads/unzips the Prince Lambda zip (for the on-demand PDF **function**). It does not stamp article PDFs into `public/` at build time. PDFs are built later by `functions/pdf` from `/_prince/` HTML.

Netlify Dev uses `make -j 10 dev`, which only `echo built` and sleeps — it is not a real watch server.

## Production `TASKS` (inside `code/production`)

`make production` → `bash -e code/production`. That script does **not** call `make doi`, `make news`, or `make imginfo`.

Task list:

```text
TASKS = INCOMING_HOOK_BODY or $TASKS or "BUILD"

if TASKS == "DAILY":
    TASKS = "BUILD CROSSREF ALGOLIA"   # DISCOURSE intentionally omitted
```

| How the build is triggered | Typical `TASKS` | Side effects besides HTML |
| --- | --- | --- |
| Git push / merge to the production branch | `BUILD` | Hugo `--minify`, `render.js`, stash `.xref` + `algolia.json` + `_redirects` in `_cache/`. **No** Crossref, Algolia upload, Mailchimp, or DOI writes. |
| Scheduled function `functions/daily-build.js` (`0 14 * * *`) POSTs body `DAILY` to `BUILD_HOOK` | `BUILD CROSSREF ALGOLIA` | Same as BUILD, then **if** `_cache/hugo.log` contains `TODAY`: deposit Crossref XML and run `npm run algolia`. |
| Manual build hook with a custom body | whatever you post (`ANALYTICS`, `CACHE`, `DISCOURSE`, …) | See hooks below. |

`TODAY` is a Hugo `warnf` from `single.html` when `PublishDate` is today’s date. No new page today → daily Crossref/Algolia steps are skipped even on the DAILY hook.

`plugins/usercache` restores/saves `_cache/` across Netlify builds.

### BUILD steps (the path every production deploy takes)

1. `mkdir _cache`
2. `code/prebuild.hook` — no-ops unless `TASKS` contains `ANALYTICS` or `CACHE` (neither is on git-push or DAILY)
3. `hugo -b $URL --minify` (if `CONTEXT` is not `production`, it would use `-DF` and `$DEPLOY_URL`; Netlify production sets `CONTEXT=production` and `HUGO_ENV=production`)
4. `node code/render.js` (MathJax, `script[render]`, dropcaps/sidenotes)
5. Move `public/.xref` → `_cache/xref`, `public/algolia.json` → `_cache`, copy `_redirects`
6. `code/postbuild.hook` — Crossref / Algolia / Discourse only if those tokens are in `TASKS` **and** `TODAY` is in the Hugo log

If `BUILD` is missing from `TASKS`, postbuild still runs but the script **exits 100** so Netlify does not publish.

### Optional hook tasks (not on a normal git deploy)

| Token | Hook | What |
| --- | --- | --- |
| `ANALYTICS` | prebuild | `update_analytics.py` (Universal Analytics v3) → `_cache/*.json` copied to `data/` |
| `CACHE` | prebuild | copy `_cache` into `public/` |
| `CROSSREF` | postbuild | `curl` each `_cache/xref/*.xml` to Crossref `doMDUpload` |
| `ALGOLIA` | postbuild | `ALGOLIA_INDEX_FILE=_cache/algolia.json npm run algolia` (`atomic-algolia`) |
| `DISCOURSE` | postbuild | `share_discourse.py` for each path in the `TODAY` log lines |

### Deploy previews

Branch and PR deploys skip Make and `render.js`, so dropcaps, sidenotes, and MathJax will not match production.

## Local Make: operations Netlify does not run

The Makefile loads `.env` if present. Targets `doi`, `news`, and `pdf` are **only defined when `INPUT` is set**:

```bash
make doi INPUT=content/articles/foo.md
make news INPUT=content/newsletter/foo.md
make pdf INPUT=content/articles/foo.md
```

| Target | Used by Netlify? | What it is |
| --- | --- | --- |
| `production` | **yes** (production context only) | `code/production` as above |
| `doi` | **no** | `python code/doi.py` — mint `10.54739/xxxx` into `data/doi.json` (must be committed). Converts `content/articles/foo.md` → `/articles/foo/` as the map key. Does not talk to Crossref. |
| `news` | **no** | `python -m code.newsletter` — MJML via mjml.io, create/update Mailchimp campaign, write `mailchimp.campaign_id` back into the markdown, `open newsletter.html`. Send-to-list is commented out; it sends **test** emails. |
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

## Local development

```bash
npm install
# optional Python tooling (doi, news, imginfo)
pip install -r requirements.txt

hugo server -D
```

`npm run dev` starts Make hugo-watch + tailwind-watch. Tailwind is not used in the production CSS path (`head.html` has `tw.css` commented out; `code/production` has `npm run tailwind` commented out).

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
| `MAILCHIMP_*` / `MJML_*` | **CLI only** (`make news`), not the Netlify build |
| `GA_SERVICE` | `ANALYTICS` task only (not on git-push or DAILY) |

The Algolia **search-only** app id / key are hardcoded in `assets/js/search.js` (normal for a public InstantSearch client).

## CSS / JS build notes

- Production pages compile `assets/css/main.scss` and `fontawesome.scss` through Hugo, then PostCSS. PurgeCSS scans `layouts/**` and `assets/js/*.js`. `layouts/whitelist.html` and generated `layouts/classes.html` exist so purged class names (Algolia widgets, editor notes, etc.) survive.
- `npm run tailwind` writes `assets/css/tw.css` (gitignored). `head.html` has the Tailwind `<style>` block commented out.
- `code/production` also has `npm run tailwind` commented out.

## Python packages

`requirements.txt`: YAML/HTML parsing (`ruamel.yaml`, `bs4`, `lxml`, `plim`, `mako`, `markdown2`), Mailchimp, Bottle (Plim adapter), Google API client (analytics), numpy, python-dotenv. `code/imgsize.py` uses Pillow (`PIL`) which is **not** listed in `requirements.txt`.
