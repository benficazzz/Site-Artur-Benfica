# Site · Artur Benfica

Site pessoal de **fotografia, vídeo e marketing digital**.
Feito em HTML, CSS e JavaScript puro: sem dependências e sem etapa de build, abre direto no navegador.

## Estrutura

```
index.html        → conteúdo e seções do site
css/style.css     → visual, cores e animações
js/config.js      → WhatsApp e palavras do texto de abertura (edite aqui)
js/main.js        → interações (trilho lateral, filtros, lightbox, cursor…)
assets/img/       → suas fotos
```

## Identidade visual

| Cor | Código |
|---|---|
| Preto | `#07080b` |
| Azul | `#2563ff` |
| Branco | `#f5f7fa` |
| Verde-limão | `#c8ff1a` |

Fontes: Syne (títulos), Inter (texto), Geist Mono (rótulos numerados).

## O que falta preencher (checklist)

- [ ] **WhatsApp**: número em `js/config.js` (formato `5531999999999`)
- [ ] **Instagram e e-mail**: links na seção Contato do `index.html`
- [ ] **Sua foto** na seção Sobre (`assets/img/artur.jpg`)
- [ ] **Fotos do portfólio**: substituir os blocos `.placeholder` por `<img>` (há um exemplo comentado no `index.html`)
- [ ] **Showreel**: link de incorporação do YouTube/Vimeo no atributo `data-video`
- [ ] Revisar os textos (bio, serviços) com as suas palavras
- [ ] Logo oficial, se houver (hoje é o monograma "AB")

Dica: exporte as fotos em `.jpg` ou `.webp` com cerca de 1600px no lado maior para o site ficar rápido.

## Ver localmente

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Publicação

Pode ser publicado gratuitamente no GitHub Pages (Settings → Pages → branch principal → pasta raiz).
