/* =========================================================
   Servidor de pagamento · Estúdio Benfica (Cloudflare Workers)
   ---------------------------------------------------------
   POST /criarPagamento   recalcula o preço com o catálogo do Firestore, cria o pedido e o checkout do Mercado Pago
   POST /webhook          aviso do Mercado Pago (o pagamento é sempre reconsultado na API)
   GET  /statusPedido     situação do pedido + lista de arquivos (exige o token do pedido)
   GET  /baixar           entrega o original do Google Drive (pedido pago, dentro do prazo)
   POST /acessoConta      cliente logado (Firebase Auth) recebe acesso aos arquivos das compras dele

   Segredos (Cloudflare > Worker > Configurações > Variáveis e segredos):
     MP_ACCESS_TOKEN        Access Token do Mercado Pago (comece pelo de TESTE)
     GOOGLE_SERVICE_ACCOUNT conteúdo inteiro do arquivo JSON da conta de serviço "loja-servidor"
   Variáveis (texto):
     SITE_URL      https://benficazzz.github.io/Site-Artur-Benfica
   ========================================================= */
const Precos = globalThis.Precos;
const PROJETO = "estudio-benfica";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const DIAS_DOWNLOAD = 30;
const ORIGENS = ["https://benficazzz.github.io", "https://estudiobenfica.com.br", "https://www.estudiobenfica.com.br", "http://localhost:8765", "http://localhost:8000"];

