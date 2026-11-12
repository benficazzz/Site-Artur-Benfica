/* =========================================================
   Loja · Estúdio Benfica
   - Modo demonstração: catálogo local (js/loja-demo.js)
   - Modo real: catálogo no Firestore + pagamento via Cloud Functions
   ========================================================= */
import { criarBancoFirebase, criarBancoTeste } from "./banco.js";
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const P = window.Precos;
const brl = P.brl;
const CFG = window.FIREBASE_CONFIG || {};
const API = window.LOJA_API;
const REAL = !!(CFG.apiKey && CFG.appId && window.LOJA_ATIVA && API);

let eventos = [];          // [{id, nome, data, local, capa, precos?, itens:[...]}]
let precosGlobais = {};
let demo = false;
let banco = null;           // Firestore (eventos criados no painel)
const TESTE = new URLSearchParams(location.search).has("teste");
let atual = null;          // evento aberto
const filtro = { time: "", atleta: "", tipo: "" };

/* ---------- Carrinho (guardado no navegador) ---------- */
const KEY = "eb-carrinho-v1";
let carrinho = { itens: [], pacotes: [] };
try { carrinho = JSON.parse(localStorage.getItem(KEY)) || carrinho; } catch {}
const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(carrinho)); } catch {} };

/* ---------- Dados ---------- */
async function carregar() {
  // 1) eventos criados no painel (Firestore)
  try {
    banco = TESTE ? criarBancoTeste() : CFG.apiKey ? await criarBancoFirebase(CFG) : null;
    if (banco) {
      const evs = await banco.listarEventosPublicos();
      if (evs.length) {
        eventos = evs.map((e) => ({ ...e, itens: null, fonte: "banco" })).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
        precosGlobais = (await banco.lerPrecos()) || {};
      }
    }
  } catch (err) { console.warn("Firestore indisponível, usando catálogo estático", err); }
  // 2) catálogo gerado a partir do Drive (ferramentas/sincronizar_loja.py)
  if (!eventos.length) try {
    const r = await fetch("data/catalogo.json", { cache: "no-cache" });
    if (r.ok) {
      const c = await r.json();
      eventos = c.eventos || [];
      precosGlobais = c.precos || {};
    }
  } catch {}
  // 3) sem catálogo: mostra a demonstração
  if (!eventos.length) { eventos = window.LOJA_DEMO; demo = true; }
  if (!REAL) {
    $("#aviso-demo").hidden = false;
    $("#car-pagar").textContent = "Enviar pedido pelo WhatsApp";
    $(".carrinho__seguro").textContent = "Você recebe a chave Pix pelo WhatsApp. Pagamento online com cartão em breve.";
  }
}

const precosDe = (ev) => P.mesclar(P.mesclar(P.PADRAO, precosGlobais), (ev && ev.precos) || {});
const fmtData = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- Tela: eventos ---------- */
function telaEventos() {
  mostrar("tela-eventos");
  const q = $("#busca-evento").value.trim().toLowerCase();
  const lista = eventos.filter((e) => !e.privado).filter((e) => !q || [e.nome, e.local, ...(e.times || [])].join(" ").toLowerCase().includes(q));
  $("#lista-eventos").innerHTML = lista.map((e) => `
    <a class="evento-card" href="#evento/${esc(e.id)}">
      <img src="${esc(e.capa)}" alt="" loading="lazy" decoding="async">
      <div class="evento-card__info">
        <span>${esc(fmtData(e.data))} · ${esc(e.local || "")}</span>
        <strong>${esc(e.nome)}</strong>
        <small>${contar(e, "foto")} fotos${contarVideos(e)}${e.times?.length ? " · " + esc(e.times.join(", ")) : ""}</small>
      </div>
    </a>`).join("");
  $("#eventos-vazio").hidden = lista.length > 0;
}
const contar = (e, tipo) => (e.itens ? e.itens.filter((i) => i.tipo === tipo).length : (e.contagem?.[tipo === "foto" ? "fotos" : "videos"] || 0));
const contarVideos = (e) => { const n = contar(e, "video"); return n ? ` · ${n} vídeos` : ""; };

