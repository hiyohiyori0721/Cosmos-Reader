#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键生成 test/ 目录下的所有测试样例书（原 make_test_*.py 的合并版）。

用法：
  python make_samples.py           # 生成全部样例
  python make_samples.py epub txt  # 只生成指定的几个样例

可生成的样例：epub / txt / pdf / cover / realbook / outline / zip / gbk / big5 / sjis
"""
import zipfile, zlib, struct, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def _write_epub(path, files_map):
    with zipfile.ZipFile(path, 'w') as zf:
        info = zipfile.ZipInfo('mimetype')
        info.compress_type = zipfile.ZIP_STORED
        zf.writestr(info, 'application/epub+zip\n')
        for name, content in files_map.items():
            if name == 'mimetype':
                continue
            zf.writestr(name, content, compress_type=zipfile.ZIP_DEFLATED)
    print('written', path, os.path.getsize(path), 'bytes')


# ---------------- sample.epub（基础 EPUB 3，3 章 + 目录） ----------------
def make_epub():
    OPF = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:sample-001</dc:identifier>
    <dc:title>测试书籍 · EPUB 阅读器</dc:title>
    <dc:creator>示例作者</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
    <itemref idref="c3"/>
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
    NAV = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
<nav epub:type="toc" id="toc">
  <h1>目录</h1>
  <ol>
    <li><a href="chapter1.xhtml">第一章 开始</a></li>
    <li><a href="chapter2.xhtml">第二章 深入</a>
      <ol>
        <li><a href="chapter2.xhtml#s1">深入基础</a></li>
        <li><a href="chapter2.xhtml#s2">深入进阶</a></li>
      </ol>
    </li>
    <li><a href="chapter3.xhtml">第三章 结束</a></li>
  </ol>
</nav>
</body>
</html>
'''
    CSS = '''body { font-family: "Georgia", "Songti SC", serif; line-height: 1.8; }
h1 { color: #a97832; margin-bottom: 0.8em; }
h2 { color: #8a6d3b; }
p { margin: 1em 0; text-indent: 2em; }
'''
    C1 = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>第一章 开始</h1>
<p>这是一本用于测试 EPUB 电子书阅读器的示例书籍。每一章都包含足够多的文字，以便在分页模式下验证翻页、进度记录与书签功能。</p>
<p>清晨的阳光透过窗帘洒进书房，桌面上摊开着一本泛黄的旧书。主人公缓缓翻动书页，字里行间仿佛藏着一个久远的故事。风从半开的窗户吹进来，书页沙沙作响，像是轻声诉说着什么。</p>
<p>阅读是一件奇妙的事情。它让我们跨越时空，与不同时代、不同国度的人对话。通过文字，我们可以走进作者构建的世界，感受他们的喜怒哀乐，体会他们的思考与感悟。</p>
<p>在这个数字化时代，电子书阅读器让阅读变得更加便捷。你可以随身携带整个图书馆，随时随地在屏幕上翻开任何一本书。字体可以调节，背景可以切换，还有书签与笔记功能帮助你记录思考的轨迹。</p>
<p>科技进步改变了我们获取知识的方式，但阅读的本质从未改变。它依然是一场心灵的旅行，一次与智者的对谈，一种认识世界与认识自我的方式。愿这本书的测试文本，能帮助阅读器验证各项功能是否正常运作。</p>
<p>让我们翻到下一章，继续这段测试之旅吧。后面还有更多章节内容，用于测试目录跳转、全文搜索以及阅读进度的记忆功能。</p>
</body>
</html>
'''
    C2 = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第二章</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>第二章 深入</h1>
<h2 id="s1">深入基础</h2>
<p>这一节用于测试目录中的子章节跳转。电子书的目录通常采用树状结构，允许读者快速定位到具体的章节甚至小节。好的目录是良好阅读体验的重要组成部分。</p>
<p>搜索功能是电子书阅读器的重要特性之一。通过全文搜索，读者可以迅速找到特定关键词出现的位置，比如人名、地名或专业术语，从而大大提高查阅效率。请尝试搜索「搜索」二字来体验这一功能。</p>
<h2 id="s2">深入进阶</h2>
<p>阅读进度记忆功能会记录你读到的位置。无论你翻到哪一页，关闭浏览器后再次打开，阅读器都会带你回到上次停下的地方，无需重新寻找。</p>
<p>书签功能则允许你在任意位置添加标记，方便日后快速返回。你可以为精彩的段落添加书签，也可以把需要反复研读的内容标注出来，让阅读更有条理。</p>
</body>
</html>
'''
    C3 = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第三章</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>第三章 结束</h1>
<p>至此，这本测试书籍的正文已经接近尾声。感谢你耐心阅读这些测试文本，它们被精心安排，用于验证 EPUB 阅读器的各种功能。</p>
<p>外观设置允许你自由调整字号大小、行距、字体与主题配色。白天模式明亮清爽，护眼模式柔和温暖，夜间模式则适合在暗光环境下阅读，减少对眼睛的刺激。</p>
<p>支持两种阅读模式：分页模式类似传统书籍，一屏一页，左右点击翻页；连续滚动模式则像网页一样平滑滚动，适合快速浏览长文。你可以根据喜好自由切换。</p>
<p>如果这一切都运行正常，那么恭喜你，这款 EPUB 电子书阅读器已经可以投入使用。希望它能成为你日常阅读的好帮手。再见！</p>
</body>
</html>
'''
    _write_epub(os.path.join(HERE, 'sample.epub'), {
        'mimetype': 'application/epub+zip\n',
        'META-INF/container.xml': CONTAINER,
        'OEBPS/content.opf': OPF,
        'OEBPS/nav.xhtml': NAV,
        'OEBPS/style.css': CSS,
        'OEBPS/chapter1.xhtml': C1,
        'OEBPS/chapter2.xhtml': C2,
        'OEBPS/chapter3.xhtml': C3,
    })


# ---------------- sample.txt（基础 TXT，多章节） ----------------
def make_txt():
    content = """星河旅人

