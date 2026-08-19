# Legacy and unused code

This is a **candidate list** for a later cleanup, not a deletion plan. Confirm each item against [open questions](open-questions.md) before removing it. Several paths look unused from static analysis but may still be triggered by Netlify UI, old bookmarks, or unpublished env flags.

## High confidence leftovers

| Item | Why it looks unused |
| --- | --- |
| `themes/hyde-x` submodule | Not set as `theme` in `config.yml`; `themes/` is not present in a normal clone unless submodules are initialized |
| `crossref` git submodule | Makefile `crossref-check` validates against `crossref/schemas/...`, but the submodule is empty unless initialized; deposits may still work without local XSD |
| `.forestry/` | Forestry CMS is discontinued; not a live editor |
| `static/admin/` (Decap CMS) | In-repo `/admin/` UI; **not working yet**. GitHub is the editor until this is revived or removed |
| `code/wordpress.py`, `code/wp-migrate.py`, `code/newsletter/wordpress.py` | WordPress import. Live site is Hugo. `wp-migrate.py` expects `wp/*.json` which is gitignored |
| `code/extract.js` | RDF extract; commented out in `code/production` |
| `code/algolia.js` | Custom Algolia updater; production uses `npm run algolia` → `atomic-algolia` |
| `layouts/single1.html` | Alternate single template; no `layout: single1` found in content |
| `assets/js/subscribe.js` | Empty file, still imported from `turbo.js` |
| `assets/js/fontvar.js` | Not imported by `turbo.js` |
| `layouts/partials/params.html` + `params_override_lookup.html` | `params.html` is not included from other templates; it also calls a partial name (`params_override`) that does not match the file name |

## Likely-stale features (behavior still in tree)

| Item | Notes |
| --- | --- |
| AMP (`layouts/_default/baseof.amp.html`, `config/amp/outputs.yml`) | AMP is not in default `outputs`. Comment in `main.scss` still mentions `ampcssframework` |
| Tailwind | Scripts and `sources/tailwind.css` exist; production does not compile or include `tw.css` |
| `layouts/_default/single.mjml.html` | MJML article layout; newsletter CLI uses `code/newsletter.plim` instead |
| Google Analytics UA in `update_analytics.py` / `byviews.html` | UA Reporting API v3 was shut down. Homepage view-count usage in `single.html` is commented out. `byviews.html` still `getJSON`s `PeacefulScience/analytics` |
| OneSignal | Still injected in production `head.html`, with SDK paths under `/wp-content/plugins/onesignal-...` |
| Discourse auto-share | `share_discourse.py` works, but DAILY tasks comment says “removed DISCOURSE for now” |
| Mailchimp send | `send_newsletter` is commented out; CLI (`make news`) still creates/updates campaigns and sends **test** emails. **Not** invoked by Netlify. |
| `content/news/` | Single 2019 staff note; not in the main nav |
| `package.json` `"directories": { "test": "test" }` | No `test/` tree in repo (`test*` is gitignored) |
| `layouts/_default/index.precompute` | `precompute` output format is defined but not listed in default `outputs` |
| Duplicate `path:` key in `config.yml` `print` outputformat | YAML duplicate; last value wins, harmless but messy |

## Migration-era static paths

`layouts/partials/redirects.html` still maps `/wp-content/uploads/*` → `/img/` and old PDF URLs. `static/wp-content/` and OneSignal headers in `static/_headers` exist so old WordPress URLs keep working. Do not delete without checking traffic / bookmarks.

`static/js/jquery.min.js` and `bootstrap.min.js` are referenced by `.gitattributes`/gitignore noise (LFS pointers) and may not be fully present; Bootstrap is compiled from npm SCSS, not those copies.

## Dependency smell

`package.json` includes packages that templates/scripts may not need on the critical path, for example:

- `@google-cloud/language`, `citeproc`, `zotero-translators`, `puppeteer`, `onesignal` (npm) vs the CDN SDK in `onesignal.js`
- `"package.json": "^2.0.1"` (almost certainly accidental)
- `atomic-algolia-fixed` listed in dependencies while the `algolia` script calls `atomic-algolia`

Python: `Pillow` is imported by `imgsize.py` but missing from `requirements.txt`. `requests` is used in several scripts but not listed (may be pulled in transitively).

Hugo is several major versions behind; a “cleanup” that also upgrades Hugo is a larger, breaking template rewrite.

## What *is* still on the hot path

Keep these unless product direction changes:

- `code/production`, `render.js`, usercache plugin
- Algolia index generation + `search.js`
- Crossref XML layouts + `data/doi.json`
- Print layouts + `functions/pdf`
- Image CDN partials + `data/imgsize.json`
- Suggest Changes / GitHub links
- Mailchimp embed forms (even if the Python campaign CLI is unused)
