# Open questions

These are the unknowns that should be settled before a clarity/cleanup refactor. Answers can be short; even “ignore / delete” is useful.

## Confirmed so far

- **Hosting:** the live site is deployed on **Netlify** (site `peacefulscience`). Production git deploys run `make production` → `code/production` with `TASKS=BUILD` (Hugo + `render.js` only).
- **No working front-end admin:** Decap (`/admin/`) and Forestry are in the repo but **not operational**. Publishing and corrections go through **Git / GitHub**.
- **DOI assign vs deposit:** **Crossref is active.** **Admins mint** via local `make doi` (writes `data/doi.json`, **not** the article file). Deposit is the DAILY Netlify hook, only if Hugo logged `TODAY`.
- **Sidecar data:** auto-generated fields follow the DOI pattern (`data/*.json` keyed by path/URL) so they do not clobber the article’s git last-modified (`enableGitInfo`). Editorial body/front-matter edits are supposed to change lastmod.
- **Image sizes:** adding an image requires updating `data/imgsize.json` (`make imginfo` locally). Netlify **does not download LFS files**, so the build cannot measure `static/img/`. Do not regenerate that JSON on Netlify.
- **Mailchimp campaigns:** local `make news` only. The Netlify build does not call Mailchimp. Subscribe forms on the site are separate (browser POST to Mailchimp).
- **AMP is defunct.** No AMP output. Safe to delete `layouts/_default/baseof.amp.html` and `config/amp/`.
- **CSS: Tailwind.** Prefer Tailwind; migrate all remaining CSS (today production is still Bootstrap 4 SCSS). The Tailwind toolchain is the destination, not leftover.
- **Discourse integration is defunct.** Do not restore `share_discourse.py` / `DISCOURSE` postbuild / auto-`commenturl`. Historical forum links in content can remain until cleaned up.
- **Page PDFs:** Prince of `_prince` HTML. Lambda until **~6 MB**; larger files → local Prince + LFS at `static/pdf/<section>/<slug>.pdf`. Shortcodes must work on the site and in Prince.
- **Tracking (near-term):** remove defunct Universal Analytics (`ga('send')`, `update_analytics.py`, `byviews.html`). Improve remaining GTM/GA4 so Turbo navigations count.
- **Crossref account is active.** Admins mint DOIs (today: `make doi` → `data/doi.json`). Deposit remains DAILY + `TODAY`.
- **Algolia** index `PeacefulScience` is still the live search backend. Daily hook still runs and is wanted.
- **Netlify Large Media / LFS is in use.** Optional later: store binaries on S3 and point ImageEngine at S3 instead of the Netlify origin. `imgsize.json` stays either way.
- **Word ingest format** (`.docx` vs Google Docs API): decide when that implementation starts; not a blocker for other work.
- **Admin stack: undecided.** Candidate: Decap (or similar Git CMS) plus GitHub Actions to run sidecar processes on updates (`imginfo`, optional explicit DOI mint). Not chosen yet.
- **SEO / JSON-LD:** live path is the jsonld mini-language, not `seo/structured`. Goal 9 recorded: fix `sameas`/`sameAs`, DOI `identifier`, author `notnews`, AI utilization. Policy still open: `llms.txt`, training crawlers, PDFs in sitemap.

## Product and ownership

1. **Who is actively maintaining the site today?** Is this still the primary publishing workflow, or is the site mostly archival?
2. **What should a refactor optimize for?** **Answered as product direction** in [goals](goals.md): hosted admin, Word ingest, Crossref, Algolia, SEO/JSON-LD/AI, Tailwind, sidecar data. **Near-term:** remove defunct Universal Analytics and fix Turbo pageview tracking; JSON-LD hygiene (goal 9). AMP and Discourse integration are out of scope (delete, do not revive).
3. **Discourse comments / auto-post?** **Answered: integration is defunct.** Do not restore auto-posting. `commenturl` / “Discuss on Forum” are leftover UI. The forum site may still exist independently; this repo should not treat it as a publishing dependency.

## Publishing workflow

4. **Which editor UI is canonical?** **Today: GitHub.** **Direction: a working admin UI.** Stack **not chosen**. Candidate to evaluate: **Decap + GitHub Actions** (Decap for markdown commits; Actions for processes on update: `imginfo`, explicit DOI mint, later citation/entity sidecars). Decap as-is still cannot encode per-folder schemas or Prince shortcodes; Actions would have to own generated `data/` files. Forestry: leftover, delete when convenient.
5. **Are newsletters still sent from this repo** (`make news` / `python -m code.newsletter`)? Confirmed: that path is **not** in the Netlify build. Remaining: is the CLI still how campaigns are composed, or has that moved into Mailchimp’s UI?
6. **Who assigns DOIs, and to which content?** **Answered:** Crossref is **active**. **Admins mint** (CLI `make doi` today). Deposit is DAILY Netlify. Minting stays an explicit admin action, not a save side effect. Which sections get DOIs remains an editorial choice per page.
7. **On-demand Prince PDFs?** **Answered: yes.** `/pdf/articles/…` is still the download URL. Typical pages: Lambda from `_prince` HTML. **If the PDF would be > ~6 MB**, generate locally with Prince of that same HTML and commit LFS at `static/pdf/<section>/<slug>.pdf` (Tonto Group articles already do this). Do not use the main site HTML. `code/pdf` is missing though `make pdf` still calls it.

