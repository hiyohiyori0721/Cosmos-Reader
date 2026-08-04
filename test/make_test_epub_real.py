#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成一本带自身 CSS 样式的 EPUB（模拟真实小说），用于测试留白覆盖。"""
import zipfile, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample-realbook.epub")

CSS = '''body {
    margin: 0;
    padding: 0 8px;
    font-family: serif;
}
p { text-indent: 2em; margin: 0.6em 0; }
h1, h2 { text-align: center; }
'''

OPF = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:realbook-001</dc:identifier>
    <dc:title>真实小说样式测试</dc:title>
    <dc:creator>测试作者</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c3" href="c3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
    <itemref idref="c3"/>
  </spine>
</package>
'''

def chapter(num, title, paras):
    body = ''.join(f'<p>{p}</p>' for p in paras)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{title}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>{title}</h1>
{body}
</body>
</html>
'''

long_para = "（正文段落）这是一个用来模拟真实小说正文的段落，包含足够多的文字以便分页与滚动测试。夜色渐深，屋外风声萧瑟，他合上书页，起身走向窗前。远处的灯火如星子般闪烁，像极了许多年前的那个夜晚。他想起那些被岁月掩埋的往事，心中涌起一阵难以名状的情绪。" * 3

C1 = chapter(1, '第一章 开端', [long_para, long_para, long_para])
C2 = chapter(2, '第二章 波澜', [long_para, long_para, long_para, long_para])
C3 = chapter(3, '第三章 归途', [long_para, long_para])

with zipfile.ZipFile(OUT, 'w') as zf:
    info = zipfile.ZipInfo('mimetype')
    info.compress_type = zipfile.ZIP_STORED
    zf.writestr(info, 'application/epub+zip\n')
    zf.writestr('META-INF/container.xml', '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>''', compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/content.opf', OPF, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/style.css', CSS, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/c1.xhtml', C1, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/c2.xhtml', C2, compress_type=zipfile.ZIP_DEFLATED)
    zf.writestr('OEBPS/c3.xhtml', C3, compress_type=zipfile.ZIP_DEFLATED)

print(f"已生成带自身 CSS 的测试书籍: {OUT} ({os.path.getsize(OUT)} bytes)")
