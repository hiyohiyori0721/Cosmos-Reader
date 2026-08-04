#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成一个用于测试的最小 EPUB 3 电子书。"""
import zipfile
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample.epub")

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

CHAPTER1 = '''<?xml version="1.0" encoding="UTF-8"?>
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

CHAPTER2 = '''<?xml version="1.0" encoding="UTF-8"?>
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

CHAPTER3 = '''<?xml version="1.0" encoding="UTF-8"?>
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

files = {
    "mimetype": "application/epub+zip\n",
    "META-INF/container.xml": CONTAINER,
    "OEBPS/content.opf": OPF,
    "OEBPS/nav.xhtml": NAV,
    "OEBPS/style.css": CSS,
    "OEBPS/chapter1.xhtml": CHAPTER1,
    "OEBPS/chapter2.xhtml": CHAPTER2,
    "OEBPS/chapter3.xhtml": CHAPTER3,
}

with zipfile.ZipFile(OUT, "w") as zf:
    # mimetype 必须第一个且不压缩
    info = zipfile.ZipInfo("mimetype")
    info.compress_type = zipfile.ZIP_STORED
    zf.writestr(info, files["mimetype"])
    for name, content in files.items():
        if name == "mimetype":
            continue
        zf.writestr(name, content, compress_type=zipfile.ZIP_DEFLATED)

print(f"已生成测试书籍: {OUT} ({os.path.getsize(OUT)} bytes)")