## Integrations that may be dead

8. **Algolia?** **Answered: yes**, `PeacefulScience` is still the live search backend. Daily upload is still gated on `TODAY` (freshness is still a gap for goal 3).
9. **OneSignal:** Should web push stay? The implementation still points at WordPress plugin paths.
10. **Analytics?** **Answered: UA is defunct — remove it.** Near-term work: delete `ga('send')`, `update_analytics.py`, `ANALYTICS`/`GA_SERVICE`, `byviews.html`. Improve GTM (`GTM-KDF8R85`) / GA4 (`G-BHPH29YM44`) so `turbo:load` records pageviews. Do not rebuild most-read widgets on UA data. Remaining: keep GTM+GA4 vs a single `gtag` snippet.
11. **MathJax, cite/bookcover functions:** which of these are still required in production? (**AMP: defunct.** **Tailwind: keep and migrate all CSS onto it.**)
12. **Netlify Large Media / Git LFS?** **Answered: still in use.** Build still does not download LFS (`imgsize.json` required). Open to **S3 for binaries** later if helpful; ImageEngine can then origin from S3 instead of the Netlify live site. Sidecar dimensions stay.

## Build behavior

13. **Should deploy previews run `code/render.js`?** They currently do not, so dropcaps/sidenotes/MathJax differ from production.
14. **Should the default (non-production) Netlify command stay as bare `hugo`?** That also skips Make, Prince, and post-render.
15. **Daily scheduled rebuild?** **Answered: yes**, still configured and wanted. It remains the automated Crossref deposit + Algolia upload path (gated on `TODAY`). Goal 7 still wants to replace full daily rebuilds with incremental side effects later.
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

23. **Admin stack?** **Undecided.** Candidate: Decap + GitHub Actions for sidecar processes on content updates. Do not implement a different CMS until this is chosen. DOI mint must stay explicit (not every Decap save).
24. **DOI policy?** **Answered:** admins mint; Crossref active. Keep assign as an explicit action. Per-section policy is editorial.
25. **Social networks** for auto-post: which of X / Facebook / Bluesky / Mastodon / Mailchimp? **Not Discourse.**
26. **Content-repo split:** required before admin ships, or only after Word ingest + DOI-as-a-service exist?
27. **Backend:** keep Hugo and move only side effects (Algolia/Crossref/social) off the daily rebuild vs processed content on S3 + dynamic JS vs Next/Metalsmith? Media-on-S3 (goal 12) can happen without a full backend port.
28. **Word ingest?** **Defer to implementation start:** `.docx` vs Google Docs API (editors already use Docs). Not a blocker for tracking, Tailwind, or Algolia/Crossref work.
29. **Entity detection provider:** reuse `@google-cloud/language`, or another NLP/LLM path that writes suggested topics into **sidecar** JSON (not into the article on each run)?
30. **`partials/lastmod.html` / `data/lastmod.json`:** unused override path. Keep for correcting bad git dates, or delete once sidecar enrichment is the norm?
31. **Newsletter `mailchimp.campaign_id`:** move to sidecar like DOIs, or leave the six existing front-matter values as a one-off?
32. **Restore `code/pdf`?** Makefile still expects it. Until then, local `prince` on the live `_prince` URL is the documented oversized-PDF path.

## SEO / JSON-LD / AI ([goal 9](goals.md#9-seo-json-ld-and-ai-utilization), [seo.md](seo.md))

33. **`llms.txt` and/or a markdown alternate** for AI crawlers? Ranking work does not require it; utilization might. If yes, keep generated text in sidecar or a committed static file — do not rewrite article markdown on a schedule.
34. **Training vs retrieval crawlers:** allow `GPTBot` / `Google-Extended` / `CCBot` as today (robots allows `*`), or restrict training while leaving Googlebot alone?
35. **PDF URLs in `sitemap.xml`:** keep (Scholar/PDF search), lower priority, or drop and rely on `rel="alternate"` + `citation_pdf_url` so HTML stays canonical?
36. **Keep Highwire `citation_*` metas** after JSON-LD `identifier`/`sameAs` is correct, or treat them as Scholar-only and trim on non-scholarly pages (books, authors)?
37. **BreadcrumbList** in the live jsonld system? The unused `seo/structured/breadcrumb.html` is wrong (skips position 2) and should not be copied.
38. **How far should ScholarlyArticle `citation` go** before goal 2’s sidecar exists — outbound `doi.org` links only, or wait for resolved CSL?
