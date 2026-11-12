/* =========================================================
   Artur Benfica · interações e animações
   JavaScript puro, sem dependências.
   ========================================================= */
(() => {
  "use strict";

  const cfg = window.SITE_CONFIG || {};
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  document.body.classList.add("is-loading");

  /* ---------- Loader ---------- */
  const finishLoading = () => {
    $(".loader")?.classList.add("is-done");
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
  };
  window.addEventListener("load", () => setTimeout(finishLoading, reduceMotion ? 0 : 1100));
  setTimeout(finishLoading, 4000); // segurança caso algum recurso demore

  /* ---------- Ano no rodapé ---------- */
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  /* ---------- WhatsApp ---------- */
  const waLink = (text) => cfg.whatsapp
    ? `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text || cfg.whatsappMessage || "")}`
    : null;

  $$("[data-whatsapp]").forEach((a) => {
    const url = waLink();
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; }
    else a.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Configure seu número de WhatsApp em js/config.js");
    });
  });

  /* ---------- Formulário → WhatsApp ---------- */
  const form = $("#contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = $(".form__note", form);
      let ok = true;
      $$("input, select, textarea", form).forEach((el) => {
        const valid = el.value.trim() !== "";
        el.closest(".field").classList.toggle("is-invalid", !valid);
        if (!valid) ok = false;
      });
      if (!ok) { note.textContent = "Preencha todos os campos, por favor."; return; }

      const msg = `Olá, Artur! Meu nome é ${form.nome.value.trim()}.\n` +
        `Serviço: ${form.servico.value}\n\n${form.mensagem.value.trim()}`;
      const url = waLink(msg);
      if (!url) { note.textContent = "WhatsApp ainda não configurado (js/config.js)."; return; }
      note.textContent = "Abrindo o WhatsApp…";
      window.open(url, "_blank", "noopener");
    });
    $$("input, select, textarea", form).forEach((el) =>
      el.addEventListener("input", () => el.closest(".field").classList.remove("is-invalid")));
  }

  /* ---------- Menu mobile ---------- */
  const toggle = $(".menu-toggle");
  const mobileMenu = $("#mobile-menu");
  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    mobileMenu.setAttribute("aria-hidden", !open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle?.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  $$("#mobile-menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  /* ---------- Header, progresso, botão flutuante ---------- */
  const header = $(".header");
  const progress = $(".progress");
  const wa = $(".wa-float");
  const processLine = $(".process__line span");
  const processSec = $("#processo");
  const reel = $(".reel");
  let lastY = 0, ticking = false;

  const onScroll = () => {
    const sy = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? sy / max : 0})`;
    header.classList.toggle("is-scrolled", sy > 30);
    if (!document.body.classList.contains("menu-open"))
      header.classList.toggle("is-hidden", sy > lastY && sy > 500);
    wa?.classList.toggle("is-visible", sy > innerHeight * 0.6);

    // Linha do processo acompanha a rolagem
    if (processLine && processSec) {
      const r = processSec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height * 0.6)));
      processLine.style.setProperty("--p", p.toFixed(3));
    }

    // Showreel cresce ao entrar na tela
    if (reel && !reduceMotion) {
      const r = reel.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.15) / innerHeight));
      reel.style.transform = `scale(${0.86 + p * 0.14})`;
    }

    lastY = sy; ticking = false;
  };
  window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();


  /* ---------- Trilho lateral: progresso + seção ativa ---------- */
  const railFill = $(".rail__fill");
  const railPct = $(".rail__pct");
  const railLinks = $$(".rail__list a");
  const railSections = railLinks.map((a) => $(a.getAttribute("href")));
  const updateRail = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    railFill?.style.setProperty("--rail", p.toFixed(4));
    if (railPct) railPct.textContent = String(Math.round(p * 100)).padStart(3, "0") + "%";
    const mid = innerHeight * 0.45;
    let active = 0;
    railSections.forEach((sec, i) => { if (sec && sec.getBoundingClientRect().top <= mid) active = i; });
    railLinks.forEach((a, i) => {
      a.classList.toggle("is-active", i === active);
      a.classList.toggle("is-passed", i < active);
    });
  };
  window.addEventListener("scroll", () => requestAnimationFrame(updateRail), { passive: true });
  window.addEventListener("resize", updateRail);
  updateRail();

  /* ---------- Link ativo no menu ---------- */
  const navLinks = $$(".nav a:not(.btn)");
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) navLinks.forEach((a) =>
        a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("section[id]").forEach((s) => spy.observe(s));

  /* ---------- Reveal ao rolar (com escalonamento) ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      revealIO.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el) => {
    const siblings = $$(":scope > .reveal", el.parentElement);
    const i = siblings.indexOf(el);
    if (i > 0) el.style.setProperty("--d", `${Math.min(i * 0.08, 0.4)}s`);
    revealIO.observe(el);
  });

  /* ---------- Palavras girando no hero ---------- */
  const word = $(".rotator__word");
  const words = cfg.rotatorWords || [];
  if (word && words.length > 1 && !reduceMotion) {
    let i = 0;
    setInterval(() => {
      word.classList.add("is-out");
      setTimeout(() => {
        i = (i + 1) % words.length;
        word.textContent = words[i];
        word.classList.remove("is-out");
        word.classList.add("is-in");
        void word.offsetWidth; // força reflow
        word.classList.remove("is-in");
      }, 450);
    }, 2400);
  }

  /* ---------- Cursor personalizado ---------- */
  if (finePointer && !reduceMotion) {
    const cursor = $(".cursor");
    const label = $(".cursor__label");
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; cursor.classList.add("is-visible"); }, { passive: true });
    document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
    const loop = () => {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener("mouseover", (e) => {
      const withLabel = e.target.closest("[data-cursor]");
      const hoverable = e.target.closest("a, button, .filter, input, select, textarea");
      cursor.classList.toggle("has-label", !!withLabel);
      cursor.classList.toggle("is-hover", !withLabel && !!hoverable);
      label.textContent = withLabel ? withLabel.dataset.cursor : "";
    });
  }

  /* ---------- Botões magnéticos ---------- */
  if (finePointer && !reduceMotion) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- Inclinação 3D + brilho seguindo o mouse ---------- */
  if (finePointer && !reduceMotion) {
    $$(".tilt").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
        el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- Filtro do portfólio ---------- */
  const works = $$(".work");
  $$(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".filter").forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active"); btn.setAttribute("aria-selected", "true");
      const f = btn.dataset.filter;
      works.forEach((w, i) => {
        const show = f === "all" || w.dataset.cat === f;
        if (!show) { w.classList.add("is-hidden"); return; }
        const wasHidden = w.classList.contains("is-hidden");
        w.classList.remove("is-hidden");
        if (wasHidden || f !== "all") {
          w.classList.add("is-entering");
          setTimeout(() => w.classList.remove("is-entering"), 30 + i * 40);
        }
      });
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = $(".lightbox");
  const stage = $(".lightbox__stage");
  const caption = $(".lightbox__caption");
  let current = 0;
  const visible = () => works.filter((w) => !w.classList.contains("is-hidden"));
  const show = (idx) => {
    const list = visible();
    if (!list.length) return;
    current = (idx + list.length) % list.length;
    const w = list[current];
    const media = w.querySelector("img, .placeholder");
    stage.innerHTML = "";
    stage.appendChild(media.cloneNode(true));
    caption.textContent = w.dataset.title || "";
  };
  const openLb = (w) => {
    show(visible().indexOf(w));
    lb.classList.add("is-open"); lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $(".lightbox__close").focus();
  };
  const closeLb = () => {
    lb.classList.remove("is-open"); lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };
  works.forEach((w) => {
    w.tabIndex = 0;
    w.setAttribute("role", "button");
    w.addEventListener("click", () => openLb(w));
    w.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLb(w); } });
  });
  $(".lightbox__close").addEventListener("click", closeLb);
  $(".lightbox__prev").addEventListener("click", () => show(current - 1));
  $(".lightbox__next").addEventListener("click", () => show(current + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (lb.classList.contains("is-open")) closeLb(); else setMenu(false); }
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  // Deslizar no celular
  let tx = 0;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });

  /* ---------- Showreel ---------- */
  const playBtn = $(".reel__play");
  playBtn?.addEventListener("click", () => {
    const src = reel.dataset.video;
    if (!src) { $(".reel__hint").textContent = "Adicione o link do seu vídeo em index.html (data-video)"; return; }
    const sep = src.includes("?") ? "&" : "?";
    $(".reel__frame").innerHTML =
      `<iframe src="${src}${sep}autoplay=1" title="Showreel" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  });

  /* ---------- Parallax suave dos brilhos do hero ---------- */
  if (!reduceMotion) {
    const glows = $$(".hero__glow");
    window.addEventListener("scroll", () => {
      const sy = window.scrollY;
      if (sy > innerHeight) return;
      glows.forEach((g, i) => { g.style.translate = `0 ${sy * (i ? -0.15 : 0.25)}px`; });
    }, { passive: true });
  }
})();
