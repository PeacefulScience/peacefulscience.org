# Open questions

These are the unknowns that should be settled before a clarity/cleanup refactor. Answers can be short; even “ignore / delete” is useful.

## Confirmed so far

- **Hosting:** the live site is deployed on **Netlify** (site `peacefulscience`). Production git deploys run `make production` → `code/production` with `TASKS=BUILD` (Hugo + `render.js` only).
- **No working front-end admin:** Decap (`/admin/`) and Forestry are in the repo but **not operational**. Publishing and corrections go through **Git / GitHub**.
- **DOI assign vs deposit:** minting IDs is local `make doi` (writes `data/doi.json`, **not** the article file). Crossref *deposit* is the DAILY Netlify hook, and only if Hugo logged `TODAY`.
- **Sidecar data:** auto-generated fields follow the DOI pattern (`data/*.json` keyed by path/URL) so they do not clobber the article’s git last-modified (`enableGitInfo`). Editorial body/front-matter edits are supposed to change lastmod.
- **Image sizes:** adding an image requires updating `data/imgsize.json` (`make imginfo` locally). Netlify **does not download LFS files**, so the build cannot measure `static/img/`. Do not regenerate that JSON on Netlify.
- **Mailchimp campaigns:** local `make news` only. The Netlify build does not call Mailchimp. Subscribe forms on the site are separate (browser POST to Mailchimp).
- **AMP is defunct.** No AMP output. Safe to delete `layouts/_default/baseof.amp.html` and `config/amp/`.
- **CSS: Tailwind.** Prefer Tailwind; migrate all remaining CSS (today production is still Bootstrap 4 SCSS). The Tailwind toolchain is the destination, not leftover.
- **Discourse integration is defunct.** Do not restore `share_discourse.py` / `DISCOURSE` postbuild / auto-`commenturl`. Historical forum links in content can remain until cleaned up.
- **Page PDFs:** Prince of `_prince` HTML. Lambda until **~6 MB**; larger files → local Prince + LFS at `static/pdf/<section>/<slug>.pdf`. Shortcodes must work on the site and in Prince.
- **Tracking (near-term):** remove defunct Universal Analytics (`ga('send')`, `update_analytics.py`, `byviews.html`). Improve remaining GTM/GA4 so Turbo navigations count.

## Product and ownership

1. **Who is actively maintaining the site today?** Is this still the primary publishing workflow, or is the site mostly archival?
2. **What should a refactor optimize for?** **Answered as product direction** in [goals](goals.md): hosted admin, Word ingest, Crossref, Algolia, Tailwind, sidecar data. **Near-term:** remove defunct Universal Analytics and fix Turbo pageview tracking. AMP and Discourse integration are out of scope (delete, do not revive).
3. **Discourse comments / auto-post?** **Answered: integration is defunct.** Do not restore auto-posting. `commenturl` / “Discuss on Forum” are leftover UI. The forum site may still exist independently; this repo should not treat it as a publishing dependency.

## Publishing workflow

4. **Which editor UI is canonical?** **Today: GitHub.** **Direction: a working admin UI** so editors do not need a local clone ([goals](goals.md) §1). Decap/Forestry as they sit cannot meet DOI control, per-folder schemas, or shortcode helpers. Remaining: custom admin vs a Git-backed CMS we extend; remove `/admin/` and `.forestry/` once that choice is made.
5. **Are newsletters still sent from this repo** (`make news` / `python -m code.newsletter`)? Confirmed: that path is **not** in the Netlify build. Remaining: is the CLI still how campaigns are composed, or has that moved into Mailchimp’s UI?
6. **Who assigns DOIs, and to which content?** Confirmed: assignment is **CLI** (`make doi` → `data/doi.json` commit). Deposit is DAILY Netlify. Remaining: is that CLI still used for new prints/articles? Is the Crossref account still active?
7. **On-demand Prince PDFs?** **Answered: yes.** `/pdf/articles/…` is still the download URL. Typical pages: Lambda from `_prince` HTML. **If the PDF would be > ~6 MB**, generate locally with Prince of that same HTML and commit LFS at `static/pdf/<section>/<slug>.pdf` (Tonto Group articles already do this). Do not use the main site HTML. `code/pdf` is missing though `make pdf` still calls it.

## Integrations that may be dead

