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
- Servidor de pagamento: `worker/loja-worker.js` (Cloudflare Worker, gerado por `ferramentas/montar_worker.py` a partir de `worker/src.js` + `js/precos.js`). Guia em `PAGAMENTO.md`. A pasta `functions/` (Cloud Functions) ficou como alternativa caso o Blaze seja ativado
- Guias: `README.md`, `LOJA.md`, `ADMIN.md`, `PAGAMENTO.md`, `assets/logo/LEIA-ME.md`

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
- **Pagamento (ligado, token de TESTE do Mercado Pago; Worker https://loja-estudio-benfica.arturbenfica5.workers.dev):** Cloudflare Worker (grátis) + Firestore no Spark + originais entregues do Drive pela conta de serviço `loja-servidor@estudio-benfica.iam.gserviceaccount.com` (papel Cloud Datastore User; o painel compartilha a pasta de originais com ela). Segredos no Worker: `GOOGLE_SERVICE_ACCOUNT`, `MP_ACCESS_TOKEN`; texto `SITE_URL`. Para ligar: `LOJA_API` = URL do Worker e `LOJA_ATIVA = true` em `js/firebase-config.js`. Worker testado com serviços simulados (17 verificações)
- Ambiente: este container bloqueia api.mercadopago.com. As APIs do Google estão acessíveis

## Painel de admin (feito, falta ativar no console)
- `admin.html` + `js/admin.js` + `css/admin.css`; dados em `js/banco.js`; marca d'água no navegador em `js/marca.js`
- Login Google (Firebase Auth) restrito a arturbenfica5@gmail.com; escopo `drive.file` para enviar originais ao Drive
  (pasta "Loja Estúdio Benfica · Originais"). Prévias no Firestore (`previas/{id}`, < 700 KB) e miniatura no item
- Firestore: `eventos/{id}` (nome, data, local, times, publico, privado, precos, capa, contagem),
  `eventos/{id}/itens/{id}` (tipo, thumb, temPrevia, time, atleta, titulo, ordem), `previas`, `originais` (só admin),
  `config/precos`, `pedidos` (visitante só cria; status novo/pago/entregue/cancelado)
- A loja lê primeiro o Firestore; sem eventos lá, usa `data/catalogo.json`; sem ele, a demonstração
- Pedido pelo WhatsApp é registrado no Firestore com código (8 primeiros caracteres do id)
- Modo de treino: `admin.html?teste=1` e `loja.html?teste=1` (localStorage)
- `firestore.rules` testado no emulador (24 casos) e o fluxo ponta a ponta também (painel → loja → pedido → entrega)
- Console já configurado pelo Artur: login Google ativo, domínio benficazzz.github.io autorizado, regras publicadas, Drive API ativa
- Loja lançada: `mostrarLoja: true` em `js/config.js` (links com `data-loja`); `noindex` removido de `loja.html`. Para esconder de novo, volte para `false`
- Hook só para testes: `window.FIREBASE_EMULADOR` (nunca definido no site)

## Área do cliente (Minha conta)
- `conta.html` + `js/conta.js` + `css/conta.css`. Login Google ou e-mail/senha (exige e-mail confirmado)
- Conta do Artur → redireciona para `admin.html`. Cliente → lista `pedidos` onde `email` == e-mail do login (regra `donoDoPedido`)
- Download pela conta: Worker `POST /acessoConta` (verifica o ID token do Firebase) → token de 24 h → `/baixar`. Pela conta não há prazo; pelo link do checkout, 30 dias
- E-mails dos pedidos são gravados em minúsculas. Pedidos do WhatsApp (sem `linhas`) também funcionam
- Testes: 31 regras no emulador, 27 verificações no Worker, página no computador e iPhone

## Fluxo de trabalho
- Testar com Playwright (Chromium já instalado), no computador e no iPhone 13, sem rolagem horizontal
- Publicar a prévia no Artifact
- Commitar com mensagem em português e enviar para a branch de trabalho
- Para levar ao site: abrir PR para o `main`. O merge é sempre feito pelo Artur
- Pendente: PR com a correção da imagem de compartilhamento (og:image absoluta) e com a loja, a decidir quando lançar
