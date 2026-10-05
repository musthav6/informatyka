"""Оновлює мітку версії (?v=...) у посиланнях на CSS/JS в усіх HTML-сторінках.

Навіщо: GitHub Pages дозволяє браузерам кешувати файли до 10 хвилин, і після оновлення
сайту діти бачать старі стилі/скрипти. Нова мітка змушує браузер завантажити свіжі файли.

Запуск з кореня репозиторію перед комітом зі змінами в assets/, tests/, practice/, lessons.js, config.js:
    python3 tools/bump_version.py
"""
import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
ver = time.strftime("%Y%m%d%H%M")
# локальні .css/.js (не з CDN): src="assets/site.js", href="assets/style.css", src="tests/index.js" …
pattern = re.compile(r'((?:src|href)="(?!https?:|//)[^"?]+\.(?:css|js))(?:\?v=\w+)?"')

changed = 0
for page in sorted(ROOT.glob("*.html")):
    s = page.read_text(encoding="utf-8")
    new = pattern.sub(lambda m: f'{m.group(1)}?v={ver}"', s)
    if new != s:
        page.write_text(new, encoding="utf-8")
        changed += 1
print(f"v={ver}: оновлено сторінок — {changed}")
