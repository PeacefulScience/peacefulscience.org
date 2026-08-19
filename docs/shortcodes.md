# Shortcodes

Custom shortcodes live in `layouts/shortcodes/`. Content also uses a few **Hugo built-ins** (`tweet`, `vimeo`) that have no file in this repo. Counts are opening tags in `content/` (455 files).

`{{< … >}}` is raw HTML (usual for embeds). `{{% … %}}` runs the inner markdown through Goldmark (usual for `image` / `amazon-caption` captions). Both appear in the corpus; mixing them is common and not always necessary.

**Every shortcode must work in two outputs:** the main site (`layouts/_default/single.html`) and Prince (`layouts/_default/single.print.html` → `/_prince/…`, then PDF). **`/_prince/` is not indexed** (Prince intermediate only). Production **`render.js` still runs on `_prince/` HTML** (`script[render]` / `[remove]` / MathJax) before Prince fetches it — Prince has no browser JS, so that cleanup is required. Prefer HTML + images + CSS that `single.print.html` already styles (`aside-xl-right`, `amazon-xl-right`, footnotes, `.d-print-none`). JS widgets (`youtube`, `facebook`, `tweet`, `pdf`, `vimeo`) need a print fallback (poster, caption, or URL) — today several of them are wrapped in `d-print-none` and **vanish** from the PDF. New shortcodes (and Word ingest) cannot be site-only.

Markdown images `![alt](/img/…)` are **not** shortcodes. They go through `layouts/_default/_markup/render-image.html` (CDN + `aside-xl-right` figure). Prefer that or `image` when you need a caption/class.

ASINs passed to `amazon` / `amazon-caption` are recorded on the page scratch. Book pages with `pages_include_backrefs` use that to list related articles.

---

## In the corpus

| Shortcode | Opens | Files | Defined here? | Role |
| --- | --- | --- | --- | --- |
| `amazon` | 215 | 78 | yes | Book cover aside (affiliate) |
| `image` | 121 | 37 | yes | Figure + optional caption (paired close tag) |
| `youtube` | 11 | 11 | yes (overrides Hugo’s built-in) | Click-to-play poster → site player |
| `mediatext` | 10 | 5 | yes | Image + caption as positional args (no close tag) |
| `vimeo` | 6 | 1 | Hugo built-in | Vimeo iframe |
| `footnotes2refs` | 3 | 3 | yes | Marker: turn footnotes into a References heading |
| `facebook` | 3 | 3 | yes | Facebook post embed |
| `tweet` | 3 | 3 | Hugo built-in | Tweet embed |
| `amazon-caption` | 2 | 2 | yes | Cover + **inner** caption (paired) |
| `pdf` | 2 | 1 | yes | Adobe PDF embed |
| `youtube-two` | 1 | 1 | yes | Two YouTube posters side by side |
| `twitter` | 1 | 1 | **no** | Almost certainly a misspelling of `tweet` |
| `nolinklist` | 0 | 0 | yes, **unused** | Hide print link-list |

Almost all uses are in `articles/` and `prints/` (`prints` is heavy on `amazon`). One `tweet` is in a newsletter.

---

## Custom shortcodes

### `amazon`

```hugo
{{< amazon `151400383X` >}}
{{< amazon `151400383X` `Optional caption markdown` >}}
```

| Pos | Meaning |
| --- | --- |
| 0 | ASIN (sometimes unquoted, e.g. `B00JUC6PL2`) |
| 1 | Optional caption (205 calls have only the ASIN; 10 have a caption) |

Renders `partials/amazon.html`: cover from `/img/bookcover/<ASIN>` (Netlify function + ImageEngine) linking to Amazon with `tag=swamidass-20`. Floats as `amazon-xl-right`.

### `amazon-caption`

```hugo
{{% amazon-caption `080287911X` %}}
Caption markdown (inner).
{{% /amazon-caption %}}
```

Same cover embed; caption is **inner** content rather than argument 1. Used twice (`wlc-genetic-challenge`, `venus-phosphine`). Prefer this when the caption is long.

### `image`

```hugo
{{% image `/img/2021/08/foo.jpg` %}}
Optional caption.
{{% /image %}}

{{% image `/img/foo.png` `aside-xl-wide` %}}
Figure caption.
{{% /image %}}
```

| Pos | Meaning | Default |
| --- | --- | --- |
| 0 | `src` (site path or URL; `imgurl` warns if missing) | required |
| 1 | CSS class on `<figure>` | `aside-xl-right` |

Corpus classes: default `aside-xl-right` (68), `aside-xl-wide` (51), `aside-xl-wide del` (2). Always a matching `{{% /image %}}` or `{{< /image >}}`. Inner caption is `RenderString` if non-whitespace. 80 uses `{{%`, 41 use `{{<`. Width/height come from `data/imgsize.json` (required; Netlify has no LFS bytes).

### `mediatext`

```hugo
{{< mediatext `/img/2019/10/foo.png` `Caption markdown` >}}
{{< mediatext `/img/foo.png` `Caption` `aside-xl-wide` >}}
```

| Pos | Meaning | Default |
| --- | --- | --- |
| 0 | `src` (query string stripped) | required |
| 1 | Caption (`.Page.Render`) | required in practice |
| 2 | Figure class | `aside-xl-right` |

No closing tag. Overlaps `image` but caption is an argument, not inner markdown. All 10 uses are in articles.

### `youtube` (overrides Hugo built-in)

```hugo
{{< youtube `NRbRul_6LHA` >}}
{{% youtube `TRNI9TtBM5E` `Caption markdown` %}}
```

