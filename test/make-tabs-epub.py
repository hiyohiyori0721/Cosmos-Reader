"""生成含长制表符的测试 EPUB（验证分页模式下过长 tab 不再撑页）"""
import zipfile
import os

OUT = os.path.join(os.path.dirname(__file__), 'sample-tabs.epub')

def w(arcname, data, compress_type=zipfile.ZIP_DEFLATED):
    return (arcname, data, compress_type)

files = []

# mimetype 必须第一个且不压缩
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
    <dc:identifier id="uid">urn:uuid:test-tabs-001</dc:identifier>
    <dc:title>Tab 撑页测试</dc:title>
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

# 含长制表符的章节：pre 段落 + 大量 tab
tabs = '\t' * 40
chapter = '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title>
<style>
  .tabs { white-space: pre; }
</style>
</head>
<body>
<h1>第一章 出发</h1>
<p>这是一段正常文字，用于验证普通段落不受影响。清晨的阳光洒进房间，主角慢慢睁开眼睛。</p>
<p>下面是带过长制表符的段落（white-space: pre），四十个制表符会把这一行撑到下一页。</p>
<p class="tabs">第一列''' + tabs + '''第二列''' + tabs + '''第三列</p>
<p>这段文字本应在制表符段落之后紧接着显示，如果被撑页影响就会跑到奇怪的位置。</p>
<p>第二段正常文字。他站起身，走向窗边，看向远处的山。</p>
<p class="tabs">AAA''' + tabs + '''BBB''' + tabs + '''CCC</p>
<p>结尾正常段落。她推开门，微笑着走了进来。</p>
</body>
</html>
'''
files.append(w('OEBPS/chapter1.xhtml', chapter))

with zipfile.ZipFile(OUT, 'w') as z:
    for arcname, data, ct in files:
        z.writestr(arcname, data, compress_type=ct)

print('OK', OUT, os.path.getsize(OUT), 'bytes')
