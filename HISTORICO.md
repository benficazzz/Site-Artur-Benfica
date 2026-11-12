# Histórico do projeto · Estúdio Benfica

Relato detalhado de tudo o que foi feito no projeto, em ordem cronológica, a partir da conversa com o Claude.
Não é a transcrição literal do chat. Contexto técnico resumido em `CLAUDE.md`.

---

## 1. Briefing e primeira versão do site
- **Pedido:** site de fotografia, vídeo e marketing digital do Artur (fotógrafo e videomaker; marketing e tráfego pago para pequenos e grandes negócios; casamentos, aniversários, futebol).
- **Identidade escolhida:** preto, azul, branco e verde-limão. Tom profissional e acolhedor. Muita animação, funcionando bem no celular.
- **Referência visual:** getartcraft.com (analisada com o Firecrawl). Aproveitamos o trilho lateral de rolagem numerado, as entradas com desfoque, os rótulos HUD em fonte mono, as linhas de grade e os anéis concêntricos.
- **Construído em HTML, CSS e JS puro:**
  - tela de carregamento, abertura com título animado e etiquetas em órbita, faixa rolante;
  - seções Sobre, Serviços, Portfólio com filtros e visualização ampliada, Showreel, Marketing, Como funciona, Contato com formulário que abre o WhatsApp;
  - cursor personalizado e botões magnéticos.
- **Publicação:** repositório `benficazzz/Site-Artur-Benfica`. O GitHub precisou ser reconectado para o primeiro envio.

## 2. Contatos e portfólio
- **Contatos:** WhatsApp 5531992264733, Instagram @benfica.estudio, arturbenfica5@gmail.com.
- **Fotos vindas do Google Drive** (as contas antigas @clicksja, jaclicks e joaoclicks são do Artur, e há autorização das pessoas fotografadas). Pastas usadas:
  - ANIVERSARIO / aniversario iza;
  - FORMANDOS 2026;
  - CASSINO FC - PACOTE;
  - LAZIO MTR;
  - CAMPO DO ALTEROSA;
  - PACOTE DE FOTOS (Copa Prime Arena 2026).
- **Evolução:**
  - de 11 para 18 e depois 30 fotos, com o botão "Ver mais fotos";
  - as fotos de time foram trocadas por versões com todo mundo enquadrado (Guerreiros BDI IMG_1322, IBK IMG_1289, Cassino FC _MG_0277);
  - entrou a foto dos medalhistas do Guerreiros BDI, chegando a **31 fotos**.

## 3. Logo
- **4 conceitos:** 01 Visor, 02 Lente, 03 Monograma B, 04 Selo. **Aprovado: 01 · Visor**, sem alterações (cantos do visor de câmera com um play verde-limão).
- **Arquivos gerados** em `assets/logo/` (letras convertidas em desenho vetorial):
  - SVG horizontal, vertical e símbolo;
  - PNG transparentes;
  - foto de perfil 1080 px e capa 1920×1080;
  - favicons;
  - kit Instagram: perfil preto e perfil azul, marcas d'água para Stories (inferior, canto e diagonal) e logo solto.
- **Aplicado no site:** cabeçalho, tela de carregamento, favicon e rodapé "ESTÚDIO BENFICA".

## 4. Marca d'água
- A marca antiga **"@ClicksJA"** foi removida de 18 fotos, por retoque digital.
- **Marca nova:** "ESTÚDIO BENFICA" + símbolo, em grade diagonal a 30°, opacidade de 16%, aplicada nas 31 fotos.
- As versões limpas, sem marca, **não** vão para o repositório.

## 5. Publicação no GitHub Pages
- Mesclagem #1 aprovada e Pages ativado. Site no ar em **https://benficazzz.github.io/Site-Artur-Benfica/**.
- Correção da imagem de prévia ao compartilhar o link (`og:image` com o endereço completo).

## 6. Loja de fotos e vídeos
- **Preços:**
  - foto e vídeo avulsos a R$ 10;
  - pacotes de fotos: 5 por R$ 40, 10 por R$ 70, 20 por R$ 120;
  - pacotes de vídeos: 5 por R$ 40, 10 por R$ 70;
  - pacotes fechados de **todas as fotos, todos os vídeos ou misto, por atleta ou por time**.
- **Regra:** sempre a combinação mais barata. Um pacote fechado só aparece quando sai mais barato que comprar avulso. O carrinho mostra a economia e dicas como "leve mais 1 e pague…".
- **Primeiro modelo de venda:** pedido pelo WhatsApp com a lista de itens e um código.

## 7. Firebase
- Projeto **estudio-benfica** (nº 586450045742), Firestore em **São Paulo (southamerica-east1)**, modo produção.
- O site antigo usa outro projeto, então foi criado um projeto separado.
- **Upgrade para o Blaze:** falhou por problema no cartão. Tudo foi construído para funcionar no plano **Spark**, que é gratuito.
- **Configurado pelo Artur no console:**
  - login com Google ativado (o login por e-mail e senha também está ativo);
  - domínio `benficazzz.github.io` autorizado;
  - regras publicadas;
  - API do Google Drive ativada.

## 8. Painel de admin (`admin.html`)
- **Login Google** restrito a arturbenfica5@gmail.com.
- **Eventos:** criar eventos públicos, privados (só pelo link) ou ocultos; times; preços por evento.
- **Envio de fotos e vídeos:**
  - a prévia com marca d'água é gerada no próprio navegador (vídeo: trecho de 6 s);
  - o **original vai para o Google Drive**, na pasta "Loja Estúdio Benfica · Originais".
