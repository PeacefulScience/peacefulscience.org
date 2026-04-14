# Repo Author Format

Author pages live at `content/authors/<slug>/_index.md`.

## Required

- `title`: display name shown on the site
- body: one short bio paragraph

## Optional Frontmatter Seen In This Repo

- `orcid`
- `twitter`
- `gscholar`
- `wiki`
- `sameas`

Use only fields with solid backing from the user or from stable public sources.
When those details are available, prefer a full profile rather than a minimal one.

## Notes

- Author lookup in templates is slug-based and uses `urlize`, so slug collisions matter.
- The UI renders an ORCID icon automatically when `orcid` is present.
- Author metadata is also pulled into structured data, so `sameas` links improve JSON-LD when they are accurate and authoritative.
- Some older entries use `Title` instead of `title`; use lowercase `title` for new entries.
- Some entries contain only `title` and a bio. Minimal entries are acceptable.

## Good Reference Files

- `content/authors/swamidass/_index.md`
- `content/authors/ian-hutchinson/_index.md`
- `content/authors/ken-miller/_index.md`

## Preferred Model

Use `content/authors/swamidass/_index.md` as the best local example of a fully developed entry.

It shows the preferred pattern when data is available:

- `title`
- `orcid`
- `twitter`
- `gscholar`
- `wiki`
- `sameas`
- one concise bio paragraph

Not every author will have every field, but the skill should actively look for each supported field before settling for a sparse entry.

## SameAs Guidance

Prioritize `sameas` URLs in roughly this order:

1. official institutional or lab profile
2. personal website or homepage
3. ORCID profile URL
4. Google Scholar profile URL
5. reputable publisher or organization author page
6. Wikipedia page when it clearly matches the person

Avoid low-confidence social links, aggregator pages, or URLs that are unlikely to stay stable.
If there is any doubt that a URL belongs to the same person, leave it out and confirm with the user first.