/* ---------------- utilidades ---------------- */
const json = (dados, status = 200, extra = {}) => new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra } });
function cors(req) {
  const o = req.headers.get("Origin");
  return o && ORIGENS.includes(o) ? { "Access-Control-Allow-Origin": o, Vary: "Origin", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } : {};
}
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlTexto = (t) => b64url(new TextEncoder().encode(t));
async function sha256(t) { return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))); }
function tokenAleatorio(n = 24) { return b64url(crypto.getRandomValues(new Uint8Array(n))); }
function iguais(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* ---------------- Google (conta de serviço) ---------------- */
let cacheToken = null;
async function tokenGoogle(env) {
  if (cacheToken && cacheToken.exp > Date.now() + 60e3) return cacheToken.t;
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64urlTexto(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64urlTexto(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----|\s/g, "");
  const chave = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ass = b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(`${cab}.${corpo}`)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${cab}.${corpo}.${ass}` });
  const d = await r.json();
  if (!r.ok) throw new Error("Google recusou a conta de serviço: " + (d.error_description || d.error));
  cacheToken = { t: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return cacheToken.t;
}

/* ---------------- Firestore (REST) ---------------- */
function deValor(v) {
  if (!v || "nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(deValor);
  if ("mapValue" in v) return deCampos(v.mapValue.fields || {});
  return null;
}
const deCampos = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, deValor(v)]));
function paraValor(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (x instanceof Date) return { timestampValue: x.toISOString() };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "string") return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(paraValor) } };
  return { mapValue: { fields: paraCampos(x) } };
}
const paraCampos = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, paraValor(v)]));

async function fs(env, caminho, op = {}) {
  const r = await fetch(`${FS}/${caminho}`, { ...op, headers: { Authorization: `Bearer ${await tokenGoogle(env)}`, "Content-Type": "application/json", ...(op.headers || {}) } });
  if (r.status === 404) return null;
  const d = await r.json();
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${d.error?.message || ""}`);
  return d;
}
async function lerDoc(env, caminho) { const d = await fs(env, caminho); return d ? deCampos(d.fields) : null; }
async function listar(env, caminho) {
  const out = []; let pag = "";
  do {
    const d = await fs(env, `${caminho}?pageSize=300${pag ? `&pageToken=${encodeURIComponent(pag)}` : ""}`);
    (d?.documents || []).forEach((x) => out.push({ id: x.name.split("/").pop(), ...deCampos(x.fields) }));
    pag = d?.nextPageToken || "";
  } while (pag);
  return out;
}
const criarDoc = (env, col, id, dados) => fs(env, `${col}?documentId=${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ fields: paraCampos(dados) }) });
const atualizarDoc = (env, caminho, dados) => fs(env, `${caminho}?${Object.keys(dados).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&")}`, { method: "PATCH", body: JSON.stringify({ fields: paraCampos(dados) }) });

/* ---------------- regras de negócio ---------------- */
async function precosDoEvento(env, eventoId, cacheEventos) {
  const ev = cacheEventos[eventoId] ??= await lerDoc(env, `eventos/${encodeURIComponent(eventoId)}`);
  if (!ev || ev.publico !== true) throw new Error(`Evento indisponível: ${eventoId}`);
  const g = (await lerDoc(env, "config/precos")) || {};
  return Precos.mesclar(Precos.mesclar(Precos.PADRAO, g), ev.precos || {});
}

async function criarPagamento(req, env) {
  const { nome, email: emailBruto, itens = [], pacotes = [] } = await req.json().catch(() => ({}));
  const email = typeof emailBruto === "string" ? emailBruto.trim().toLowerCase() : emailBruto;
  if (!nome || typeof nome !== "string" || nome.length > 120) return json({ erro: "Nome inválido" }, 400);
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return json({ erro: "E-mail inválido" }, 400);
  if (!Array.isArray(itens) || !Array.isArray(pacotes) || itens.length + pacotes.length === 0 || itens.length > 300 || pacotes.length > 20) return json({ erro: "Carrinho inválido" }, 400);
  const eventosIds = [...new Set([...itens.map((i) => i.evento), ...pacotes.map((p) => p.evento)])];
  if (eventosIds.some((e) => typeof e !== "string" || !e || e.includes("/"))) return json({ erro: "Evento inválido" }, 400);

  const cacheEventos = {};
  const precos = await precosDoEvento(env, eventosIds[0], cacheEventos);
  for (const e of eventosIds.slice(1)) await precosDoEvento(env, e, cacheEventos);
  const catalogo = {};
  for (const e of eventosIds) catalogo[e] = Object.fromEntries((await listar(env, `eventos/${encodeURIComponent(e)}/itens`)).map((i) => [i.id, i]));

  const linhas = new Map();
  const add = (e, it) => linhas.set(`${e}/${it.id}`, { chave: `${e}/${it.id}`, evento: e, id: it.id, tipo: it.tipo, titulo: it.titulo || "", eventoNome: cacheEventos[e]?.nome || "" });
  const pacotesSrv = pacotes.map((p) => {
    if (!["foto", "video", "misto"].includes(p.tipo) || !["atleta", "time"].includes(p.escopo) || typeof p.valor !== "string") throw new Error("Pacote inválido");
    const sel = Object.values(catalogo[p.evento] || {}).filter((it) => it[p.escopo] === p.valor && (p.tipo === "misto" || it.tipo === p.tipo));
    if (!sel.length) throw new Error("Pacote vazio");
    sel.forEach((it) => add(p.evento, it));
    return { tipo: p.tipo, escopo: p.escopo, valor: p.valor, evento: p.evento, itens: sel.map((it) => `${p.evento}/${it.id}`), tipos: sel.map((it) => it.tipo),
      rotulo: `${{ foto: "Todas as fotos", video: "Todos os vídeos", misto: "Fotos + vídeos" }[p.tipo]} · ${p.valor}` };
  });
  const soltos = itens.map((i) => {
    const it = catalogo[i.evento]?.[i.id];
    if (!it) throw new Error(`Item inexistente: ${i.evento}/${i.id}`);
    add(i.evento, it);
    return { id: `${i.evento}/${it.id}`, tipo: it.tipo };
  });
  const conta = Precos.calcular({ itens: soltos, pacotes: pacotesSrv }, precos);
  if (!(conta.total > 0)) return json({ erro: "Total inválido" }, 400);

  const pedidoId = tokenAleatorio(15);
  const token = tokenAleatorio(24);
  const agora = new Date();
  const listaLinhas = [...linhas.values()];
  const cobertos = new Set(pacotesSrv.flatMap((p) => p.itens));
  await criarDoc(env, "pedidos", pedidoId, {
    nome, email, total: conta.total, origem: "mercadopago", status: "aguardando", criadoEm: agora,
    expiraEm: new Date(agora.getTime() + DIAS_DOWNLOAD * 864e5), tokenHash: await sha256(token),
    linhas: listaLinhas,
    itens: listaLinhas.filter((l) => !cobertos.has(l.chave)).map(({ evento, id, tipo, titulo, eventoNome }) => ({ evento, id, tipo, titulo, eventoNome })),
    pacotes: pacotesSrv.map((p) => ({ evento: p.evento, rotulo: p.rotulo, itens: p.itens.map((c) => c.split("/")[1]) })),
  });

  const site = (env.SITE_URL || "https://benficazzz.github.io/Site-Artur-Benfica").replace(/\/$/, "");
  const voltar = `${site}/loja.html?pedido=${pedidoId}&t=${token}`;
  const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": pedidoId },
    body: JSON.stringify({
      items: [{ id: pedidoId, title: `Estúdio Benfica · ${linhas.size} arquivo(s)`, quantity: 1, unit_price: conta.total, currency_id: "BRL" }],
      payer: { name: nome, email },
      external_reference: pedidoId,
      notification_url: `${new URL(req.url).origin}/webhook`,
      back_urls: { success: voltar, pending: voltar, failure: voltar },
      auto_return: "approved",
      statement_descriptor: "ESTUDIOBENFICA",
      payment_methods: { installments: 6 },
    }),
  });
  const pref = await mp.json();
  if (!mp.ok) { console.error("Mercado Pago recusou", JSON.stringify(pref)); throw new Error("Mercado Pago indisponível no momento"); }
  await atualizarDoc(env, `pedidos/${pedidoId}`, { mpPreferencia: pref.id });
  return json({ checkout: pref.init_point, pedido: pedidoId });
}

async function webhook(req, env) {
  const u = new URL(req.url);
  const corpo = await req.json().catch(() => ({}));
  const tipo = corpo.type || corpo.topic || u.searchParams.get("type") || u.searchParams.get("topic");
  const id = corpo.data?.id || u.searchParams.get("data.id") || u.searchParams.get("id");
  if (tipo !== "payment" || !id) return new Response("ignorado");
  // nunca confia no aviso: consulta o pagamento direto no Mercado Pago
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) return new Response("pagamento não encontrado");
  const pg = await r.json();
  const ref = String(pg.external_reference || "");
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(ref)) return new Response("sem pedido");
  const p = await lerDoc(env, `pedidos/${ref}`);
  if (!p || p.status === "pago" || p.status === "entregue") return new Response("ok");
  const novo = pg.status === "approved" && Math.abs(Number(pg.transaction_amount) - p.total) < 0.01 && pg.currency_id === "BRL" ? "pago"
    : ["rejected", "cancelled", "refunded", "charged_back"].includes(pg.status) ? "cancelado" : "aguardando";
  await atualizarDoc(env, `pedidos/${ref}`, { status: novo, mpPagamento: String(pg.id), mpStatus: String(pg.status), meio: pg.payment_type_id || null, atualizadoEm: new Date() });
  return new Response("ok");
}