第一章 启程

夜色如墨，星河横贯天际。林远站在观测台的顶端，望着那些遥远的光点出神。
这是他成为星际测绘员的第十个年头，却依然会在每次出航前感到难以言说的激动。

"坐标已锁定，引擎预热完成。"通讯器里传来同伴的声音。
林远深吸一口气，推下了启动杆。飞船微微一颤，随即平稳地滑入夜空。

第一章 星空

第一段旅程并不顺利。三天后，飞船遭遇了罕见的粒子风暴，导航系统一度失灵。
林远凭借多年的经验，手动调整航线，最终在风暴边缘找到了一条安全的缝隙。

"你真是个疯子。"同伴苦笑着说，"刚才差一点就回不来了。"
"可我们回来了，不是吗？"林远看着窗外恢复平静的星河，眼里闪着光。

第二章 深空信号

第十天，他们接收到了一个微弱的重复信号。
频率恒定，间隔规整，显然不是自然现象。林远将信号放大分析，发现其中似乎编码着某种规律。

"这像是一串坐标。"他喃喃道，"指向……嗯，猎户座方向。"

第二章 抵达

三个月后，飞船终于抵达了信号源所在的星系。
那里有一颗被淡蓝色薄雾包裹的星球，表面覆盖着大片神秘的结构——像是某种建筑的遗迹。

没有人知道那里曾有过怎样的文明。但林远知道，这次发现将改写人类对宇宙的认识。
他打开日志，郑重地写下：第一天，我们找到了他们留下的城市。

第三章 归途

返航的旅程比去程更加漫长。林远常常站在舷窗前，回想那颗蓝色星球上看到的一切。
那究竟是什么样的一群生命？他们去了哪里？又为什么会留下那些建筑？

或许答案就藏在某个未知的角落，等待下一位旅人。

尾声

