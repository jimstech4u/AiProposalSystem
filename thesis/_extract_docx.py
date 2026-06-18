import zipfile, re, sys, os
from xml.etree import ElementTree as ET

DOCX = r"C:\Users\ajibe\Desktop\25626_final_project\Ai Proposal System\thesis\Ajibewa_Irekanmi_25626_Thesis.docx"
OUT = os.path.join(os.environ.get("TEMP", "."), "thesis_extracted.txt")

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

z = zipfile.ZipFile(DOCX)

# map rId -> media target
rels = {}
try:
    rxml = ET.fromstring(z.read("word/_rels/document.xml.rels"))
    for rel in rxml:
        rels[rel.get("Id")] = rel.get("Target")
except Exception as e:
    pass

doc = ET.fromstring(z.read("word/document.xml"))
body = doc.find(f"{W}body")

lines = []

def para_text(p):
    txt = "".join(t.text or "" for t in p.iter(f"{W}t"))
    # detect images in this paragraph
    imgs = []
    for blip in p.iter(f"{A}blip"):
        rid = blip.get(f"{R}embed")
        if rid and rid in rels:
            imgs.append(os.path.basename(rels[rid]))
    style = None
    pPr = p.find(f"{W}pPr")
    if pPr is not None:
        ps = pPr.find(f"{W}pStyle")
        if ps is not None:
            style = ps.get(f"{W}val")
    return txt, style, imgs

for el in body:
    tag = el.tag
    if tag == f"{W}p":
        txt, style, imgs = para_text(el)
        prefix = ""
        if style and ("Heading" in style or "Title" in style):
            prefix = f"[{style}] "
        if txt.strip():
            lines.append(prefix + txt)
        for im in imgs:
            lines.append(f"    <<IMAGE: {im}>>")
    elif tag == f"{W}tbl":
        lines.append("--- TABLE START ---")
        for row in el.findall(f"{W}tr"):
            cells = []
            for tc in row.findall(f"{W}tc"):
                ctext = " ".join(
                    "".join(t.text or "" for t in p.iter(f"{W}t"))
                    for p in tc.findall(f"{W}p")
                ).strip()
                cells.append(ctext)
            lines.append(" | ".join(cells))
        lines.append("--- TABLE END ---")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("WROTE", OUT)
print("LINES", len(lines))
print("CHARS", sum(len(l) for l in lines))