/* ---------- Tela: evento ---------- */
async function abrirEvento(id) {
  atual = eventos.find((e) => e.id === id);
  // galeria privada: não aparece na lista, mas abre pelo link
  if (!atual && banco) {
    try { const ev = await banco.lerEvento(id); if (ev && ev.publico) { atual = { ...ev, itens: null, fonte: "banco" }; eventos.push(atual); } } catch {}
  }
  if (!atual) return (location.hash = "");
  if (!atual.itens) {
    mostrar("tela-evento");
    $("#ev-nome").textContent = atual.nome;
    $("#lista-itens").innerHTML = `<p class="loja__vazio">Carregando fotos…</p>`;
    const its = await banco.listarItens(atual.id);
    atual.itens = its.map((i) => ({ ...i, previa: i.thumb }));
  }
  filtro.time = filtro.atleta = filtro.tipo = "";
  mostrar("tela-evento");
  $("#ev-nome").textContent = atual.nome;
  $("#ev-meta").innerHTML = `<span class="dot"></span> ${esc(fmtData(atual.data))} · ${esc(atual.local || "")}`;
  const times = [...new Set(atual.itens.map((i) => i.time).filter(Boolean))];
  $("#f-time").innerHTML = `<option value="">Todos os times</option>` + times.map((t) => `<option>${esc(t)}</option>`).join("");
  $("#f-time").hidden = times.length < 1;
  atualizarAtletas();
  const temVideo = atual.itens.some((i) => i.tipo === "video");
  $$("#f-tipo button").forEach((b) => { b.classList.toggle("is-active", b.dataset.tipo === ""); b.hidden = !temVideo && b.dataset.tipo === "video"; });
  $("#f-tipo").hidden = !temVideo;
  renderEvento();
  window.scrollTo({ top: 0 });
}

function atualizarAtletas() {
  const atletas = [...new Set(atual.itens.filter((i) => !filtro.time || i.time === filtro.time).map((i) => i.atleta).filter(Boolean))];
  $("#f-atleta").innerHTML = `<option value="">Todos os atletas</option>` + atletas.map((a) => `<option>${esc(a)}</option>`).join("");
  $("#f-atleta").hidden = atletas.length < 1;
  if (!atletas.includes(filtro.atleta)) filtro.atleta = "";
}

const visiveis = () => atual.itens.filter((i) =>
  (!filtro.time || i.time === filtro.time) && (!filtro.atleta || i.atleta === filtro.atleta) && (!filtro.tipo || i.tipo === filtro.tipo));

function renderEvento() {
  const lista = visiveis();
  const cobertos = idsCobertos();
  const sel = new Set(carrinho.itens.map((i) => i.id));
  $("#ev-contagem").textContent = `${lista.length} ${lista.length === 1 ? "item" : "itens"}`;
  $("#lista-itens").innerHTML = lista.map((i) => `
    <figure class="item ${cobertos.has(i.id) ? "is-coberto" : sel.has(i.id) ? "is-sel" : ""}" data-id="${esc(i.id)}">
      ${i.tipo === "video" && !String(i.previa).startsWith("data:image")
        ? `<video src="${esc(i.previa)}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${esc(i.previa)}" alt="${esc(i.titulo || "")}" loading="lazy" decoding="async">`}
      <button class="item__sel" aria-label="Selecionar ${esc(i.titulo || "")}"></button>
      <button class="item__ver" aria-label="Ampliar">⤢</button>
      <span class="item__check" aria-hidden="true">✓</span>
      <figcaption class="item__info"><span>${esc(i.atleta || i.time || "")}</span><span class="item__tipo">${i.tipo === "video" ? "VÍDEO" : "FOTO"} · ${brl(precosDe(atual)[i.tipo].avulso)}</span></figcaption>
    </figure>`).join("");
  $$("#lista-itens video").forEach((v) => { v.addEventListener("mouseenter", () => v.play()); v.addEventListener("mouseleave", () => v.pause()); });
  renderPacotes();
}