多年以后，林远依然会讲述这个故事。
每当有人问起宇宙中最神奇的东西是什么，他总会微笑着回答："是可能性。"

旅途永无止境，星河依旧璀璨。
"""
    out = os.path.join(HERE, 'sample.txt')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    print('written', out, os.path.getsize(out), 'bytes')


# ---------------- sample.pdf（基础 PDF，1 页） ----------------
def _build_pdf(path, objs):
    out = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for i, o in enumerate(objs):
        offsets.append(len(out))
        out += ('%d 0 obj\n' % (i + 1)).encode() + o + b'\nendobj\n'
    xref_pos = len(out)
    out += ('xref\n0 %d\n' % (len(objs) + 1)).encode()
    out += b'0000000000 65535 f \n'
    for off in offsets[1:]:
        out += ('%010d 00000 n \n' % off).encode()
    out += ('trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref_pos)).encode()
    with open(path, 'wb') as f:
        f.write(out)
    print('written', path, os.path.getsize(path), 'bytes')


def make_pdf():
    title = 'PDF Reader Test Document 12345'
    stream = ('BT /F1 20 Tf 60 700 Td (' + title + ') Tj ET').encode('latin-1')
    objs = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length %d >>\nstream\n%s\nendstream' % (len(stream), stream),
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    _build_pdf(os.path.join(HERE, 'sample.pdf'), objs)


# ---------------- sample-cover.epub（带封面的 EPUB） ----------------
def make_cover():
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
    _write_epub(os.path.join(HERE, 'sample-cover.epub'), {
        'mimetype': 'application/epub+zip\n',
        'META-INF/container.xml': CONTAINER_XML,
        'OEBPS/content.opf': OPF,
        'OEBPS/chapter1.xhtml': CH1,
        'OEBPS/cover.png': cover_png,
    })


# ---------------- sample-realbook.epub（带自身 CSS 的 EPUB） ----------------
def make_realbook():
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
        body = ''.join('<p>%s</p>' % p for p in paras)
        return '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>%s</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>%s</h1>
%s
</body>
</html>
''' % (title, title, body)

    long_para = '（正文段落）这是一个用来模拟真实小说正文的段落，包含足够多的文字以便分页与滚动测试。夜色渐深，屋外风声萧瑟，他合上书页，起身走向窗前。远处的灯火如星子般闪烁，像极了许多年前的那个夜晚。他想起那些被岁月掩埋的往事，心中涌起一阵难以名状的情绪。' * 3
    C1 = chapter(1, '第一章 开端', [long_para, long_para, long_para])
    C2 = chapter(2, '第二章 波澜', [long_para, long_para, long_para, long_para])
    C3 = chapter(3, '第三章 归途', [long_para, long_para])

    _write_epub(os.path.join(HERE, 'sample-realbook.epub'), {
        'mimetype': 'application/epub+zip\n',
        'META-INF/container.xml': CONTAINER_XML,
        'OEBPS/content.opf': OPF,
        'OEBPS/style.css': CSS,
        'OEBPS/c1.xhtml': C1,
        'OEBPS/c2.xhtml': C2,
        'OEBPS/c3.xhtml': C3,
    })


# ---------------- sample-outline.pdf（带大纲的 PDF，2 页） ----------------
def make_outline():
    objs = [
        b'<< /Type /Catalog /Pages 2 0 R /Outlines 6 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Type /Outlines /First 9 0 R /Last 10 0 R /Count 2 >>',
    ]
    s1 = b'BT /F1 20 Tf 60 700 Td (This is Page One) Tj ET'
    objs.append(b'<< /Length %d >>\nstream\n%s\nendstream' % (len(s1), s1))
    s2 = b'BT /F1 20 Tf 60 700 Td (This is Page Two) Tj ET'
    objs.append(b'<< /Length %d >>\nstream\n%s\nendstream' % (len(s2), s2))
    objs.append(b'<< /Title (Chapter One) /Parent 6 0 R /Next 10 0 R /Dest [3 0 R /XYZ null null null] >>')
    objs.append(b'<< /Title (Chapter Two) /Parent 6 0 R /Prev 9 0 R /Dest [4 0 R /XYZ null null null] >>')
    _build_pdf(os.path.join(HERE, 'sample-outline.pdf'), objs)


# ---------------- sample-books.zip（打包 epub/txt/pdf） ----------------
def make_zip():
    zip_path = os.path.join(HERE, 'sample-books.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in ('sample.epub', 'sample.txt', 'sample.pdf'):
            p = os.path.join(HERE, name)
            if os.path.exists(p):
                z.write(p, 'books/' + name)
            else:
                print('missing:', p)
        # 非电子书文件，验证会被忽略
        z.writestr('books/说明.md', '# 说明\n这个文件不应被识别为电子书\n')
    print('written', zip_path, os.path.getsize(zip_path), 'bytes')


# ---------------- 编码测试 TXT（gbk / big5 / sjis） ----------------
def make_enc(name, content, enc):
    out = os.path.join(HERE, name)
    with open(out, 'w', encoding=enc) as f:
        f.write(content)
    print('written', out, os.path.getsize(out), 'bytes')


def make_gbk():
    make_enc('sample-gbk.txt', '星河旅人\n\n第一章 启程\n\n夜色如墨，星河横贯天际。\n', 'gbk')


def make_big5():
    make_enc('sample-big5.txt', '星河旅人（繁體）\n\n第一章 啟程\n\n夜色如墨，星河橫貫天際。\n', 'big5')


def make_sjis():
    make_enc('sample-sjis.txt', '銀河の旅人\n\n第一章 出発\n\n夜の空に星が輝く。\n', 'shift_jis')


CONTAINER_XML = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
'''



# ---------------- 英文 / 日文测试书 ----------------
def _html_chapter(title, paras):
    body = ''.join('<p>%s</p>' % x for x in paras)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>%s</title></head>\n<body>\n<h1>%s</h1>\n%s\n</body>\n</html>\n' % (title, title, body)

def _make_lang_epub(path, title, creator, chapters):
    OPF = '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:identifier id="book-id">urn:uuid:lang-001</dc:identifier>\n    <dc:title>%s</dc:title>\n    <dc:creator>%s</dc:creator>\n    <dc:language>%s</dc:language>\n    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>\n  </metadata>\n  <manifest>\n    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>\n    <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>\n    <item id="c3" href="c3.xhtml" media-type="application/xhtml+xml"/>\n  </manifest>\n  <spine>\n    <itemref idref="c1"/>\n    <itemref idref="c2"/>\n    <itemref idref="c3"/>\n  </spine>\n</package>\n' % (title, creator, 'en' if 'en.' in path else 'ja')
    files = {'mimetype': 'application/epub+zip\n',
             'META-INF/container.xml': CONTAINER_XML,
             'OEBPS/content.opf': OPF}
    for i, (t, ps) in enumerate(chapters, 1):
        files['OEBPS/c%d.xhtml' % i] = _html_chapter(t, ps)
    _write_epub(path, files)

def make_en():
    para = 'The morning sun streamed through the window as he opened the book. The pages rustled softly in the breeze, carrying the scent of old paper and quiet stories waiting to be told.'
    _make_lang_epub(os.path.join(HERE, 'sample-en.epub'), 'English Sample Book', 'English Author', [
        ('Chapter One: The Beginning', [para, para]),
        ('Chapter Two: The Journey', [para, para, para]),
        ('Chapter Three: The End', [para, para]),
    ])

def make_jp():
    para = '朝日が窓から差し込み、彼は本を開いた。風に吹かれてページがめくれ、古い紙の香りと静かな物語が広がっていた。'
    _make_lang_epub(os.path.join(HERE, 'sample-jp.epub'), '日本語サンプル本', 'サンプル著者', [
        ('第一章 出発', [para, para]),
        ('第二章 冒険', [para, para, para]),
        ('第三章 帰還', [para, para]),
    ])

def make_en_txt():
    content = """The Star Traveler

