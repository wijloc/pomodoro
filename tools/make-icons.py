#!/usr/bin/env python3
"""Gera os PNGs do app em assets/gtr4new/ (sem dependências, só Python 3).

- icon.png  (248x248): ícone do app, uma maçã com um relógio no meio dentro de um círculo
- store/icon-240.png (240x240): o mesmo ícone no tamanho pedido pela loja da Zepp
- apple.png (40x40):   maçã de foco concluído
- dot.png   (40x40):   bolinha de foco pendente

Uso: python3 tools/make-icons.py
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'gtr4new')

RED = (230, 50, 45, 255)
RED_HL = (255, 120, 110, 255)
LEAF = (60, 190, 80, 255)
STEM = (120, 72, 30, 255)
FACE = (250, 250, 250, 255)
INK = (40, 40, 40, 255)
GRAY = (90, 90, 90, 255)


def write_png(path, px):
    n = len(px)
    raw = b''.join(b'\x00' + bytes(c for p in row for c in p) for row in px)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    data = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(data)


def render(size, shade, ss=4):
    """Rasteriza shade(u, v) com u, v em 0..1, com antialiasing por supersampling."""
    img = []
    for y in range(size):
        row = []
        for x in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    c = shade((x + (sx + .5) / ss) / size, (y + (sy + .5) / ss) / size)
                    if c:
                        a = c[3] / 255
                        for i in range(3):
                            acc[i] += c[i] * a
                        acc[3] += a
            a = acc[3] / (ss * ss)
            rgb = [int(acc[i] / acc[3]) if acc[3] else 0 for i in range(3)]
            row.append((rgb[0], rgb[1], rgb[2], int(round(a * 255))))
        img.append(row)
    return img


def ellipse(u, v, cx, cy, rx, ry):
    return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1


def seg_dist(u, v, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    t = max(0, min(1, ((u - x1) * dx + (v - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(u - (x1 + t * dx), v - (y1 + t * dy))


def apple_parts(u, v):
    """Maçã em coordenadas 0..1 (desenho base de 40x40)."""
    if 0.475 <= u <= 0.5375 and 0.125 <= v <= 0.325:
        return STEM
    lx, ly = u - 0.6375, v - 0.2125
    a = math.radians(-30)
    rx = lx * math.cos(a) - ly * math.sin(a)
    ry = lx * math.sin(a) + ly * math.cos(a)
    if (rx / 0.1625) ** 2 + (ry / 0.075) ** 2 <= 1:
        return LEAF
    body = (ellipse(u, v, 0.3625, 0.575, 0.2625, 0.3)
            or ellipse(u, v, 0.6375, 0.575, 0.2625, 0.3)
            or ellipse(u, v, 0.5, 0.675, 0.275, 0.2375))
    notch = ellipse(u, v, 0.5, 0.2625, 0.08, 0.075)
    if body and not notch:
        return 'body'
    return None


def apple(u, v):
    p = apple_parts(u, v)
    if p == 'body':
        return RED_HL if ellipse(u, v, 0.325, 0.475, 0.075, 0.1125) else RED
    return p


BG = (245, 245, 247, 255)


def icon(u, v):
    # a loja exige ícone circular, transparente fora do círculo
    if math.hypot(u - 0.5, v - 0.5) > 0.5:
        return None
    p = apple_clock((u - 0.13) / 0.74, (v - 0.12) / 0.74)
    return p or BG


def apple_clock(u, v):
    # mesma maçã, um pouco menor e centralizada, com um relógio no meio
    s, ox, oy = 0.92, 0.04, 0.02
    p = apple_parts((u - ox) / s, (v - oy) / s)
    if p != 'body':
        return p
    cx, cy, r = 0.5, 0.62, 0.22
    d = math.hypot(u - cx, v - cy)
    if d > r:
        return RED_HL if ellipse(u, v, 0.2, 0.42, 0.045, 0.08) else RED
    if d > r - 0.022:
        return INK  # aro
    # marcações das 12, 3, 6 e 9 horas
    for k in range(4):
        ang = k * math.pi / 2
        x1, y1 = cx + math.sin(ang) * (r - 0.05), cy - math.cos(ang) * (r - 0.05)
        x2, y2 = cx + math.sin(ang) * (r - 0.085), cy - math.cos(ang) * (r - 0.085)
        if seg_dist(u, v, x1, y1, x2, y2) < 0.012:
            return INK
    # ponteiros: minutos apontando para cima, horas para as 2
    if seg_dist(u, v, cx, cy, cx, cy - r * 0.72) < 0.014:
        return INK
    ang = math.radians(60)
    if seg_dist(u, v, cx, cy, cx + math.sin(ang) * r * 0.5, cy - math.cos(ang) * r * 0.5) < 0.017:
        return INK
    if d < 0.025:
        return RED  # pino central
    return FACE


def dot(u, v):
    d = math.hypot(u - 0.5, v - 0.5)
    return GRAY if 0.175 <= d <= 0.25 else None


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write_png(os.path.join(OUT, 'icon.png'), render(248, icon, ss=3))
    store = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'store')
    os.makedirs(store, exist_ok=True)
    write_png(os.path.join(store, 'icon-240.png'), render(240, icon, ss=3))
    write_png(os.path.join(OUT, 'apple.png'), render(40, apple))
    write_png(os.path.join(OUT, 'dot.png'), render(40, dot))
    print('ícones gerados em', os.path.normpath(OUT))
