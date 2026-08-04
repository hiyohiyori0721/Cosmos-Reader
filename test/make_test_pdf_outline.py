# -*- coding: utf-8 -*-
"""生成带书签大纲（outline）的多页测试 PDF，用于验证 PDF 目录功能"""
import os

def build(path):
    objs = []
    # 1: Catalog（含 Outlines）
    objs.append(b"<< /Type /Catalog /Pages 2 0 R /Outlines 6 0 R >>")
    # 2: Pages
    objs.append(b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>")
    # 3: Page 1
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
    # 4: Page 2
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
    # 5: Font
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    # 6: Outlines
    objs.append(b"<< /Type /Outlines /First 9 0 R /Last 10 0 R /Count 2 >>")
    # 7: Page 1 content
    s1 = b"BT /F1 20 Tf 60 700 Td (This is Page One) Tj ET"
    objs.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(s1), s1))
    # 8: Page 2 content
    s2 = b"BT /F1 20 Tf 60 700 Td (This is Page Two) Tj ET"
    objs.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(s2), s2))
    # 9: Outline item 1 -> page 1
    objs.append(b"<< /Title (Chapter One) /Parent 6 0 R /Next 10 0 R /Dest [3 0 R /XYZ null null null] >>")
    # 10: Outline item 2 -> page 2
    objs.append(b"<< /Title (Chapter Two) /Parent 6 0 R /Prev 9 0 R /Dest [4 0 R /XYZ null null null] >>")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, o in enumerate(objs):
        offsets.append(len(out))
        out += ("%d 0 obj\n" % (i + 1)).encode() + o + b"\nendobj\n"
    xref_pos = len(out)
    out += ("xref\n0 %d\n" % (len(objs) + 1)).encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += ("%010d 00000 n \n" % off).encode()
    out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref_pos)).encode()

    with open(path, "wb") as f:
        f.write(out)
    return path

if __name__ == "__main__":
    p = os.path.join(os.path.dirname(__file__), "sample-outline.pdf")
    build(p)
    print("written", p, os.path.getsize(p))