| Pos | Meaning |
| --- | --- |
| 0 | YouTube video id |
| 1 | Optional caption |

Uses `partials/youtube.html`: poster `img.youtube.com/vi/<id>/hqdefault.jpg`, click calls `PlayVideo` (site overlay in `assets/js/video.js`). Not a YouTube iframe on the page. Header videos use front matter `headerimage.youtube`, not this shortcode.

### `youtube-two`

```hugo
{{< youtube-two `idLeft` `idRight` `Caption left` `Caption right` >}}
```

Two posters in a row. One use: `articles/miller-textbook-dover.md`.

### `pdf`

```hugo
{{< pdf "/pdf/asa-apology-swamidass.pdf" >}}
{{< pdf "/pdf/foo.pdf" "IN_LINE" >}}
```

| Pos | Meaning | Default |
| --- | --- | --- |
| 0 | Path under `static/` (e.g. `/pdf/file.pdf`) | required |
| 1 | Adobe `embedMode` | `IN_LINE` |

Adobe Document Cloud viewer (`clientId` hardcoded). Warns `MISSING.PDF` if the file is not in `static`. Only `articles/my-response-to-the-asas-apology.md`.

### `facebook`

```hugo
{{< facebook `https://www.facebook.com/.../posts/...` >}}
```

Facebook SDK `fb-post` for the URL. Three article uses.

### `footnotes2refs`

```hugo
{{< footnotes2refs >}}
```

No arguments. Emits a marker div. `single.html` / `single.print.html` then run `partials/footnotes2refs.html`, which replaces the footnotes `<hr>` with `<h2>References</h2>` and notes that “references” were rendered so the print **link list** is titled “Links” instead. Three uses.

### `nolinklist` (unused)

```hugo
{{< nolinklist >}}
```

Sets scratch `hide: linklist` so `partials/linklist.html` skips the print URL list. **Zero content uses.** Prints instead set `design.linklist: false` (cascade + some pages).

---

## Hugo built-ins used in content

These have **no** `layouts/shortcodes/*.html`. Behavior is Hugo 0.97’s.

### `tweet`

```hugo
{{< tweet user=between2worlds id=1153689884223332357 >}}
{{< tweet user=`aprilkapu` id=`1382045452405735436` >}}
```

Named params `user` and `id`. Three uses (two articles, one newsletter). One id still has a `?s=20&t=…` query suffix (`newsletter/history-matters.md`).

### `vimeo`

```hugo
{{< vimeo `379301717` >}}
```

Hugo’s Vimeo iframe. All six uses are `articles/human-origins-rtb-workshop.md`.

### `twitter` (broken name)

```hugo
{{< twitter user=JohnInazu id=`1180111902669725698` >}}
```

One use (`articles/lents-in-usa-today.md`). There is no local `twitter` shortcode; Hugo 0.97’s embed is **`tweet`**. This likely renders nothing useful.

Hugo’s built-in `youtube` is **not** used as-is; the custom file shadows it. Built-ins `figure`, `highlight`, `ref`, `relref`, `instagram` do not appear in the corpus.

---

## Related non-shortcode embeds

| Mechanism | What |
| --- | --- |
| `headerimage.youtube` | Hero playable poster (`single.html`) |
| `![alt](src)` | `render-image.html` figure |
| Bare `https://doi.org/…` links with empty text | `render-link.html` → DOI chip |
| `<div class="editor-note">` | HTML, not a shortcode |
| Adobe / Facebook / YouTube scripts | Loaded by the shortcodes above, not globally |

---

## Prince and the main site

Page PDFs are Prince of `/_prince/…` HTML, not Chrome “print this page.” The print template inlines its own CSS (`single.print.html`). **`code/render.js` still runs on that HTML** (same `public/**/*.html` glob as the main site): print `script[render remove]` rewrites footnotes for Prince; `[remove]` scripts are stripped so Prince never has to execute them; MathJax is inlined when needed. Shortcodes share `.Content` with the site, so markup has to survive Hugo, `render.js`, and Prince.

| Shortcode | Site | Prince today |
| --- | --- | --- |
| `image`, `mediatext` | Figure + ImageEngine | Same HTML; print CSS floats `aside-xl-*`. Images must be fetchable URLs (CDN). |
| `amazon`, `amazon-caption` | Cover + affiliate link | Print CSS for `.amazon-xl-right`. Cover comes from `/img/bookcover/` (function). |
| `footnotes2refs` | Marker; both templates rewrite footnotes | Same rewrite in `single.print.html`. |
| `youtube`, `youtube-two` | Click-to-play overlay (`PlayVideo`) | Wrapper is `d-print-none` — **omitted from the PDF**. Needs a print fallback (poster + URL). |
| `facebook`, `tweet`, `vimeo`, `pdf` | JS SDKs / iframes | Prince will not run those scripts. `pdf` (Adobe viewer) is useless on paper. |

Admin UI, Word ingest, and any new shortcode must keep this table in mind. Oversized PDFs still use this same `_prince` HTML ([build-and-deploy](build-and-deploy.md#article-pdfs-prince)).

---

## Implications for a later cleanup

1. `image` vs `mediatext` vs Markdown images overlap; a single figure shortcode would be enough.
2. `amazon` vs `amazon-caption` differ only in where the caption lives.
3. `nolinklist` can go if `design.linklist` stays.
4. Rename or fix the lone `twitter` call to `tweet`.
5. Custom `youtube` vs Hugo `youtube`: the custom one is required for the site player; do not delete it thinking the built-in is enough. Add a print fallback so Prince is not empty.
6. `pdf` shortcode (Adobe embed) is for **uploaded** PDFs in the article body, not the page’s Prince download.
