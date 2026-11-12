/* =========================================================
   Painel do Estúdio Benfica
   ?teste=1  → modo de teste (dados só no navegador)
   ========================================================= */
import { criarBancoFirebase, criarBancoTeste, novoId, slug } from "./banco.js";
import { prepararFonte, previaFoto, previaVideo } from "./marca.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const P = window.Precos;
const brl = P.brl;
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TESTE = new URLSearchParams(location.search).has("teste");
const SITE = location.href.replace(/admin\.html.*$/, "");
const LOJA = (id) => `${SITE}loja.html${TESTE ? "?teste=1" : ""}#evento/${id}`;

let banco, eventos = [], atual = null, itens = [], selecionados = new Set(), pedidos = [], filtroPedido = "";

/* ---------- Diálogo simples ---------- */
function perguntar(titulo, html, { ok = "OK", cancelar = "Cancelar" } = {}) {
  const d = $("#dialogo");
  $("#dlg-titulo").textContent = titulo;
  $("#dlg-corpo").innerHTML = html;
  $("#dlg-ok").textContent = ok;
  $("#dlg-cancelar").hidden = !cancelar;
  $("#dlg-cancelar").textContent = cancelar || "";
  d.showModal();
  return new Promise((r) => d.addEventListener("close", () => r(d.returnValue === "ok"), { once: true }));
}
const aviso = (t, h) => perguntar(t, h, { cancelar: null });

/* ---------- Início ---------- */
async function iniciar() {
  $("#faixa-teste").hidden = !TESTE;
  try {
    banco = TESTE ? criarBancoTeste() : await criarBancoFirebase(window.FIREBASE_CONFIG);
  } catch (e) {
    $("#tela-login").hidden = false;
    $("#login-msg").textContent = "Não foi possível carregar o Firebase. Verifique a conexão.";
    console.error(e);
    return;
  }
  prepararFonte();
  banco.aoMudarLogin(async (u) => {
    const dentro = !!(u && u.admin);
    $("#tela-login").hidden = dentro;
    $("#abas").hidden = $("#usuario").hidden = !dentro;
    if (u && !u.admin) $("#login-msg").textContent = `A conta ${u.email} não tem acesso ao painel.`;
    if (!dentro) { $$(".adm-aba").forEach((a) => (a.hidden = true)); return; }
    $("#u-nome").textContent = u.nome || u.email;
    try { precosGerais = await banco.lerPrecos(); } catch {}
    abrirAba(location.hash.replace("#", "") || "eventos");
    await carregarEventos();
    carregarPedidos(true);
  });
}

$("#entrar").addEventListener("click", async () => {
  $("#login-msg").textContent = "";
  try { await banco.entrar(); }
  catch (e) { $("#login-msg").textContent = e.code === "auth/popup-blocked" ? "O navegador bloqueou a janela de login. Libere pop-ups para este site." : "Não foi possível entrar. Tente de novo."; console.error(e); }
});
$("#sair").addEventListener("click", () => banco.sair());

function abrirAba(nome) {
  if (!["eventos", "precos", "pedidos"].includes(nome)) nome = "eventos";
  $$("#abas button").forEach((b) => b.classList.toggle("is-active", b.dataset.aba === nome));
  $$(".adm-aba").forEach((a) => (a.hidden = a.id !== "aba-" + nome));
  history.replaceState(null, "", location.pathname + location.search + "#" + nome);
  if (nome === "precos") carregarPrecos();
  if (nome === "pedidos") carregarPedidos();
}
$$("#abas button").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));

/* =========================================================
   EVENTOS
   ========================================================= */
async function carregarEventos() {
  eventos = await banco.listarEventos();
  renderListaEventos();
}

function estadoEvento(e) { return !e.publico ? "oculto" : e.privado ? "privado" : "publico"; }
const ROTULO = { publico: "Publicado", privado: "Privado", oculto: "Oculto" };

