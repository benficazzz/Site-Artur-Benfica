# Painel do Estúdio Benfica

Endereço: **https://benficazzz.github.io/Site-Artur-Benfica/admin.html** (não aparece no menu do site).
Treino sem risco: `admin.html?teste=1` (os dados ficam só no seu navegador).

## O que dá para fazer
- **Eventos (álbuns):** criar, editar, definir times, publicar, ocultar (rascunho) ou transformar em galeria privada (só abre pelo link).
- **Fotos e vídeos:** arrastar os arquivos. O painel:
  1. gera a prévia com a marca d'água diagonal (foto de até 1400 px; vídeo com um trecho de 6 s);
  2. envia o **original** para o seu Google Drive, na pasta *Loja Estúdio Benfica · Originais / data · evento*;
  3. publica a prévia na loja.
- **Time e atleta:** escolha antes de enviar ou selecione vários arquivos e aplique de uma vez.
- **Preços:** foto e vídeo avulsos, pacotes por quantidade e pacotes fechados (atleta ou time). Cada evento pode ter preços próprios.
- **Pedidos:** cada pedido feito na loja (pelo WhatsApp) aparece aqui com um código. Quando o Pix cair, marque como **Pago** e clique em **Gerar links de entrega**: o painel libera os originais no Drive e monta a mensagem pronta para copiar ou mandar por e-mail.

## Onde fica cada coisa
| Dado | Onde |
|---|---|
| Eventos, itens, preços, pedidos | Firestore (projeto `estudio-benfica`, plano gratuito) |
| Prévias com marca d'água | Firestore (coleção `previas`) e miniaturas dentro de cada item |
| Originais | Seu Google Drive (só você vê, até liberar a entrega) |

Limites do plano gratuito do Firestore: 1 GB de dados e 50 mil leituras por dia. Isso dá para algumas
centenas de eventos e milhares de visitas por dia. Se um dia passar disso, migramos as prévias para outro serviço.

---

## Ativação (uma vez, no console do Firebase)

1. **Login com Google**
   Firebase → **Segurança → Authentication → Começar → Método de login → Google → Ativar**.
   Escolha seu e-mail como "e-mail de suporte" e clique em **Salvar**.
2. **Domínio do site**
   Ainda em Authentication → **Configurações → Domínios autorizados → Adicionar domínio**:
   `benficazzz.github.io`
3. **Regras de segurança**
   **Firestore → Regras** → apague o conteúdo, cole o arquivo `firestore.rules` deste repositório → **Publicar**.
4. **API do Google Drive**
   Abra https://console.cloud.google.com/apis/library/drive.googleapis.com?project=estudio-benfica → **Ativar**.

No primeiro login o Google pede permissão para o painel "ver e gerenciar os arquivos do Drive que você usa com este app".
Ele só enxerga os arquivos que o próprio painel criou, não o resto do seu Drive.

## Segurança (testado no emulador oficial do Firebase: 24 regras)
- Só a conta **arturbenfica5@gmail.com** edita eventos, preços e pedidos e vê os originais.
- Visitantes veem apenas eventos publicados; galerias privadas só com o link; rascunhos ninguém vê.
- Visitantes só conseguem **criar** um pedido novo (com dados validados), nunca ler pedidos de outras pessoas.
