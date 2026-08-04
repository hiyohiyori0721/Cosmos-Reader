#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成一个带封面的测试 EPUB，用于验证封面提取。"""
import zipfile, zlib, struct, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample-cover.epub")

def make_png(width, height, rgb):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        c += struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
        return c
    raw = b''
    for _ in range(height):
        raw += b'\x00' + bytes(rgb) * width
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))

cover_png = make_png(200, 300, (147, 112, 219))  # 紫色封面

OPF = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:cover-sample-001</dc:identifier>
    <dc:title>带封面的测试书籍</dc:title>
    <dc:creator>封面作者</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="cover-image" href="cover.png" media-type="image/png" properties="cover"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
  </spine>
</package>
'''

CONTAINER = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
'''

CH1 = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title></head>
<body>
<h1>带封面的测试书籍</h1>
<p>这是一本包含封面的测试书籍，用于验证阅读器在书库中能正确显示封面图片。</p>
</body>
</html>
'''

with zipfile.ZipFile(OUT, 'w') as zf:
    info = zipfile.ZipInfo('mimetype')
    info.compress_type = zipfile.ZIP_STORED
    zf.writestr(info, 'application/epub+zip\n')
    zf.writestr('META-INF/container.xml', CONTAINER, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/content.opf', OPF, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/chapter1.xhtml', CH1, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/cover.png', cover_png, compress_type=zipfile.ZIP_STORED)

print(f"已生成带封面测试书籍: {OUT} ({os.path.getsize(OUT)} bytes)")