function renderListaEventos() {
  $("#lista-eventos").innerHTML = eventos.length ? eventos.map((e) => `
    <button class="adm-ev ${atual?.id === e.id ? "is-active" : ""}" data-id="${esc(e.id)}">
      ${e.capa ? `<img src="${esc(e.capa)}" alt="">` : `<span class="adm-ev__sem">sem foto</span>`}
      <span><b>${esc(e.nome)}</b><small>${esc(e.data || "")} · ${(e.contagem?.fotos || 0)} fotos · ${(e.contagem?.videos || 0)} vídeos</small>
      <em class="adm-chip adm-chip--${estadoEvento(e)}">${ROTULO[estadoEvento(e)]}</em></span>
    </button>`).join("") : `<p class="adm-nota">Nenhum evento ainda.</p>`;
}
$("#lista-eventos").addEventListener("click", (e) => { const b = e.target.closest(".adm-ev"); if (b) abrirEvento(b.dataset.id); });

const CAMPOS_ESCOPO = [["foto:atleta", "Todas as fotos do atleta"], ["video:atleta", "Todos os vídeos do atleta"], ["misto:atleta", "Fotos + vídeos do atleta"],
  ["foto:time", "Todas as fotos do time"], ["video:time", "Todos os vídeos do time"], ["misto:time", "Fotos + vídeos do time"]];

function novoEvento() {
  atual = null; itens = []; selecionados.clear();
  preencherForm({ nome: "", data: new Date().toISOString().slice(0, 10), local: "", times: [], publico: false, privado: false, precos: {} });
  $("#ev-titulo").textContent = "Novo evento";
  $("#apagar-evento").hidden = $("#ev-ver").hidden = true;
  $("#bloco-envio").hidden = $("#bloco-itens").hidden = true;
  $("#ev-vazio").hidden = true; $("#ev-editor").hidden = false;
  renderListaEventos();
  $("#form-evento [name=nome]").focus();
}
$("#novo-evento").addEventListener("click", novoEvento);

function preencherForm(ev) {
  const f = $("#form-evento");
  f.nome.value = ev.nome || ""; f.data.value = ev.data || ""; f.local.value = ev.local || "";
  f.times.value = (ev.times || []).join(", ");
  f.querySelector(`[name=visib][value=${ev.id ? estadoEvento(ev) : "oculto"}]`).checked = true;
  const pr = P.mesclar(P.PADRAO, precosGerais || {});
  $("#precos-evento").innerHTML = CAMPOS_ESCOPO.map(([k, r]) => `<label class="adm-campo">${r}<input type="number" step="0.01" min="0" data-escopo="${k}" value="${ev.precos?.escopo?.[k] ?? ""}" placeholder="${pr.escopo[k]}"></label>`).join("");
  atualizarLinkPrivado(ev);
}

function atualizarLinkPrivado(ev) {
  const privado = $("#form-evento [name=visib][value=privado]").checked;
  $("#link-privado").hidden = !(privado && ev?.id);
  if (ev?.id) $("#link-privado-url").textContent = LOJA(ev.id);
}
$$("#form-evento [name=visib]").forEach((r) => r.addEventListener("change", () => atualizarLinkPrivado(atual)));
$("#copiar-link").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#link-privado-url").textContent); $("#copiar-link").textContent = "Copiado!"; } catch {} });

async function abrirEvento(id) {
  atual = eventos.find((e) => e.id === id);
  if (!atual) return;
  selecionados.clear();
  preencherForm(atual);
  $("#ev-titulo").textContent = atual.nome;
  $("#apagar-evento").hidden = false;
  $("#ev-ver").hidden = false; $("#ev-ver").href = LOJA(atual.id);
  $("#ev-vazio").hidden = true; $("#ev-editor").hidden = false;
  $("#bloco-envio").hidden = $("#bloco-itens").hidden = false;
  renderListaEventos();
  atualizarSelectsTime();
  $("#itens").innerHTML = `<p class="adm-nota">Carregando…</p>`;
  itens = await banco.listarItens(id);
  renderItens();
}

function atualizarSelectsTime() {
  const times = atual?.times || [];
  const op = times.map((t) => `<option>${esc(t)}</option>`).join("");
  $("#up-time").innerHTML = `<option value="">(sem time)</option>` + op;
  $("#sel-time").innerHTML = `<option value="">Definir time…</option><option value="__nenhum">(sem time)</option>` + op;
  $("#it-filtro").innerHTML = `<option value="">Todos os times</option>` + op;
  const atletas = [...new Set(itens.map((i) => i.atleta).filter(Boolean))];
  $("#atletas-lista").innerHTML = atletas.map((a) => `<option value="${esc(a)}">`).join("");
}

