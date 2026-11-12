# Estúdio Benfica · contexto do projeto

Site e loja do **Estúdio Benfica** (Artur Benfica): fotografia, vídeo e marketing digital.
Responder sempre em **português do Brasil**, com tom profissional e prático. Pedir aprovação antes de
publicar, apagar ou enviar algo para fora. Não inventar dados (clientes, números, depoimentos).

## Onde está cada coisa
- **Site no ar:** https://benficazzz.github.io/Site-Artur-Benfica/ (GitHub Pages, branch `main`, pasta raiz)
- **Repositório:** `benficazzz/Site-Artur-Benfica`. O trabalho é feito numa branch e entra no `main` por pull request, que o Artur aprova
- **Prévia privada (Artifact):** https://claude.ai/artifact/KFZPsodipSeN2oppxZSA5A
- Stack: HTML + CSS + JS puro, sem etapa de build
- Arquivos principais: `index.html`, `css/style.css`, `js/main.js`, `js/config.js` (contatos)
- Loja: `loja.html`, `css/loja.css`, `js/loja.js`, `js/precos.js`, `js/loja-demo.js`, `data/catalogo.json` (ainda não existe; é gerado)
- Servidor (escrito, ainda NÃO publicado): `functions/` (Cloud Functions), `firestore.rules`, `storage.rules`, `firebase.json`
- Guias: `README.md`, `LOJA.md`, `assets/logo/LEIA-ME.md`

## Identidade
- Marca: **Estúdio Benfica**. Logo aprovado: conceito **01 · Visor** (cantos do visor de câmera + play verde-limão)
- Cores: preto `#07080b`, azul `#2563ff`, branco `#f5f7fa`, verde-limão `#c8ff1a`
- Fontes: Syne (títulos), Inter (texto), Geist Mono (rótulos)
- Arquivos do logo: `assets/logo/svg`, `assets/logo/png`, `assets/logo/instagram` (perfil e marcas d'água para Stories)
- Marca d'água das fotos: "ESTÚDIO BENFICA" + símbolo, em grade diagonal a 30°, opacidade de 16%
- Estilo do site inspirado em getartcraft.com: trilho lateral de rolagem numerado, entradas com desfoque, rótulos HUD em fonte mono
- Contatos: WhatsApp 5531992264733 · Instagram @benfica.estudio · arturbenfica5@gmail.com

## Portfólio
- 31 fotos em `assets/img/portfolio/` (WebP, 1800 px, com marca d'água)
- A marca antiga "@ClicksJA" foi removida
- As versões limpas (sem marca) NÃO vão para o repositório
- Fontes no Drive: CASSINO FC - PACOTE, LAZIO MTR, CAMPO DO ALTEROSA, PACOTE DE FOTOS (Copa Prime), ANIVERSARIO, aniversario iza, FORMANDOS 2026
- O Artur tem autorização das pessoas fotografadas. @clicksja, jaclicks e joaoclicks são contas antigas dele
- Pendências do site: foto do Artur para a seção "Sobre", link do showreel, revisão dos textos, domínio próprio

## Loja (situação atual)
- **Preços:**
  - Foto e vídeo avulsos: R$ 10
  - Pacotes de fotos: 5 por R$ 40, 10 por R$ 70, 20 por R$ 120. Pacotes de vídeos: 5 por R$ 40, 10 por R$ 70
  - Pacotes fechados por **atleta** e por **time** (fotos, vídeos ou misto). Valores de exemplo, ajustáveis por evento
  - Um pacote fechado só aparece quando sai mais barato que comprar avulso
- **Hoje funciona assim (pré-lançamento):** o carrinho envia o pedido pelo **WhatsApp** com a lista de itens e o total, e o Pix é combinado direto. `window.LOJA_ATIVA = false` em `js/firebase-config.js`
- **Catálogo:** vem do Drive. Pasta **"Loja Estúdio Benfica"** (id `1LW7vYxUgyn5K2hJxuQFFs3aUmhjvF1Ho`), estrutura `AAAA-MM-DD · Evento / Time / [Atleta] / arquivos`
  - "sincroniza a loja": baixar do Drive para `<pasta>/<evento>/<time>/[atleta]/<driveId>__<nome>`, rodar `python3 ferramentas/sincronizar_loja.py --origem <pasta> --site .` (precisa de `pillow-heif` e `ffmpeg`), revisar e publicar
  - Os originais ficam só no Drive
- **Firebase:** projeto `estudio-benfica` (número 586450045742)
  - Firestore criado em southamerica-east1 (São Paulo), modo produção
  - App Web registrado. A configuração pública já está em `js/firebase-config.js`
  - **Plano Spark:** o upgrade para o Blaze falhou (problema com o cartão). Sem o Blaze não há Cloud Functions nem Storage
- **Mercado Pago:** conta CNPJ. A aplicação Checkout Pro ainda não foi criada. O token NUNCA passa pelo chat: vai como segredo (`firebase functions:secrets:set MP_ACCESS_TOKEN`) ou como variável secreta equivalente
- **Plano B, se o Blaze não for possível:** servidor de pagamento no Cloudflare Workers (grátis) + Firestore no Spark + originais entregues a partir do Drive
- Ambiente: este container bloqueia api.mercadopago.com. As APIs do Google estão acessíveis

## PRÓXIMA TAREFA pedida pelo Artur: painel de admin no site
Quer gerenciar tudo pelo navegador, sem depender do Claude:
- Criar álbuns ou eventos
- Subir fotos e vídeos, com prévia e marca d'água automáticas
- Marcar time e atleta de cada item
- Definir preços e pacotes (avulso, por quantidade, atleta, time)
- Publicar ou ocultar eventos e criar galerias privadas
- Ver pedidos

Pontos a decidir no início:
1. **Login do admin:** Firebase Auth com Google (funciona no Spark), liberando só o e-mail do Artur nas regras
2. **Catálogo e preços:** Firestore (funciona no Spark). A loja passa a ler do Firestore, e o `data/catalogo.json` vira alternativa
3. **Arquivos:** sem Blaze não há Storage. Opções:
   - (a) O painel envia os originais para o **Drive** pela API Google com o login do Artur, gera a prévia com marca d'água no próprio navegador (canvas) e guarda as prévias num lugar público. Esse lugar ainda está em aberto: Cloudflare R2/Pages ou commit no GitHub pela API
   - (b) Conseguir o Blaze e usar o Storage
4. Pagamento automático (Mercado Pago + entrega) continua dependendo de um servidor: Blaze ou Cloudflare

## Fluxo de trabalho
- Testar com Playwright (Chromium já instalado), no computador e no iPhone 13, sem rolagem horizontal
- Publicar a prévia no Artifact
- Commitar com mensagem em português e enviar para a branch de trabalho
- Para levar ao site: abrir PR para o `main`. O merge é sempre feito pelo Artur
- Pendente: PR com a correção da imagem de compartilhamento (og:image absoluta) e com a loja, a decidir quando lançar