8. **Algolia:** Is the `PeacefulScience` index still updated in production? Daily builds only upload when Hugo logs `TODAY`. Goal 3 is to improve indexing and the search page regardless; confirm the index is still the live search backend.
9. **OneSignal:** Should web push stay? The implementation still points at WordPress plugin paths.
10. **Analytics?** **Answered: UA is defunct — remove it.** Near-term work: delete `ga('send')`, `update_analytics.py`, `ANALYTICS`/`GA_SERVICE`, `byviews.html`. Improve GTM (`GTM-KDF8R85`) / GA4 (`G-BHPH29YM44`) so `turbo:load` records pageviews. Do not rebuild most-read widgets on UA data. Remaining: keep GTM+GA4 vs a single `gtag` snippet.
11. **MathJax, cite/bookcover functions:** which of these are still required in production? (**AMP: defunct.** **Tailwind: keep and migrate all CSS onto it.**)
12. **Netlify Large Media / Git LFS:** Confirmed: **Netlify does not download LFS** in the build; that is why `imgsize.json` is committed. Remaining: Large Media is being wound down — is it still enabled, and is there a preferred replacement for storing the binaries (S3, etc.) while keeping the sidecar?

## Build behavior

13. **Should deploy previews run `code/render.js`?** They currently do not, so dropcaps/sidenotes/MathJax differ from production.
14. **Should the default (non-production) Netlify command stay as bare `hugo`?** That also skips Make, Prince, and post-render.
15. **Is the daily scheduled rebuild (`functions/daily-build.js` → `BUILD_HOOK`) still configured and wanted?** That is the only automated Crossref/Algolia upload path. Goal 7 is to replace full daily rebuilds with incremental publish + side effects.
16. **Python on Netlify:** `runtime.txt` is 3.8. Default `BUILD` does not call Python. **DISCOURSE and ANALYTICS (UA) are defunct.** Python remains for local CLI (`doi`, `news`, `imginfo`) if those stay in this repo.

## Content policy (for later refactors that touch templates)

17. **Homepage composition** in `layouts/index.html` hard-codes topic buckets (prints, featured, race/ancestry, AI, art). Is that still the editorial intent?
18. **`news/` vs `articles/`:** should the leftover news item be moved and the section removed?
19. **Comics POC** is gitignored (`content/comics`, `static/img/comics`). Keep ignoring, revive, or delete local leftovers?

## Documentation follow-up

20. **Where should contributor docs live long-term?** This `docs/` folder, the public `/about/` pages, Cursor rules, or all three with a single source of truth?
21. **Should author values be normalized to slugs?** Books and several prints use display names with no `content/authors/` page. A strict schema would break those bylines. The admin should auto-create author pages (goal 1) without requiring every historical byline to become a slug first.
22. **Should `prints/excerpts` and `prints/deleted` stay one Hugo section?** They share `single.html` but not front matter. Splitting types would clarify templates at the cost of URL/section changes.

## Product direction (from [goals](goals.md))

23. **Admin stack:** custom hosted app, GitHub-backed CMS with validation, or Git gateway (Actions/app that commits `content/` + `data/doi.json`)? Decap as-is is not sufficient.
24. **DOI policy in the admin:** who may mint? Articles and prints, or prints only? Must assign stay an explicit button (recommended) rather than a side effect of save?
25. **Social networks** for auto-post: which of X / Facebook / Bluesky / Mastodon / Mailchimp? **Not Discourse.**
26. **Content-repo split:** required before admin ships, or only after Word ingest + DOI-as-a-service exist?
27. **Backend:** keep Hugo and move only side effects (Algolia/Crossref/social) off the daily rebuild vs processed content on S3 + dynamic JS vs Next/Metalsmith?
28. **Word ingest:** `.docx` upload only, or Google Docs API as well (editors already work in Docs)?
29. **Entity detection provider:** reuse `@google-cloud/language`, or another NLP/LLM path that writes suggested topics into **sidecar** JSON (not into the article on each run)?
30. **`partials/lastmod.html` / `data/lastmod.json`:** unused override path. Keep for correcting bad git dates, or delete once sidecar enrichment is the norm?
31. **Newsletter `mailchimp.campaign_id`:** move to sidecar like DOIs, or leave the six existing front-matter values as a one-off?
32. **Restore `code/pdf`?** Makefile still expects it. Until then, local `prince` on the live `_prince` URL is the documented oversized-PDF path.