Chapter One: Departure

The night was dark, and the river of stars stretched across the sky. Lin Yuan stood at the top of the observation platform, gazing at the distant points of light. It was his tenth year as a stellar surveyor, yet he still felt an indescribable excitement before every voyage.

"Coordinates locked. Engines ready." A familiar voice came through the communicator. Lin Yuan took a deep breath and pushed the throttle. The spaceship trembled slightly, then glided smoothly into the night.

Chapter Two: Deep Space

Ten days later, they received a faint, repeating signal. The frequency was constant and the interval regular; clearly not a natural phenomenon. Lin Yuan amplified the signal and found it seemed to encode some pattern.

"It looks like a set of coordinates," he murmured. "Pointing toward... the Orion constellation."

Chapter Three: Homecoming

The return journey was even longer than the trip out. Lin Yuan often stood at the porthole, recalling everything he had seen on that blue planet. What kind of beings had they been? Where had they gone? And why had they left those structures behind?

Perhaps the answers were hidden in some unknown corner, waiting for the next traveler.

Epilogue

Years later, Lin Yuan still told this story. Whenever someone asked what was the most amazing thing in the universe, he would smile and answer: "Possibility."

The journey never ends, and the stars remain as bright as ever.
"""
    out = os.path.join(HERE, 'sample-en.txt')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    print('written', out, os.path.getsize(out), 'bytes')

def make_jp_txt():
    content = """銀河の旅人

