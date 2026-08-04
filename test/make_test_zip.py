# -*- coding: utf-8 -*-
"""生成测试压缩包：内含 epub / txt / pdf 电子书，供 zip 自动识别导入测试"""
import os, zipfile

HERE = os.path.dirname(__file__)

def build():
    zip_path = os.path.join(HERE, "sample-books.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        # 直接从 test 目录收集已有样例 + 生成的 pdf
        files = []
        for name in ("sample.epub", "sample.txt", "sample.pdf"):
            p = os.path.join(HERE, name)
            if os.path.exists(p):
                files.append((p, name))
            else:
                print("missing:", p)
        # 也放一个非电子书文件（扩展名非 epub/txt/pdf），验证会被忽略
        readme = os.path.join(HERE, "说明.md")
        with open(readme, "w", encoding="utf-8") as f:
            f.write("# 说明\n这个文件不应被识别为电子书\n")
        files.append((readme, "说明.md"))
        for src, arc in files:
            # 模拟放在子目录里
            z.write(src, "books/" + arc)
    print("written", zip_path, os.path.getsize(zip_path))

if __name__ == "__main__":
    build()
