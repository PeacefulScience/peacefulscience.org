#!/usr/bin/env python3

import argparse
import datetime as dt
import html
import os
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dc": "http://purl.org/dc/elements/1.1/",
}

XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
CONTENT_DIR = Path("content")
DEFAULT_SECTION = "articles"
REF_SECTION_TITLES = {"references", "bibliography", "works cited", "notes"}
SPECIAL_FOOTNOTE_IDS = {"-1", "0"}
DOI_ANY_RE = re.compile(
    r"""(?ix)
    (
        \bhttps?://(?:dx\.)?doi\.org/(?P<url_doi>[^\s\])}>,"']+)
        |
        \bdoi:\s*(?P<label_doi>[^\s\])}>,"']+)
        |
        \b(?P<bare_doi>10\.\d{4,9}/[^\s\])}>,"']+)
    )
    (?P<trailing>[.;:,]?)
    """
)
HTTP_URL_RE = re.compile(r"""(?i)\bhttps?://[^\s<>\])},\["']+""")
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\([^)]+\)")


def qname(prefix, name):
    return "{%s}%s" % (NS[prefix], name)


def read_xml(docx, name):
    try:
        return ET.fromstring(docx.read(name))
    except KeyError:
        return None


def get_text(element):
    if element is None:
        return ""
    return "".join(element.itertext())


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text or "untitled"


def plain_text(markdown):
    text = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1", markdown)
    text = re.sub(r"[*_`>#-]", "", text)
    text = re.sub(r"\[\^\d+\]", "", text)
    text = re.sub(r"\s+", " ", text)
    return html.unescape(text).strip()


def yaml_quote(text):
    text = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{text}"'


def wrap_inline(text, bold=False, italic=False):
    if not text:
        return ""
    marker = ""
    if bold and italic:
        marker = "***"
    elif bold:
        marker = "**"
    elif italic:
        marker = "*"
    return f"{marker}{text}{marker}" if marker else text


def collapse_blank_lines(text):
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    return text + "\n" if text else ""


def normalize_doi_links(text):
    def repl(match):
        raw = match.group("url_doi") or match.group("label_doi") or match.group("bare_doi") or ""
        raw = raw.strip()
        trailing = match.group("trailing") or ""
        while raw and raw[-1] in ".,;:":
            trailing = raw[-1] + trailing
            raw = raw[:-1]
        url = f"https://doi.org/{raw}"
        return f"[{url}]({url}){trailing}"

    return DOI_ANY_RE.sub(repl, text)


def normalize_http_links(text):
    def replace_segment(segment):
        def repl(match):
            raw = match.group(0)
            trimmed = raw
            trailing = ""
            while trimmed and trimmed[-1] in ".,;:":
                trailing = trimmed[-1] + trailing
                trimmed = trimmed[:-1]
            return f"[{trimmed}]({trimmed}){trailing}"

        return HTTP_URL_RE.sub(repl, segment)

    pieces = []
    last = 0
    for match in MARKDOWN_LINK_RE.finditer(text):
        pieces.append(replace_segment(text[last:match.start()]))
        pieces.append(match.group(0))
        last = match.end()
    pieces.append(replace_segment(text[last:]))
    return "".join(pieces)


def normalize_citation_links(text):
    return normalize_http_links(normalize_doi_links(text))