第1話 出発

夜の空に星が輝いていた。林遠は観測台の頂上に立ち、遠くの光を眺めていた。星図測量士になって十年目、それでも毎回の出航前に言葉にできない興奮を覚える。

「座標ロック完了、エンジン準備OK。」通信機から仲間の声が聞こえる。林遠は深呼吸して、操縦桿を押し下げた。宇宙船はわずかに震え、そして静かに夜空へと滑り出した。

第2話 深宇宙

十日後、彼らは微弱な繰り返し信号を受信した。周波数は一定で、間隔も規則的だった。明らかに自然現象ではない。林遠は信号を拡大して分析し、何かの規則が符号化されているように見えた。

「これは座標みたいだ。」彼はつぶやいた。「オリオン座の方向を指している……」

第3話 帰還

帰りの旅は行きよりも長かった。林遠はよく舷窓に立ち、あの青い惑星で見たすべてを思い出していた。彼らはどんな存在だったのか。どこへ行ったのか。そしてなぜあの構造物を残したのか。

おそらく答えは、未知のどこかに隠されていて、次の旅人を待っているのだろう。

終章

何年もの後、林遠はまだこの物語を語っていた。宇宙で一番不思議なものは何かと聞かれるたび、彼は微笑んでこう答えた。「可能性、です。」

旅は終わらない。星はいつまでも輝いている。
"""
    out = os.path.join(HERE, 'sample-jp.txt')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    print('written', out, os.path.getsize(out), 'bytes')

GENERATORS = {
    'epub': make_epub,
    'txt': make_txt,
    'pdf': make_pdf,
    'cover': make_cover,
    'realbook': make_realbook,
    'outline': make_outline,
    'zip': make_zip,
    'gbk': make_gbk,
    'big5': make_big5,
    'sjis': make_sjis,
    'en': make_en,
    'jp': make_jp,
    'en-txt': make_en_txt,
    'jp-txt': make_jp_txt,
}


def main():
    args = sys.argv[1:]
    targets = args if args else sorted(GENERATORS.keys())
    for t in targets:
        if t not in GENERATORS:
            print('unknown sample: %s (可选: %s)' % (t, ', '.join(sorted(GENERATORS))))
            sys.exit(1)
    for t in targets:
        GENERATORS[t]()
    print('done. 共生成 %d 个样例' % len(targets))


if __name__ == '__main__':
    main()
