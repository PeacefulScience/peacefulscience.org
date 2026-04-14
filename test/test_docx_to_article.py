import subprocess
import tempfile
import unittest
import zipfile
from base64 import b64decode
from pathlib import Path

from code.docx_to_article import normalize_citation_links, normalize_doi_links


CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>
"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>
"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId20" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/sample-image.png"/>
  <Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com" TargetMode="External"/>
  <Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://peacefulscience.org/about/mission-and-values/" TargetMode="External"/>
</Relationships>
"""

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Sample Article</dc:title>
  <dc:creator>Jane Example</dc:creator>
  <dc:description>Short summary here.</dc:description>
</cp:coreProperties>
"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/></w:style>
  <w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/></w:style>
  <w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/></w:style>
</w:styles>
"""

SETTINGS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:proofState w:spelling="clean" w:grammar="clean"/>
</w:settings>
"""

DOCUMENT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>Sample Article</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Subtitle"/></w:pPr>
      <w:r><w:t>Subtitle summary from Word style.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Section One</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">This is </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
      <w:r><w:t xml:space="preserve"> and </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>
      <w:r><w:t xml:space="preserve"> with a </w:t></w:r>
      <w:hyperlink r:id="rId10"><w:r><w:t>link</w:t></w:r></w:hyperlink>
      <w:r><w:t xml:space="preserve"> and bare url https://peacefulscience.org/about/mission-and-values/.</w:t></w:r>
      <w:r><w:footnoteReference w:id="2"/></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Subsection</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Text under heading two.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">Zotero citation example </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> ADDIN ZOTERO_ITEM CSL_CITATION {&quot;citationItems&quot;:[{&quot;id&quot;:&quot;ITEM-1&quot;}]} </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>(Swamidass 2019)</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:r><w:t>.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
      <w:r><w:t>Detail Level</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Text under heading three.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <wp:docPr id="1" name="Word Figure" descr="Figure from the Word document."/>
            <a:graphic>
              <a:graphicData>
                <a:blip r:embed="rId20"/>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Caption"/></w:pPr>
      <w:r><w:t xml:space="preserve">First caption paragraph with a </w:t></w:r>
      <w:hyperlink r:id="rId11"><w:r><w:t>link</w:t></w:r></w:hyperlink>
      <w:r><w:t xml:space="preserve"> and a note</w:t></w:r>
      <w:r><w:footnoteReference w:id="3"/></w:r>
      <w:r><w:t>.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Caption"/></w:pPr>
      <w:r><w:t>Second caption paragraph.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>References</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Bare DOI 10.1080/14746700.2016.1156328.</w:t></w:r>
    </w:p>
    <w:p>
      <w:fldSimple w:instr=" ADDIN ZOTERO_BIBL {&quot;uncited&quot;:[]} ">
        <w:r><w:t>Zotero bibliography entry visible to readers.</w:t></w:r>
      </w:fldSimple>
    </w:p>
    <w:p>
      <w:r><w:t>Prefixed DOI doi: 10.5281/zenodo.1328247;</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Canonical DOI URL https://doi.org/10.1006/mpev.1996.0013,</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Legacy DOI URL http://dx.doi.org/10.5840/acpq201185213.</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>
"""

PNG_BYTES = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0K1cAAAAASUVORK5CYII="
)

FOOTNOTES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1">
    <w:p>
      <w:r><w:separator/></w:r>
    </w:p>
  </w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0">
    <w:p>
      <w:r><w:continuationSeparator/></w:r>
    </w:p>
  </w:footnote>
  <w:footnote w:id="2">
    <w:p>
      <w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>
      <w:r>
        <w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr>
        <w:footnoteRef/>
      </w:r>
      <w:r><w:t xml:space="preserve"> Footnote text with DOI 10.5281/zenodo.1328247 and bare url https://example.org/footnote.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>
      <w:r><w:t>Second footnote paragraph with http://peacefulscience.org/books/adam-genome/.</w:t></w:r>
    </w:p>
  </w:footnote>
  <w:footnote w:id="3">
    <w:p>
      <w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>
      <w:r>
        <w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr>
        <w:footnoteRef/>
      </w:r>
      <w:r><w:t xml:space="preserve"> Caption footnote text with https://example.org/caption-note.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>
      <w:r><w:t>Second caption footnote paragraph.</w:t></w:r>
    </w:p>
  </w:footnote>
