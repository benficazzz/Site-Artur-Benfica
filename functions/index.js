/**
 * Loja Estúdio Benfica · Cloud Functions (região São Paulo)
 *
 *  POST /criarPagamento   recalcula o valor no servidor, cria o pedido e o checkout do Mercado Pago
 *  POST /webhookMercadoPago  aviso do Mercado Pago; o pagamento é sempre reconsultado na API
 *  GET  /statusPedido     situação do pedido + lista de arquivos (exige o token do pedido)
 *  GET  /baixar           entrega o arquivo original (só para pedido pago, dentro do prazo)
 *
 * Segredo necessário:  firebase functions:secrets:set MP_ACCESS_TOKEN
 */
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Precos = require("./precos");

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 5 });

const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");
const SITE_URL = defineString("SITE_URL", { default: "https://benficazzz.github.io/Site-Artur-Benfica" });
const REGIAO_URL = "https://southamerica-east1-estudio-benfica.cloudfunctions.net";
const DIAS_DOWNLOAD = 30;

const ORIGENS = ["https://benficazzz.github.io", "http://localhost:8000", "http://localhost:8765"];
function cors(req, res) {
  const o = req.get("origin");
  if (o && ORIGENS.some((x) => o === x || o.endsWith(".estudiobenfica.com.br") || o === "https://estudiobenfica.com.br")) res.set("Access-Control-Allow-Origin", o);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return true; }
  return false;
}

const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
const iguais = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function precosDoEvento(eventoId) {
  const [g, e] = await Promise.all([db.doc("config/precos").get(), db.doc(`eventos/${eventoId}`).get()]);
  if (!e.exists || e.get("publico") !== true) throw new Error(`Evento indisponível: ${eventoId}`);
  return Precos.mesclar(Precos.mesclar(Precos.PADRAO, g.exists ? g.data() : {}), e.get("precos") || {});
}

/* ------------------------------------------------------------------ */
exports.criarPagamento = onRequest({ secrets: [MP_ACCESS_TOKEN] }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });
  try {
    const { nome, email, itens = [], pacotes = [] } = req.body || {};
    if (!nome || typeof nome !== "string" || nome.length > 120) return res.status(400).json({ erro: "Nome inválido" });
    if (!/^\S+@\S+\.\S+$/.test(email || "") || email.length > 200) return res.status(400).json({ erro: "E-mail inválido" });
    if (!Array.isArray(itens) || !Array.isArray(pacotes) || itens.length + pacotes.length === 0 || itens.length > 500 || pacotes.length > 20)
      return res.status(400).json({ erro: "Carrinho inválido" });

    const eventosIds = [...new Set([...itens.map((i) => i.evento), ...pacotes.map((p) => p.evento)])];
    if (eventosIds.some((e) => typeof e !== "string" || !e || e.includes("/"))) return res.status(400).json({ erro: "Evento inválido" });
    // Mesma tabela para o carrinho todo: usa a do primeiro evento
    const precos = await precosDoEvento(eventosIds[0]);
    for (const e of eventosIds.slice(1)) await precosDoEvento(e);

    // Carrega os itens de verdade (nunca confia em tipo/preço vindo do navegador)
    const catalogo = {};
    for (const e of eventosIds) {
      const snap = await db.collection(`eventos/${e}/itens`).get();
      catalogo[e] = Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
    }
    const linhas = new Map();
    const add = (e, it) => linhas.set(`${e}/${it.id}`, { chave: `${e}/${it.id}`, evento: e, id: it.id, tipo: it.tipo, titulo: it.titulo || "", previa: it.previa || "", original: it.original });

    const pacotesSrv = pacotes.map((p) => {
      if (!["foto", "video", "misto"].includes(p.tipo) || !["atleta", "time"].includes(p.escopo) || typeof p.valor !== "string") throw new Error("Pacote inválido");
      const ids = Object.values(catalogo[p.evento] || {}).filter((it) => it[p.escopo] === p.valor && (p.tipo === "misto" || it.tipo === p.tipo));
      if (!ids.length) throw new Error("Pacote vazio");
      ids.forEach((it) => add(p.evento, it));
      return { tipo: p.tipo, escopo: p.escopo, valor: p.valor, evento: p.evento, itens: ids.map((it) => `${p.evento}/${it.id}`), tipos: ids.map((it) => it.tipo) };
    });
    const soltos = itens.map((i) => {
      const it = catalogo[i.evento]?.[i.id];
      if (!it) throw new Error(`Item inexistente: ${i.evento}/${i.id}`);
      add(i.evento, it);
      return { id: `${i.evento}/${it.id}`, tipo: it.tipo };
    });

    const conta = Precos.calcular({ itens: soltos, pacotes: pacotesSrv }, precos);
    if (!(conta.total > 0)) return res.status(400).json({ erro: "Total inválido" });

    const token = crypto.randomBytes(24).toString("base64url");
    const ref = db.collection("pedidos").doc();
    const agora = admin.firestore.Timestamp.now();
    await ref.set({
      nome, email, linhas: [...linhas.values()], pacotes: pacotesSrv, total: conta.total,
      status: "pendente", tokenHash: hash(token), criadoEm: agora,
      expiraEm: admin.firestore.Timestamp.fromMillis(agora.toMillis() + DIAS_DOWNLOAD * 864e5),
    });

    const voltar = `${SITE_URL.value()}/loja.html?pedido=${ref.id}&t=${token}`;
    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN.value()}`, "Content-Type": "application/json", "X-Idempotency-Key": ref.id },
      body: JSON.stringify({
        items: [{ id: ref.id, title: `Estúdio Benfica · ${linhas.size} arquivo(s)`, quantity: 1, unit_price: conta.total, currency_id: "BRL" }],
        payer: { name: nome, email },
        external_reference: ref.id,
        notification_url: `${REGIAO_URL}/webhookMercadoPago`,
        back_urls: { success: voltar, pending: voltar, failure: voltar },
        auto_return: "approved",
        statement_descriptor: "ESTUDIOBENFICA",
        payment_methods: { installments: 6 },
      }),
    });
    const pref = await mp.json();
    if (!mp.ok) { logger.error("Mercado Pago recusou a preferência", pref); throw new Error("Mercado Pago indisponível"); }
    await ref.update({ mpPreferencia: pref.id });
    res.json({ checkout: pref.init_point, pedido: ref.id });
  } catch (e) {
    logger.warn("criarPagamento", e.message);
    res.status(400).json({ erro: e.message });
  }
});

/* ------------------------------------------------------------------ */
exports.webhookMercadoPago = onRequest({ secrets: [MP_ACCESS_TOKEN] }, async (req, res) => {
  try {
    const tipo = req.body?.type || req.query.type || req.query.topic;
    const id = req.body?.data?.id || req.query["data.id"] || req.query.id;
    if (tipo !== "payment" || !id) return res.status(200).send("ignorado");
    // Nunca confia no corpo do aviso: consulta o pagamento direto na API
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN.value()}` } });
    if (!r.ok) return res.status(200).send("pagamento não encontrado");
    const pg = await r.json();
    const ref = db.doc(`pedidos/${pg.external_reference}`);
    await db.runTransaction(async (tx) => {
      const p = await tx.get(ref);
      if (!p.exists || p.get("status") === "pago") return;
      const novo = pg.status === "approved" && Math.abs(pg.transaction_amount - p.get("total")) < 0.01 && pg.currency_id === "BRL" ? "pago"
        : ["rejected", "cancelled", "refunded", "charged_back"].includes(pg.status) ? "recusado" : "pendente";
      tx.update(ref, { status: novo, mpPagamento: String(pg.id), mpStatus: pg.status, meio: pg.payment_type_id || null, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
    });
    res.status(200).send("ok");
  } catch (e) {
    logger.error("webhook", e);
    res.status(500).send("erro");
  }
});

