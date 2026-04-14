---
name: convert-docx
description: Convert raw Word .docx manuscripts into Peaceful Science article markdown, then generate repo-matching metadata: title, description, authors, categories, and new-author records when needed. Use when a Word document needs to become a publishable article file in this repo.
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

7. After the Python conversion, review the converted draft and assign repo-native categories before finalizing metadata.
   - Read the existing taxonomy under `content/categories/*/_index.md`.
   - Compare the manuscript's subject, argument, and framing against the current category set.
   - Add the relevant existing category slugs to frontmatter metadata in the converted draft.
   - Prefer the smallest accurate set.
   - Do not invent new categories or leave category selection implicit.

8. After the Python conversion, always ask the user who the author or authors should be.
   - Do not assume the converter found the right author names.
   - Add authors to frontmatter under `authors:` using the repo's author slugs.
   - Look up each author in `content/authors/*/_index.md` by checking both slug candidates and author metadata such as `title`, `orcid`, `sameas`, and other fields when needed to confirm the match.
   - If you find a plausible but uncertain existing match, show that candidate author slug and title to the user and ask whether it is the right person.
   - If there is not a confident existing author match, use `$add-author` to create the author record before finalizing article metadata.
   - If there is any uncertainty about identity, confirm with the user before attaching the author slug.

9. Generate editorial metadata in the workflow, not in the script:
   - Use the document title only if it is clearly present in the Word document.
   - If the title is weak or missing, propose a title that matches the style of existing Peaceful Science articles by checking nearby examples in `content/articles/` and `content/prints/`.
   - `description` is required.
   - If the Word document does not provide a subtitle or explicit description, draft one before finishing.
   - Follow the style of existing repo descriptions: one concise sentence, plain-language, specific to the article's argument or topic, and usually around 15-30 words.
   - Avoid vague summaries like "An article about..." or promotional copy.
   - Always ask the user whether the article should have a header image.
   - If yes, ask which image should be used and whether there should be a caption/credit.
   - Add the header image to front matter in repo format:

```yaml
headerimage:
  src: /img/YYYY/MM/filename.ext
  credit: Optional caption or credit text
```

   - Only include `credit` when the user provides one.
   - If the user wants a header image but has not chosen one yet, stop and confirm before finalizing metadata.
10. Validate the chosen categories against the existing taxonomy files in `content/categories/*/_index.md`.
   - Use category slugs that already exist in the repo.
   - Choose the smallest set that fits the manuscript.
   - If several categories seem plausible, prefer the ones most clearly reflected in the manuscript's main theme rather than every side topic.
   - Do not invent new categories unless the user explicitly asks for taxonomy changes.
11. Write the final file only after the slug, destination, and `authors:` metadata are confirmed and verified not to collide with an existing file, then review it for cleanup where the Word XML structure was ambiguous.

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
  - prompting for a header image and optional caption/credit
  - asking for the author after conversion
  - author matching against `content/authors/*/_index.md`
  - invoking `$add-author` when an author record does not exist
  - category selection after Python conversion by checking existing taxonomy files