$("#form-evento").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, msg = $("#ev-msg");
  const visib = f.querySelector("[name=visib]:checked").value;
  const escopo = {};
  $$("#precos-evento input").forEach((i) => { if (i.value !== "") escopo[i.dataset.escopo] = Math.max(0, +i.value); });
  const ev = {
    id: atual?.id || (visib === "privado" ? `${slug(f.nome.value).slice(0, 30)}-${novoId(12)}` : `${f.data.value}-${slug(f.nome.value).slice(0, 40)}-${novoId(4)}`),
    nome: f.nome.value.trim(), data: f.data.value, local: f.local.value.trim(),
    times: [...new Set(f.times.value.split(",").map((t) => t.trim()).filter(Boolean))],
    publico: visib !== "oculto", privado: visib === "privado",
    precos: Object.keys(escopo).length ? { escopo } : {},
    contagem: atual?.contagem || { fotos: 0, videos: 0 }, capa: atual?.capa || "",
  };
  if (!ev.nome || !ev.data) { msg.textContent = "Preencha nome e data."; return; }
  msg.textContent = "Salvando…";
  try {
    await banco.salvarEvento(ev);
    await carregarEventos();
    msg.textContent = "Salvo ✓";
    setTimeout(() => (msg.textContent = ""), 2500);
    await abrirEvento(ev.id);
  } catch (err) { msg.textContent = "Erro ao salvar: " + err.message; console.error(err); }
});

$("#apagar-evento").addEventListener("click", async () => {
  if (!atual) return;
  const ok = await perguntar("Excluir evento?", `<p>O evento <b>${esc(atual.nome)}</b> e os ${itens.length} arquivos dele saem da loja.</p><p class="adm-nota">Os originais continuam no seu Google Drive.</p>`, { ok: "Excluir" });
  if (!ok) return;
  await banco.apagarEvento(atual.id);
  atual = null; $("#ev-editor").hidden = true; $("#ev-vazio").hidden = false;
  await carregarEventos();
});

