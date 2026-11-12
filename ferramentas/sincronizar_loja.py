#!/usr/bin/env python3
"""
Sincroniza a pasta "Loja Estúdio Benfica" (cópia local do Drive) com a loja do site.

Estrutura esperada em --origem:
    <evento>/<time>/[<atleta>/]<driveId>__<arquivo>
    ex.: 2026-09-28 · Copa Prime Arena 2026/Guerreiros BDI/Camisa 10/1AbC__IMG_1322.jpg

Gera em --site:
    assets/loja/<evento>/<driveId>.webp   prévia de foto com marca d'água (1400 px)
    assets/loja/<evento>/<driveId>.mp4    prévia de vídeo com marca d'água (até 12 s, 720p, sem áudio)
    data/catalogo.json                    catálogo lido pela loja

Os ORIGINAIS nunca vão para o site: ficam no Drive e são entregues após o pagamento.
Pastas que começam com "_" são ignoradas; com "🔒" viram galeria privada.
"""
import argparse, json, os, re, subprocess, sys, unicodedata
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

try:
    import pillow_heif; pillow_heif.register_heif_opener()
except ImportError:
    pass

AQUI = os.path.dirname(os.path.abspath(__file__))
FONTE = ImageFont.truetype(os.path.join(AQUI, "Syne-ExtraBold.ttf"), 10)
FOTO = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
VIDEO = {".mp4", ".mov", ".m4v"}
OPACIDADE = 0.16
LADO_PREVIA = 1400


def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


# ---------- marca d'água diagonal (igual à do portfólio) ----------
def _simbolo(d, x, y, s, fill):
    w, k = max(2, int(s * .08)), s * .22
    for a, b, c in [((x, y + k), (x, y), (x + k, y)), ((x + s - k, y), (x + s, y), (x + s, y + k)),
                    ((x + s, y + s - k), (x + s, y + s), (x + s - k, y + s)), ((x + k, y + s), (x, y + s), (x, y + s - k))]:
        d.line([a, b, c], fill=fill, width=w, joint="curve")
    d.polygon([(x + s * .40, y + s * .31), (x + s * .71, y + s * .50), (x + s * .40, y + s * .69)], fill=fill)


def camada(w, h):
    size = max(22, int(min(w, h) * .034))
    f = FONTE.font_variant(size=size)
    txt = "ESTÚDIO BENFICA"
    sym = int(size * 1.05)
    unit = sym + size * .6 + f.getlength(txt) + size * 3.2
    row = size * 4.6
    D = int((w * w + h * h) ** .5) + 4 * int(unit)
    L = Image.new("L", (D, D), 0); d = ImageDraw.Draw(L)
    y, j = 0.0, 0
    while y < D:
        x = -unit + (unit / 2 if j % 2 else 0)
        while x < D:
            _simbolo(d, x, y - sym * .05, sym, 255)
            d.text((x + sym + size * .6, y + sym / 2), txt, font=f, fill=255, anchor="lm")
            x += unit
        y += row; j += 1
    L = L.rotate(30, resample=Image.BICUBIC)
    l, t = (D - w) // 2, (D - h) // 2
    return L.crop((l, t, l + w, t + h))


def marcar(img):
    img = img.convert("RGB"); m = camada(*img.size)
    sombra = m.filter(ImageFilter.GaussianBlur(max(1, img.width / 900)))
    out = Image.composite(Image.new("RGB", img.size, (7, 8, 11)), img, sombra.point(lambda v: int(v * OPACIDADE * .45)))
    return Image.composite(Image.new("RGB", img.size, (245, 247, 250)), out, m.point(lambda v: int(v * OPACIDADE)))


def previa_foto(src, dst):
    im = ImageOps.exif_transpose(Image.open(src)); im.thumbnail((LADO_PREVIA, LADO_PREVIA), Image.LANCZOS)
    marcar(im).save(dst, "WEBP", quality=78, method=6)


