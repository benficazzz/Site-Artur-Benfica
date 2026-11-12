#!/usr/bin/env python3
"""Monta worker/loja-worker.js (arquivo único para colar no Cloudflare):
regra de preços (js/precos.js) + servidor (worker/src.js)."""
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
precos = open(os.path.join(R, "js/precos.js"), encoding="utf-8").read()
src = open(os.path.join(R, "worker/src.js"), encoding="utf-8").read()
cab = ("// ARQUIVO GERADO por ferramentas/montar_worker.py — não edite aqui.\n"
       "// Cole este arquivo inteiro no editor do Worker no Cloudflare.\n\n")
open(os.path.join(R, "worker/loja-worker.js"), "w", encoding="utf-8").write(cab + precos + "\n" + src)
print("worker/loja-worker.js gerado")