/* ---------- Envio de arquivos ---------- */
const drop = $("#drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
drop.addEventListener("drop", (e) => enviar([...e.dataTransfer.files]));
$("#up-arquivos").addEventListener("change", (e) => { enviar([...e.target.files]); e.target.value = ""; });

let enviando = false;
async function enviar(arquivos) {
  if (!atual || !arquivos.length) return;
  if (enviando) return aviso("Aguarde", "<p>Ainda estou enviando o lote anterior.</p>");
  const validos = arquivos.filter((f) => /^image\/|^video\//.test(f.type));
  if (!validos.length) return aviso("Formato não suportado", "<p>Envie fotos (JPG, PNG) ou vídeos (MP4, MOV).</p>");
  // pede a autorização do Drive já no clique (o navegador bloqueia pop-ups depois de esperas)
  try { await banco.prepararDrive(); } catch (e) { return aviso("Sem acesso ao Google Drive", `<p>Autorize o acesso ao Drive para enviar os originais.</p><p class="adm-nota">${esc(e.message)}</p>`); }
  enviando = true;
  const time = $("#up-time").value, atleta = $("#up-atleta").value.trim();
  const ev = atual;
  const fila = $("#fila");
  const linhas = validos.map((f) => {
    const el = document.createElement("div");
    el.className = "adm-fila__item";
    el.innerHTML = `<span>${esc(f.name)}</span><i><b style="width:0%"></b></i><small>aguardando</small>`;
    fila.prepend(el);
    return el;
  });
  let ordem = itens.reduce((m, i) => Math.max(m, i.ordem || 0), 0);
  for (let k = 0; k < validos.length; k++) {
    const f = validos[k], el = linhas[k], barra = el.querySelector("b"), st = el.querySelector("small");
    const passo = (txt, p) => { st.textContent = txt; barra.style.width = `${Math.round(p * 100)}%`; };
    try {
      const video = f.type.startsWith("video/");
      passo("gerando prévia…", 0.05);
      const pv = video ? await previaVideo(f, (p) => passo("gerando prévia…", 0.05 + p * 0.3)) : await previaFoto(f);
      passo("enviando original ao Drive…", 0.35);
      const drv = await banco.enviarOriginal(f, `${ev.data} · ${ev.nome}`, (p) => passo("enviando original ao Drive…", 0.35 + p * 0.6));
      const item = { tipo: video ? "video" : "foto", thumb: pv.thumb, temPrevia: !!pv.previa, time: time || null, atleta: atleta || null,
        titulo: f.name.replace(/\.[^.]+$/, ""), ordem: ++ordem };
      const id = await banco.criarItem(ev.id, item, pv.previa, { driveId: drv.id, nome: f.name, mime: f.type, tamanho: f.size });
      itens.push({ ...item, id });
      passo("pronto ✓", 1); el.classList.add("is-ok");
    } catch (err) {
      passo("erro: " + err.message, 1); el.classList.add("is-erro"); console.error(err);
    }
  }
  enviando = false;
  await atualizarResumoEvento();
  renderItens();
}

/** Recalcula capa, contagem e times do evento depois de mudanças. */
async function atualizarResumoEvento() {
  if (!atual) return;
  const fotos = itens.filter((i) => i.tipo === "foto"), videos = itens.filter((i) => i.tipo === "video");
  const capa = (fotos[0] || videos[0])?.thumb || "";
  const times = [...new Set([...(atual.times || []), ...itens.map((i) => i.time).filter(Boolean)])];
  Object.assign(atual, { contagem: { fotos: fotos.length, videos: videos.length }, capa, times });
  await banco.salvarEvento({ id: atual.id, contagem: atual.contagem, capa, times });
  renderListaEventos();
  atualizarSelectsTime();
}

/* ---------- Grade de itens ---------- */
function renderItens() {
  const f = $("#it-filtro").value;
  const lista = itens.filter((i) => !f || i.time === f);
  $("#it-contagem").textContent = `· ${itens.filter((i) => i.tipo === "foto").length} fotos · ${itens.filter((i) => i.tipo === "video").length} vídeos`;
  $("#itens").innerHTML = lista.length ? lista.map((i) => `
    <figure class="adm-item ${selecionados.has(i.id) ? "is-sel" : ""}" data-id="${esc(i.id)}">
      <img src="${esc(i.thumb)}" alt="" loading="lazy">
      ${i.tipo === "video" ? `<span class="adm-item__play">▶</span>` : ""}
      <span class="adm-item__check">✓</span>
      <figcaption><b>${esc(i.time || "sem time")}</b>${i.atleta ? `<small>${esc(i.atleta)}</small>` : ""}</figcaption>
    </figure>`).join("") : `<p class="adm-nota">Nenhum arquivo ainda. Use a área acima para enviar.</p>`;
  $("#barra-sel").hidden = selecionados.size === 0;
  $("#sel-qtd").textContent = `${selecionados.size} selecionado(s)`;
}
$("#it-filtro").addEventListener("change", renderItens);
$("#itens").addEventListener("click", (e) => {
  const fig = e.target.closest(".adm-item"); if (!fig) return;
  const id = fig.dataset.id;
  selecionados.has(id) ? selecionados.delete(id) : selecionados.add(id);
  renderItens();
});
$("#sel-limpar").addEventListener("click", () => { selecionados.clear(); renderItens(); });
$("#sel-aplicar").addEventListener("click", async () => {
  const patch = {};
  const t = $("#sel-time").value, a = $("#sel-atleta").value.trim();
  if (t) patch.time = t === "__nenhum" ? null : t;
  if (a) patch.atleta = a === "-" ? null : a;
  if (!Object.keys(patch).length) return aviso("Nada para aplicar", "<p>Escolha um time ou digite um atleta. Para remover o atleta, digite um traço (-).</p>");
  const ids = [...selecionados];
  await banco.atualizarItens(atual.id, ids, patch);
  itens.forEach((i) => ids.includes(i.id) && Object.assign(i, patch));
  selecionados.clear(); $("#sel-atleta").value = ""; $("#sel-time").value = "";
  await atualizarResumoEvento(); renderItens();
});
$("#sel-apagar").addEventListener("click", async () => {
  const ids = [...selecionados];
  if (!(await perguntar("Apagar arquivos?", `<p>${ids.length} arquivo(s) saem da loja.</p><p class="adm-nota">Os originais continuam no seu Google Drive.</p>`, { ok: "Apagar" }))) return;
  await banco.apagarItens(atual.id, ids);
  itens = itens.filter((i) => !ids.includes(i.id));
  selecionados.clear();
  await atualizarResumoEvento(); renderItens();
});

/* =========================================================
   PREÇOS
   ========================================================= */
let precosGerais = null;
async function carregarPrecos() {
  precosGerais = await banco.lerPrecos();
  const p = P.mesclar(P.PADRAO, precosGerais || {});
  const f = $("#form-precos");
  f.foto_avulso.value = p.foto.avulso; f.video_avulso.value = p.video.avulso;
  ["foto", "video"].forEach((t) => ($(`.adm-pacotes[data-tipo=${t}]`).innerHTML = p[t].pacotes.map(linhaPacote).join("")));
  $("#precos-escopo").innerHTML = CAMPOS_ESCOPO.map(([k, r]) => `<label class="adm-campo">${r} (R$)<input type="number" step="0.01" min="0" data-escopo="${k}" value="${p.escopo[k] ?? ""}"></label>`).join("");
  exemploPrecos();
}
const linhaPacote = (pk = { qtd: "", preco: "" }) => `<div class="adm-pacote"><input type="number" min="2" step="1" data-k="qtd" value="${pk.qtd}" aria-label="Quantidade"><span>por R$</span><input type="number" min="0" step="0.01" data-k="preco" value="${pk.preco}" aria-label="Preço"><button type="button" aria-label="Remover">×</button></div>`;
$("#form-precos").addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) { $(`.adm-pacotes[data-tipo=${add.dataset.add}]`).insertAdjacentHTML("beforeend", linhaPacote()); return; }
  if (e.target.matches(".adm-pacote button")) { e.target.parentElement.remove(); exemploPrecos(); }
});
$("#form-precos").addEventListener("input", exemploPrecos);