async function pedidoAutorizado(u, env) {
  const pedido = u.searchParams.get("pedido"), t = u.searchParams.get("t");
  if (!pedido || !t || !/^[A-Za-z0-9_-]{10,40}$/.test(pedido)) return null;
  const p = await lerDoc(env, `pedidos/${pedido}`);
  if (!p) return null;
  const h = await sha256(t);
  if (iguais(p.tokenHash, h)) return { id: pedido, ...p, viaConta: false };
  if (iguais(p.tokenContaHash, h) && new Date(p.tokenContaExpira).getTime() > Date.now()) return { id: pedido, ...p, viaConta: true };
  return null;
}
const statusPago = (p) => p.status === "pago" || p.status === "entregue";
// pelo link do e-mail/checkout: 30 dias. Pela conta do cliente: sem prazo.
const pago = (p) => statusPago(p) && (p.viaConta || new Date(p.expiraEm).getTime() > Date.now());

/** Linhas do pedido (pedidos pelo WhatsApp não têm "linhas": monta a partir de itens e pacotes). */
function linhasDe(p) {
  if (Array.isArray(p.linhas) && p.linhas.length) return p.linhas;
  const m = new Map();
  (p.itens || []).forEach((i) => m.set(`${i.evento}/${i.id}`, { chave: `${i.evento}/${i.id}`, evento: i.evento, id: i.id, tipo: i.tipo || "foto", titulo: i.titulo || "" }));
  (p.pacotes || []).forEach((k) => (k.itens || []).forEach((id) => { const c = `${k.evento}/${id}`; if (!m.has(c)) m.set(c, { chave: c, evento: k.evento, id, tipo: "foto", titulo: k.rotulo || "" }); }));
  return [...m.values()];
}

