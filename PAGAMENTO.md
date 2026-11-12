# Pagamento online · Estúdio Benfica

Pix, crédito (até 6×) e débito pelo **Mercado Pago (conta CNPJ)**, com entrega automática dos originais.
Funciona sem o plano Blaze do Firebase: o servidor roda no **Cloudflare Workers** (grátis).

```
Cliente escolhe as fotos ──► Worker /criarPagamento  (recalcula o preço com o catálogo do Firestore)
                               │
                               ▼
                 Checkout do Mercado Pago (Pix / cartão)
                               │
        aviso automático ──►  Worker /webhook  (reconsulta o pagamento no Mercado Pago)
                               │
                               ▼
     loja.html?pedido=… ──►  /statusPedido ──► /baixar  (original direto do seu Drive, por 30 dias)
```

| Peça | Onde |
|---|---|
| Servidor | `worker/loja-worker.js` (gerado de `worker/src.js` + `js/precos.js` por `ferramentas/montar_worker.py`) |
| Pedidos | Firestore `pedidos/{id}`: aguardando → pago (ou cancelado). Aparecem no painel |
| Originais | Seu Google Drive, pasta "Loja Estúdio Benfica · Originais" (o painel libera a leitura para o servidor) |

---

## Ativação (uma vez)

### 1. Conta de serviço do Google (dá ao servidor acesso ao banco e ao Drive)
1. Abra https://console.cloud.google.com/iam-admin/serviceaccounts?project=estudio-benfica
2. **+ Criar conta de serviço** → nome: `loja-servidor` (o ID fica `loja-servidor`) → **Criar e continuar**.
3. Papel: **Usuário do Cloud Datastore** (*Cloud Datastore User*) → **Continuar** → **Concluir**.
4. Clique na conta criada → aba **Chaves** → **Adicionar chave → Criar nova chave → JSON → Criar**.
   Um arquivo `.json` é baixado. **Guarde com cuidado e não envie por chat ou e-mail.**

### 2. Mercado Pago
1. https://www.mercadopago.com.br/developers → **Suas integrações → Criar aplicação**.
2. Tipo: **Pagamentos online**, produto **Checkout Pro**.
3. Em **Credenciais de teste**, copie o **Access Token** (começa com `TEST-`). Comece por ele.

### 3. Cloudflare (servidor)
1. Crie uma conta gratuita em https://dash.cloudflare.com/sign-up
2. **Workers e Pages → Criar → Criar Worker** → nome: `loja-estudio-benfica` → **Implantar**.
3. **Editar código**: apague tudo, cole o conteúdo de `worker/loja-worker.js` → **Implantar**.
4. **Configurações → Variáveis e segredos → Adicionar**:
   | Tipo | Nome | Valor |
   |---|---|---|
   | Segredo | `GOOGLE_SERVICE_ACCOUNT` | o conteúdo inteiro do arquivo `.json` do passo 1 |
   | Segredo | `MP_ACCESS_TOKEN` | o Access Token do passo 2 |
   | Texto | `SITE_URL` | `https://benficazzz.github.io/Site-Artur-Benfica` |
5. Copie o endereço do Worker (algo como `https://loja-estudio-benfica.SEU-NOME.workers.dev`).
   Abra esse endereço: deve aparecer `{"ok":true,"servico":"Loja Estúdio Benfica"}`.

### 4. Ligar no site
Em `js/firebase-config.js`: `LOJA_API = "<endereço do Worker>"` e `LOJA_ATIVA = true` (ou peça para o Claude).

### 5. Testar e virar a chave
1. Com o token de **teste**, faça uma compra usando os cartões de teste do Mercado Pago.
2. Confira: volta com "Pagamento aprovado!", o download funciona e o pedido aparece como **Pago** no painel.
3. Troque o segredo `MP_ACCESS_TOKEN` pelo **Access Token de produção** (Credenciais de produção da mesma aplicação).

## Importante
- As fotos enviadas pelo painel **depois** desta atualização já ficam disponíveis para o servidor.
  Se houver fotos enviadas antes, abra o painel e envie qualquer arquivo novo: a pasta é liberada na hora.
- Taxas e prazo de liberação do dinheiro são os do Mercado Pago para a sua conta.
- O Worker gratuito aguenta 100 mil requisições por dia.

---

## Aviso de venda no Telegram (opcional)
A cada pagamento aprovado, o servidor manda uma mensagem para você com o código do pedido, cliente, valor e forma de pagamento.

1. No Telegram, abra o **@BotFather** → envie `/newbot` → escolha um nome (ex.: *Vendas Estúdio Benfica*) e um usuário terminado em `bot`.
   Ele responde com um **token** (algo como `123456:ABC...`). Não envie esse token por chat.
2. Abra o seu bot novo e mande **/start** para ele.
3. No navegador, abra `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` e procure `"chat":{"id":` — esse número é o seu **chat id**.
4. No Cloudflare (Worker → Configurações → Variáveis e segredos):
   | Tipo | Nome | Valor |
   |---|---|---|
   | Segredo | `TELEGRAM_TOKEN` | o token do passo 1 |
   | Texto | `TELEGRAM_CHAT_ID` | o número do passo 3 |
5. Teste: abra `https://loja-estudio-benfica.arturbenfica5.workers.dev/testeAviso?chat=<SEU_CHAT_ID>` — deve chegar uma mensagem no Telegram.

## Atualizações do site
Antes de publicar mudanças em CSS/JS, rode `python3 ferramentas/versao.py` (carimba a versão nos arquivos e evita cache antigo).
