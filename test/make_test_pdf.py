# -*- coding: utf-8 -*-
"""生成一个带正确 xref 的最小测试 PDF（单页含中文/英文文字），供阅读器测试"""
import os

def build_pdf(path, title_text="PDF Reader Test Document 12345"):
    objs = []
    # 对象 1: Catalog
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    # 对象 2: Pages
    objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    # 对象 3: Page
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
    # 对象 4: Content stream（标准 ASCII 文本，便于 pdf.js 提取 textContent）
    stream = ("BT /F1 20 Tf 60 700 Td (" + title_text + ") Tj ET").encode("latin-1")
    objs.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream))
    # 对象 5: Font
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

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
    out = os.path.join(os.path.dirname(__file__), "sample.pdf")
    build_pdf(out)
    print("written", out, os.path.getsize(out))
