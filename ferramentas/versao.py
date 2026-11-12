#!/usr/bin/env python3
"""Carimba um número de versão nos arquivos CSS/JS do site (ex.: css/style.css?v=202611121830).
Assim o navegador baixa a versão nova depois de cada atualização, sem precisar de Ctrl+F5.
Rode antes de cada publicação:  python3 ferramentas/versao.py"""
import glob, os, re, time
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = time.strftime("%Y%m%d%H%M")
n = 0
for f in glob.glob(os.path.join(R, "*.html")):
    s = open(f, encoding="utf-8").read()
    novo = re.sub(r'((?:href|src)="(?:css|js)/[\w.-]+\.(?:css|js))(\?v=\d+)?"', rf'\1?v={v}"', s)
    if novo != s: open(f, "w", encoding="utf-8").write(novo); n += 1
for f in glob.glob(os.path.join(R, "js", "*.js")):
    s = open(f, encoding="utf-8").read()
    novo = re.sub(r'(from\s+"\./[\w.-]+\.js)(\?v=\d+)?"', rf'\1?v={v}"', s)
    if novo != s: open(f, "w", encoding="utf-8").write(novo); n += 1
print(f"versão {v} aplicada em {n} arquivo(s)")