/* ------------------------------------------------------------------ */
async function pedidoAutorizado(req) {
  const { pedido, t } = req.query;
  if (typeof pedido !== "string" || typeof t !== "string" || !pedido || pedido.includes("/")) return null;
  const s = await db.doc(`pedidos/${pedido}`).get();
  if (!s.exists || !iguais(s.get("tokenHash"), hash(t))) return null;
  return s;
}

exports.statusPedido = onRequest(async (req, res) => {
  if (cors(req, res)) return;
  const s = await pedidoAutorizado(req);
  if (!s) return res.status(404).json({ erro: "Pedido não encontrado" });
  const pago = s.get("status") === "pago" && s.get("expiraEm").toMillis() > Date.now();
  res.json({
    status: s.get("status"), total: s.get("total"),
    itens: pago ? s.get("linhas").map(({ chave, tipo, titulo, previa }) => ({ chave, tipo, titulo, previa })) : [],
  });
});

exports.baixar = onRequest(async (req, res) => {
  const s = await pedidoAutorizado(req);
  if (!s || s.get("status") !== "pago") return res.status(403).send("Download não autorizado.");
  if (s.get("expiraEm").toMillis() < Date.now()) return res.status(410).send("O prazo de download deste pedido terminou. Fale com o Estúdio Benfica.");
  const linha = s.get("linhas").find((l) => l.chave === req.query.item);
  if (!linha || !linha.original) return res.status(404).send("Arquivo não encontrado.");
  const arquivo = admin.storage().bucket().file(linha.original);
  const [existe] = await arquivo.exists();
  if (!existe) return res.status(404).send("Arquivo não encontrado.");
  const [meta] = await arquivo.getMetadata();
  const nome = linha.original.split("/").pop();
  res.set("Content-Type", meta.contentType || "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename="${nome.replace(/"/g, "")}"`);
  if (meta.size) res.set("Content-Length", meta.size);
  arquivo.createReadStream().on("error", (e) => { logger.error(e); res.end(); }).pipe(res);
});