</w:footnotes>
"""


class DocxToArticleTest(unittest.TestCase):
    def test_normalize_doi_links_variants(self):
        source = (
            "Bare DOI 10.1080/14746700.2016.1156328. "
            "Prefixed DOI doi: 10.5281/zenodo.1328247; "
            "URL DOI https://doi.org/10.1006/mpev.1996.0013, "
            "and dx DOI http://dx.doi.org/10.5840/acpq201185213. "
            "Upper DOI: dwfijoewifj. "
            "Lower doi: 234rewr; "
            "and http://doi.org/kdfwfj."
        )

        normalized = normalize_doi_links(source)

        self.assertIn(
            "[https://doi.org/10.1080/14746700.2016.1156328](https://doi.org/10.1080/14746700.2016.1156328).",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/10.5281/zenodo.1328247](https://doi.org/10.5281/zenodo.1328247);",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/10.1006/mpev.1996.0013](https://doi.org/10.1006/mpev.1996.0013),",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/10.5840/acpq201185213](https://doi.org/10.5840/acpq201185213).",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/dwfijoewifj](https://doi.org/dwfijoewifj).",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/234rewr](https://doi.org/234rewr);",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/kdfwfj](https://doi.org/kdfwfj).",
            normalized,
        )

    def test_normalize_citation_links_http_and_doi(self):
        source = (
            "Text https://peacefulscience.org/about/mission-and-values/. "
            "Footnote doi: 10.5281/zenodo.1328247 and http://example.org/footnote."
        )
        normalized = normalize_citation_links(source)
        self.assertIn(
            "[https://peacefulscience.org/about/mission-and-values/](https://peacefulscience.org/about/mission-and-values/).",
            normalized,
        )
        self.assertIn(
            "[https://doi.org/10.5281/zenodo.1328247](https://doi.org/10.5281/zenodo.1328247)",
            normalized,
        )
        self.assertIn(
            "[http://example.org/footnote](http://example.org/footnote).",
            normalized,
        )

    def test_native_docx_conversion(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            docx = tmpdir / "sample.docx"
            output = tmpdir / "sample.md"

            with zipfile.ZipFile(docx, "w") as zf:
                zf.writestr("[Content_Types].xml", CONTENT_TYPES)
                zf.writestr("_rels/.rels", ROOT_RELS)
                zf.writestr("word/_rels/document.xml.rels", DOC_RELS)
                zf.writestr("docProps/core.xml", CORE)
                zf.writestr("word/styles.xml", STYLES)
                zf.writestr("word/settings.xml", SETTINGS)
                zf.writestr("word/document.xml", DOCUMENT)
                zf.writestr("word/footnotes.xml", FOOTNOTES)
                zf.writestr("word/media/sample-image.png", PNG_BYTES)

            image_root = tmpdir / "static" / "img"
            subprocess.run(
                [
                    "python3",
                    "code/docx_to_article.py",
                    str(docx),
                    "--output",
                    str(output),
                    "--author",
                    "swamidass",
                    "--category",
                    "science",
                    "--date",
                    "2026-04-14T12:00:00",
                    "--image-root",
                    str(image_root),
                    "--draft",
                ],
                check=True,
            )

            text = output.read_text()
            self.assertIn('title: "Sample Article"', text)
            self.assertIn('description: "Subtitle summary from Word style."', text)
            self.assertIn("authors:\n- swamidass", text)
            self.assertIn("categories:\n- science", text)
            self.assertIn("## Section One", text)
            self.assertIn("### Subsection", text)
            self.assertIn("#### Detail Level", text)
            self.assertIn("Text under heading two.", text)
            self.assertIn("Zotero citation example (Swamidass 2019).", text)
            self.assertIn("Text under heading three.", text)
            self.assertNotIn("\n\nSubtitle summary from Word style.\n\n## Section One", text)
            self.assertIn("Zotero bibliography entry visible to readers.", text)
            self.assertNotIn("ADDIN ZOTERO_ITEM", text)
            self.assertNotIn("ADDIN ZOTERO_BIBL", text)
            self.assertNotIn("CSL_CITATION", text)
            self.assertIn(
                "{{% image `/img/2026/04/word-figure.png` `aside-xl-wide` %}}\nFirst caption paragraph with a [link](https://peacefulscience.org/about/mission-and-values/) and a note[^2].\n\nSecond caption paragraph.\n{{% /image %}}",
                text,
            )
            self.assertTrue((image_root / "2026" / "04" / "word-figure.png").exists())
            self.assertIn(
                "This is **bold** and *italic* with a [link](https://example.com) and bare url [https://peacefulscience.org/about/mission-and-values/](https://peacefulscience.org/about/mission-and-values/).[^1]",
                text,
            )
            self.assertIn(
                "This is **bold** and *italic* with a [link](https://example.com) and bare url [https://peacefulscience.org/about/mission-and-values/](https://peacefulscience.org/about/mission-and-values/).[^1]\n\n[^1]: Footnote text with DOI [https://doi.org/10.5281/zenodo.1328247](https://doi.org/10.5281/zenodo.1328247) and bare url [https://example.org/footnote](https://example.org/footnote).",
                text,
            )
            self.assertIn('<div class="references">', text)
            self.assertIn("## References", text)
            self.assertNotIn("### References", text)
            self.assertIn(
                "Bare DOI [https://doi.org/10.1080/14746700.2016.1156328](https://doi.org/10.1080/14746700.2016.1156328).",
                text,
            )
            self.assertIn(
                "Prefixed DOI [https://doi.org/10.5281/zenodo.1328247](https://doi.org/10.5281/zenodo.1328247);",
                text,
            )
            self.assertIn(
                "Canonical DOI URL [https://doi.org/10.1006/mpev.1996.0013](https://doi.org/10.1006/mpev.1996.0013),",
                text,
            )
            self.assertIn(
                "Legacy DOI URL [https://doi.org/10.5840/acpq201185213](https://doi.org/10.5840/acpq201185213).",
                text,
            )
            self.assertIn("</div>", text)
            self.assertIn(
                "[^1]: Footnote text with DOI [https://doi.org/10.5281/zenodo.1328247](https://doi.org/10.5281/zenodo.1328247) and bare url [https://example.org/footnote](https://example.org/footnote).",
                text,
            )
            self.assertIn(
                "    \n    Second footnote paragraph with [http://peacefulscience.org/books/adam-genome/](http://peacefulscience.org/books/adam-genome/).",
                text,
            )
            self.assertIn(
                "[^2]: Caption footnote text with [https://example.org/caption-note](https://example.org/caption-note).\n    \n    Second caption footnote paragraph.",
                text,
            )
            self.assertLess(
                text.index("[^1]: Footnote text with DOI"),
                text.index('<div class="references">'),
            )
            self.assertLess(
                text.index("[^2]: Caption footnote text with"),
                text.index('<div class="references">'),
            )
            self.assertNotIn("{{< footnotes2refs >}}", text)

    def test_script_does_not_infer_authors_from_doc_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            docx = tmpdir / "sample.docx"
            output = tmpdir / "sample.md"

            with zipfile.ZipFile(docx, "w") as zf:
                zf.writestr("[Content_Types].xml", CONTENT_TYPES)
                zf.writestr("_rels/.rels", ROOT_RELS)
                zf.writestr("word/_rels/document.xml.rels", DOC_RELS)
                zf.writestr("docProps/core.xml", CORE)
                zf.writestr("word/styles.xml", STYLES)
                zf.writestr("word/settings.xml", SETTINGS)
                zf.writestr("word/document.xml", DOCUMENT)
                zf.writestr("word/footnotes.xml", FOOTNOTES)
                zf.writestr("word/media/sample-image.png", PNG_BYTES)

            subprocess.run(
                [
                    "python3",
                    "code/docx_to_article.py",
                    str(docx),
                    "--output",
                    str(output),
                    "--date",
                    "2026-04-14T12:00:00",
                    "--image-root",
                    str(tmpdir / "static" / "img"),
                    "--draft",
                ],
                check=True,
            )

            text = output.read_text()
            self.assertNotIn("authors:\n", text)
            self.assertNotIn("byline:", text)
            self.assertIn('title: "Sample Article"', text)
            self.assertIn('description: "Subtitle summary from Word style."', text)


if __name__ == "__main__":
    unittest.main()