class DocxArticleConverter:
    def __init__(self, path, image_root=None, image_date=None):
        self.path = Path(path)
        self.note_number_map = {}
        self.note_text_map = {}
        self.next_note_number = 1
        self.emitted_note_numbers = set()
        self.notes_in_current_block = []
        self.current_reference_section = False
        self.reference_div_open = False
        self.image_root = Path(image_root) if image_root else Path("static/img")
        self.image_date = image_date or dt.datetime.now()
        self.extracted_images = {}
        self.image_counter = 0

    def convert(self):
        if self.path.suffix.lower() != ".docx":
            raise ValueError("This converter supports .docx files. Re-save legacy .doc files as .docx first.")

        with zipfile.ZipFile(self.path) as docx:
            self.docx = docx
            self.document = read_xml(docx, "word/document.xml")
            if self.document is None:
                raise ValueError("word/document.xml is missing from this .docx file.")

            self.relationships = self._load_relationships()
            self.styles = self._load_styles()
            self.numbering = self._load_numbering()
            self.footnotes = self._load_notes("word/footnotes.xml", "footnote")
            self.endnotes = self._load_notes("word/endnotes.xml", "endnote")
            self.core = self._load_core_properties()

            title = self._pick_title()
            blocks = self._convert_body()
            body = collapse_blank_lines("\n\n".join(block for block in blocks if block.strip()))
            description = self._pick_subtitle_description() or self.core.get("description") or ""

            return {
                "title": title,
                "description": description,
                "body": body,
                "creator": self.core.get("creator", "").strip(),
            }

    def _load_relationships(self):
        root = read_xml(self.docx, "word/_rels/document.xml.rels")
        rels = {}
        if root is None:
            return rels
        for rel in root:
            rid = rel.attrib.get("Id")
            target = rel.attrib.get("Target")
            mode = rel.attrib.get("TargetMode")
            if rid and target:
                if mode == "External":
                    rels[rid] = target
                else:
                    rels[rid] = target.lstrip("/")
        return rels

    def _load_styles(self):
        root = read_xml(self.docx, "word/styles.xml")
        styles = {}
        if root is None:
            return styles
        for style in root.findall("w:style", NS):
            style_id = style.attrib.get(qname("w", "styleId"))
            name = style.find("w:name", NS)
            based_on = style.find("w:basedOn", NS)
            styles[style_id] = {
                "name": name.attrib.get(qname("w", "val"), style_id or "") if name is not None else style_id or "",
                "based_on": based_on.attrib.get(qname("w", "val")) if based_on is not None else None,
            }
        return styles

    def _load_numbering(self):
        root = read_xml(self.docx, "word/numbering.xml")
        numbering = {}
        if root is None:
            return numbering

        abstract = defaultdict(dict)
        for abstract_num in root.findall("w:abstractNum", NS):
            abstract_id = abstract_num.attrib.get(qname("w", "abstractNumId"))
            for level in abstract_num.findall("w:lvl", NS):
                ilvl = level.attrib.get(qname("w", "ilvl"), "0")
                numfmt = level.find("w:numFmt", NS)
                abstract[abstract_id][ilvl] = numfmt.attrib.get(qname("w", "val"), "bullet") if numfmt is not None else "bullet"

        for num in root.findall("w:num", NS):
            num_id = num.attrib.get(qname("w", "numId"))
            abstract_ref = num.find("w:abstractNumId", NS)
            abstract_id = abstract_ref.attrib.get(qname("w", "val")) if abstract_ref is not None else None
            if num_id and abstract_id in abstract:
                numbering[num_id] = dict(abstract[abstract_id])
        return numbering

    def _load_notes(self, path, tag_name):
        root = read_xml(self.docx, path)
        notes = {}
        if root is None:
            return notes
        for note in root.findall(f"w:{tag_name}", NS):
            note_id = note.attrib.get(qname("w", "id"))
            if note_id in SPECIAL_FOOTNOTE_IDS:
                continue
            notes[note_id] = note
        return notes

    def _load_core_properties(self):
        root = read_xml(self.docx, "docProps/core.xml")
        if root is None:
            return {}
        title = get_text(root.find("dc:title", NS)).strip()
        creator = get_text(root.find("dc:creator", NS)).strip()
        description = get_text(root.find("dc:description", NS)).strip()
        return {"title": title, "creator": creator, "description": description}

    def _pick_title(self):
        if self.core.get("title"):
            return self.core["title"]
        body = self.document.find("w:body", NS)
        for para in body.findall("w:p", NS):
            style_name = self._paragraph_style_name(para).lower()
            text = plain_text(self._render_paragraph_text(para, note_context=True))
            if not text:
                continue
            if style_name == "title":
                return text
            if style_name.startswith("heading 1"):
                return text
        return self.path.stem.replace("-", " ").replace("_", " ").strip().title()

    def _pick_subtitle_description(self):
        body = self.document.find("w:body", NS)
        for para in body.findall("w:p", NS):
            style_name = self._paragraph_style_name(para).lower()
            text = plain_text(self._render_paragraph_text(para, note_context=True))
            if not text:
                continue
            if style_name == "subtitle":
                return text
        return ""

    def _paragraph_style_name(self, paragraph):
        p_style = paragraph.find("w:pPr/w:pStyle", NS)
        if p_style is None:
            return ""
        style_id = p_style.attrib.get(qname("w", "val"), "")
        visited = set()
        while style_id and style_id not in visited:
            visited.add(style_id)
            style = self.styles.get(style_id, {})
            name = style.get("name") or style_id
            if name:
                return name
            style_id = style.get("based_on")
        return style_id or ""

    def _heading_level(self, style_name):
        style = style_name.lower().strip()
        if style == "title":
            return 1
        match = re.match(r"heading\s+(\d+)", style)
        if match:
            return int(match.group(1))
        return None

    def _paragraph_list_info(self, paragraph):
        num_pr = paragraph.find("w:pPr/w:numPr", NS)
        if num_pr is None:
            return None
        ilvl = num_pr.find("w:ilvl", NS)
        num_id = num_pr.find("w:numId", NS)
        if num_id is None:
            return None
        level = ilvl.attrib.get(qname("w", "val"), "0") if ilvl is not None else "0"
        list_id = num_id.attrib.get(qname("w", "val"))
        fmt = self.numbering.get(list_id, {}).get(level, "bullet")
        return {"level": int(level), "format": fmt}

    def _convert_body(self):
        body = self.document.find("w:body", NS)
        blocks = []
        children = list(body)
        i = 0
        while i < len(children):
            child = children[i]
            if child.tag == qname("w", "p"):
                self.notes_in_current_block = []
                image_block, consumed = self._render_image_with_adjacent_captions(children, i)
                if image_block is not None:
                    blocks.append(image_block)
                    blocks.extend(self._flush_notes_for_current_block())
                    i += consumed
                    continue

                block = self._render_paragraph(child)
                if block:
                    blocks.append(block)
                    blocks.extend(self._flush_notes_for_current_block())
            elif child.tag == qname("w", "tbl"):
                self.notes_in_current_block = []
                table = self._render_table(child)
                if table:
                    blocks.append(table)
                    blocks.extend(self._flush_notes_for_current_block())
            i += 1
        if self.reference_div_open:
            blocks.append("</div>")
            self.reference_div_open = False
        return blocks

    def _render_image_with_adjacent_captions(self, children, start_index):
        paragraph = children[start_index]
        image_blocks = self._render_paragraph_images(paragraph)
        if not image_blocks:
            return None, 0

        captions = []
        consumed = 1
        idx = start_index + 1
        while idx < len(children):
            next_child = children[idx]
            if next_child.tag != qname("w", "p"):
                break
            if not self._paragraph_is_caption(next_child):
                break
            caption_text = self._render_caption_paragraph(next_child)
            if caption_text:
                captions.append(caption_text)
            consumed += 1
            idx += 1

        # If there are multiple images in one paragraph, attach the adjacent caption block to the first.
        first = image_blocks[0]
        caption_body = "\n\n".join(captions).strip()
        if caption_body:
            image_blocks[0] = self._format_image_shortcode(first["path"], caption_body)
        elif first["caption"]:
            image_blocks[0] = self._format_image_shortcode(first["path"], first["caption"])
        else:
            image_blocks[0] = self._format_image_shortcode(first["path"], "")

        for n in range(1, len(image_blocks)):
            image_blocks[n] = self._format_image_shortcode(image_blocks[n]["path"], image_blocks[n]["caption"])

        return "\n\n".join(image_blocks), consumed

    def _paragraph_is_caption(self, paragraph):
        return self._paragraph_style_name(paragraph).lower().strip() == "caption"

    def _render_caption_paragraph(self, paragraph):
        text = self._render_paragraph_text(paragraph).strip()
        return normalize_http_links(text) if text else ""

    def _render_paragraph(self, paragraph):
        style_name = self._paragraph_style_name(paragraph)
        text = self._render_paragraph_text(paragraph)
        text = collapse_blank_lines(text).strip()
        if not text:
            return ""

        level = self._heading_level(style_name)
        normalized_text = plain_text(text).lower()
        if style_name.lower() == "title" and plain_text(text) == self._pick_title():
            return ""
        if style_name.lower() == "subtitle" and plain_text(text) == self._pick_subtitle_description():
            return ""

        if level:
            entering_references = normalized_text in REF_SECTION_TITLES
            if self.reference_div_open and not entering_references:
                self.reference_div_open = False
                self.current_reference_section = False
                return f"</div>\n\n{'#' * (level + 1)} {plain_text(text)}"
            self.current_reference_section = entering_references
            heading_level = 2 if entering_references else level + 1
            heading = f"{'#' * heading_level} {plain_text(text)}"
            if entering_references and not self.reference_div_open:
                self.reference_div_open = True
                return f'<div class="references">\n\n{heading}'
            return heading

        list_info = self._paragraph_list_info(paragraph)
        if list_info:
            indent = "  " * list_info["level"]
            marker = "-" if list_info["format"] == "bullet" else "1."
            return f"{indent}{marker} {text}"

        if style_name.lower() in {"quote", "blockquote", "intense quote"}:
            return "\n".join(f"> {line}" if line else ">" for line in text.splitlines())

        if self.current_reference_section:
            return normalize_citation_links(text)

        return normalize_http_links(text)

    def _render_table(self, table):
        rows = []
        for row in table.findall("w:tr", NS):
            cells = []
            for cell in row.findall("w:tc", NS):
                parts = []
                for para in cell.findall("w:p", NS):
                    text = self._render_paragraph_text(para, note_context=True).strip()
                    if text:
                        parts.append(plain_text(text))
                cells.append(" ".join(parts).strip())
            if any(cells):
                rows.append(cells)

        if not rows:
            return ""

        width = max(len(row) for row in rows)
        normalized = [row + [""] * (width - len(row)) for row in rows]
        header = normalized[0]
        separator = ["---"] * width
        body = normalized[1:] or [[""] * width]
        lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(separator) + " |"]
        lines.extend("| " + " | ".join(row) + " |" for row in body)
        return "\n".join(lines)

    def _render_paragraph_text(self, paragraph, note_context=False):
        parts = []
        for child in paragraph:
            rendered = self._render_inline_node(child, note_context=note_context)
            if rendered:
                parts.append(rendered)
        text = "".join(parts)
        text = text.replace("\u00a0", " ")
        text = re.sub(r"[ \t]+\n", "\n", text)
        return text.strip()

    def _render_paragraph_images(self, paragraph):
        blocks = []
        for run in paragraph.findall("w:r", NS):
            for drawing in run.findall("w:drawing", NS):
                block = self._render_drawing(drawing)
                if block:
                    blocks.append(block)
        return blocks

    def _render_inline_node(self, node, note_context=False):
        tag = node.tag

        if tag == qname("w", "r"):
            return self._render_run(node, note_context=note_context)

        if tag == qname("w", "hyperlink"):
            return self._render_hyperlink(node, note_context=note_context)

        if tag in {qname("w", "ins"), qname("w", "smartTag"), qname("w", "sdt"), qname("w", "customXml"), qname("w", "fldSimple")}:
            return "".join(self._render_inline_node(child, note_context=note_context) for child in node)

        if tag in {qname("w", "del"), qname("w", "bookmarkStart"), qname("w", "bookmarkEnd"), qname("w", "proofErr")}:
            return ""

        return get_text(node)

    def _render_hyperlink(self, node, note_context=False):
        rid = node.attrib.get(qname("r", "id"))
        anchor = node.attrib.get(qname("w", "anchor"))
        target = None
        if rid:
            target = self.relationships.get(rid)
            if target and not target.startswith(("http://", "https://", "mailto:", "#")):
                target = target.replace("\\", "/")
        elif anchor:
            target = f"#{anchor}"

        text = "".join(self._render_inline_node(child, note_context=note_context) for child in node).strip()
        if not text:
            return ""
        if not target:
            return text
        if plain_text(text) == target:
            return f"<{target}>"
        safe_target = target.replace(" ", "%20")
        return f"[{text}]({safe_target})"

    def _render_run(self, run, note_context=False):
        props = run.find("w:rPr", NS)
        bold = props is not None and props.find("w:b", NS) is not None
        italic = props is not None and props.find("w:i", NS) is not None
        superscript = False
        if props is not None:
            valign = props.find("w:vertAlign", NS)
            superscript = valign is not None and valign.attrib.get(qname("w", "val")) == "superscript"

        parts = []
        for child in run:
            if child.tag == qname("w", "t"):
                text = child.text or ""
                if child.attrib.get(XML_SPACE) != "preserve":
                    text = re.sub(r"\s+", " ", text)
                parts.append(text)
            elif child.tag in {qname("w", "tab")}:
                parts.append("\t")
            elif child.tag in {qname("w", "br"), qname("w", "cr")}:
                parts.append("  \n")
            elif child.tag == qname("w", "noBreakHyphen"):
                parts.append("-")
            elif child.tag == qname("w", "instrText"):
                continue
            elif child.tag == qname("w", "fldChar"):
                continue
            elif child.tag == qname("w", "drawing"):
                image_markup = self._render_drawing(child, note_context=note_context)
                if image_markup:
                    parts.append(image_markup)
            elif child.tag == qname("w", "footnoteReference"):
                note_id = child.attrib.get(qname("w", "id"))
                parts.append(self._render_note_reference("footnote", note_id, note_context=note_context))
            elif child.tag == qname("w", "endnoteReference"):
                note_id = child.attrib.get(qname("w", "id"))
                parts.append(self._render_note_reference("endnote", note_id, note_context=note_context))

        text = "".join(parts)
        if superscript and text and text.isdigit():
            text = f"^{text}^"
        return wrap_inline(text, bold=bold, italic=italic)

    def _render_drawing(self, drawing, note_context=False):
        if note_context:
            return None

        blip = drawing.find(".//a:blip", NS)
        if blip is None:
            return None

        rid = blip.attrib.get(qname("r", "embed"))
        if not rid:
            return None

        rel_target = self.relationships.get(rid)
        if not rel_target:
            return None

        web_path = self._extract_image(rel_target, drawing)
        if not web_path:
            return None

        doc_pr = drawing.find(".//wp:docPr", NS)
        caption = ""
        if doc_pr is not None:
            caption = (doc_pr.attrib.get("descr") or doc_pr.attrib.get("name") or "").strip()
        return {"path": web_path, "caption": normalize_http_links(caption) if caption else ""}

    def _format_image_shortcode(self, web_path, caption):
        opening = f"{{{{% image `{web_path}` `aside-xl-wide` %}}}}"
        if caption:
            return f"{opening}\n{caption}\n{{{{% /image %}}}}"
        return f"{opening}\n{{{{% /image %}}}}"

    def _extract_image(self, rel_target, drawing):
        if rel_target in self.extracted_images:
            return self.extracted_images[rel_target]

        zip_path = rel_target if rel_target.startswith("word/") else f"word/{rel_target}"
        try:
            data = self.docx.read(zip_path)
        except KeyError:
            return ""

        ext = Path(zip_path).suffix.lower() or ".bin"
        subdir = self.image_root / f"{self.image_date.year:04d}" / f"{self.image_date.month:02d}"
        subdir.mkdir(parents=True, exist_ok=True)

        doc_pr = drawing.find(".//wp:docPr", NS)
        base_name = ""
        if doc_pr is not None:
            base_name = doc_pr.attrib.get("name") or doc_pr.attrib.get("descr") or ""
        if not base_name:
            base_name = Path(rel_target).stem or self.path.stem

        base_slug = slugify(base_name)
        candidate = subdir / f"{base_slug}{ext}"
        suffix = 2
        while candidate.exists():
            try:
                if candidate.read_bytes() == data:
                    web_path = self._web_path_for_image(candidate)
                    self.extracted_images[rel_target] = web_path
                    return web_path
            except OSError:
                pass
            candidate = subdir / f"{base_slug}-{suffix}{ext}"
            suffix += 1

        candidate.write_bytes(data)
        web_path = self._web_path_for_image(candidate)
        self.extracted_images[rel_target] = web_path
        return web_path

    def _web_path_for_image(self, candidate):
        rel = candidate.relative_to(self.image_root).as_posix()
        return f"/img/{rel}"

    def _render_note_reference(self, note_type, note_id, note_context=False):
        if note_context or note_id in SPECIAL_FOOTNOTE_IDS:
            return ""

        key = (note_type, note_id)
        if key not in self.note_number_map:
            self.note_number_map[key] = self.next_note_number
            self.next_note_number += 1
            source = self.footnotes if note_type == "footnote" else self.endnotes
            note = source.get(note_id)
            if note is not None:
                body = []
                for para in note.findall("w:p", NS):
                    rendered = self._render_paragraph_text(para, note_context=True).strip()
                    if rendered:
                        body.append(rendered)
                self.note_text_map[key] = "\n\n".join(body).strip()
            else:
                self.note_text_map[key] = ""

        number = self.note_number_map[key]
        self.notes_in_current_block.append(number)
        return f"[^{number}]"

    def _render_note_definition(self, number):
        key = next((key for key, value in self.note_number_map.items() if value == number), None)
        text = self.note_text_map.get(key, "").strip()
        if not text:
            return f"[^{number}]:"

        text = normalize_citation_links(text)
        lines = text.splitlines()
        first = lines[0]
        rest = lines[1:]
        block = [f"[^{number}]: {first}"]
        for line in rest:
            block.append("    " + line if line else "    ")
        return "\n".join(block)

    def _flush_notes_for_current_block(self):
        blocks = []
        seen = set()
        for number in self.notes_in_current_block:
            if number in seen or number in self.emitted_note_numbers:
                continue
            seen.add(number)
            self.emitted_note_numbers.add(number)
            blocks.append(self._render_note_definition(number))
        return blocks


