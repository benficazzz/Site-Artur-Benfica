# Próximos passos recomendados · Estúdio Benfica

## 🟡 Melhoram as vendas
1. **Domínio próprio** (ex.: `estudiobenfica.com.br`, cerca de R$ 40 por ano no Registro.br)
   - Configurar no GitHub Pages (Settings → Pages → Custom domain) e no DNS do Registro.br.
   - Atualizar o `SITE_URL` no Cloudflare, os domínios autorizados no Firebase Authentication e a lista `ORIGENS` em `worker/src.js`.
2. **E-mail automático com os links das fotos** (depende do domínio)
   - Serviço sugerido: **Resend** (grátis até 3 mil e-mails por mês). Alternativa: Brevo.
   - O Worker envia o e-mail quando o pagamento é aprovado, no mesmo ponto em que hoje manda o aviso do Telegram.
3. **Aparecer no Google**
   - Google Search Console: verificar o site e enviar um sitemap.
   - Google Meu Negócio: perfil gratuito, para buscas como "fotógrafo Betim".
4. **Busca por número da camisa** na loja (o atleta digita "10" e vê só as fotos dele).

## 🟢 Conteúdo (depende do Artur)
- Foto do Artur na seção "Sobre" (em `index.html`, trocar o bloco "Sua foto aqui").
- Link do showreel (YouTube ou Vimeo) no atributo `data-video` da seção Showreel.
- Revisão de todos os textos com as palavras do Artur.
- Mostrar os Termos e a Privacidade ao contador (principalmente cancelamento e reembolso, e licença de uso).

## 🔧 Manutenção
- Antes de cada publicação: `python3 ferramentas/versao.py`.
- Quando mudar `worker/src.js`: `python3 ferramentas/montar_worker.py` e colar o `worker/loja-worker.js` novo no Cloudflare (Editar código → Deploy).
- Quando mudar `firestore.rules`: colar o conteúdo em Firestore → Regras → Publicar.
- Limites gratuitos para acompanhar: Firestore com 1 GB e 50 mil leituras por dia; Worker com 100 mil requisições por dia.
- Se o Blaze for ativado um dia: dá para usar a pasta `functions/` (Cloud Functions) e o Storage.

## Ideias para o futuro
- Galerias privadas com senha para festas e formaturas.
- Cupons de desconto para times parceiros.
- "Encontre suas fotos" por selfie (reconhecimento facial). Exige cuidado com a LGPD.
- Painel com o total vendido por evento e por mês.
