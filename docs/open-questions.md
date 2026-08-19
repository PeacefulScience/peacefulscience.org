# Open questions

These are the unknowns that should be settled before a clarity/cleanup refactor. Answers can be short; even “ignore / delete” is useful.

## Confirmed so far

- **Hosting:** the live site is deployed on **Netlify** (site `peacefulscience`). Production builds run `make production` from `netlify.toml`.
- **No working front-end admin:** Decap (`/admin/`) and Forestry are in the repo but **not operational**. Publishing and corrections go through **Git / GitHub** (including the on-page “Suggest Changes” link, which opens GitHub’s file editor).

## Product and ownership

1. **Who is actively maintaining the site today?** Is this still the primary publishing workflow, or is the site mostly archival?
2. **What should a refactor optimize for?** Examples: easier article publishing, fewer moving parts on Netlify, Hugo upgrade, faster builds, removing dead integrations, accessibility, or visual redesign.
3. **Is the Discourse forum still the intended comments system?** Should new articles always get a `commenturl`, and should auto-posting (`share_discourse.py`) be restored?

## Publishing workflow

4. **Which editor UI is canonical?** **Answered: GitHub.** No in-site CMS is working. Remaining: should Decap be made to work later, or should `/admin/` and `.forestry/` be removed as dead UI?
5. **Are newsletters still sent from this repo** (`python -m code.newsletter`), or has that moved entirely into Mailchimp’s own composer?
6. **Who assigns DOIs, and to which content?** All new articles, prints only, or nothing new? Is the Crossref account still active?
7. **Are on-demand Prince PDFs (`/pdf/articles/...pdf`) still used?** If yes, is the Lambda Prince zip still the right way to ship the binary?

## Integrations that may be dead

8. **Algolia:** Is the `PeacefulScience` index still updated in production? Daily builds only upload when Hugo logs `TODAY` — is that still the intended gate?
9. **OneSignal:** Should web push stay? The implementation still points at WordPress plugin paths.
10. **Analytics:** UA v3 code cannot work as written. Is GTM/GA4 the only analytics now? Can `update_analytics.py`, `byviews.html`, and the analytics git repo hook be removed?
11. **AMP, Tailwind, MathJax, cite/bookcover functions:** which of these are still required in production?
12. **Netlify Large Media / Git LFS:** Netlify has been winding Large Media down. Is it still enabled on this site, and is there a preferred replacement for images/PDFs?

## Build behavior

13. **Should deploy previews run `code/render.js`?** They currently do not, so dropcaps/sidenotes/MathJax differ from production.
14. **Should the default (non-production) Netlify command stay as bare `hugo`?** That also skips Make, Prince, and post-render.
15. **Is the daily scheduled rebuild (`functions/daily-build.js` → `BUILD_HOOK`) still configured and wanted?**
16. **Python on Netlify:** is `runtime.txt` (3.8) still needed for production, or only for local CLI tools?

## Content policy (for later refactors that touch templates)

17. **Homepage composition** in `layouts/index.html` hard-codes topic buckets (prints, featured, race/ancestry, AI, art). Is that still the editorial intent?
18. **`news/` vs `articles/`:** should the leftover news item be moved and the section removed?
19. **Comics POC** is gitignored (`content/comics`, `static/img/comics`). Keep ignoring, revive, or delete local leftovers?

## Documentation follow-up

20. **Where should contributor docs live long-term?** This `docs/` folder, the public `/about/` pages, Cursor rules, or all three with a single source of truth?
21. **Should author values be normalized to slugs?** Books and several prints use display names with no `content/authors/` page. A strict schema would break those bylines.
22. **Should `prints/excerpts` and `prints/deleted` stay one Hugo section?** They share `single.html` but not front matter. Splitting types would clarify templates at the cost of URL/section changes.