function lerFormPrecos() {
  const f = $("#form-precos");
  const pac = (t) => $$(`.adm-pacotes[data-tipo=${t}] .adm-pacote`).map((l) => ({ qtd: +l.querySelector("[data-k=qtd]").value, preco: +l.querySelector("[data-k=preco]").value }))
    .filter((x) => x.qtd >= 2 && x.preco > 0).sort((a, b) => a.qtd - b.qtd);
  const escopo = {};
  $$("#precos-escopo input").forEach((i) => { if (i.value !== "") escopo[i.dataset.escopo] = +i.value; });
  return { foto: { avulso: +f.foto_avulso.value || 0, pacotes: pac("foto") }, video: { avulso: +f.video_avulso.value || 0, pacotes: pac("video") }, escopo };
}
function exemploPrecos() {
  const p = lerFormPrecos();
  const ex = [3, 5, 7, 10, 15].map((n) => `${n} fotos = <b>${brl(P.custoQuantidade(n, p.foto).total)}</b>`).join(" · ");
  $("#exemplo-precos").innerHTML = `Exemplos: ${ex}`;
}
$("#form-precos").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#precos-msg");
  try { await banco.salvarPrecos(lerFormPrecos()); precosGerais = lerFormPrecos(); msg.textContent = "Preços salvos ✓"; }
  catch (err) { msg.textContent = "Erro: " + err.message; }
  setTimeout(() => (msg.textContent = ""), 3000);
});

/* =========================================================
   PEDIDOS
   ========================================================= */
