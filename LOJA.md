# Loja · Estúdio Benfica

Venda de fotos e vídeos com pagamento pelo Mercado Pago (Pix, crédito, débito).

## Como funciona

```
Cliente escolhe fotos/vídeos ──► criarPagamento (servidor recalcula o preço)
                                   │
                                   ▼
                     Checkout do Mercado Pago (Pix / cartão)
                                   │
              aviso automático ──► webhookMercadoPago (confere o pagamento na API)
                                   │
                                   ▼
            loja.html?pedido=… ──► statusPedido ──► baixar (arquivo original, 30 dias)
```

| Parte | Onde fica |
|---|---|
| Página da loja | `loja.html`, `js/loja.js`, `css/loja.css` (GitHub Pages) |
| Regra de preços | `js/precos.js` (a mesma no site e no servidor) |
| Servidor | `functions/index.js` (Cloud Functions, região São Paulo) |
| Segurança | `firestore.rules`, `storage.rules` |
| Catálogo de demonstração | `js/loja-demo.js` (usado enquanto o Firebase não está ligado) |

## Preços

Padrão em `js/precos.js` (cada evento pode ter os seus em `eventos/{id}.precos`):

- Foto avulsa **R$ 10** · pacotes 5 = R$ 40, 10 = R$ 70, 20 = R$ 120
- Vídeo avulso **R$ 10** · pacotes 5 = R$ 40, 10 = R$ 70
- Pacotes fechados (exemplo, ajuste por evento): todas as fotos do atleta R$ 40, do time R$ 120;
  todos os vídeos do atleta R$ 40, do time R$ 120; fotos + vídeos do atleta R$ 70, do time R$ 200

Um pacote fechado só aparece quando sai mais barato do que comprar as mesmas fotos avulsas.

## Estrutura no Firestore

```
config/precos                 (opcional) sobrescreve os preços padrão
eventos/{eventoId}            nome, data "AAAA-MM-DD", local, capa, times[], publico: true, precos?
eventos/{eventoId}/itens/{id} tipo "foto"|"video", previa (URL pública com marca d'água),
                              original ("originais/…" no Storage), time, atleta, titulo, ordem
pedidos/{pedidoId}            criado só pelo servidor
```

Storage: `previas/…` é público; `originais/…` é fechado e só sai pela função `baixar` depois do pagamento.

---

## Publicar (passo a passo)

### 1. No console do Firebase (projeto `estudio-benfica`)
1. **Firestore Database** → Criar banco → modo **produção** → local **southamerica-east1 (São Paulo)**.
2. **Storage** → Começar → mesmo local.
3. **Upgrade para o plano Blaze** (necessário para as funções). Em seguida, no Google Cloud
   → Faturamento → **Orçamentos e alertas** → crie um alerta (ex.: R$ 20/mês).
4. ⚙️ Configurações do projeto → **Seus apps** → ícone **Web (</>)** → registre "Site".
   Copie `apiKey` e `appId` para `js/firebase-config.js`.

### 2. No Mercado Pago (conta CNPJ)
1. Acesse **mercadopago.com.br/developers** → Suas integrações → **Criar aplicação** → Checkout Pro.
2. Pegue o **Access Token de teste** primeiro (para testar sem cobrar) e, depois, o **de produção**.
3. Não envie o token por chat ou e-mail: ele é cadastrado direto no Firebase (passo 3).

### 3. No seu computador (uma vez)
Precisa do Node.js 20+ instalado (nodejs.org).

```bash
npm install -g firebase-tools
firebase login
git clone https://github.com/benficazzz/Site-Artur-Benfica.git
cd Site-Artur-Benfica/functions && npm install && cd ..
firebase functions:secrets:set MP_ACCESS_TOKEN
firebase deploy --only firestore,storage,functions
```

O comando `secrets:set` pede o token na tela; cole o Access Token e tecle Enter.

### 4. Testar
Com o token **de teste**, faça uma compra usando os cartões de teste do Mercado Pago.
Confira se a página volta com "Pagamento aprovado" e se o download funciona.
Depois troque para o token de produção (repita o `secrets:set` e o `deploy --only functions`).

## Próxima fase
Sincronização com o Google Drive: uma pasta por evento → prévias com marca d'água e originais
enviados automaticamente para a loja.

---

## Catálogo a partir do Google Drive (em uso)

Pasta no Drive: **Loja Estúdio Benfica** (veja o arquivo `COMO USAR` dentro dela).

```
Loja Estúdio Benfica/
  AAAA-MM-DD · Nome do evento/
    Nome do time/
      [Nome ou camisa do atleta/]
        fotos e vídeos
```

Para publicar: peça "sincroniza a loja". O processo baixa os arquivos novos, roda
`ferramentas/sincronizar_loja.py` (prévias com marca d'água em `assets/loja/` e
`data/catalogo.json`) e publica no site. Os originais continuam só no Drive.

Enquanto o pagamento online não está ativo, o carrinho envia o pedido pelo **WhatsApp**
(com a lista de arquivos e o total) e o Pix é combinado direto.
