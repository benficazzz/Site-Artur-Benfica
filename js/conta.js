/* =========================================================
   Minha conta · login de clientes e do admin
   - conta do Artur → vai para o painel (admin.html)
   - cliente → vê as compras feitas com o e-mail dele e baixa os originais
   ?teste=1 → modo de treino
   ========================================================= */
import { criarBancoFirebase, criarBancoTeste } from "./banco.js?v=202611121919";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const brl = window.Precos.brl;
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TESTE = new URLSearchParams(location.search).has("teste");
const API = window.LOJA_API;
let banco, criando = false;

const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "Não encontramos uma conta com esse e-mail. Crie sua conta.",
  "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Entre com a senha ou use \"Esqueci a senha\".",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere pop-ups para este site.",
  "auth/popup-closed-by-user": "",
};
const erro = (e) => (e?.code in ERROS ? ERROS[e.code] : "Não foi possível concluir. Tente de novo.");

function mostrar(id) { ["tela-carregando", "tela-entrar", "tela-verificar", "tela-compras"].forEach((t) => ($("#" + t).hidden = t !== id)); }

async function iniciar() {
  try { banco = TESTE ? criarBancoTeste() : await criarBancoFirebase(window.FIREBASE_CONFIG); }
  catch (e) { console.error(e); $("#tela-carregando").innerHTML = `<p class="loja__vazio">Não foi possível carregar. Verifique sua conexão.</p>`; return; }
  banco.aoMudarLogin((u) => {
    if (!u) return mostrar("tela-entrar");
    if (u.admin) { location.href = "admin.html" + (TESTE ? "?teste=1" : ""); return; }
    if (!u.verificado) { $("#ver-email").textContent = u.email; return mostrar("tela-verificar"); }
    abrirCompras(u);
  });
}

/* ---------- Entrar ---------- */
$("#ent-google").addEventListener("click", async () => {
  $("#ent-msg").textContent = "";
  try { await banco.entrarCliente(); } catch (e) { $("#ent-msg").textContent = erro(e); console.error(e); }
});
$("#alternar").addEventListener("click", () => {
  criando = !criando;
  $("#campo-nome").hidden = !criando;
  $("#ent-titulo").textContent = criando ? "Criar conta" : "Entrar";
  $("#e-enviar").textContent = criando ? "Criar conta" : "Entrar";
  $("#e-senha").autocomplete = criando ? "new-password" : "current-password";
  $("#alternar").textContent = criando ? "Já tem conta? Entrar" : "Não tem conta? Criar conta";
  $("#ent-msg").textContent = "";
});
$("#form-email").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#ent-msg"), email = $("#e-email").value.trim(), senha = $("#e-senha").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = "Digite um e-mail válido."; return; }
  if (senha.length < 6) { msg.textContent = "A senha precisa ter pelo menos 6 caracteres."; return; }
  msg.textContent = criando ? "Criando sua conta…" : "Entrando…";
  try { criando ? await banco.criarContaEmail($("#e-nome").value.trim(), email, senha) : await banco.entrarEmail(email, senha); msg.textContent = ""; }
  catch (err) { msg.textContent = erro(err); console.error(err); }
});
$("#esqueci").addEventListener("click", async () => {
  const email = $("#e-email").value.trim(), msg = $("#ent-msg");
  if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = "Digite seu e-mail no campo acima e clique de novo em \"Esqueci a senha\"."; return; }
  try { await banco.redefinirSenha(email); msg.textContent = "Se houver uma conta com esse e-mail, você vai receber o link para criar uma nova senha."; }
  catch (err) { msg.textContent = erro(err); }
});

/* ---------- Confirmar e-mail ---------- */
$("#ver-pronto").addEventListener("click", async () => {
  const ok = await banco.recarregarUsuario();
  if (!ok) $("#ver-msg").textContent = "Ainda não identificamos a confirmação. Abra o link do e-mail e tente de novo.";
  else location.reload();
});
$("#ver-reenviar").addEventListener("click", async () => {
  try { await banco.reenviarVerificacao(); $("#ver-msg").textContent = "E-mail reenviado. Confira também a caixa de spam."; }
  catch (err) { $("#ver-msg").textContent = erro(err); }
});
$$("[data-sair]").forEach((b) => b.addEventListener("click", () => banco.sair()));

/* ---------- Minhas compras ---------- */
const quando = (t) => { const d = t?.toDate ? t.toDate() : t ? new Date(t) : null; return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""; };
const SIT = { pago: ["Pago", "ok"], entregue: ["Pago", "ok"], aguardando: ["Aguardando pagamento", "esp"], novo: ["Aguardando confirmação", "esp"], cancelado: ["Cancelado", "x"] };