/* ---------------- login do cliente (Firebase Auth) ---------------- */
let cacheChaves = null;
async function verificarTokenFirebase(idToken) {
  const [h, c, a] = String(idToken || "").split(".");
  if (!h || !c || !a) throw new Error("Login inválido");
  const cab = JSON.parse(atob(h.replace(/-/g, "+").replace(/_/g, "/")));
  const dados = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(c.replace(/-/g, "+").replace(/_/g, "/")), (x) => x.charCodeAt(0))));
  if (!cacheChaves || cacheChaves.exp < Date.now()) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    cacheChaves = { keys: (await r.json()).keys || [], exp: Date.now() + 3600e3 };
  }
  const jwk = cacheChaves.keys.find((k) => k.kid === cab.kid);
  if (cab.alg !== "RS256" || !jwk) throw new Error("Login inválido");
  const chave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", chave, Uint8Array.from(atob(a.replace(/-/g, "+").replace(/_/g, "/")), (x) => x.charCodeAt(0)), new TextEncoder().encode(`${h}.${c}`));
  const agora = Date.now() / 1000;
  if (!ok || dados.aud !== PROJETO || dados.iss !== `https://securetoken.google.com/${PROJETO}` || !(dados.exp > agora) || !(dados.iat <= agora + 300) || !dados.sub) throw new Error("Login inválido");
  if (!dados.email || dados.email_verified !== true) throw new Error("Confirme seu e-mail para acessar suas compras");
  return String(dados.email).toLowerCase();
}

/** Cliente logado pede acesso aos arquivos de um pedido seu: recebe um token válido por 24 h. */
async function acessoConta(req, env) {
  const email = await verificarTokenFirebase((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
  const { pedido } = await req.json().catch(() => ({}));
  if (!pedido || !/^[A-Za-z0-9_-]{10,40}$/.test(pedido)) return json({ erro: "Pedido inválido" }, 400);
  const p = await lerDoc(env, `pedidos/${pedido}`);
  if (!p || String(p.email || "").toLowerCase() !== email) return json({ erro: "Pedido não encontrado nesta conta" }, 404);
  if (!statusPago(p)) return json({ status: p.status, itens: [] });
  const t = tokenAleatorio(24);
  await atualizarDoc(env, `pedidos/${pedido}`, { tokenContaHash: await sha256(t), tokenContaExpira: new Date(Date.now() + 864e5) });
  return json({ status: "pago", t, itens: linhasDe(p).map(({ chave, tipo, titulo }) => ({ chave, tipo, titulo })) });
}

async function statusPedido(u, env) {
  const p = await pedidoAutorizado(u, env);
  if (!p) return json({ erro: "Pedido não encontrado" }, 404);
  const status = pago(p) ? "pago" : p.status === "cancelado" ? "recusado" : "pendente";
  return json({ status, total: p.total, itens: pago(p) ? linhasDe(p).map(({ chave, tipo, titulo }) => ({ chave, tipo, titulo })) : [] });
}

async function baixar(u, env) {
  const p = await pedidoAutorizado(u, env);
  if (!p || !pago(p)) return new Response("Download não autorizado ou prazo encerrado.", { status: 403 });
  const linha = linhasDe(p).find((l) => l.chave === u.searchParams.get("item"));
  if (!linha) return new Response("Arquivo não encontrado.", { status: 404 });
  const orig = await lerDoc(env, `originais/${encodeURIComponent(linha.id)}`);
  if (!orig?.driveId) return new Response("Arquivo não encontrado. Fale com o Estúdio Benfica pelo WhatsApp.", { status: 404 });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(orig.driveId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await tokenGoogle(env)}` } });
  if (!r.ok) return new Response("Não foi possível obter o arquivo agora. Tente de novo em instantes.", { status: 502 });
  const nome = String(orig.nome || linha.titulo || "arquivo").replace(/["\\\r\n]/g, "");
  return new Response(r.body, { headers: { "Content-Type": orig.mime || r.headers.get("Content-Type") || "application/octet-stream", "Content-Disposition": `attachment; filename="${nome}"`, ...(r.headers.get("Content-Length") ? { "Content-Length": r.headers.get("Content-Length") } : {}) } });
}

/* ---------------- roteador ---------------- */
export default {
  async fetch(req, env) {
    const u = new URL(req.url), c = cors(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
    try {
      let r;
      if (u.pathname === "/criarPagamento" && req.method === "POST") r = await criarPagamento(req, env);
      else if (u.pathname === "/webhook") r = await webhook(req, env);
      else if (u.pathname === "/statusPedido") r = await statusPedido(u, env);
      else if (u.pathname === "/acessoConta" && req.method === "POST") r = await acessoConta(req, env);
      else if (u.pathname === "/baixar") r = await baixar(u, env);
      else if (u.pathname === "/") r = json({ ok: true, servico: "Loja Estúdio Benfica" });
      else r = json({ erro: "Rota inexistente" }, 404);
      Object.entries(c).forEach(([k, v]) => r.headers.set(k, v));
      return r;
    } catch (e) {
      console.error(e);
      return json({ erro: e.message || "Erro interno" }, 400, c);
    }
  },
};