- **Marcação de time e atleta** em lote.
- **Pedidos**, com o botão "Gerar links de entrega".
- **Modo de treino:** `admin.html?teste=1`.
- **Testado:** regras no emulador oficial do Firebase e fluxo completo (painel → loja → pedido → entrega).
- **A loja ficou escondida** até o lançamento e foi lançada em seguida (mesclagens #2 e #3). Foi preciso apertar Ctrl + F5 por causa do cache.

## 9. Pagamento online: Mercado Pago + Cloudflare
- **Plano B, sem o Blaze:** servidor no **Cloudflare Workers**, que é gratuito.
- **Conta de serviço do Google:** `loja-servidor@estudio-benfica.iam.gserviceaccount.com`, com o papel "Usuário do Cloud Datastore".
  - A conta `firebase-adminsdk-fbsvc` pertence ao projeto e **não deve ser apagada**.
- **Worker:** `loja-estudio-benfica`, endereço **https://loja-estudio-benfica.arturbenfica5.workers.dev**.
  - Segredos: `GOOGLE_SERVICE_ACCOUNT` (conteúdo do JSON) e `MP_ACCESS_TOKEN`.
  - Texto: `SITE_URL`.
- **Mercado Pago:** aplicação "Loja Estudio Benfica" na **conta CNPJ**, do tipo Checkout Pro com a **API de Preferências** (não a de Orders).
- **Aprendizados:**
  - **o Pix não aparece com as credenciais de teste.** Com o token de **produção** (`APP_USR-...`), o Pix apareceu;
  - o erro "uma das partes é de teste" acontece ao misturar conta de teste com conta real;
  - o nome da variável precisa ser exatamente `MP_ACCESS_TOKEN`. Quando ela foi renomeada para `APP_USR`, o pagamento parou de funcionar.
- **Fluxo:**
  1. o servidor recalcula o preço;
  2. o cliente paga no checkout do Mercado Pago;
  3. o aviso do Mercado Pago chega ao Worker, que reconsulta o pagamento;
  4. o cliente vê "Pagamento aprovado!" e baixa o original direto do Drive, por 30 dias.
- **Mesclagem #4.** A compra real de teste com Pix funcionou.

## 10. Área do cliente: Minha conta (`conta.html`)
- **Login** com Google ou com e-mail e senha, que exige confirmar o e-mail.
- **A conta do Artur** vai direto para o painel. **O cliente** vê as compras feitas com o e-mail dele e baixa sem prazo.
- **Worker:** rota `/acessoConta`, que verifica o login do Firebase.
- **Regras:** o cliente lê apenas os próprios pedidos. Os pedidos feitos pelo WhatsApp também aparecem.
- **Mesclagem #5.**

## 11. Ajustes finais (mesclagem #6)
- O título da abertura não é mais cortado em telas grandes.
- Versão nos arquivos (`ferramentas/versao.py`), para acabar com o Ctrl + F5.
- **Termos de uso** e **Política de privacidade** (LGPD), com links no rodapé, no carrinho e em Minha conta.
- **Aviso de venda no Telegram.**

## 12. Telegram
- Bot criado no **@BotFather**: **"Venda Lojinha Benfica"**.
- Foi mandado **/start** para o bot. O chat id foi descoberto em `https://api.telegram.org/bot<TOKEN>/getUpdates`, no campo `"chat":{"id":` → **5206927383**.
- **No Cloudflare:** segredo `TELEGRAM_TOKEN` (o token do BotFather, que nunca foi mandado no chat) e texto `TELEGRAM_CHAT_ID = 5206927383`.
- **Teste:** `https://loja-estudio-benfica.arturbenfica5.workers.dev/testeAviso?chat=5206927383` → a mensagem chegou ✅.
- **Mensagem a cada venda:** "💰 Venda aprovada!", com o pedido, o cliente, a quantidade de arquivos, o valor e a forma de pagamento. Não duplica.

## 13. Dados legais (mesclagem #7)
- **CNPJ 69.264.690/0001-92**, Betim, Minas Gerais, preenchidos nos Termos e na Privacidade.

---

## Contas e serviços usados
| Serviço | Para quê | Onde |
|---|---|---|
| GitHub | Código e hospedagem do site | benficazzz/Site-Artur-Benfica (Pages na branch `main`) |
| Firebase (Spark) | Login, banco de dados (eventos, preços, pedidos) | projeto `estudio-benfica` |
| Google Drive | Originais das fotos e vídeos | pasta "Loja Estúdio Benfica · Originais" |
| Google Cloud | Conta de serviço do servidor | `loja-servidor@…` |
| Cloudflare Workers | Servidor de pagamento e downloads | `loja-estudio-benfica` |
| Mercado Pago (CNPJ) | Pix, cartão e boleto | aplicação "Loja Estudio Benfica" |
| Telegram | Aviso de vendas | bot "Venda Lojinha Benfica" |

**Senhas e chaves nunca ficam no código:** elas ficam apenas como segredos no Cloudflare.

## Mesclagens (pull requests)
#1 site v1 · #2 painel e loja escondida · #3 lançamento da loja · #4 pagamento online · #5 Minha conta · #6 título, versão, termos e Telegram · #7 CNPJ e cidade.
