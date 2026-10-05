"""Конспекти уроків з Google Диску → notes/<клас>.js (розгортний «Повний конспект» на сторінці уроку).

Вхід — текст Google Doc «Уроки NN–NN — …» так, як його віддає конектор Диска (read_file_content):
заголовки ###, таблиці з | … |, визначення — таблиці з однієї клітинки.
Сирий текст у репозиторій НЕ класти: у ньому відповіді для вчителя.

На сайт потрапляє: теорія (розділи 1, 2, …), практична робота, «Завдання».
Не потрапляє: аркуш «ВІДПОВІДІ», діагностувальна робота й тематичне оцінювання (паперові варіанти тестів).

Запуск з кореня репозиторію (кілька класів за раз — можна):
    python3 tools/make_notes.py /шлях/5.md /шлях/6.md
Уже наявні уроки в notes/<клас>.js зберігаються, нові — додаються або замінюють старі з тим самим id.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEAD = re.compile(r"^\*\*ІНФОРМАТИКА · (\d+) КЛАС · УРОК (\d+)\*\*\s*$", re.M)
ANSWERS = re.compile(r"^#[^#\n]*ВІДПОВІДІ", re.M)
# розділи, яких учні не мають бачити до тесту
HIDDEN = re.compile(r"^### \*\*(Діагностувальна робота|Тематичне оцінювання)", re.M)


def unescape(s):
    return re.sub(r"\\(.)", r"\1", s)


INLINE = re.compile(r"\*\*(.+?)\*\*|(?<![\\*])\*(?!\*)(.+?)(?<!\\)\*")


def inline(raw):
    """Жирний і курсив markdown → <b>, <i>; решта — екранований текст."""
    out, last = [], 0
    for m in INLINE.finditer(raw):
        out.append(html.escape(unescape(raw[last:m.start()]), quote=False))
        if m.group(1) is not None:
            out.append("<b>" + html.escape(unescape(m.group(1)), quote=False) + "</b>")
        else:
            out.append("<i>" + html.escape(unescape(m.group(2)), quote=False) + "</i>")
        last = m.end()
    out.append(html.escape(unescape(raw[last:]), quote=False))
    return "".join(out).strip()


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def table(lines):
    rows = [cells(l) for l in lines if not re.match(r"^\|\s*:?-", l.strip())]
    rows = [r for r in rows if any(c for c in r)]          # перший рядок у Drive — порожній
    rows = [[inline(unescape(c)) for c in r] for r in rows]  # у клітинках екранування подвійне
    if not rows:
        return ""
    if len(rows[0]) == 1:                                    # визначення в рамці
        return "".join(f'<div class="def">{r[0]}</div>' for r in rows)
    head, body = [re.sub(r"</?b>", "", c) for c in rows[0]], rows[1:]
    th = "".join(f"<th>{c}</th>" for c in head)
    # data-th — підпис колонки: на вузькому телефоні таблиця на 3+ колонки стає стосом карток
    labels = [html.escape(html.unescape(c)) for c in head]
    tb = "".join("<tr>" + "".join(f'<td data-th="{labels[k] if k < len(labels) else ""}">{c}</td>' for k, c in enumerate(r)) + "</tr>" for r in body)
    cls = "ntable wide" if len(head) >= 3 else "ntable"
    return f'<div class="{cls}"><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>'


def convert(chunk):
    """Текст одного уроку → HTML."""
    out, i = [], 0
    lines = chunk.splitlines()
    skipped_book = False
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s or s == "-----":
            i += 1; continue
        if s.startswith("## "):                              # назва уроку вже є в шапці сторінки
            i += 1; continue
        if not skipped_book and re.match(r"^\*[^*].*\*$", s):  # рядок із підручником — теж є в шапці
            skipped_book = True; i += 1; continue
        if s.startswith("### "):
            out.append(f"<h3>{inline(s[4:])}</h3>"); i += 1; continue
        if s.startswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i]); i += 1
            out.append(table(block)); continue
        if re.match(r"^- ", s):
            items = []
            while i < len(lines) and re.match(r"^\s*- ", lines[i]):
                items.append(f"<li>{inline(lines[i].strip()[2:])}</li>"); i += 1
            out.append("<ul>" + "".join(items) + "</ul>"); continue
        if re.match(r"^\d+\.\s", s):
            items = []
            while i < len(lines) and re.match(r"^\s*\d+\.\s", lines[i]):
                items.append("<li>" + inline(re.sub(r"^\s*\d+\.\s+", "", lines[i])) + "</li>"); i += 1
            out.append("<ol>" + "".join(items) + "</ol>"); continue
        if re.match(r"^\*[^*].*\*$", s):                     # пояснення курсивом
            out.append(f'<p class="nnote">{inline(s)}</p>'); i += 1; continue
        if re.match(r"^\*\*Завдання \d", s):
            out.append(f'<p class="ntask">{inline(s)}</p>'); i += 1; continue
        out.append(f"<p>{inline(s)}</p>"); i += 1
    return "".join(out)


def lessons(text):
    text = ANSWERS.split(text)[0]
    heads = list(HEAD.finditer(text))
    for k, m in enumerate(heads):
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        chunk = text[m.end():end]
        chunk = HIDDEN.split(chunk)[0]
        yield f"{m.group(1)}-{int(m.group(2)):02d}", convert(chunk)


def main(paths):
    if not paths:
        print(__doc__); sys.exit(1)
    by_grade = {}
    for p in paths:
        for lid, h in lessons(pathlib.Path(p).read_text(encoding="utf-8")):
            by_grade.setdefault(lid.split("-")[0], {})[lid] = h
    (ROOT / "notes").mkdir(exist_ok=True)
    for g, new in sorted(by_grade.items()):
        f = ROOT / "notes" / f"{g}.js"
        old = {}
        if f.exists():
            m = re.search(r"Object\.assign\(window\.NOTES \|\| \{\}, (\{.*\})\);", f.read_text(encoding="utf-8"), re.S)
            if m:
                old = json.loads(m.group(1))
        old.update(new)
        body = json.dumps(dict(sorted(old.items())), ensure_ascii=False, indent=0)
        f.write_text(
            f"/* Повні конспекти {g} класу для сторінки уроку. Згенеровано tools/make_notes.py з Google Docs — руками не правити. */\n"
            f"window.NOTES = Object.assign(window.NOTES || {{}}, {body});\n", encoding="utf-8")
        print(f"notes/{g}.js: " + ", ".join(f"{k} ({len(v) // 1000} КБ)" for k, v in sorted(old.items())))


if __name__ == "__main__":
    main(sys.argv[1:])