const ST = { novo: "Novo", aguardando: "Aguardando pagamento", pago: "Pago", entregue: "Entregue", cancelado: "Cancelado" };
async function carregarPedidos(soBadge = false) {
  try { pedidos = await banco.listarPedidos(); } catch (e) { console.error(e); pedidos = []; }
  const novos = pedidos.filter((p) => p.status === "novo").length;
  $("#badge-pedidos").hidden = !novos; $("#badge-pedidos").textContent = novos;
  if (!soBadge) renderPedidos();
}
const quando = (t) => { const d = t?.toDate ? t.toDate() : t ? new Date(t) : null; return d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""; };
function renderPedidos() {
  const lista = pedidos.filter((p) => !filtroPedido || p.status === filtroPedido);
  $("#pedidos").innerHTML = lista.length ? lista.map((p) => `
    <article class="adm-card adm-pedido" data-id="${esc(p.id)}">
      <div class="adm-linha"><div><b>${esc(p.nome)}</b> <small>${esc(p.email)} · ${quando(p.criadoEm)}</small></div>
        <select data-status aria-label="Situação">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${p.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <ul>${(p.pacotes || []).map((k) => `<li>📦 ${esc(k.rotulo)} <small>(${(k.itens || []).length} arquivos)</small></li>`).join("")}
        ${(p.itens || []).map((i) => `<li>${i.tipo === "video" ? "🎬" : "📷"} ${esc(i.titulo)} <small>${esc(i.eventoNome || "")}</small></li>`).join("")}</ul>
      <div class="adm-linha"><b class="adm-total">${brl(p.total || 0)}</b>
        <button class="btn btn--small btn--lime" data-entregar>Gerar links de entrega</button></div>
      <div class="adm-entrega" hidden></div>
    </article>`).join("") : `<p class="adm-nota">Nenhum pedido ${filtroPedido ? "com essa situação" : "ainda"}.</p>`;
}
$$("#ped-filtro button").forEach((b) => b.addEventListener("click", () => { filtroPedido = b.dataset.st; $$("#ped-filtro button").forEach((x) => x.classList.toggle("is-active", x === b)); renderPedidos(); }));
$("#pedidos").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-status]")) return;
  const id = e.target.closest(".adm-pedido").dataset.id;
  await banco.atualizarPedido(id, { status: e.target.value });
  pedidos.find((p) => p.id === id).status = e.target.value;
  carregarPedidos(true);
});
$("#pedidos").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-entregar]"); if (!b) return;
  const card = b.closest(".adm-pedido"), p = pedidos.find((x) => x.id === card.dataset.id), box = card.querySelector(".adm-entrega");
  const ids = [...new Set([...(p.itens || []).map((i) => i.id), ...(p.pacotes || []).flatMap((k) => k.itens || [])])];
  if (p.status !== "pago" && p.status !== "entregue" && !(await perguntar("Pedido ainda não está como pago", "<p>Confirme que o Pix caiu antes de liberar os arquivos.</p>", { ok: "Já recebi, liberar" }))) return;
  b.disabled = true; b.textContent = "Liberando arquivos…";
  try {
    await banco.prepararDrive();
    const orig = await banco.lerOriginais(ids);
    const links = [];
    for (const o of orig) if (o.driveId) links.push(`${o.nome}: ${await banco.compartilharOriginal(o.driveId)}`);
    const falt = orig.filter((o) => !o.driveId).length;
    const texto = `Olá, ${p.nome.split(" ")[0]}! Seu pagamento foi confirmado. Aqui estão seus arquivos em alta resolução:\n\n${links.join("\n")}\n\nObrigado pela preferência! Estúdio Benfica`;
    box.hidden = false;
    box.innerHTML = `<textarea readonly rows="6">${esc(texto)}</textarea>
      ${falt ? `<p class="adm-nota">⚠️ ${falt} arquivo(s) sem original no Drive (vieram do catálogo antigo). Envie esses à parte.</p>` : ""}
      <div class="adm-acoes"><button class="btn btn--small btn--lime" data-copiar>Copiar mensagem</button>
      <a class="btn btn--small btn--ghost" target="_blank" rel="noopener" href="mailto:${esc(p.email)}?subject=${encodeURIComponent("Suas fotos · Estúdio Benfica")}&body=${encodeURIComponent(texto)}">Enviar por e-mail</a></div>`;
    box.querySelector("[data-copiar]").addEventListener("click", async (ev) => { try { await navigator.clipboard.writeText(texto); ev.target.textContent = "Copiado!"; } catch {} });
    if (p.status !== "entregue") { await banco.atualizarPedido(p.id, { status: "entregue" }); p.status = "entregue"; card.querySelector("[data-status]").value = "entregue"; carregarPedidos(true); }
    b.textContent = "Links gerados ✓";
  } catch (err) { b.disabled = false; b.textContent = "Gerar links de entrega"; aviso("Não consegui gerar os links", `<p>${esc(err.message)}</p>`); }
});

iniciar();
