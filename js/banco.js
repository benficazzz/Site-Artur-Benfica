/* =========================================================
   Camada de dados do painel e da loja.
   - criarBancoFirebase(): Firestore + Login Google + Google Drive (originais)
   - criarBancoTeste(): tudo na memória do navegador (?teste=1), para treinar sem risco
   ========================================================= */
export const ADMIN_EMAIL = "arturbenfica5@gmail.com";
const V = "10.12.2";
const DRIVE_PASTA_RAIZ = "Loja Estúdio Benfica · Originais";
const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.file";

export const novoId = (n = 20) => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join("");
};
export const slug = (t) => (t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ------------------------------------------------------------------ */
export async function criarBancoFirebase(config) {
  const [{ initializeApp }, au, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = au.getAuth(app);
  const db = fs.getFirestore(app);
  // somente para testes automatizados (emulador local); não é usado no site
  if (window.FIREBASE_EMULADOR) { fs.connectFirestoreEmulator(db, "127.0.0.1", window.FIREBASE_EMULADOR.firestore); if (window.FIREBASE_EMULADOR.auth) au.connectAuthEmulator(auth, `http://127.0.0.1:${window.FIREBASE_EMULADOR.auth}`, { disableWarnings: true }); }
  const provedor = new au.GoogleAuthProvider();
  provedor.addScope(ESCOPO_DRIVE);
  provedor.setCustomParameters({ login_hint: ADMIN_EMAIL, prompt: "select_account" });

  const TOK = "eb-drive-token";
  const guardarToken = (cred) => {
    const c = au.GoogleAuthProvider.credentialFromResult(cred);
    if (c?.accessToken) try { sessionStorage.setItem(TOK, JSON.stringify({ t: c.accessToken, em: Date.now() })); } catch {}
  };
  const tokenValido = () => { try { const x = JSON.parse(sessionStorage.getItem(TOK)); return x && Date.now() - x.em < 50 * 60e3 ? x.t : null; } catch { return null; } };

  async function tokenDrive() {
    const t = tokenValido();
    if (t) return t;
    const cred = await au.reauthenticateWithPopup(auth.currentUser, provedor);
    guardarToken(cred);
    return tokenValido();
  }

  async function drive(caminho, op = {}) {
    const r = await fetch(`https://www.googleapis.com${caminho}`, { ...op, headers: { Authorization: `Bearer ${await tokenDrive()}`, ...(op.headers || {}) } });
    if (!r.ok) throw new Error(`Google Drive: ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.status === 204 ? null : r.json();
  }
  const pastas = {};
  async function pasta(nome, pai) {
    const k = `${pai || "raiz"}/${nome}`;
    if (pastas[k]) return pastas[k];
    const q = encodeURIComponent(`name='${nome.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (pai ? ` and '${pai}' in parents` : ""));
    const achou = await drive(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
    if (achou.files?.length) return (pastas[k] = achou.files[0].id);
    const nova = await drive("/drive/v3/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", ...(pai ? { parents: [pai] } : {}) }) });
    return (pastas[k] = nova.id);
  }

  /** Dá ao servidor de pagamento (conta de serviço) acesso de leitura à pasta dos originais, para entregar após o pagamento. */
  let servidorLiberado = false;
  async function liberarParaServidor(pastaId) {
    const email = window.LOJA_SERVIDOR_EMAIL;
    if (!email || servidorLiberado) return;
    try {
      await drive(`/drive/v3/files/${pastaId}/permissions?sendNotificationEmail=false&fields=id`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "user", emailAddress: email }) });
      servidorLiberado = true;
    } catch (e) { console.warn("Não consegui liberar a pasta para o servidor", e); }
  }

  /** Envia o original para o Drive (envio retomável, com progresso). */
  async function enviarOriginal(arquivo, nomeEvento, aoProgresso = () => {}) {
    const raiz = await pasta(DRIVE_PASTA_RAIZ);
    await liberarParaServidor(raiz);
    const destino = await pasta(nomeEvento, raiz);
    const token = await tokenDrive();
    const ini = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": arquivo.type || "application/octet-stream", "X-Upload-Content-Length": String(arquivo.size) },
      body: JSON.stringify({ name: arquivo.name, parents: [destino] }),
    });
    const sessao = ini.headers.get("Location");
    if (!ini.ok || !sessao) throw new Error(`Google Drive recusou o envio (${ini.status}).`);
    return new Promise((ok, erro) => {
      const x = new XMLHttpRequest();
      x.open("PUT", sessao);
      x.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
      x.upload.onprogress = (e) => e.lengthComputable && aoProgresso(e.loaded / e.total);
      x.onload = () => (x.status < 300 ? ok(JSON.parse(x.responseText)) : erro(new Error(`Drive: ${x.status}`)));
      x.onerror = () => erro(new Error("Falha de rede ao enviar para o Drive."));
      x.send(arquivo);
    });
  }

  const col = (...p) => fs.collection(db, ...p);
  const doc = (...p) => fs.doc(db, ...p);
  const lista = async (q) => (await fs.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
  async function emLotes(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = fs.writeBatch(db);
      ops.slice(i, i + 400).forEach((f) => f(b));
      await b.commit();
    }
  }

  return {
    modo: "firebase",
    aoMudarLogin: (fn) => au.onAuthStateChanged(auth, (u) => fn(u ? { email: u.email, nome: u.displayName, foto: u.photoURL, admin: u.email === ADMIN_EMAIL && u.emailVerified } : null)),
    async entrar() {
      if (window.FIREBASE_EMULADOR?.contaTeste) return au.signInWithCredential(auth, au.GoogleAuthProvider.credential(JSON.stringify(window.FIREBASE_EMULADOR.contaTeste)));
      guardarToken(await au.signInWithPopup(auth, provedor));
    },
    sair: () => { try { sessionStorage.removeItem(TOK); } catch {} return au.signOut(auth); },

    listarEventos: () => lista(fs.query(col("eventos"), fs.orderBy("data", "desc"))),
    salvarEvento: (ev) => fs.setDoc(doc("eventos", ev.id), { ...ev, atualizadoEm: fs.serverTimestamp() }, { merge: true }),
    async apagarEvento(id) {
      const its = await lista(col("eventos", id, "itens"));
      await emLotes([
        ...its.flatMap((i) => [(b) => b.delete(doc("eventos", id, "itens", i.id)), (b) => b.delete(doc("previas", i.id)), (b) => b.delete(doc("originais", i.id))]),
        (b) => b.delete(doc("eventos", id)),
      ]);
    },
    listarItens: (ev) => lista(fs.query(col("eventos", ev, "itens"), fs.orderBy("ordem"))),
    async criarItem(ev, item, previa, original) {
      const id = item.id || novoId();
      await emLotes([
        (b) => b.set(doc("eventos", ev, "itens", id), { ...item, id, criadoEm: fs.serverTimestamp() }),
        (b) => previa && b.set(doc("previas", id), { evento: ev, dados: previa }),
        (b) => b.set(doc("originais", id), { evento: ev, ...original }),
      ].filter(Boolean));
      return id;
    },
    atualizarItens: (ev, ids, patch) => emLotes(ids.map((id) => (b) => b.update(doc("eventos", ev, "itens", id), patch))),
    apagarItens: (ev, ids) => emLotes(ids.flatMap((id) => [(b) => b.delete(doc("eventos", ev, "itens", id)), (b) => b.delete(doc("previas", id)), (b) => b.delete(doc("originais", id))])),
    lerPrevia: async (id) => (await fs.getDoc(doc("previas", id))).data()?.dados || null,
    lerPrecos: async () => (await fs.getDoc(doc("config", "precos"))).data() || {},
    salvarPrecos: (p) => fs.setDoc(doc("config", "precos"), p),
    listarPedidos: () => lista(fs.query(col("pedidos"), fs.orderBy("criadoEm", "desc"), fs.limit(200))),
    atualizarPedido: (id, patch) => fs.updateDoc(doc("pedidos", id), patch),
    lerOriginais: async (ids) => Promise.all(ids.map(async (id) => ({ id, ...((await fs.getDoc(doc("originais", id))).data() || {}) }))),
    enviarOriginal,
    prepararDrive: () => tokenDrive(),
    /** Libera o original para quem tiver o link e devolve o endereço de download. */
    async compartilharOriginal(driveId) {
      await drive(`/drive/v3/files/${driveId}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" }) });
      return `https://drive.google.com/file/d/${driveId}/view`;
    },
    // usado pela loja (visitante, sem login)
    async criarPedido(p) { const r = await fs.addDoc(col("pedidos"), { ...p, status: "novo", criadoEm: fs.serverTimestamp() }); return r.id; },
    listarEventosPublicos: () => lista(fs.query(col("eventos"), fs.where("publico", "==", true), fs.where("privado", "==", false))),
    lerEvento: async (id) => { const s = await fs.getDoc(doc("eventos", id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
  };
}

/* ------------------------------------------------------------------ */
export function criarBancoTeste() {
  const K = "eb-banco-teste";
  let d;
  try { d = JSON.parse(localStorage.getItem(K)); } catch {}
  d = d || { eventos: {}, itens: {}, previas: {}, originais: {}, precos: {}, pedidos: {} };
  const gravar = () => { try { localStorage.setItem(K, JSON.stringify(d)); } catch { /* sem espaço: segue só na memória */ } };
  let ouvinte = null, usuario = null;
  const espera = (v) => new Promise((ok) => setTimeout(() => ok(v), 60));
  return {
    modo: "teste",
    aoMudarLogin(fn) { ouvinte = fn; fn(usuario); },
    async entrar() { usuario = { email: ADMIN_EMAIL, nome: "Artur (teste)", admin: true }; ouvinte?.(usuario); },
    async sair() { usuario = null; ouvinte?.(null); },
    listarEventos: async () => espera(Object.values(d.eventos).sort((a, b) => (b.data || "").localeCompare(a.data || ""))),
    async salvarEvento(ev) { d.eventos[ev.id] = { ...d.eventos[ev.id], ...ev }; gravar(); },
    async apagarEvento(id) { Object.values(d.itens).filter((i) => i.evento === id).forEach((i) => { delete d.itens[i.id]; delete d.previas[i.id]; delete d.originais[i.id]; }); delete d.eventos[id]; gravar(); },
    listarItens: async (ev) => espera(Object.values(d.itens).filter((i) => i.evento === ev).sort((a, b) => a.ordem - b.ordem)),
    async criarItem(ev, item, previa, original) { const id = item.id || novoId(); d.itens[id] = { ...item, id, evento: ev }; if (previa) d.previas[id] = previa; d.originais[id] = { evento: ev, ...original }; gravar(); return id; },
    async atualizarItens(ev, ids, patch) { ids.forEach((id) => Object.assign(d.itens[id], patch)); gravar(); },
    async apagarItens(ev, ids) { ids.forEach((id) => { delete d.itens[id]; delete d.previas[id]; delete d.originais[id]; }); gravar(); },
    lerPrevia: async (id) => d.previas[id] || null,
    lerPrecos: async () => d.precos,
    async salvarPrecos(p) { d.precos = p; gravar(); },
    listarPedidos: async () => Object.values(d.pedidos).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)),
    async atualizarPedido(id, patch) { Object.assign(d.pedidos[id], patch); gravar(); },
    lerOriginais: async (ids) => ids.map((id) => ({ id, ...(d.originais[id] || {}) })),
    async enviarOriginal(arquivo, _ev, aoProgresso = () => {}) { for (let p = 0; p <= 1; p += 0.25) { aoProgresso(p); await espera(); } return { id: "teste-" + novoId(8), name: arquivo.name, mimeType: arquivo.type, size: arquivo.size }; },
    prepararDrive: async () => true,
    async compartilharOriginal(driveId) { return `https://drive.google.com/file/d/${driveId}/view`; },
    async criarPedido(p) { const id = novoId(); d.pedidos[id] = { id, ...p, status: "novo", criadoEm: Date.now() }; gravar(); return id; },
    listarEventosPublicos: async () => Object.values(d.eventos).filter((e) => e.publico && !e.privado),
    lerEvento: async (id) => d.eventos[id] || null,
  };
}
