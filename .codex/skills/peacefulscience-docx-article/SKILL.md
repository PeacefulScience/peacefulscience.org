---
name: peacefulscience-docx-article
description: Convert raw Word .docx manuscripts into Peaceful Science article markdown, then generate repo-matching metadata in the Claude workflow: title, description, authors, categories, and new-author records when needed. Use when a Word document needs to become a publishable article file in this repo.
---

# Peaceful Science DOCX Article

Use this skill when a user gives you a Word manuscript and wants it converted into the article format used in this repository.

## Workflow

1. Confirm the input is a `.docx` file. If it is an old binary `.doc`, stop and ask for it to be re-saved as `.docx`.
2. Before writing output, propose a sensible slug based on the manuscript title and ask the user to either confirm it or provide a different one.
3. Ask the user which content directory it should go in.
4. Offer the directory choice in terms of the repo structure, especially:
   - `content/articles/`
   - `content/prints/`
   - an existing subdirectory under either when appropriate
5. Before writing the final file, always check whether the proposed destination path already exists.
   - If it exists, do not clobber it.
   - Propose a new slug or ask the user whether they want a different filename.
6. Run the converter to extract the body and any explicit document metadata:

```bash
python3 code/docx_to_article.py /absolute/path/to/manuscript.docx --draft
```

7. Generate editorial metadata in the Claude workflow, not in the script:
   - Use the document title only if it is clearly present in the Word document.
   - If the title is weak or missing, propose a title that matches the style of existing Peaceful Science articles by checking nearby examples in `content/articles/` and `content/prints/`.
   - `description` is required.
   - If the Word document does not provide a subtitle or explicit description, draft one before finishing.
   - Follow the style of existing repo descriptions: one concise sentence, plain-language, specific to the article's argument or topic, and usually around 15-30 words.
   - Avoid vague summaries like "An article about..." or promotional copy.
8. Match authors against existing author records in `content/authors/*/_index.md`.
   - Prefer an exact existing slug when available.
   - If an author is not present, create a new author record under `content/authors/<slug>/_index.md`.
   - For unknown authors, search the web for authoritative sources to assemble:
     - full display name
     - short bio
     - ORCID if available
     - Twitter/X handle if clearly attributable
     - wiki or institutional profile
     - `sameas` links for strong identity sources
9. Match categories only from existing taxonomy files in `content/categories/*/_index.md`.
   - Choose the smallest set that fits the manuscript.
   - Do not invent new categories unless the user explicitly asks for taxonomy changes.
10. Write the final file only after the slug and destination are confirmed and verified not to collide with an existing file, then review it for cleanup where the Word XML structure was ambiguous.

## Notes

- The converter reads raw WordprocessingML from the `.docx` zip package. It does not depend on Pandoc.
- It preserves:
  - headings
  - bold and italics
  - hyperlinks
  - ordered and unordered lists
  - tables
  - footnotes and endnotes
- The script should not invent authors, categories, or descriptions.
- Metadata quality is the skill's responsibility:
  - title proposal
  - description proposal, always present by the end of the task
  - author matching or creation
  - category selection

## Author Record Template

Create new author files like:

```md
---
title: Full Name
orcid: 0000-0000-0000-0000
twitter: handle
wiki: https://example.org/profile
sameas:
- https://institution.example.edu/profile
---
Short third-person bio in the style of existing author entries.
```

Only include fields you can support confidently from sources.
