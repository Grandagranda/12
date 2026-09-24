// Блоки после первого экрана.
// Всё, что считается от позиции прокрутки, пересчитывается в одном месте (update)
// и в том же кадре, где сдвинулась страница (kmkScroll.onFrame, см. smooth-scroll.js).
// Остальное — на IntersectionObserver и CSS-переходах.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const vh = () => innerHeight;

  // ── заголовки: слова поднимаются из-под маски ──
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach(part => {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    $$('.w', el).forEach(w => w.setAttribute('aria-hidden', 'true'));
  });

  // ── «О проекте»: слова проявляются из размытия по мере прокрутки ──
  const mf = $('[data-blur]');
  let mfWords = [];
  if (mf) {
    const wrapWords = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach(part => {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span'); s.className = 'bw'; s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrapWords(n);
      });
    };
    wrapWords(mf);
    mfWords = $$('.bw', mf);
  }

  // ── кнопки: стрелка из двух SVG (вместо маски) ──
  const AR = '<svg viewBox="0 0 16 16"><path d="M1 8h13M9 3l5 5-5 5"/></svg>';
  $$('.pill-ar').forEach(a => { a.innerHTML = AR + AR; });

  // ── появление по IntersectionObserver ──
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
    if (e.target._onIn) e.target._onIn();
  }), { rootMargin: '0px 0px -12% 0px' });
  // надпись на ролике прибита к окну — её включает reel.js, когда окно открылось
  $$('[data-split]:not(.reel-h),[data-reveal],.cal,.reviews,.apply').forEach(el => io.observe(el));

  // зачёркивания идут прямо за прокруткой, без таймеров: у каждой строки свой отрезок пути --p 0→1 —
  // линия начинает тянуться, когда верх строки поднялся до 68 % высоты окна, и дочерчена к 38 %.
  // Строки стоят друг под другом, поэтому и зачёркиваются по очереди; скролл назад — стирается
  // Описание «Вместо этого» проявляется по словам из размытия, как текст «О проекте»: слово i —
  // на своём отрезке длиной SPAN слов во второй половине пути строки, соседние перекрываются
  const stRows = $$('.st-row');
  stRows.forEach(row => {
    const yes = $('.st-yes', row);
    if (!yes) return;
    [...yes.querySelectorAll('*'), yes].forEach(el => [...el.childNodes].forEach(n => {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/([ \t\n\r]+)/).forEach(part => {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const s = document.createElement('span'); s.className = 'bw'; s.textContent = part;
        frag.appendChild(s);
      });
      n.replaceWith(frag);
    }));
    row._words = $$('.bw', yes);
  });
  function stScrub(h) {
    const SPAN = 5;
    for (const row of stRows) {
      const p = +(reduced ? 1 : clamp((h * .68 - row.getBoundingClientRect().top) / (h * .3), 0, 1)).toFixed(3);
      if (row._p === p) continue;
      row._p = p; row.style.setProperty('--p', p);
      const w = row._words || [], N = w.length, q = clamp((p - .3) / .7, 0, 1);
      for (let i = 0; i < N; i++) {
        const t = +clamp((q * (N + SPAN) - i) / SPAN, 0, 1).toFixed(3);
        if (w[i]._t !== t) { w[i]._t = t; w[i].style.setProperty('--t', t); }
      }
    }
  }

  // свет в «Чего у нас нет» переливается, только пока блок на экране
  const ioLive = new IntersectionObserver(es => es.forEach(e =>
    e.target.classList.toggle('is-live', e.isIntersecting)));
  $$('.strike').forEach(el => ioLive.observe(el));

  // ── счётчики ──
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count;
    if (reduced) return;
    el.textContent = '0';
    const host = el.closest('[data-reveal]');
    host._onIn = () => {
      const t0 = performance.now(), dur = 1600 + to * 4;
      const step = now => {
        const p = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
  });

  // ── горизонтальная лента ──
  const hs = $('.hs'), track = $('.hs-track'), fill = $('.hs-fill');
  const steps = $$('.hs-step'), barLabels = $$('.hs-bar span'), hsImgs = $$('.hs-ph img');
  let hsDist = 0;
  const hsOn = () => innerWidth > 900;
  function hsLayout() {
    if (!hsOn()) { hs.style.height = ''; return; }
    // хвост ленты заканчивается там же, где правый край колонки
    const pad = parseFloat(getComputedStyle(track).paddingLeft);
    hsDist = Math.max(0, track.scrollWidth + pad - innerWidth);
    hs.style.height = (vh() + hsDist) + 'px';
  }

  // ── фото интенсивов: из темноты во всю ширину → сетка 3×3 уменьшается к центру ──
  const life = $('.life'), lfGrid = $('.lf-grid'), lfDim = $('.lf-dim'), stGlow = $('.st-glow');
  // мягкое ускорение и торможение без рывка посередине (пик скорости ×1.57, у кубической было ×3)
  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;
  let lfW = 0, lfS0 = 1, lfY0 = 0, lfY1 = 0;
  function lfLayout() {
    if (!life) return;
    // финал: сетка во всю ширину, но помещается между шапкой и низом окна (с полями по 16 px)
    const barH = bar ? bar.offsetHeight : 0;
    lfW = Math.min(innerWidth, (vh() - barH - 32) * 1800 / 866);
    lfY1 = barH / 2;
    // старт: центральное фото (582 из 1800) растянуто на всю ширину окна и прижато к верху,
    // чтобы верхний ряд был за краем — первыми открываются фото слева, справа и снизу
    lfS0 = innerWidth / (lfW * 582 / 1800);
    lfY0 = lfW * 280 / 1800 * lfS0 / 2 - vh() / 2;
    lfGrid.style.setProperty('--rad', (16 * lfW / 1800).toFixed(2) + 'px');
  }

  // ── бегущая строка: сама ползёт, скролл её подгоняет ──
  const mqIn = $('.mq-in'), mqRow = $('.mq-row');
  if (mqIn) mqRow.appendChild(mqIn.cloneNode(true)).setAttribute('aria-hidden', 'true');
  const mqItems = $$('.mq-in');
  let mqX = 0, mqV = 0, lastY = scrollY, mqW = 0;

  // ── липкая шапка ──
  const bar = $('.bar'), reel = $('.reel'), stage = $('.stage');
  let dimLast = -1;

  function update() {
    const y = scrollY, h = vh();

    // шапка появляется, когда ролик уехал
    const rb = reel.getBoundingClientRect().bottom;
    bar.classList.toggle('is-on', rb < 80);

    // первый экран гаснет под наезжающим «О проекте» (до 85 %, как город на «Байкале»)
    const dim = +(clamp(y / (stage.offsetHeight || 1), 0, 1) * .85).toFixed(3);
    if (dim !== dimLast) { dimLast = dim; stage.style.setProperty('--dim', dim); }

    // «О проекте»: текст начинает проявляться, когда верх абзаца на 88 % высоты окна,
    // и проявлен целиком, когда он поднялся до 38 %. Слово i проявляется на своём
    // отрезке длиной SPAN слов — соседние перекрываются, фронт идёт мягкой волной
    if (mfWords.length) {
      const r = mf.getBoundingClientRect();
      const p = reduced ? 1 : clamp((h * .88 - r.top) / (h * .5), 0, 1);
      const N = mfWords.length, SPAN = 7;
      for (let i = 0; i < N; i++) {
        const t = +clamp((p * (N + SPAN) - i) / SPAN, 0, 1).toFixed(3);
        if (mfWords[i]._t !== t) { mfWords[i]._t = t; mfWords[i].style.setProperty('--t', t); }
      }
    }

    // лента
    if (hsOn() && hsDist) {
      const r = hs.getBoundingClientRect();
      const p = clamp(-r.top / hsDist, 0, 1);
      track.style.transform = `translate3d(${(-p * hsDist).toFixed(1)}px,0,0)`;
      fill.style.setProperty('--p', p.toFixed(4));
      // активный шаг — тот, что ближе всех к центру окна
      let best = -1, bd = 1e9;
      steps.forEach((s, i) => {
        const b = s.getBoundingClientRect();
        const d = Math.abs(b.left + b.width / 2 - innerWidth / 2);
        if (d < bd) { bd = d; best = i; }
      });
      if (p < .06) best = -1;
      steps.forEach((s, i) => s.classList.toggle('is-act', i === best));
      barLabels.forEach((s, i) => s.classList.toggle('on', i <= best));
      // фото внутри рамки едут медленнее рамки
      hsImgs.forEach(img => {
        const b = img.parentElement.getBoundingClientRect();
        const c = (b.left + b.width / 2 - innerWidth / 2) / innerWidth;
        img.style.setProperty('--px', (c * -8).toFixed(2) + '%');
      });
    }

    // фото интенсивов
    if (life) {
      const r = life.getBoundingClientRect();
      // вход: верх секции идёт от низа окна к верху — фото проступает, свет выше гаснет
      const e = clamp(1 - r.top / h, 0, 1);
      // липкая часть: сетка уменьшается от lfS0 до 1
      const t = clamp(-r.top / Math.max(1, r.height - h), 0, 1);
      // ширина сетки: от lfS0 (центральное фото во всю ширину) до финальной
      const k = ease(t), s = lfS0 + (1 - lfS0) * k;
      lfGrid.style.setProperty('--W', (lfW * s).toFixed(1) + 'px');
      lfGrid.style.setProperty('--y', (lfY0 + (lfY1 - lfY0) * k).toFixed(1) + 'px');
      lfDim.style.setProperty('--dim', (.9 * Math.pow(1 - e, 1.3)).toFixed(3));
      if (stGlow) stGlow.style.opacity = (1 - clamp((e - .15) / .75, 0, 1)).toFixed(3);
    }

    stScrub(h);

    mqV += (y - lastY) * .12;
    lastY = y;
  }

  // бегущая строка крутится своим циклом: базовая скорость + импульс от скролла
  let mqT = performance.now();
  function mqTick(now) {
    const dt = Math.min(.05, (now - mqT) / 1000); mqT = now;
    if (!mqW) mqW = mqItems[0].offsetWidth;
    mqV *= Math.exp(-dt * 3);
    mqX -= (40 + Math.abs(mqV) * 60) * dt * (mqV < -.05 ? -1 : 1);
    if (mqX <= -mqW) mqX += mqW;
    if (mqX > 0) mqX -= mqW;
    const t = `translate3d(${mqX.toFixed(1)}px,0,0)`;
    mqItems.forEach(el => el.style.transform = t);
    requestAnimationFrame(mqTick);
  }
  if (mqItems.length && !reduced) requestAnimationFrame(mqTick);

  let sq = 0;
  addEventListener('scroll', () => { if (!sq) sq = requestAnimationFrame(() => { sq = 0; update(); }); }, { passive: true });
  if (window.kmkScroll && window.kmkScroll.active) window.kmkScroll.onFrame(update);
  addEventListener('resize', () => { hsLayout(); lfLayout(); mqW = 0; update(); });
  addEventListener('load', () => { hsLayout(); lfLayout(); update(); });
  hsLayout(); lfLayout(); update();

  // ── интенсивы: аккордеон, подсветка дней, превью за курсором ──
  const cal = $('.cal'), rows = $$('.in-row'), peek = $('.in-peek'), peekImg = peek && $('img', peek);
  rows.forEach(row => {
    const head = $('.in-head', row);
    head.addEventListener('click', () => {
      const open = !row.classList.contains('is-open');
      rows.forEach(r => { r.classList.remove('is-open'); $('.in-head', r).setAttribute('aria-expanded', 'false'); });
      if (open) { row.classList.add('is-open'); head.setAttribute('aria-expanded', 'true'); }
      setTimeout(() => { hsLayout(); update(); }, 850);
    });
    row.addEventListener('pointerenter', () => { cal.dataset.act = row.dataset.k; });
    row.addEventListener('pointerleave', () => { delete cal.dataset.act; });
  });
  if (hover && peek) {
    const pp = { x: 0, y: 0, tx: 0, ty: 0, raf: 0, cur: '' };
    const loop = () => {
      pp.x += (pp.tx - pp.x) * .14; pp.y += (pp.ty - pp.y) * .14;
      const tilt = clamp((pp.tx - pp.x) * .05, -8, 8);
      peek.style.transform = `translate3d(${pp.x.toFixed(1)}px,${pp.y.toFixed(1)}px,0) rotate(${tilt.toFixed(2)}deg)`;
      pp.raf = Math.hypot(pp.tx - pp.x, pp.ty - pp.y) > .2 ? requestAnimationFrame(loop) : 0;
    };
    $$('.in-head').forEach(head => {
      const row = head.closest('.in-row');
      head.addEventListener('pointerenter', e => {
        if (pp.cur !== row.dataset.img) { pp.cur = row.dataset.img; peekImg.src = pp.cur; }
        if (!peek.classList.contains('is-on')) { pp.x = pp.tx = e.clientX + 180; pp.y = pp.ty = e.clientY; }
        peek.classList.add('is-on');
      });
      head.addEventListener('pointermove', e => {
        // превью держится справа от курсора, чтобы не закрывать название
        pp.tx = e.clientX + 180; pp.ty = e.clientY;
        if (!pp.raf) pp.raf = requestAnimationFrame(loop);
      });
      head.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
    });
    addEventListener('scroll', () => peek.classList.remove('is-on'), { passive: true });
  }

  // ── эксперты: при наведении портрет оживает ──
  $$('.ex').forEach(ex => {
    const v = $('video', ex);
    const play = () => { v.preload = 'auto'; v.play().catch(() => {}); };
    const stop = () => { v.pause(); };
    ex.addEventListener('pointerenter', play);
    ex.addEventListener('pointerleave', stop);
    if (!hover) new IntersectionObserver(([e]) => e.isIntersecting ? play() : stop(), { threshold: .5 }).observe(ex);
  });

  // ── организация: тёплый свет за курсором ──
  $$('.org-t').forEach(t => t.addEventListener('pointermove', e => {
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  // ── отзывы: перетаскивание, стрелки, счётчик, видео в окне ──
  const strip = $('.rv-strip');
  if (strip) {
    const cards = $$('.rv', strip), cnt = $('.rv-cnt b');
    cards.forEach((c, i) => c.style.setProperty('--d', (i * .07) + 's'));
    const stepW = () => cards[0].offsetWidth + parseFloat(getComputedStyle($('.rv-track')).columnGap || 20);
    let target = 0, cur = 0, raf = 0;
    const go = x => {
      target = clamp(x, 0, strip.scrollWidth - strip.clientWidth);
      if (!raf) { cur = strip.scrollLeft; raf = requestAnimationFrame(glide); }
    };
    function glide() {
      cur += (target - cur) * .12;
      if (Math.abs(target - cur) < .5) cur = target;
      strip.scrollLeft = cur;
      raf = cur !== target ? requestAnimationFrame(glide) : 0;
    }
    $('.rv-prev').addEventListener('click', () => go(Math.round(strip.scrollLeft / stepW() - 1) * stepW()));
    $('.rv-next').addEventListener('click', () => go(Math.round(strip.scrollLeft / stepW() + 1) * stepW()));
    strip.addEventListener('scroll', () => {
      const i = clamp(Math.round(strip.scrollLeft / stepW()), 0, cards.length - 1);
      const end = strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2;
      cnt.textContent = String(end ? cards.length : i + 1).padStart(2, '0');
    }, { passive: true });

    // тянем мышью, отпускаем — лента докатывается по инерции
    let drag = null;
    strip.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button) return;
      drag = { x: e.clientX, s: strip.scrollLeft, v: 0, t: performance.now(), lx: e.clientX, moved: false };
    });
    addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; strip.classList.add('is-drag'); }
      if (!drag.moved) return;
      const now = performance.now();
      drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      strip.scrollLeft = drag.s - dx;
    });
    addEventListener('pointerup', () => {
      if (!drag) return;
      if (drag.moved) go(strip.scrollLeft - drag.v * 380);
      setTimeout(() => strip.classList.remove('is-drag'), 0);
      drag = null;
    });

    const modal = $('.kv-modal'), box = $('.kv-box');
    const close = () => {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open'); box.innerHTML = '';
      document.documentElement.classList.remove('is-locked');
    };
    cards.forEach(c => c.addEventListener('click', () => {
      box.innerHTML = `<iframe src="https://kinescope.io/embed/${c.dataset.kin}?autoplay=1" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
      modal.classList.add('is-open');
      document.documentElement.classList.add('is-locked');
    }));
    $('.kv-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  // ── для команд: вкладки ──
  const tabs = $$('.tm-tabs [role=tab]'), panes = $$('.tm-pane');
  tabs.forEach((t, i) => t.addEventListener('click', () => {
    tabs.forEach((x, j) => x.setAttribute('aria-selected', i === j));
    panes.forEach((p, j) => p.classList.toggle('is-on', i === j));
  }));

  // ── заявка: свет за курсором, выбор интенсива из кнопок, отправка ──
  const apply = $('.apply'), glow = $('.ap-glow');
  if (apply && hover && !reduced) {
    const g = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
    const r0 = () => apply.getBoundingClientRect();
    const init = () => { const r = r0(); g.x = g.tx = r.width * .3; g.y = g.ty = r.height * .45; };
    init();
    const loop = () => {
      g.x += (g.tx - g.x) * .06; g.y += (g.ty - g.y) * .06;
      glow.style.transform = `translate3d(${g.x.toFixed(1)}px,${g.y.toFixed(1)}px,0)`;
      g.raf = Math.hypot(g.tx - g.x, g.ty - g.y) > .3 ? requestAnimationFrame(loop) : 0;
    };
    apply.addEventListener('pointermove', e => {
      const r = r0(); g.tx = e.clientX - r.left; g.ty = e.clientY - r.top;
      if (!g.raf) g.raf = requestAnimationFrame(loop);
    });
    loop();
  }
  $$('[data-pick]').forEach(a => a.addEventListener('click', () => {
    const box = $$('.ap-pick input').find(i => i.value === a.dataset.pick);
    if (box) box.checked = true;
  }));
  const form = $('.ap-form');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('.ap-f', form).forEach(f => {
      const inp = $('input', f);
      const bad = inp.required && !inp.value.trim();
      f.classList.toggle('is-bad', bad);
      if (bad) ok = false;
    });
    if (!ok) { $('.ap-f.is-bad input', form).focus(); return; }
    // TODO: подключить отправку (CRM / почта) — сейчас только состояние «отправлено»
    form.classList.add('is-sent');
  });
})();