/** Pacotes fechados conforme o filtro (time ou atleta). Só aparecem se saírem mais baratos. */
function renderPacotes() {
  const pr = precosDe(atual);
  const escopo = filtro.atleta ? "atleta" : filtro.time ? "time" : null;
  const box = $("#pacotes");
  const qtd = `<div class="pacote" style="cursor:default"><b>Pacotes por quantidade</b>
    <small>Fotos: ${pr.foto.pacotes.map((p) => `${p.qtd} por <em>${brl(p.preco)}</em>`).join(" · ")}</small>
    ${atual.itens.some((i) => i.tipo === "video") ? `<small>Vídeos: ${pr.video.pacotes.map((p) => `${p.qtd} por <em>${brl(p.preco)}</em>`).join(" · ")}</small>` : ""}
    <small>O desconto entra sozinho no carrinho.</small></div>`;
  if (!escopo) {
    box.innerHTML = qtd + (atual.times?.length || atual.itens.some((i) => i.time)
      ? `<div class="pacote" style="cursor:default"><b>Tudo do seu time ou atleta</b><small>Escolha um time ou atleta no filtro acima para ver os pacotes completos.</small></div>` : "");
    return;
  }
  const valor = escopo === "atleta" ? filtro.atleta : filtro.time;
  const doEscopo = atual.itens.filter((i) => i[escopo] === valor);
  const tipos = ["foto", "video"].filter((t) => doEscopo.some((i) => i.tipo === t));
  if (tipos.length === 2) tipos.push("misto");
  const nomes = { foto: "Todas as fotos", video: "Todos os vídeos", misto: "Fotos + vídeos" };
  const cards = tipos.map((tipo) => {
    const itens = doEscopo.filter((i) => tipo === "misto" || i.tipo === tipo);
    const preco = pr.escopo[`${tipo}:${escopo}`];
    const separado = P.calcular({ itens: itens.map((i) => ({ id: i.id, tipo: i.tipo })) }, pr).total;
    if (!preco || preco >= separado) return "";
    const ativo = carrinho.pacotes.some((p) => p.evento === atual.id && p.tipo === tipo && p.escopo === escopo && p.valor === valor);
    return `<button class="pacote ${ativo ? "is-on" : ""}" data-tipo="${tipo}">
      <b>${nomes[tipo]} ${escopo === "atleta" ? "do atleta" : "do time"}</b>
      <small>${esc(valor)} · ${itens.length} ${itens.length === 1 ? "item" : "itens"}</small>
      <small><em>${brl(preco)}</em> &nbsp;<s>${brl(separado)}</s></small>
      <small>${ativo ? "✓ No carrinho · toque para remover" : "Toque para adicionar"}</small>
    </button>`;
  }).join("");
  box.innerHTML = qtd + cards;
  $$("#pacotes button.pacote").forEach((b) => b.addEventListener("click", () => alternarPacote(b.dataset.tipo, escopo, valor, pr)));
}

function alternarPacote(tipo, escopo, valor, pr) {
  const i = carrinho.pacotes.findIndex((p) => p.evento === atual.id && p.tipo === tipo && p.escopo === escopo && p.valor === valor);
  if (i >= 0) carrinho.pacotes.splice(i, 1);
  else {
    const sel = atual.itens.filter((it) => it[escopo] === valor && (tipo === "misto" || it.tipo === tipo));
    const itens = sel.map((it) => it.id), tipos = sel.map((it) => it.tipo);
    // um pacote maior substitui pacotes menores do mesmo escopo
    carrinho.pacotes = carrinho.pacotes.filter((p) => !(p.evento === atual.id && p.itens.every((x) => itens.includes(x))));
    carrinho.pacotes.push({ evento: atual.id, tipo, escopo, valor, itens, tipos, preco: pr.escopo[`${tipo}:${escopo}`],
      rotulo: `${{ foto: "Todas as fotos", video: "Todos os vídeos", misto: "Fotos + vídeos" }[tipo]} · ${valor}`, capa: atual.itens.find((x) => x.id === itens[0])?.previa });
  }
  salvar(); renderEvento(); renderCarrinho();
}

const idsCobertos = () => new Set(carrinho.pacotes.flatMap((p) => p.itens));

function alternarItem(id) {
  if (idsCobertos().has(id)) return;
  const i = carrinho.itens.findIndex((x) => x.id === id);
  if (i >= 0) carrinho.itens.splice(i, 1);
  else { const it = atual.itens.find((x) => x.id === id); carrinho.itens.push({ id, tipo: it.tipo, evento: atual.id, previa: it.previa, titulo: it.titulo || atual.nome }); }
  salvar(); renderEvento(); renderCarrinho();
}

/* ---------- Carrinho ---------- */
function resumo() {
  const ev = eventos.find((e) => e.id === (carrinho.itens[0]?.evento || carrinho.pacotes[0]?.evento));
  return P.calcular({ itens: carrinho.itens, pacotes: carrinho.pacotes.map((p) => ({ ...p })) }, precosDe(ev));
}

