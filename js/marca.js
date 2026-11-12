/* =========================================================
   Prévias com marca d'água, geradas no navegador (painel admin).
   Mesma marca do portfólio: "ESTÚDIO BENFICA" + símbolo do visor,
   em grade diagonal a 30°, opacidade de 16%.
   ========================================================= */
const OPACIDADE = 0.16;
const LIMITE_DOC = 700 * 1024; // a prévia é guardada no Firestore (máx. 1 MB por documento)

export async function prepararFonte() {
  try { await document.fonts.load('800 40px "Syne"'); } catch {}
}

function simbolo(ctx, x, y, s) {
  const k = s * 0.22;
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
  ctx.moveTo(x + s - k, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + k);
  ctx.moveTo(x + s, y + s - k); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - k, y + s);
  ctx.moveTo(x + k, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s - k);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.40, y + s * 0.31); ctx.lineTo(x + s * 0.71, y + s * 0.50); ctx.lineTo(x + s * 0.40, y + s * 0.69);
  ctx.closePath(); ctx.fill();
}

function grade(ctx, w, h, cor) {
  const size = Math.max(14, Math.min(w, h) * 0.034);
  ctx.font = `800 ${size}px Syne, "Arial Black", sans-serif`;
  ctx.textBaseline = "middle";
  const label = "ESTÚDIO BENFICA";
  const tw = ctx.measureText(label).width;
  const sym = size * 1.05;
  const unit = sym + size * 0.6 + tw + size * 3.2;
  const row = size * 4.6;
  const D = Math.hypot(w, h) + 2 * unit;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = ctx.strokeStyle = cor;
  let j = 0;
  for (let y = -D / 2; y < D / 2; y += row, j++) {
    for (let x = -D / 2 - unit + (j % 2 ? unit / 2 : 0); x < D / 2; x += unit) {
      simbolo(ctx, x, y - sym / 2, sym);
      ctx.fillText(label, x + sym + size * 0.6, y);
    }
  }
  ctx.restore();
}

/** Camada transparente com a marca d'água, desenhada uma vez por tamanho. */
const cache = new Map();
function camada(w, h) {
  const k = `${Math.round(w)}x${Math.round(h)}`;
  if (cache.has(k)) return cache.get(k);
  const c = canvasDe(w, h), ctx = c.getContext("2d");
  ctx.save();
  ctx.filter = `blur(${Math.max(1, w / 900)}px)`;
  grade(ctx, w, h, `rgba(7,8,11,${OPACIDADE * 0.45})`);
  ctx.restore();
  grade(ctx, w, h, `rgba(245,247,250,${OPACIDADE})`);
  if (cache.size > 8) cache.clear();
  cache.set(k, c);
  return c;
}

/** Aplica a marca d'água sobre o que já está desenhado no canvas. */
export function aplicarMarca(ctx, w, h) {
  ctx.drawImage(camada(w, h), 0, 0, w, h);
}

function canvasDe(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.round(w); c.height = Math.round(h);
  return c;
}

const lerDataURL = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(blob); });
const paraBlob = (c, tipo, q) => new Promise((ok) => c.toBlob(ok, tipo, q));

/** Desenha a imagem reduzida (lado maior = lado) com marca d'água e devolve data URL WebP. */
async function versao(fonte, fw, fh, lado, qualidades, limite) {
  const esc = Math.min(1, lado / Math.max(fw, fh));
  const c = canvasDe(fw * esc, fh * esc);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fonte, 0, 0, c.width, c.height);
  aplicarMarca(ctx, c.width, c.height);
  let blob;
  for (const q of qualidades) {
    blob = await paraBlob(c, "image/webp", q);
    if (blob && blob.size <= limite) break;
  }
  return { url: await lerDataURL(blob), w: c.width, h: c.height, bytes: blob.size };
}

/** Foto → { previa (1400 px), thumb (480 px), largura, altura } */
export async function previaFoto(arquivo) {
  let bmp;
  try { bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" }); }
  catch { throw new Error(`Não consegui abrir "${arquivo.name}". Se for HEIC, exporte como JPG.`); }
  const previa = await versao(bmp, bmp.width, bmp.height, 1400, [0.8, 0.7, 0.6, 0.5], LIMITE_DOC);
  const thumb = await versao(bmp, bmp.width, bmp.height, 480, [0.72, 0.6], 60 * 1024);
  const r = { previa: previa.url, thumb: thumb.url, largura: bmp.width, altura: bmp.height };
  bmp.close?.();
  return r;
}

/** Vídeo → { previa (6 s, 360p, com marca), thumb, duracao } */
export async function previaVideo(arquivo, aoProgresso = () => {}) {
  const url = URL.createObjectURL(arquivo);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise((ok, erro) => { v.onloadedmetadata = ok; v.onerror = () => erro(new Error(`Não consegui abrir o vídeo "${arquivo.name}".`)); });
    const dur = v.duration || 0;
    // miniatura a 1/3 do vídeo
    v.currentTime = Math.min(dur / 3, 2);
    await new Promise((ok) => (v.onseeked = ok));
    const thumb = await versao(v, v.videoWidth, v.videoHeight, 480, [0.72, 0.6], 60 * 1024);

    const esc = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    const c = canvasDe(v.videoWidth * esc, v.videoHeight * esc);
    const ctx = c.getContext("2d");
    const tipo = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!tipo) return { previa: null, thumb: thumb.url, duracao: dur };

    const trecho = Math.min(6, dur || 6);
    let bitrate = 380_000, previa = null;
    for (let tentativa = 0; tentativa < 2 && !previa; tentativa++) {
      v.currentTime = 0;
      await new Promise((ok) => (v.onseeked = ok));
      const rec = new MediaRecorder(c.captureStream(24), { mimeType: tipo, videoBitsPerSecond: bitrate });
      const partes = [];
      rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
      const fim = new Promise((ok) => (rec.onstop = ok));
      rec.start(250);
      await v.play();
      await new Promise((ok) => {
        const quadro = () => {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          aplicarMarca(ctx, c.width, c.height);
          aoProgresso(Math.min(1, v.currentTime / trecho));
          if (v.currentTime >= trecho || v.ended) return ok();
          requestAnimationFrame(quadro);
        };
        quadro();
      });
      v.pause(); rec.stop(); await fim;
      const blob = new Blob(partes, { type: tipo.split(";")[0] });
      if (blob.size < 2048) break; // o navegador não conseguiu gravar: segue só com a miniatura
      if (blob.size <= LIMITE_DOC) previa = await lerDataURL(blob);
      else bitrate = Math.floor(bitrate * (LIMITE_DOC / blob.size) * 0.85);
    }
    return { previa, thumb: thumb.url, duracao: dur };
  } finally {
    URL.revokeObjectURL(url);
  }
}
