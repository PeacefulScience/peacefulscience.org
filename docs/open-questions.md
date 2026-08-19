# Open questions

These are the unknowns that should be settled before a clarity/cleanup refactor. Answers can be short; even “ignore / delete” is useful.

## Confirmed so far

- **Hosting:** the live site is deployed on **Netlify** (site `peacefulscience`). Production git deploys run `make production` → `code/production` with `TASKS=BUILD` (Hugo + `render.js` only).
- **No working front-end admin:** Decap (`/admin/`) and Forestry are in the repo but **not operational**. Publishing and corrections go through **Git / GitHub**.
- **DOI assign vs deposit:** minting IDs is local `make doi` (writes `data/doi.json`). Crossref *deposit* is the DAILY Netlify hook, and only if Hugo logged `TODAY`.
- **Mailchimp campaigns:** local `make news` only. The Netlify build does not call Mailchimp. Subscribe forms on the site are separate (browser POST to Mailchimp).

## Product and ownership

1. **Who is actively maintaining the site today?** Is this still the primary publishing workflow, or is the site mostly archival?
2. **What should a refactor optimize for?** **Answered as product direction** in [goals](goals.md): hosted admin (no local clone), accurate Crossref references, better Algolia, auto topics/entities, auto social posts, optional content-repo split, optional S3/dynamic backend so new content does not require a full daily rebuild, and **Word → Hugo format as the highest near-term implementation goal**. Cleanup/Hugo-upgrade is secondary to that pipeline.
3. **Is the Discourse forum still the intended comments system?** Should new articles always get a `commenturl`, and should auto-posting (`share_discourse.py`) be restored? (Also part of goal 5 — which networks besides Discourse?)

## Publishing workflow

4. **Which editor UI is canonical?** **Today: GitHub.** **Direction: a working admin UI** so editors do not need a local clone ([goals](goals.md) §1). Decap/Forestry as they sit cannot meet DOI control, per-folder schemas, or shortcode helpers. Remaining: custom admin vs a Git-backed CMS we extend; remove `/admin/` and `.forestry/` once that choice is made.
5. **Are newsletters still sent from this repo** (`make news` / `python -m code.newsletter`)? Confirmed: that path is **not** in the Netlify build. Remaining: is the CLI still how campaigns are composed, or has that moved into Mailchimp’s UI?
6. **Who assigns DOIs, and to which content?** Confirmed: assignment is **CLI** (`make doi` → `data/doi.json` commit). Deposit is DAILY Netlify. Remaining: is that CLI still used for new prints/articles? Is the Crossref account still active?
7. **Are on-demand Prince PDFs (`/pdf/articles/...pdf`) still used?** If yes, is the Lambda Prince zip still the right way to ship the binary?

## Integrations that may be dead

8. **Algolia:** Is the `PeacefulScience` index still updated in production? Daily builds only upload when Hugo logs `TODAY`. Goal 3 is to improve indexing and the search page regardless; confirm the index is still the live search backend.
9. **OneSignal:** Should web push stay? The implementation still points at WordPress plugin paths.
10. **Analytics:** UA v3 code cannot work as written. Is GTM/GA4 the only analytics now? Can `update_analytics.py`, `byviews.html`, and the analytics git repo hook be removed?
11. **AMP, Tailwind, MathJax, cite/bookcover functions:** which of these are still required in production?
12. **Netlify Large Media / Git LFS:** Netlify has been winding Large Media down. Is it still enabled on this site, and is there a preferred replacement for images/PDFs?

## Build behavior

13. **Should deploy previews run `code/render.js`?** They currently do not, so dropcaps/sidenotes/MathJax differ from production.
14. **Should the default (non-production) Netlify command stay as bare `hugo`?** That also skips Make, Prince, and post-render.
15. **Is the daily scheduled rebuild (`functions/daily-build.js` → `BUILD_HOOK`) still configured and wanted?** That is the only automated Crossref/Algolia upload path. Goal 7 is to replace full daily rebuilds with incremental publish + side effects.
16. **Python on Netlify:** `runtime.txt` is 3.8. Default `BUILD` does not call Python. Keep it only if ANALYTICS/DISCOURSE hooks are still used.

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
25. **Social networks** for auto-post: Discourse only, plus which of X / Facebook / Bluesky / Mastodon / Mailchimp?
26. **Content-repo split:** required before admin ships, or only after Word ingest + DOI-as-a-service exist?
27. **Backend:** keep Hugo and move only side effects (Algolia/Crossref/social) off the daily rebuild vs processed content on S3 + dynamic JS vs Next/Metalsmith?
28. **Word ingest:** `.docx` upload only, or Google Docs API as well (editors already work in Docs)?
29. **Entity detection provider:** reuse `@google-cloud/language`, or another NLP/LLM path that writes suggested `topics` / `tags` for human accept?
