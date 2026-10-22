/* ==========================================================================
   ARRANCA TJ  |  app.js
   Dependencias locales: GSAP + ScrollTrigger + Lenis (assets/vendor)
   Estructura:
     1. Utilidades y flags
     2. Funciones que no necesitan GSAP (menú, FAQ, formulario, enlaces)
     3. Loader
     4. Scroll suave (Lenis)
     5. Hero (entrada, parallax, canvas de energía)
     6. Animaciones de scroll por sección
     7. Arranque
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Utilidades y flags
     ------------------------------------------------------------------------ */
  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const motion = hasGSAP && !reduceMotion;

  const WA_NUMBER = '526648208134';
  const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  let lenis = null;
  let refreshTimer = 0;
  const refreshSoon = (ms = 120) => {
    if (!hasGSAP) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => window.ScrollTrigger.refresh(), ms);
  };

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ------------------------------------------------------------------------
     2. Funciones que no necesitan GSAP
     ------------------------------------------------------------------------ */

  /** Enlaces a WhatsApp con mensaje prellenado */
  function initWhatsAppLinks() {
    $$('[data-wa]').forEach((a) => {
      a.href = waUrl(a.dataset.wa);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
  }

  /** Menú móvil */
  let closeMenu = () => {};
  function initMenu() {
    const toggle = $('#navToggle');
    const menu = $('#menu');
    if (!toggle || !menu) return;

    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      doc.classList.toggle('menu-open', open);
      if (lenis) open ? lenis.stop() : lenis.start();
    };

    closeMenu = () => setMenu(false);
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /** Navegación: sombra al bajar + scroll suave a anclas */
  function initNavAndAnchors() {
    const nav = $('#nav');
    if (nav && 'IntersectionObserver' in window) {
      const sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none';
      document.body.prepend(sentinel);
      new IntersectionObserver(([entry]) => nav.classList.toggle('is-stuck', !entry.isIntersecting)).observe(sentinel);
    }

    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = $(id);
        if (!target) return;
        e.preventDefault();
        closeMenu(); // reanuda el scroll antes de desplazarse
        if (lenis) lenis.scrollTo(target, { offset: id === '#inicio' ? 0 : -8, duration: 1.5 });
        else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
        history.replaceState(null, '', id);
      });
    });
  }

  /** Preguntas frecuentes (acordeón accesible) */
  function initFaq() {
    const items = $$('.qa');
    const setOpen = (qa, open) => {
      qa.classList.toggle('is-open', open);
      $('.qa__q', qa).setAttribute('aria-expanded', String(open));
    };
    items.forEach((qa) => {
      $('.qa__q', qa).addEventListener('click', () => {
        const willOpen = !qa.classList.contains('is-open');
        items.forEach((other) => setOpen(other, false));
        setOpen(qa, willOpen);
        refreshSoon(650);
      });
    });
    if (items[0]) setOpen(items[0], true);
  }

  /** Formulario: valida, arma el mensaje y abre WhatsApp */
  function initForm() {
    const form = $('#leadForm');
    if (!form) return;
    const btn = $('#submitBtn');
    const btnLabel = btn.querySelector('span');
    const okBox = $('#formOk');
    const fallback = $('#waFallback');
    const idleLabel = btnLabel.textContent;

    const rules = {
      nombre: { el: $('#f-nombre'), err: $('#e-nombre'), msg: 'Escribe tu nombre para que Carlos sepa con quién habla.', test: (v) => v.trim().length >= 2 },
      interes: { el: $('#f-interes'), err: $('#e-interes'), msg: 'Elige qué necesitas.', test: (v) => v !== '' },
      zona: { el: $('#f-zona'), err: $('#e-zona'), msg: 'Elige dónde nos vemos.', test: (v) => v !== '' },
    };

    const validate = (key, show = true) => {
      const r = rules[key];
      const ok = r.test(r.el.value);
      const field = r.el.closest('.field');
      field.classList.toggle('has-error', !ok && show);
      r.el.setAttribute('aria-invalid', String(!ok && show));
      r.err.textContent = !ok && show ? r.msg : '';
      return ok;
    };

    Object.keys(rules).forEach((key) => {
      const r = rules[key];
      r.el.addEventListener('blur', () => validate(key));
      r.el.addEventListener('input', () => { if (r.el.closest('.field').classList.contains('has-error')) validate(key); });
      r.el.addEventListener('change', () => { if (r.el.closest('.field').classList.contains('has-error')) validate(key); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const results = Object.keys(rules).map((k) => ({ k, ok: validate(k) }));
      const firstBad = results.find((r) => !r.ok);
      if (firstBad) { rules[firstBad.k].el.focus(); return; }

      const nombre = rules.nombre.el.value.trim();
      const mensaje = $('#f-msg').value.trim();
      const text =
        `Hola Carlos, soy ${nombre}.\n` +
        `Quiero: ${rules.interes.el.value}.\n` +
        `Punto de entrega: ${rules.zona.el.value}.` +
        (mensaje ? `\nMensaje: ${mensaje}` : '') +
        '\n(Enviado desde la página web)';
      const url = waUrl(text);

      btn.classList.add('is-loading');
      btn.querySelector('i').className = 'ph ph-circle-notch';
      btnLabel.textContent = 'Abriendo WhatsApp...';
      fallback.href = url;

      const win = window.open(url, '_blank', 'noopener');
      setTimeout(() => {
        btn.classList.remove('is-loading');
        btn.querySelector('i').className = 'ph-fill ph-whatsapp-logo';
        btnLabel.textContent = idleLabel;
        okBox.hidden = false;
        if (!win) okBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 900);
    });
  }

  /** Botón flotante de WhatsApp: entra, se abre un momento y se recoge */
  function showFloatingButton() {
    const wa = $('#waFloat');
    if (!wa) return;
    wa.classList.add('is-in');
    if (reduceMotion) return;
    setTimeout(() => wa.classList.add('is-open'), 5200);
    setTimeout(() => wa.classList.remove('is-open'), 9800);
  }

  /* ------------------------------------------------------------------------
     3. Loader (anillo de carga, porcentaje y cortinas)
     ------------------------------------------------------------------------ */
  function runLoader() {
    const loader = $('#loader');
    if (!loader) return Promise.resolve();

    const finish = () => {
      loader.setAttribute('data-done', '');
      loader.style.display = 'none';
      doc.classList.remove('is-loading');
    };

    if (!motion) { finish(); return Promise.resolve(); }

    const pctEl = $('#loaderPct');
    const statusEl = $('#loaderStatus');
    const arc = $('.loader__arc');
    const CIRC = 339.3;
    const messages = [[0, 'Cargando energía'], [34, 'Conectando satélites'], [68, 'Verificando carga'], [96, 'Listo para arrancar']];
    const state = { p: 0 };
    let msgIndex = -1;

    const render = () => {
      pctEl.textContent = Math.round(state.p);
      arc.style.strokeDashoffset = CIRC * (1 - state.p / 100);
      for (let i = messages.length - 1; i >= 0; i--) {
        if (state.p >= messages[i][0]) {
          if (i !== msgIndex) { msgIndex = i; statusEl.textContent = messages[i][1]; }
          break;
        }
      }
    };

    const pageReady = Promise.all([
      document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })),
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    ]);

    return new Promise((resolve) => {
      const tl = gsap.timeline();
      tl.to(state, { p: 88, duration: 1.6, ease: 'power2.out', onUpdate: render })
        .add(() => { tl.pause(); pageReady.then(() => tl.resume()); })
        .to(state, { p: 100, duration: 0.5, ease: 'power1.inOut', onUpdate: render })
        .to('.loader__bolt', { scale: 1.45, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out' }, '>-0.15')
        .to('.loader__core', { opacity: 0, y: -24, duration: 0.45, ease: 'power2.in' }, '+=0.12')
        .to('.loader__panel--l', { xPercent: -101, duration: 1.05, ease: 'expo.inOut' }, '>-0.1')
        .to('.loader__panel--r', { xPercent: 101, duration: 1.05, ease: 'expo.inOut' }, '<')
        .add(() => { doc.classList.remove('is-loading'); resolve(); }, '>-0.55')
        .add(finish, '>');
    });
  }

  /* ------------------------------------------------------------------------
     4. Scroll suave (Lenis) sincronizado con ScrollTrigger
     ------------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (!motion || typeof window.Lenis === 'undefined') return;
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', window.ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // se libera cuando termina el loader
  }

  /* ------------------------------------------------------------------------
     5. Hero
     ------------------------------------------------------------------------ */
  function prepareHero() {
    gsap.set('.line__in', { yPercent: 118 });
    gsap.set('[data-hero-in]', { opacity: 0, y: 30 });
    gsap.set('.stage__orb', { scale: 0.55, opacity: 0 });
    gsap.set('.stage__spin', { opacity: 0 });
    gsap.set('.stage__card', { opacity: 0, y: 90 });
    gsap.set('.stage__gps', { opacity: 0, y: -70 });
    gsap.set('#nav', { yPercent: -170 });
    gsap.set('#flicker', { '--on': 0 });
  }

  /** Entrada del hero. "varado" parpadea como una luz que se enciende. */
  function playHeroIntro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.line__in', { yPercent: 0, duration: 1.25, stagger: 0.14 }, 0)
      .to('#nav', { yPercent: 0, duration: 1.1 }, 0.1)
      .to('.stage__orb', { scale: 1, opacity: 1, duration: 1.5, ease: 'back.out(1.5)' }, 0.15)
      .to('.stage__spin', { opacity: 1, duration: 1.4 }, 0.5)
      .to('.stage__card', { opacity: 1, y: 0, duration: 1.3 }, 0.35)
      .to('.stage__gps', { opacity: 1, y: 0, duration: 1.3 }, 0.45)
      .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.65)
      .to('#flicker', {
        keyframes: [
          { '--on': 0.9, duration: 0.05 }, { '--on': 0, duration: 0.07 }, { '--on': 1, duration: 0.05 },
          { '--on': 0.15, duration: 0.09 }, { '--on': 1, duration: 0.05 }, { '--on': 0.45, duration: 0.07 },
          { '--on': 1, duration: 0.3 },
        ],
        ease: 'none',
      }, 0.95)
      .add(initHeroParallax);
  }

  /** Las capas del escenario siguen el puntero con distinta profundidad */
  function initHeroParallax() {
    const hero = $('.hero');
    if (!hero) return;

    // Al bajar, el escenario sube un poco más lento que la página
    gsap.to('#stage', {
      yPercent: -10, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });

    if (!finePointer) return;
    const layers = $$('[data-depth]', hero).map((el) => ({
      d: parseFloat(el.dataset.depth),
      x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' }),
      y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' }),
    }));
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach((l) => { l.x(nx * 38 * l.d); l.y(ny * 30 * l.d); });
    });
    hero.addEventListener('pointerleave', () => layers.forEach((l) => { l.x(0); l.y(0); }));
  }

  /** Campo de energía: nodos que derivan, enlaces y arcos eléctricos */
  function initEnergyField() {
    const canvas = $('#energy');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    const INK = '12,12,14';
    const VOLT = '255,214,10';
    let w = 0, h = 0, dpr = 1, last = 0, nextArc = 0, raf = 0, running = false;
    let nodes = [];
    let arcs = [];
    const mouse = { x: -999, y: -999, on: false };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = clamp(Math.round((w * h) / 21000), 22, 70);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.36, vy: (Math.random() - 0.5) * 0.36,
        r: Math.random() * 1.4 + 0.9, hot: Math.random() < 0.16,
      }));
      arcs = [];
    };

    const boltPath = (a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const pts = [{ x: a.x, y: a.y }];
      const segs = 8;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const off = (Math.random() - 0.5) * 34 * Math.sin(Math.PI * t);
        pts.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
      }
      pts.push({ x: b.x, y: b.y });
      return pts;
    };

    const strokePath = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };

    const frame = (t) => {
      const dt = Math.min(34, t - last) / 16.7;
      last = t;
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
        if (mouse.on) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 19600) { const d = Math.sqrt(d2) || 1, f = (1 - d / 140) * 1.5; n.x += (dx / d) * f * dt; n.y += (dy / d) * f * dt; }
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d2 = dx * dx + dy * dy;
          if (d2 < 14400) {
            ctx.strokeStyle = `rgba(${INK},${((1 - Math.sqrt(d2) / 120) * 0.2).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        if (n.hot) {
          ctx.fillStyle = `rgba(${VOLT},.28)`; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 5, 0, 6.2832); ctx.fill();
          ctx.fillStyle = `rgb(${VOLT})`; ctx.strokeStyle = `rgba(${INK},.85)`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 2.1, 0, 6.2832); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${INK},.34)`; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.2832); ctx.fill();
        }
      }

      // Arcos eléctricos entre nodos "calientes" cercanos
      if (t > nextArc) {
        const hot = nodes.filter((n) => n.hot);
        const a = hot[Math.floor(Math.random() * hot.length)];
        if (a) {
          const near = nodes.filter((n) => n !== a && Math.hypot(n.x - a.x, n.y - a.y) < 320 && Math.hypot(n.x - a.x, n.y - a.y) > 80);
          const b = near[Math.floor(Math.random() * near.length)];
          if (b) arcs.push({ a, b, born: t, life: 650, jit: 0, pts: boltPath(a, b) });
        }
        nextArc = t + 450 + Math.random() * 900;
      }
      arcs = arcs.filter((arc) => t - arc.born < arc.life);
      ctx.lineJoin = 'round';
      for (const arc of arcs) {
        if (t - arc.jit > 55) { arc.pts = boltPath(arc.a, arc.b); arc.jit = t; }
        const k = 1 - (t - arc.born) / arc.life;
        ctx.strokeStyle = `rgba(${VOLT},${(k * 0.55).toFixed(3)})`; ctx.lineWidth = 7; strokePath(arc.pts);
        ctx.strokeStyle = `rgba(${INK},${(k * 0.9).toFixed(3)})`; ctx.lineWidth = 1.4; strokePath(arc.pts);
      }

      if (running) raf = requestAnimationFrame(frame);
    };

    const start = () => { if (running || reduceMotion) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    if (reduceMotion) { frame(performance.now()); return; }

    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 200); });
    const hero = $('.hero');
    if (finePointer && hero) {
      hero.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; });
      hero.addEventListener('pointerleave', () => { mouse.on = false; });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { threshold: 0 }).observe(canvas);
    } else start();
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (canvas.getBoundingClientRect().bottom > 0) start(); });
  }

  /* ------------------------------------------------------------------------
     6. Animaciones de scroll por sección
     ------------------------------------------------------------------------ */

  /** Divide un texto en palabras con máscara (conserva etiquetas internas) */
  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span');
            inner.className = 'w__in'; inner.textContent = tok;
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
    return $$('.w__in', el);
  }

  function initRevealsAndText() {
    $$('[data-split]').forEach((el) => {
      const words = splitWords(el);
      gsap.from(words, {
        yPercent: 118, duration: 1.15, stagger: 0.05, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    $$('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 46, opacity: 0, duration: 1.1, ease: 'expo.out',
        delay: parseFloat(el.dataset.delay || '0'),
        scrollTrigger: { trigger: el, start: 'top 91%', once: true },
      });
    });

    // Contadores
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const obj = { v: 0 };
      el.textContent = '0';
      window.ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(obj, {
          v: end, duration: end > 1000 ? 2.4 : 1.7, ease: 'power3.out',
          onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('es-MX'); },
        }),
      });
    });
  }

  /** Marquee único: velocidad ligada al scroll, invierte al subir */
  function initMarquee() {
    const track = $('#marquee');
    if (!track) return;
    $$('.marquee__set', track).forEach((set) => { set.innerHTML += set.innerHTML; });
    const tween = gsap.to(track, { xPercent: -50, duration: 30, ease: 'none', repeat: -1 });

    let velocity = 0, dir = 1, boost = 0;
    window.ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { velocity = self.getVelocity(); } });
    gsap.ticker.add(() => {
      if (Math.abs(velocity) > 30) dir = velocity > 0 ? 1 : -1;
      boost += (clamp(Math.abs(velocity) / 450, 0, 7) - boost) * 0.07;
      tween.timeScale(dir * (1 + boost));
    });
  }

  /** Progreso de la página como "carga de batería" */
  function initScrollProgress() {
    const pct = $('#chargePct');
    window.ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        doc.style.setProperty('--p', self.progress.toFixed(4));
        if (pct) pct.textContent = `${Math.round(self.progress * 100)}%`;
      },
    });
  }

  function initScrollScenes() {
    const mm = gsap.matchMedia();

    /* Jumpers: la segunda tarjeta cubre a la primera */
    mm.add('(min-width: 900px)', () => {
      const cards = $$('.jcard');
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.94, '--dim': 0.55, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 85%', end: 'top 130px', scrub: true },
        });
      });
    });
    mm.add('(max-width: 899px)', () => {
      $$('.jcard').forEach((card) => {
        gsap.from(card, { y: 70, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 90%', once: true } });
      });
    });

    /* Entrega: el panel oscuro se abre a pantalla completa y el flyer gira a su lugar */
    const pin = $('.entrega__pin');
    const panel = $('.entrega__panel');
    const flyer = $('#flyer');
    const buildExpand = (fromClip) => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: pin, start: 'top top', end: '+=115%', scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true },
      });
      tl.fromTo(panel, { clipPath: fromClip }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', duration: 1 }, 0)
        .fromTo(flyer, { rotate: -9, scale: 0.7, yPercent: 14 }, { rotate: 0, scale: 1, yPercent: 0, ease: 'none', duration: 1 }, 0);
      return () => tl.kill();
    };
    if (pin && panel && flyer) {
      mm.add('(min-width: 900px)', () => buildExpand('inset(9% 5% 9% 5% round 44px)'));
      mm.add('(max-width: 899px)', () => buildExpand('inset(5% 3.5% 5% 3.5% round 30px)'));
    }

    /* Proceso: la línea se dibuja con el scroll y activa cada paso */
    const fill = $('#processFill');
    const wrap = $('#processSteps');
    if (fill && wrap) {
      const draw = (prop) => gsap.fromTo(fill, { [prop]: 0 }, {
        [prop]: 1, ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top 62%', end: 'bottom 72%', scrub: 0.5 },
      });
      mm.add('(min-width: 900px)', () => { const t = draw('scaleX'); return () => t.kill(); });
      mm.add('(max-width: 899px)', () => { const t = draw('scaleY'); return () => t.kill(); });
      $$('.pstep').forEach((step) => {
        window.ScrollTrigger.create({
          trigger: step, start: 'top 66%',
          onEnter: () => step.classList.add('is-active'),
          onLeaveBack: () => step.classList.remove('is-active'),
        });
      });
    }

    /* Footer: letras que suben */
    const giant = $$('#giant span');
    if (giant.length) {
      gsap.from(giant, {
        yPercent: 80, opacity: 0, duration: 1.3, stagger: 0.07, ease: 'expo.out',
        scrollTrigger: { trigger: '#giant', start: 'top 96%', once: true },
      });
    }
  }

  /** GPS: el scroll recorre las 4 funciones. También funciona con clic en cada paso. */
  function initGpsWalkthrough() {
    const track = $('#gpsTrack');
    const visual = $('#gpsVisual');
    if (!track || !visual) return;
    const items = $$('.steps__item');
    const alerts = $$('.alert');
    const dots = $$('#stepDots i');
    let current = -1;

    const setStep = (i) => {
      if (i === current) return;
      current = i;
      items.forEach((item, k) => {
        item.classList.toggle('is-active', k === i);
        const b = $('.steps__btn', item);
        if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      alerts.forEach((a, k) => a.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      visual.dataset.step = String(i);
    };

    window.ScrollTrigger.create({
      trigger: track, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => setStep(clamp(Math.floor(self.progress * items.length), 0, items.length - 1)),
    });

    $$('.steps__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.step, 10);
        const top = track.getBoundingClientRect().top + window.scrollY;
        const y = top + ((i + 0.5) / items.length) * (track.offsetHeight - window.innerHeight);
        if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /** Micro-interacciones solo para puntero fino: botones magnéticos y tarjetas con inclinación */
  function initPointerEffects() {
    if (!finePointer) return;

    $$('[data-magnetic]').forEach((el) => {
      const x = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3' });
      const y = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.2);
        y((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    });

    $$('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
        ry((px - 0.5) * 9);
        rx((0.5 - py) * 9);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ------------------------------------------------------------------------
     7. Arranque
     ------------------------------------------------------------------------ */
  function boot() {
    initWhatsAppLinks();
    initMenu();
    initFaq();
    initForm();
    initNavAndAnchors();

    if (!hasGSAP) {
      // Sin GSAP la página sigue siendo totalmente funcional (contenido visible)
      const loader = $('#loader');
      if (loader) { loader.setAttribute('data-done', ''); loader.style.display = 'none'; }
      doc.classList.remove('is-loading');
      showFloatingButton();
      initEnergyField();
      return;
    }

    gsap.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.config({ ignoreMobileResize: true });
    window.scrollTo(0, 0);

    initScrollProgress();
    initGpsWalkthrough();
    initEnergyField();

    if (motion) {
      doc.classList.add('anim');
      initSmoothScroll();
      prepareHero();
      initRevealsAndText();
      initMarquee();
      initScrollScenes();
      initPointerEffects();
    }

    runLoader().then(() => {
      if (lenis) lenis.start();
      if (motion) playHeroIntro();
      showFloatingButton();
      window.ScrollTrigger.refresh();
    });

    window.addEventListener('load', () => refreshSoon(200));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => refreshSoon(100));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
