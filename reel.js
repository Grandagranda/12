// Ролик: блок «О проекте» уезжает вверх и открывает видео, которое стоит на месте.
// Пока окно приоткрыто — кадр почти чёрный, затемнение уходит до макетного по мере прокрутки.
// Кнопка плеера стоит под надписью справа (как в макете) и тянется за курсором (как на первом
// экране Peroni): курсор остаётся обычным, кнопка заметно отстаёт. Как только курсор оказался
// внутри круга — акцент растекается из точки входа; вышел за круг — стекает в точку выхода.
// Фон — ролик с Kinescope без звука; клик открывает полный просмотр со звуком в плеере Kinescope.
(function () {
  const root = document.documentElement;
  const reel = document.querySelector('.reel');
  const card = reel.querySelector('.reel-card');
  const bg = card.querySelector('.reel-bg');
  const head = card.querySelector('.reel-h');
  const copy = card.querySelector('.reel-copy');
  const btn = card.querySelector('.reel-play');
  const modal = document.querySelector('.reel-modal');
  const full = modal.querySelector('.reel-full');
  const KIN = 'https://kinescope.io/embed/' + bg.dataset.kin;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // темп догона: 1 − e^(−K·dt) за кадр; K = 1.7 — это 2.8 % пути за кадр на 60 Гц, как у Peroni
  const K = 1.7;

  let box = { l: 0, t: 0, r: 0, b: 0 };   // видимая часть ролика (окно секции) в px окна
  const ptr = { x: 0, y: 0, in: false, seen: false };
  let home = { x: 0, y: 0 }, pos = null, R = 55;
  let raf = 0, last = 0, caught = false;

  // дом кнопки — под надписью, правее центра: в макете круг 109 px стоит в 1.7rem под текстом,
  // его центр на 25.35rem правее середины кадра; на узком экране — просто по центру
  function measureHome() {
    R = btn.offsetWidth / 2;
    const rem = parseFloat(getComputedStyle(root).fontSize);
    const c = copy.getBoundingClientRect();
    const x = innerWidth > 900 ? innerWidth / 2 + 25.35 * rem : innerWidth / 2;
    home = { x: Math.min(x, innerWidth - R - 16), y: c.bottom + 1.7 * rem + R };
  }

  // ── скролл: ролик прибит к окну, видна только та часть, что под секцией ──
  function layout() {
    const r = reel.getBoundingClientRect();
    const h = innerHeight;
    box = { l: 0, t: Math.max(0, r.top), r: innerWidth, b: Math.min(h, r.bottom) };
    // окно открылось на долю open: 0 — только показался край, 1 — ролик во весь экран
    const open = clamp(1 - r.top / h, 0, 1);
    card.style.setProperty('--shade', (0.45 + 0.55 * Math.pow(1 - open, 1.4)).toFixed(3));
    // надпись встаёт, когда окно открыто наполовину
    if (head && !head.classList.contains('is-in') && open > 0.5) head.classList.add('is-in');
    testHover();
    kick();
  }
  let sq = 0;
  const onScroll = () => { if (!sq) sq = requestAnimationFrame(() => { sq = 0; layout(); }); };
  addEventListener('scroll', onScroll, { passive: true });
  // при плавной прокрутке — в том же кадре, что и сдвиг страницы (см. smooth-scroll.js)
  if (window.kmkScroll && window.kmkScroll.active) window.kmkScroll.onFrame(layout);
  addEventListener('resize', () => { measureHome(); onScroll(); });
  addEventListener('load', () => { measureHome(); kick(); });
  measureHome();
  layout();

  // ── фон (плеер Kinescope) подгружаем, когда блок в экране от окна ──
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    bg.src = KIN + '?autoplay=1&muted=1&loop=1&playsinline=1&controls=0&autopause=0';
    io.disconnect();
  }, { rootMargin: '100% 0px' });
  io.observe(reel);

  // ── кнопка за курсором ──
  function testHover() {
    const inside = ptr.seen && !modal.classList.contains('is-open') &&
      ptr.x >= box.l && ptr.x <= box.r && ptr.y >= box.t && ptr.y <= box.b;
    if (inside !== ptr.in) { ptr.in = inside; kick(); }
  }
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.seen = true;
    testHover(); kick();
  }, { passive: true });
  root.addEventListener('pointerleave', () => { ptr.seen = false; testHover(); });

  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!pos) pos = { x: home.x, y: home.y };
    // курсор над роликом — тянемся к нему, не вылезая за край окна; ушёл — домой
    const edge = 12;
    const tx = ptr.in ? clamp(ptr.x, R + edge, innerWidth - R - edge) : home.x;
    const ty = ptr.in ? clamp(ptr.y, box.t + R + edge, Math.max(box.t + R + edge, box.b - R - edge)) : home.y;
    const f = 1 - Math.exp(-dt * K);
    pos.x += (tx - pos.x) * f;
    pos.y += (ty - pos.y) * f;
    const d = ptr.in ? Math.hypot(ptr.x - pos.x, ptr.y - pos.y) : Infinity;
    // курсор внутри круга — акцент; вышел за край — обратно (гистерезис, чтобы не мигало)
    if (!caught && d < R) { caught = true; spot(); btn.classList.add('is-caught'); }
    else if (caught && d > R + 6) { caught = false; spot(); btn.classList.remove('is-caught'); }
    btn.style.transform = `translate3d(${pos.x.toFixed(2)}px,${pos.y.toFixed(2)}px,0)`;
    if (Math.hypot(tx - pos.x, ty - pos.y) > 0.15) raf = requestAnimationFrame(frame);
  }

  // точка, откуда растекается (и куда стекает) заливка: курсор, прижатый к краю круга
  function spot() {
    let dx = ptr.x - pos.x, dy = ptr.y - pos.y;
    const k = Math.hypot(dx, dy) / R;
    if (k > 1) { dx /= k; dy /= k; }
    btn.style.setProperty('--x', (50 + dx / R * 50).toFixed(1) + '%');
    btn.style.setProperty('--y', (50 + dy / R * 50).toFixed(1) + '%');
  }

  // ── полный просмотр ──
  function open() {
    modal.classList.add('is-open');
    root.classList.add('is-locked');
    testHover();
    full.innerHTML = `<iframe src="${KIN}?autoplay=1" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
    if (modal.requestFullscreen) modal.requestFullscreen().catch(() => {});
  }
  function close() {
    if (!modal.classList.contains('is-open')) return;
    full.innerHTML = '';
    modal.classList.remove('is-open');
    root.classList.remove('is-locked');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    testHover();
  }
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  modal.querySelector('.reel-close').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // вышли из полноэкранного режима браузера (Esc) — закрываем и окно
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) close(); });

  window.__reel = { layout, box: () => box, pos: () => pos, ptr, frame, home: () => home };   // для проверки
})();