function renderCarrinho() {
  const n = carrinho.itens.length + carrinho.pacotes.length;
  $("#barra").hidden = n === 0;
  if (!n) { fecharCarrinho(); return; }
  const r = resumo();
  const partes = [];
  if (carrinho.itens.filter((i) => i.tipo === "foto").length) partes.push(`${carrinho.itens.filter((i) => i.tipo === "foto").length} foto(s)`);
  if (carrinho.itens.filter((i) => i.tipo === "video").length) partes.push(`${carrinho.itens.filter((i) => i.tipo === "video").length} vídeo(s)`);
  if (carrinho.pacotes.length) partes.push(`${carrinho.pacotes.length} pacote(s)`);
  $("#barra-qtd").textContent = partes.join(" · ");
  $("#barra-eco").textContent = r.economia > 0 ? `Você economiza ${brl(r.economia)}` : "";
  $("#barra-total").textContent = brl(r.total);

  const cob = idsCobertos();
  $("#car-lista").innerHTML =
    carrinho.pacotes.map((p, k) => `<div class="car-linha"><span class="pk">${p.itens.length}</span><div><b>${esc(p.rotulo)}</b><small>Pacote fechado</small></div><button data-pk="${k}" aria-label="Remover">×</button></div>`).join("") +
    carrinho.itens.filter((i) => !cob.has(i.id)).map((i) => `<div class="car-linha"><img src="${esc(i.previa)}" alt=""><div><b>${esc(i.titulo)}</b><small>${i.tipo === "video" ? "Vídeo" : "Foto"}</small></div><button data-it="${esc(i.id)}" aria-label="Remover">×</button></div>`).join("");
  $$("#car-lista [data-pk]").forEach((b) => b.addEventListener("click", () => { carrinho.pacotes.splice(+b.dataset.pk, 1); salvar(); renderCarrinho(); atual && renderEvento(); }));
  $$("#car-lista [data-it]").forEach((b) => b.addEventListener("click", () => { carrinho.itens = carrinho.itens.filter((x) => x.id !== b.dataset.it); salvar(); renderCarrinho(); atual && renderEvento(); }));

  $("#car-dica").hidden = !r.dica; $("#car-dica").textContent = r.dica ? "💡 " + r.dica : "";
  const linhas = [];
  r.pacotes.forEach((p) => linhas.push([p.rotulo, brl(p.preco)]));
  if (r.fotos.qtd) linhas.push([`${r.fotos.qtd} foto(s) · ${r.fotos.combinacao.map((c) => c.vezes > 1 ? `${c.vezes}× ${c.nome}` : c.nome).join(" + ")}`, brl(r.fotos.total)]);
  if (r.videos.qtd) linhas.push([`${r.videos.qtd} vídeo(s) · ${r.videos.combinacao.map((c) => c.vezes > 1 ? `${c.vezes}× ${c.nome}` : c.nome).join(" + ")}`, brl(r.videos.total)]);
  $("#car-resumo").innerHTML = linhas.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${b}</dd>`).join("") +
    (r.economia > 0 ? `<dt class="eco">Desconto de pacote</dt><dd class="eco">− ${brl(r.economia)}</dd>` : "") +
    `<dt class="tot">Total</dt><dd class="tot">${brl(r.total)}</dd>`;
}

const abrirCarrinho = () => { $("#carrinho").classList.add("is-open"); $("#carrinho").setAttribute("aria-hidden", "false"); };
const fecharCarrinho = () => { $("#carrinho").classList.remove("is-open"); $("#carrinho").setAttribute("aria-hidden", "true"); };

async function pagar(e) {
  e.preventDefault();
  const msg = $("#car-msg"), nome = $("#c-nome").value.trim(), email = $("#c-email").value.trim();
  if (!nome || !/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = "Preencha seu nome e um e-mail válido."; return; }
  if (!REAL) {
    // Pré-lançamento: o pedido vai pelo WhatsApp e o Pix é combinado direto
    if (demo) { msg.textContent = "Estes são eventos de demonstração. Os eventos reais entram em breve."; return; }
    const r = resumo(), cob = idsCobertos();
    const nomeEv = (id) => eventos.find((x) => x.id === id)?.nome || id;
    const linhas = [
      ...carrinho.pacotes.map((p) => `• ${p.rotulo} (${nomeEv(p.evento)})`),
      ...carrinho.itens.filter((i) => !cob.has(i.id)).map((i) => `• ${i.tipo === "video" ? "Vídeo" : "Foto"} ${i.titulo} (${nomeEv(i.evento)})`),
    ];
    const wa = (window.SITE_CONFIG || {}).whatsapp;
    if (!wa) { msg.textContent = "WhatsApp não configurado."; return; }
    const janela = window.open("", "_blank"); // abre já no clique para o navegador não bloquear
    let codigo = "";
    if (banco && eventos.some((e) => e.fonte === "banco")) {
      try {
        codigo = await banco.criarPedido({
          nome: nome.slice(0, 120), email: email.slice(0, 200), total: r.total, origem: "whatsapp",
          itens: carrinho.itens.filter((i) => !cob.has(i.id)).slice(0, 300).map((i) => ({ evento: i.evento, id: i.id, tipo: i.tipo, titulo: String(i.titulo || "").slice(0, 120), eventoNome: nomeEv(i.evento) })),
          pacotes: carrinho.pacotes.slice(0, 20).map((p) => ({ evento: p.evento, rotulo: p.rotulo, itens: p.itens.slice(0, 300) })),
        });
      } catch (err) { console.warn("Pedido não registrado", err); }
    }
    const texto = `Olá, Artur! Quero comprar pela loja do site:\n\n${linhas.join("\n")}\n\nTotal: ${brl(r.total)}\nNome: ${nome}\nE-mail: ${email}${codigo ? `\nPedido: ${codigo.slice(0, 8).toUpperCase()}` : ""}`;
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`;
    if (janela) janela.location.href = url; else location.href = url;
    msg.textContent = "Pedido aberto no WhatsApp. É só enviar a mensagem!";
    return;
  }
  if (demo) { msg.textContent = "Estes são eventos de demonstração. Os eventos reais entram em breve."; return; }
  const btn = $("#car-pagar"); btn.disabled = true; msg.textContent = "Gerando pagamento seguro…";
  try {
    const res = await fetch(`${API}/criarPagamento`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email,
        itens: carrinho.itens.map((i) => ({ evento: i.evento, id: i.id })),
        pacotes: carrinho.pacotes.map((p) => ({ evento: p.evento, tipo: p.tipo, escopo: p.escopo, valor: p.valor })) }),
    });
    const d = await res.json();
    if (!res.ok || !d.checkout) throw new Error(d.erro || "Falha ao criar pagamento");
    carrinho = { itens: [], pacotes: [] }; salvar();
    location.href = d.checkout;
  } catch (err) {
    msg.textContent = "Não foi possível iniciar o pagamento. Tente novamente ou fale comigo no WhatsApp.";
    btn.disabled = false; console.error(err);
  }
}