def previa_video(src, dst, tmp_png):
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation",
                                      "-of", "json", src], capture_output=True, text=True, check=True).stdout)
    st = info["streams"][0]; w, h = st["width"], st["height"]
    rot = abs(int(next((s.get("rotation", 0) for s in st.get("side_data_list", [])), 0)))
    if rot in (90, 270): w, h = h, w
    s = 720 / min(w, h); W, H = int(w * s) // 2 * 2, int(h * s) // 2 * 2
    m = camada(W, H)
    rgba = Image.new("RGBA", (W, H), (245, 247, 250, 0)); rgba.putalpha(m.point(lambda v: int(v * .22)))
    rgba.save(tmp_png)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-i", tmp_png, "-t", "12",
                    "-filter_complex", f"[0:v]scale={W}:{H}[v];[v][1:v]overlay=0:0", "-an",
                    "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-movflags", "+faststart", dst], check=True)


# ---------- leitura da estrutura ----------
def ler_evento(nome):
    m = re.match(r"^(\d{4}-\d{2}-\d{2})\s*[·\-–|]\s*(.+)$", nome.strip())
    return (m.group(1), m.group(2).strip()) if m else ("", nome.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origem", required=True); ap.add_argument("--site", required=True)
    a = ap.parse_args()
    eventos, novos, erros = [], 0, []
    for ev in sorted(os.listdir(a.origem)):
        pev = os.path.join(a.origem, ev)
        if not os.path.isdir(pev) or ev.startswith("_"): continue
        privado = ev.startswith("🔒"); nome_limpo = ev.lstrip("🔒 ").strip()
        data, nome = ler_evento(nome_limpo)
        eid = slug(f"{data} {nome}") or slug(nome)
        out = os.path.join(a.site, "assets", "loja", eid); os.makedirs(out, exist_ok=True)
        itens, ordem = [], 0
        for raiz, _, arqs in sorted(os.walk(pev)):
            partes = os.path.relpath(raiz, pev).split(os.sep)
            partes = [] if partes == ["."] else partes
            time = partes[0] if len(partes) >= 1 else None
            atleta = partes[1] if len(partes) >= 2 else None
            for f in sorted(arqs):
                ext = os.path.splitext(f)[1].lower()
                tipo = "foto" if ext in FOTO else "video" if ext in VIDEO else None
                if not tipo or "__" not in f: continue
                did, original = f.split("__", 1)
                dst = os.path.join(out, did + (".webp" if tipo == "foto" else ".mp4"))
                if not os.path.exists(dst):
                    try:
                        (previa_foto(os.path.join(raiz, f), dst) if tipo == "foto"
                         else previa_video(os.path.join(raiz, f), dst, dst + ".png"))
                        novos += 1
                    except Exception as e:
                        erros.append(f"{ev}/{'/'.join(partes)}/{original}: {e}"); continue
                    finally:
                        if os.path.exists(dst + ".png"): os.remove(dst + ".png")
                ordem += 1
                itens.append({"id": did, "tipo": tipo, "previa": os.path.relpath(dst, a.site).replace(os.sep, "/"),
                              "time": time, "atleta": atleta, "titulo": os.path.splitext(original)[0], "ordem": ordem})
        if not itens: continue
        capa = next((i["previa"] for i in itens if i["tipo"] == "foto"), itens[0]["previa"])
        eventos.append({"id": eid, "nome": nome, "data": data, "local": "", "capa": capa, "privado": privado,
                        "times": sorted({i["time"] for i in itens if i["time"]}), "itens": itens})
    eventos.sort(key=lambda e: e["data"], reverse=True)
    cat = {"atualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "eventos": eventos}
    os.makedirs(os.path.join(a.site, "data"), exist_ok=True)
    with open(os.path.join(a.site, "data", "catalogo.json"), "w", encoding="utf-8") as fh:
        json.dump(cat, fh, ensure_ascii=False, indent=1)
    print(f"{len(eventos)} evento(s), {sum(len(e['itens']) for e in eventos)} item(ns), {novos} prévia(s) nova(s)")
    for e in erros: print("ERRO:", e, file=sys.stderr)


if __name__ == "__main__":
    main()
