# -*- coding: utf-8 -*-
"""生成 PWA 应用图标（金色背景 + 白色翻开的书），无第三方依赖。"""
import zlib
import struct
import os

BG = (184, 134, 11)      # #b8860b 强调金
WHITE = (255, 255, 255)

def in_round_rect(fx, fy, x0, y0, x1, y1, r):
    if fx < x0 or fx > x1 or fy < y0 or fy > y1:
        return False
    cx = x0 + r if fx < x0 + r else (x1 - r if fx > x1 - r else fx)
    cy = y0 + r if fy < y0 + r else (y1 - r if fy > y1 - r else fy)
    return (fx - cx) ** 2 + (fy - cy) ** 2 <= r * r

def pixel_fn(fx, fy):
    book = in_round_rect(fx, fy, 0.26, 0.30, 0.74, 0.70, 0.05)
    if not book:
        return BG
    if 0.47 <= fx <= 0.53:          # 中缝（书脊）
        return BG
    lines = (0.40, 0.48, 0.56, 0.64)
    for ly in lines:
        if 0.31 <= fx <= 0.46 and ly <= fy <= ly + 0.02:
            return BG
        if 0.54 <= fx <= 0.69 and ly <= fy <= ly + 0.02:
            return BG
    return WHITE

def make_png(path, size):
    w = h = size
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: none
        for x in range(w):
            r, g, b = pixel_fn((x + 0.5) / w, (y + 0.5) / h)
            raw += bytes((r, g, b))
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('written', path, os.path.getsize(path), 'bytes')

if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    make_png(os.path.join(base, 'icon-192.png'), 192)
    make_png(os.path.join(base, 'icon-512.png'), 512)
