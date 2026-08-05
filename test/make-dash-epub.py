"""生成含长破折号分隔线的测试 EPUB（验证分页模式下破折号线不再延伸到下一页）"""
import zipfile
import os

OUT = os.path.join(os.path.dirname(__file__), 'sample-dash.epub')

def w(arcname, data, compress_type=zipfile.ZIP_DEFLATED):
    return (arcname, data, compress_type)

files = []
files.append(w('mimetype', 'application/epub+zip', zipfile.ZIP_STORED))
files.append(w('META-INF/container.xml', '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
'''))
files.append(w('OEBPS/content.opf', '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:test-dash-001</dc:identifier>
    <dc:title>破折号分隔线测试</dc:title>
    <dc:language>zh</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
  </spine>
</package>
'''))
files.append(w('OEBPS/nav.xhtml', '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
<nav epub:type="toc"><ol><li><a href="chapter1.xhtml">第一章</a></li></ol></nav>
</body>
</html>
'''))

dash = '\u2014' * 24  # 24 个 em dash
paras = []
paras.append('<h1>第一章 出发</h1>')
# 多段正常文字凑满多页
for i in range(1, 26):
    paras.append('<p>第%d段正文。清晨的阳光洒进房间，主角慢慢睁开眼睛，窗外是一片宁静的山村景色，空气里带着露水的味道。' % i)
# 破折号分隔线（normal 段落）
paras.append('<p>' + dash + '</p>')
for i in range(26, 40):
    paras.append('<p>第%d段正文。他站起身走向窗边，远处的群山在晨雾中若隐若现，这一天的旅程才刚刚开始。' % i)
# 又一条破折号分隔线（pre 段落）
paras.append('<p style="white-space:pre">' + dash + '</p>')
for i in range(40, 55):
    paras.append('<p>第%d段正文。她推开门走了进来，微笑着递过一杯热茶，屋里顿时弥漫起温暖的香气。</p>' % i)

chapter = '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title></head>
<body>
''' + '\n'.join(paras) + '''
</body>
</html>
'''
files.append(w('OEBPS/chapter1.xhtml', chapter))

with zipfile.ZipFile(OUT, 'w') as z:
    for arcname, data, ct in files:
        z.writestr(arcname, data, compress_type=ct)

print('OK', OUT, os.path.getsize(OUT), 'bytes')