def build_front_matter(args, title, description):
    now = args.date or dt.datetime.now().replace(microsecond=0).isoformat()
    lines = ["---", f"title: {yaml_quote(title)}", f'date: "{now}"']

    if description:
        lines.append(f"description: {yaml_quote(description)}")

    authors = list(args.author or [])
    if authors:
        lines.append("authors:")
        for author in authors:
            lines.append(f"- {author}")

    if args.category:
        lines.append("categories:")
        for category in args.category:
            lines.append(f"- {category}")

    if args.series:
        lines.append(f"series: {args.series}")

    if args.commenturl:
        lines.append(f"commenturl: {yaml_quote(args.commenturl)}")

    if args.draft:
        lines.append("draft: true")

    lines.append("---")
    return "\n".join(lines)


def output_path_for(args, slug):
    if args.output:
        return Path(args.output)
    return CONTENT_DIR / args.section / f"{slug}.md"


def resolve_image_date(date_str):
    if not date_str:
        return dt.datetime.now()
    try:
        return dt.datetime.fromisoformat(date_str)
    except ValueError:
        try:
            return dt.datetime.fromisoformat(f"{date_str}T00:00:00")
        except ValueError:
            return dt.datetime.now()


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Convert a raw .docx Word manuscript into Peaceful Science article markdown."
    )
    parser.add_argument("input", help="Path to the .docx file")
    parser.add_argument("-o", "--output", help="Path to the output markdown file")
    parser.add_argument("--section", default=DEFAULT_SECTION, help="Content section, default: articles")
    parser.add_argument("--slug", help="Output slug; defaults to a slugified title")
    parser.add_argument("--title", help="Override the extracted title")
    parser.add_argument("--date", help="ISO datetime for front matter")
    parser.add_argument("--author", action="append", help="Author slug, can be passed multiple times")
    parser.add_argument("--category", action="append", help="Category slug, can be passed multiple times")
    parser.add_argument("--series", help="Series slug")
    parser.add_argument("--commenturl", help="Forum thread URL")
    parser.add_argument("--description", help="Override the extracted description")
    parser.add_argument("--image-root", help="Root directory for extracted images, default: static/img")
    parser.add_argument("--draft", action="store_true", help="Mark the article as draft")
    parser.add_argument("--stdout", action="store_true", help="Print the converted article instead of writing a file")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    converter = DocxArticleConverter(
        args.input,
        image_root=args.image_root,
        image_date=resolve_image_date(args.date),
    )
    result = converter.convert()

    title = args.title or result["title"]
    description = args.description or result["description"]
    slug = args.slug or slugify(title)
    output_path = output_path_for(args, slug)

    front_matter = build_front_matter(args, title, description)
    body = result["body"].rstrip()

    article = f"{front_matter}\n\n{body}\n"

    if args.stdout:
        sys.stdout.write(article)
        return 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(article, encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