/* ---------- Tela: pedido (volta do Mercado Pago) ---------- */
async function telaPedido(pedido, token, tentativa = 0) {
  mostrar("tela-pedido");
  $("#barra").hidden = true;
  if (!REAL) { $("#ped-titulo").textContent = "Pedido de demonstração"; return; }
  try {
    const r = await fetch(`${API}/statusPedido?pedido=${encodeURIComponent(pedido)}&t=${encodeURIComponent(token)}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro);
    if (d.status === "pago") {
      $("#ped-titulo").innerHTML = `Pagamento <em class="accent">aprovado!</em>`;
      $("#ped-texto").innerHTML = `Obrigado! Baixe seus arquivos abaixo. Este link vale por 30 dias. Para acessar quando quiser, <a class="loja__link" href="conta.html">entre em Minha conta</a> com o mesmo e-mail da compra.`;
      $("#ped-downloads").innerHTML = d.itens.map((i) => `<div class="download">${i.previa ? `<img src="${esc(i.previa)}" alt="" loading="lazy">` : ""}<b>${esc(i.titulo || "")}</b>
        <a class="btn btn--lime btn--small" href="${API}/baixar?pedido=${encodeURIComponent(pedido)}&t=${encodeURIComponent(token)}&item=${encodeURIComponent(i.chave)}">Baixar ${i.tipo === "video" ? "vídeo" : "foto"}</a></div>`).join("");
    } else if (d.status === "recusado") {
      $("#ped-titulo").textContent = "Pagamento não aprovado";
      $("#ped-texto").textContent = "O pagamento foi recusado ou cancelado. Você pode tentar de novo pela loja.";
    } else {
      $("#ped-titulo").textContent = "Aguardando confirmação do pagamento…";
      $("#ped-texto").textContent = "Pix costuma confirmar em segundos. Esta página atualiza sozinha.";
      if (tentativa < 40) setTimeout(() => telaPedido(pedido, token, tentativa + 1), 6000);
    }
  } catch {
    $("#ped-titulo").textContent = "Não encontramos este pedido";
    $("#ped-texto").textContent = "Confira o link ou fale comigo no WhatsApp.";
  }
}

/* ---------- Navegação ---------- */
function mostrar(id) { ["tela-eventos", "tela-evento", "tela-pedido"].forEach((t) => ($("#" + t).hidden = t !== id)); }
function rota() {
  const q = new URLSearchParams(location.search);
  if (q.get("pedido")) return telaPedido(q.get("pedido"), q.get("t") || "");
  const m = location.hash.match(/^#evento\/(.+)$/);
  if (m) abrirEvento(decodeURIComponent(m[1])); else { atual = null; telaEventos(); }
}

/* ---------- Visualizar ---------- */
async function ampliar(id) {
  const it = atual.itens.find((x) => x.id === id);
  let src = it.previa;
  if (atual.fonte === "banco" && it.temPrevia) {
    $("#lb-stage").innerHTML = `<p class="loja__vazio">Carregando…</p>`;
    $("#lb").classList.add("is-open");
    try { src = (it.previaGrande ||= await banco.lerPrevia(id)) || it.previa; } catch {}
  }
  const ehVideo = it.tipo === "video" && !String(src).startsWith("data:image");
  $("#lb-stage").innerHTML = ehVideo ? `<video src="${esc(src)}" controls autoplay muted loop playsinline style="max-width:100%;max-height:100%"></video>` : `<img src="${esc(src)}" alt="">`;
  $("#lb-cap").textContent = [it.titulo, it.atleta, it.time].filter(Boolean).join(" · ");
  $("#lb").classList.add("is-open"); $("#lb").setAttribute("aria-hidden", "false");
}
const fecharLb = () => { $("#lb").classList.remove("is-open"); $("#lb").setAttribute("aria-hidden", "true"); $("#lb-stage").innerHTML = ""; };

/* ---------- Eventos da página ---------- */
$("#busca-evento").addEventListener("input", telaEventos);
$("#voltar-eventos").addEventListener("click", () => (location.hash = ""));
$("#f-time").addEventListener("change", (e) => { filtro.time = e.target.value; atualizarAtletas(); renderEvento(); });
$("#f-atleta").addEventListener("change", (e) => { filtro.atleta = e.target.value; renderEvento(); });
$$("#f-tipo button").forEach((b) => b.addEventListener("click", () => { filtro.tipo = b.dataset.tipo; $$("#f-tipo button").forEach((x) => x.classList.toggle("is-active", x === b)); renderEvento(); }));
$("#sel-todos").addEventListener("click", () => {
  const cob = idsCobertos(), ja = new Set(carrinho.itens.map((i) => i.id));
  visiveis().forEach((it) => { if (!cob.has(it.id) && !ja.has(it.id)) carrinho.itens.push({ id: it.id, tipo: it.tipo, evento: atual.id, previa: it.previa, titulo: it.titulo || atual.nome }); });
  salvar(); renderEvento(); renderCarrinho();
});
$("#lista-itens").addEventListener("click", (e) => {
  const fig = e.target.closest(".item"); if (!fig) return;
  if (e.target.closest(".item__ver")) ampliar(fig.dataset.id); else alternarItem(fig.dataset.id);
});
$("#abrir-carrinho").addEventListener("click", abrirCarrinho);
$("#fechar-carrinho").addEventListener("click", fecharCarrinho);
$("#carrinho").addEventListener("click", (e) => { if (e.target.id === "carrinho") fecharCarrinho(); });
$("#car-form").addEventListener("submit", pagar);
$("#lb-fechar").addEventListener("click", fecharLb);
$("#lb").addEventListener("click", (e) => { if (e.target.id === "lb") fecharLb(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { fecharLb(); fecharCarrinho(); } });
window.addEventListener("hashchange", rota);

carregar().then(() => { rota(); renderCarrinho(); }).catch((err) => {
  console.error(err);
  $("#lista-eventos").innerHTML = `<p class="loja__vazio">Não foi possível carregar a loja agora. Tente de novo em instantes.</p>`;
});
