/* =========================================================
   Cálculo de preços da loja (mesma regra no site e no servidor).
   O servidor (functions/precos.js) é quem decide o valor final.
   ========================================================= */
(function (root) {
  "use strict";

  // Valores padrão. Cada evento pode sobrescrever em Firestore (eventos/{id}.precos).
  const PADRAO = {
    foto: { avulso: 10, pacotes: [{ qtd: 5, preco: 40 }, { qtd: 10, preco: 70 }, { qtd: 20, preco: 120 }] },
    video: { avulso: 10, pacotes: [{ qtd: 5, preco: 40 }, { qtd: 10, preco: 70 }] },
    // Pacotes fechados por escopo (valores de exemplo, ajuste por evento)
    escopo: {
      "foto:atleta": 40, "video:atleta": 40, "misto:atleta": 70,
      "foto:time": 120, "video:time": 120, "misto:time": 200,
    },
  };

  const centavos = (v) => Math.round(v * 100);

  /** Menor custo para levar n itens com avulso + pacotes de quantidade (podem combinar). */
  function custoQuantidade(n, regra) {
    if (n <= 0) return { total: 0, combinacao: [] };
    const av = centavos(regra.avulso);
    const pac = (regra.pacotes || []).map((p) => ({ qtd: p.qtd, c: centavos(p.preco) }));
    const best = new Array(n + 1).fill(Infinity), escolha = new Array(n + 1).fill(null);
    best[0] = 0;
    for (let i = 1; i <= n; i++) {
      if (best[i - 1] + av < best[i]) { best[i] = best[i - 1] + av; escolha[i] = { qtd: 1, c: av }; }
      for (const p of pac) {
        // um pacote pode ser usado mesmo "sobrando" vagas, se sair mais barato
        const prev = Math.max(0, i - p.qtd);
        if (best[prev] + p.c < best[i]) { best[i] = best[prev] + p.c; escolha[i] = { qtd: i - prev, c: p.c, pacote: p.qtd }; }
      }
    }
    const combinacao = []; let i = n;
    while (i > 0) { const e = escolha[i]; combinacao.push(e.pacote ? `Pacote ${e.pacote}` : "Avulso"); i -= e.qtd; }
    return { total: best[n] / 100, combinacao: agrupar(combinacao) };
  }

  function agrupar(lista) {
    const m = {}; lista.forEach((x) => (m[x] = (m[x] || 0) + 1));
    return Object.entries(m).map(([nome, vezes]) => ({ nome, vezes }));
  }

  /**
   * carrinho = { itens: [{id, tipo:'foto'|'video'}], pacotes: [{tipo, escopo, valor, itens:[ids]}] }
   * Itens que já estão dentro de um pacote fechado não são cobrados de novo.
   */
  function calcular(carrinho, precos) {
    const p = mesclar(PADRAO, precos || {});
    const cobertos = new Set();
    let totalPacotes = 0;
    const linhasPacotes = (carrinho.pacotes || []).map((pk) => {
      const preco = pk.preco ?? p.escopo[`${pk.tipo}:${pk.escopo}`] ?? 0;
      pk.itens.forEach((id) => cobertos.add(id));
      totalPacotes += preco;
      return { ...pk, preco };
    });
    const soltos = (carrinho.itens || []).filter((i) => !cobertos.has(i.id));
    const nf = soltos.filter((i) => i.tipo === "foto").length;
    const nv = soltos.filter((i) => i.tipo === "video").length;
    const f = custoQuantidade(nf, p.foto), v = custoQuantidade(nv, p.video);
    // valor "cheio": todos os itens (inclusive os dos pacotes) comprados avulsos
    const tiposPacotes = (carrinho.pacotes || []).flatMap((pk) => pk.tipos || pk.itens.map(() => (pk.tipo === "video" ? "video" : "foto")));
    const semDesconto = (nf + tiposPacotes.filter((t) => t === "foto").length) * p.foto.avulso
      + (nv + tiposPacotes.filter((t) => t === "video").length) * p.video.avulso;
    const total = Math.round((totalPacotes + f.total + v.total) * 100) / 100;
    return {
      fotos: { qtd: nf, total: f.total, combinacao: f.combinacao },
      videos: { qtd: nv, total: v.total, combinacao: v.combinacao },
      pacotes: linhasPacotes,
      economia: Math.max(0, Math.round((semDesconto - total) * 100) / 100),
      total,
      dica: dica(nf, p.foto, "foto") || dica(nv, p.video, "vídeo"),
    };
  }

  /** Sugestão do tipo "leve mais 2 fotos e pague R$ 40 por 5". */
  function dica(n, regra, nome) {
    if (!n) return null;
    const atual = custoQuantidade(n, regra).total;
    for (const pk of [...(regra.pacotes || [])].sort((a, b) => a.qtd - b.qtd)) {
      if (pk.qtd > n) {
        const falta = pk.qtd - n;
        const novo = custoQuantidade(pk.qtd, regra).total;
        if (novo - atual <= falta * regra.avulso * 0.6) {
          return `Escolha mais ${falta} ${nome}${falta > 1 ? "s" : ""} e leve ${pk.qtd} por ${brl(novo)}`;
        }
        return null;
      }
    }
    return null;
  }

  function mesclar(a, b) {
    const o = JSON.parse(JSON.stringify(a));
    for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? { ...o[k], ...b[k] } : b[k];
    return o;
  }

  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const api = { PADRAO, calcular, custoQuantidade, brl, mesclar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Precos = api;
})(typeof window !== "undefined" ? window : globalThis);
