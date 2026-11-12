/* Catálogo de DEMONSTRAÇÃO, usado enquanto o Firebase não está configurado.
   Na loja real, os eventos e itens vêm do Firestore (alimentado pelo Drive). */
window.LOJA_DEMO = (() => {
  const P = "assets/img/portfolio/";
  const it = (id, arquivo, time, atleta, titulo) => ({ id, tipo: "foto", previa: P + arquivo + ".webp", time, atleta, titulo });
  return [
    {
      id: "copa-prime-2026", nome: "Copa Prime Arena 2026", data: "2026-09-28", local: "Betim · MG", capa: P + "copa-prime-campeoes.webp",
      times: ["Guerreiros BDI", "IBK Futebol Clube"],
      itens: [
        it("cp1", "copa-prime-campeoes", "Guerreiros BDI", null, "Campeões"),
        it("cp2", "copa-prime-quarteto", "Guerreiros BDI", null, "Medalhistas"),
        it("cp3", "copa-prime-trofeu", "Guerreiros BDI", null, "Troféu em família"),
        it("cp4", "copa-prime-medalhas", "Guerreiros BDI", null, "Medalhas"),
        it("cp5", "copa-prime-ibk", "IBK Futebol Clube", null, "Elenco IBK"),
      ],
    },
    {
      id: "open-futsal-betim", nome: "Open Futsal Betim", data: "2026-06-10", local: "Betim · MG", capa: P + "futsal-lazio-comemoracao.webp",
      times: ["Cassino FC", "Lazio MTR"],
      precos: { escopo: { "foto:time": 35, "foto:atleta": 10 } }, // valores só para a demonstração
      itens: [
        it("of1", "futsal-cassino-time", "Cassino FC", null, "Elenco Cassino FC"),
        it("of2", "futsal-cassino-concentracao", "Cassino FC", null, "Concentração"),
        it("of3", "futsal-cassino-chute", "Cassino FC", "Camisa 7", "Camisa 7"),
        it("of4", "futsal-cassino-drible", "Cassino FC", null, "Drible"),
        it("of5", "futsal-cassino-conducao", "Cassino FC", null, "Condução"),
        it("of6", "futsal-lazio-comemoracao", "Lazio MTR", null, "Comemoração"),
        it("of7", "futsal-lazio-gol", "Lazio MTR", null, "Gol"),
        it("of8", "futsal-lazio-abraco", "Lazio MTR", null, "Abraço do gol"),
      ],
    },
    {
      id: "campo-alterosa", nome: "Campo do Alterosa", data: "2026-05-03", local: "Betim · MG", capa: P + "campo-alterosa-disputa.webp",
      times: ["Azul e branco"],
      itens: [
        it("ca1", "campo-alterosa-disputa", "Azul e branco", null, "Disputa"),
        it("ca2", "campo-alterosa-conducao", "Azul e branco", null, "Condução"),
        it("ca3", "campo-alterosa-duelo", "Azul e branco", null, "Duelo"),
        it("ca4", "campo-alterosa-retrato", "Azul e branco", null, "Resenha"),
        it("ca5", "campo-alterosa-chuteira", "Azul e branco", null, "Detalhe"),
      ],
    },
  ];
})();