async function abrirCompras(u) {
  mostrar("tela-compras");
  $("#c-nome").textContent = (u.nome || u.email).split(" ")[0];
  $("#c-email").textContent = u.email;
  $("#compras").innerHTML = `<p class="loja__vazio">Carregando suas compras…</p>`;
  let pedidos = [];
  try { pedidos = await banco.listarMeusPedidos(u.email); }
  catch (e) { console.error(e); $("#compras").innerHTML = `<p class="loja__vazio">Não foi possível carregar suas compras agora.</p>`; return; }
  pedidos.sort((a, b) => (b.criadoEm?.seconds || +new Date(b.criadoEm) || 0) - (a.criadoEm?.seconds || +new Date(a.criadoEm) || 0));
  if (!pedidos.length) {
    $("#compras").innerHTML = `<div class="conta__vazio"><h2>Nenhuma compra com este e-mail ainda.</h2>
      <p>Se você comprou com outro e-mail, saia e entre com ele. Dúvidas? Fale no <a class="loja__link" href="https://wa.me/${esc((window.SITE_CONFIG || {}).whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>.</p>
      <a class="btn btn--lime" href="loja.html">Ir para a loja</a></div>`;
    return;
  }
  $("#compras").innerHTML = pedidos.map((p) => {
    const [rot, cls] = SIT[p.status] || ["—", "esp"];
    const itens = [...(p.pacotes || []).map((k) => `📦 ${esc(k.rotulo)}`), ...(p.itens || []).map((i) => `${i.tipo === "video" ? "🎬" : "📷"} ${esc(i.titulo)}`)];
    const liberado = p.status === "pago" || p.status === "entregue";
    return `<article class="conta__pedido" data-id="${esc(p.id)}">
      <header><div><b>Pedido ${esc(p.id.slice(0, 8).toUpperCase())}</b><small>${quando(p.criadoEm)} · ${brl(p.total || 0)}</small></div>
        <span class="conta__sit conta__sit--${cls}">${rot}</span></header>
      <p class="conta__itens">${itens.slice(0, 6).join(" · ")}${itens.length > 6 ? ` · +${itens.length - 6}` : ""}</p>
      ${liberado ? `<button class="btn btn--lime btn--small" data-abrir>Ver e baixar arquivos</button>` : `<p class="loja__vazio">Os arquivos aparecem aqui assim que o pagamento for confirmado.</p>`}
      <div class="conta__arquivos" hidden></div>
    </article>`;
  }).join("");
}

$("#compras").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-abrir]"); if (!b) return;
  const card = b.closest(".conta__pedido"), box = card.querySelector(".conta__arquivos"), id = card.dataset.id;
  if (!box.hidden) { box.hidden = true; b.textContent = "Ver e baixar arquivos"; return; }
  b.disabled = true; b.textContent = "Liberando arquivos…";
  try {
    if (!API) throw new Error("Downloads pela conta disponíveis em breve. Fale comigo no WhatsApp.");
    const r = await fetch(`${API}/acessoConta`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await banco.tokenId()}` }, body: JSON.stringify({ pedido: id }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || "Não foi possível liberar os arquivos.");
    if (!d.itens?.length) throw new Error("Este pedido ainda não tem arquivos liberados. Fale comigo no WhatsApp.");
    const link = (i) => `${API}/baixar?pedido=${encodeURIComponent(id)}&t=${encodeURIComponent(d.t)}&item=${encodeURIComponent(i.chave)}`;
    box.innerHTML = `<ul>${d.itens.map((i) => `<li><span>${i.tipo === "video" ? "🎬" : "📷"} ${esc(i.titulo || i.chave)}</span><a class="btn btn--ghost btn--small" href="${link(i)}">Baixar</a></li>`).join("")}</ul>
      ${d.itens.length > 1 ? `<button class="btn btn--lime btn--small" data-todos>Baixar todos (${d.itens.length})</button>` : ""}`;
    box.hidden = false; b.textContent = "Ocultar arquivos";
    box.querySelector("[data-todos]")?.addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      for (const i of d.itens) { const a = document.createElement("a"); a.href = link(i); a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); await new Promise((ok) => setTimeout(ok, 900)); }
      ev.target.disabled = false;
    });
  } catch (err) {
    box.hidden = false; box.innerHTML = `<p class="form__note">${esc(err.message)}</p>`; b.textContent = "Tentar de novo";
  } finally { b.disabled = false; }
});

iniciar();
