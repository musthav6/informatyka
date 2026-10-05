"""Генерує QR-коди для всіх уроків з lessons.js: qr/<id>.svg (для сайту) і qr/<id>.png (для Google Docs).

Запуск з кореня репозиторію:  pip install segno  &&  python3 tools/make_qr.py
Код веде на <SITE_URL>?l=<id>; SITE_URL береться з config.js.
"""
import pathlib
import re

import segno

ROOT = pathlib.Path(__file__).resolve().parent.parent
site = re.search(r'SITE_URL:\s*"([^"]+)"', (ROOT / "config.js").read_text(encoding="utf-8")).group(1)
ids = re.findall(r'id:\s*"(\d+-\d\d)"', (ROOT / "lessons.js").read_text(encoding="utf-8"))

out = ROOT / "qr"
out.mkdir(exist_ok=True)
for lid in ids:
    qr = segno.make(f"{site}?l={lid}", error="m")
    qr.save(out / f"{lid}.svg", scale=10, border=2, dark="#17232e", xmldecl=False, omitsize=True)  # viewBox замість width/height, щоб масштабувався
    qr.save(out / f"{lid}.png", scale=10, border=2, dark="#17232e")
# Головна сторінка (перелік уроків) — qr/home.*
home = segno.make(site, error="m")
home.save(out / "home.svg", scale=10, border=2, dark="#17232e", xmldecl=False, omitsize=True)
home.save(out / "home.png", scale=16, border=2, dark="#17232e")
print(f"{len(ids)} QR-кодів уроків + головна у {out.relative_to(ROOT)}/ → {site}")
