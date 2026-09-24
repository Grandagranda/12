// Ролик: блок «О проекте» уезжает вверх и открывает видео, которое стоит на месте.
// Пока окно приоткрыто — кадр почти чёрный, затемнение уходит до макетного по мере прокрутки.
// Кнопка «смотреть» стоит под надписью и тянется за курсором (как на первом экране Peroni):
// курсор остаётся обычным, кнопка заметно отстаёт и, догнав, заливается акцентом.
// Пока в кадре — играет без звука; клик открывает полный просмотр со звуком.
(function () {
  const root = document.documentElement;
  const reel = document.querySelector('.reel');
  const card = reel.querySelector('.reel-card');
  const bg = card.querySelector('video');
  const head = card.querySelector('.reel-h');
  const copy = card.querySelector('.reel-copy');
  const btn = card.querySelector('.reel-play');
  const modal = document.querySelector('.reel-modal');
  const full = modal.querySelector('video');
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // темп догона: 1 − e^(−K·dt) за кадр; K = 1.7 — это 2.8 % пути за кадр на 60 Гц, как у Peroni
  const K = 1.7;

  let box = { l: 0, t: 0, r: 0, b: 0 };   // видимая часть ролика (окно секции) в px окна
  const ptr = { x: 0, y: 0, in: false, seen: false };
  let home = { x: 0, y: 0 }, pos = null, R = 70;
  let raf = 0, last = 0, caught = false;

  // дом кнопки — по центру, под надписью
  function measureHome() {
    R = btn.offsetWidth / 2;
    const c = copy.getBoundingClientRect();
    home = { x: innerWidth / 2, y: c.bottom + R + innerWidth * 0.028 };
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

  // ── фон играет только когда виден ──
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !modal.classList.contains('is-open')) bg.play().catch(() => {});
    else bg.pause();
  }, { threshold: 0 }).observe(reel);

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
    // догнала — акцент; курсор снова оторвался — стекло (гистерезис, чтобы не мигало)
    if (!caught && d < 10) { caught = true; btn.classList.add('is-caught'); }
    else if (caught && d > 26) { caught = false; btn.classList.remove('is-caught'); }
    btn.style.transform = `translate3d(${pos.x.toFixed(2)}px,${pos.y.toFixed(2)}px,0)`;
    if (Math.hypot(tx - pos.x, ty - pos.y) > 0.15) raf = requestAnimationFrame(frame);
  }

  // ── полный просмотр ──
  function open() {
    bg.pause();
    modal.classList.add('is-open');
    root.classList.add('is-locked');
    testHover();
    full.currentTime = 0;
    full.muted = false;
    full.play().catch(() => {});
    if (modal.requestFullscreen) modal.requestFullscreen().catch(() => {});
  }
  function close() {
    if (!modal.classList.contains('is-open')) return;
    full.pause();
    modal.classList.remove('is-open');
    root.classList.remove('is-locked');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    bg.play().catch(() => {});
    testHover();
  }
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  modal.querySelector('.reel-close').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // вышли из полноэкранного режима браузера (Esc) — закрываем и окно
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) close(); });
  full.addEventListener('ended', close);

  window.__reel = { layout, box: () => box, pos: () => pos, ptr, frame, home: () => home };   // для проверки
})();
