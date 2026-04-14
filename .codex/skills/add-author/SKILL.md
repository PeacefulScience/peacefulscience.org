---
name: add-author
description: Add a new author profile for peacefulscience.org under `content/authors`. Use when Codex needs to check whether an author already exists, gather missing details from the user, browse the web for stable profile data such as ORCID, official biography pages, and durable profile URLs, draft a short bio, propose a non-conflicting slug, present the draft for approval, and only then write and commit the author entry.
---

# Add Author

Add author pages in the format used by this repository.

Read [references/repo-author-format.md](references/repo-author-format.md) before writing the file.

## Workflow

1. Check for an existing author before asking for anything else.
   Search `content/authors/*/_index.md` for the full name and likely variants.
   Also check for a matching slug directory under `content/authors/`.
   If the author appears to already exist, stop and show the match instead of drafting a duplicate.
   If the search finds a plausible but not certain existing match, show that possible match to the user and ask whether it is the same person.

2. Gather the minimum missing information from the user.
   Required: full display name.
   Helpful: affiliation, role, field, personal or institutional page, ORCID, Google Scholar, X/Twitter handle, Wikipedia page, short notes for the bio, and any preferred slug.
   Ask concise follow-up questions only after the duplicate check.

3. Research stable profile details on the web.
   Do a web search for every new author unless the user explicitly forbids browsing.
   Browse for official or durable sources first: ORCID, university or lab profile, personal website, publisher page, Google Scholar, and Wikipedia when relevant.
   Use the web to support both the bio draft and the metadata, especially `sameas` URLs.
   Prefer verified identifiers and institutional affiliations over social profiles.
   Treat `content/authors/swamidass/_index.md` as the fullest target example for a well-developed entry.
   When available and verifiable, try to capture the same supported metadata fields used there: `orcid`, `twitter`, `gscholar`, `wiki`, and `sameas`.
   For `sameas`, actively collect durable public profile pages that identify the same person, prioritizing official institutional pages, personal sites, ORCID, Google Scholar, publisher/author pages, and Wikipedia when appropriate.
   Avoid stuffing `sameas` with low-value or unstable links.
   If multiple people have the same name, or if any source match is uncertain, stop and ask the user to confirm the identity before drafting.
   When asking, explicitly list the plausible existing match or matches you found and why they might correspond to the requested author.
   Never guess that two profiles belong to the same person based on name similarity alone.

4. Propose a slug.
   Use the user's preferred slug if they gave one and it does not clash.
   Otherwise, derive a lower-case hyphen slug from the author's common name.
   Re-check for clashes at `content/authors/<slug>/`.
   If the slug is taken, propose 2-3 nearby alternatives and ask the user to choose.

5. Draft the author entry before writing anything.
   Show the proposed slug and the full `_index.md` draft to the user.
   Write a neutral 2-4 sentence bio in present tense unless the person is deceased or clearly retired from the role being described.
   Base the bio on verifiable facts from the user and from web research, not just user-supplied wording.
   Do not include claims that are hard to verify, promotional phrasing, or controversial descriptions stated as fact.

6. Wait for explicit approval.
   Do not create or modify files until the user approves the slug and draft.
   If the user asks for revisions, update the draft and ask again.

7. After approval, write the file and commit it.
   Create `content/authors/<slug>/_index.md`.
   Re-check that the slug still does not exist immediately before writing.
   Include as much supported frontmatter as you can verify, not just the minimum.
   Prefer a well-developed entry like `content/authors/swamidass/_index.md` whenever the data is available.
   Keep frontmatter limited to fields supported by the repo and backed by user input or sources.
   Commit only after the file is written and the user has approved the draft.
   Use a concise commit message such as `Add author profile for <Name>`.

## Author File Rules

- Use this shape:

```md
---
title: Full Name
orcid: 0000-0000-0000-0000
twitter: handle
gscholar: scholarId
wiki: https://en.wikipedia.org/wiki/Example
sameas:
- https://example.edu/profile
- https://example.com
---
Short bio paragraph.
```

- Include optional keys only when they are known and useful.
- Prefer a complete entry over a sparse one when reliable data is available.
- Check for each of these before settling for a minimal file: `orcid`, `twitter`, `gscholar`, `wiki`, and one or more `sameas` URLs.
- Use `sameas` for extra stable URLs that do not have a dedicated frontmatter key.
- Treat `sameas` as important structured data, not an optional afterthought, because these URLs are used downstream in author JSON-LD.
- Prioritize `sameas` links that clearly identify the same person on authoritative pages.
- If identity is not certain, do not include the link yet; ask the user to confirm first.
- Preserve ASCII unless the author's real name requires accents or other characters already used in source material.
- Match existing repo style: one short paragraph after frontmatter, no trailing sections.

## Practical Checks

- Duplicate name check:
  `rg -n '^(title|Title):' content/authors/*/_index.md`
- Candidate slug check:
  `test -e content/authors/<slug>/_index.md`
- Existing examples:
  `content/authors/swamidass/_index.md`
  `content/authors/ian-hutchinson/_index.md`

## Metadata Gathering Order

Try to gather supported fields in this order:

1. `title`
2. `orcid`
3. `gscholar`
4. `wiki`
5. `twitter`
6. `sameas` with official institutional and personal profile URLs
7. bio facts needed for the paragraph

## Output To Show Before Approval

Always show:

- Whether the author already appears to exist
- Any plausible existing author matches that need confirmation
- The sources used for the draft
- Which URLs are being added to `sameas` and why they were chosen
- The proposed slug
- The exact `_index.md` draft
- Any uncertainty that still needs user confirmation

## Identity Safety Rule

When matching a person across web results, be conservative.

- If there is any real doubt that a page belongs to the author, ask the user to confirm before using it.
- Do not merge facts from multiple people with the same or similar names.
- Do not infer ORCID, Google Scholar, X/Twitter, Wikipedia, or institutional pages from partial matches.
- It is better to leave a field blank than to attach the wrong identity.
