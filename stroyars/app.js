/* Строярс — поведение страниц (без зависимостей) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;

  // первый экран: включаем «уровень» после загрузки
  const ready = () => requestAnimationFrame(() => setTimeout(() => root.classList.remove('is-loading'), 60));
  document.readyState === 'complete' ? ready() : addEventListener('load', ready);
  setTimeout(() => root.classList.remove('is-loading'), 1800); // на случай медленных картинок

  // появление при прокрутке
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });

  // переключатели-сегменты: одна кнопка из группы
  const state = {};
  const setSeg = (group, v) => {
    const box = $(`[data-seg="${group}"]`);
    if (!box) return;
    state[group] = v;
    $$('button', box).forEach(b => {
      const on = b.dataset.v === v;
      b.setAttribute('aria-pressed', on);
      if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', on);
    });
  };
  $$('[data-seg]').forEach(box => {
    const cur = $('[aria-pressed="true"]', box) || $('button', box);
    state[box.dataset.seg] = cur.dataset.v;
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      setSeg(box.dataset.seg, b.dataset.v);
      box.dispatchEvent(new CustomEvent('seg', { bubbles: true }));
    });
  });

  /* ─── расчёт стоимости ─── */
  const RATE   = { base: 25000, opt: 38000, prem: 55000 };   // работы + материалы, ₽/м²
  const DESIGN = { base: 1500,  opt: 2500,  prem: 4000 };    // дизайн-проект, ₽/м²
  const PACE   = { base: 40,    opt: 30,    prem: 22 };      // м² в месяц на объект
  const NAME   = { base: 'Базовый', opt: 'Оптимальный', prem: 'Премиальный' };
  const rub = n => Math.round(n / 1000) * 1000;
  const fmt = n => rub(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

  function price({ area, cls, type = 'flat', st = 'new', design = true }) {
    area = Math.min(Math.max(+area || 0, 20), 1000);
    let works = area * RATE[cls] * (type === 'house' ? 1.12 : 1) + (st === 'old' ? area * 2500 : 0);
    const des = design ? area * DESIGN[cls] : 0;
    const months = Math.max(3, Math.round(2 + area / PACE[cls] + (type === 'house' ? 1 : 0)));
    return { area, works, des, total: works + des, months,
      rough: works * .38, fine: works * .27, mat: works * .35, meet: design ? 4 : 2 };
  }

  // быстрый расчёт в первом экране
  const qArea = $('#q-area');
  const quick = () => {
    if (!qArea) return;
    const r = price({ area: qArea.value, cls: state['q-class'] });
    $('#q-sum').textContent = fmt(r.total);
    $('#q-term').textContent = r.months + ' мес.';
  };

  // полный калькулятор
  const cArea = $('#c-area');
  const paintRange = () => cArea && cArea.style.setProperty('--p', ((cArea.value - cArea.min) / (cArea.max - cArea.min) * 100) + '%');
  const full = () => {
    if (!cArea) return;
    const r = price({ area: cArea.value, cls: state['c-class'], type: state['c-type'], st: state['c-state'], design: $('#c-design').checked });
    $('#c-area-out').textContent = r.area;
    $('#c-sum').textContent = fmt(r.total);
    $('#c-per').textContent = (Math.round(r.total / r.area / 100) * 100).toLocaleString('ru-RU');
    $('#c-term').textContent = r.months + ' мес.';
    $('#c-l-design').textContent = r.des ? fmt(r.des) : '—';
    $('#c-l-rough').textContent = fmt(r.rough);
    $('#c-l-fine').textContent = fmt(r.fine);
    $('#c-l-mat').textContent = fmt(r.mat);
    $('#c-meet').textContent = r.meet + ' ' + plural(r.meet, 'встреча', 'встречи', 'встреч');
    paintRange();
    full.last = r;
  };

  // синхронизация: что ввели наверху — то и в калькуляторе
  qArea && qArea.addEventListener('input', () => {
    quick();
    if (cArea && +qArea.value >= 20) { cArea.value = Math.min(qArea.value, cArea.max); full(); }
  });
  cArea && cArea.addEventListener('input', () => { if (qArea) qArea.value = cArea.value; full(); quick(); });
  document.addEventListener('seg', e => {
    const g = e.target.dataset.seg;
    if (g === 'q-class') { setSeg('c-class', state['q-class']); full(); }
    if (g === 'c-class') { setSeg('q-class', state['c-class']); quick(); }
    full(); quick();
  });
  $('#c-design') && $('#c-design').addEventListener('change', full);
  quick(); full();

  // «зафиксировать цену» — переносим расчёт в заявку
  $$('[data-prefill]').forEach(a => a.addEventListener('click', () => {
    const r = full.last, p = $('#lead-prefill'); if (!r || !p) return;
    p.hidden = false;
    p.textContent = `Ваш расчёт: ${r.area} м² · ${NAME[state['c-class']]} · ${fmt(r.total)}`;
    $('#l-area').value = r.area;
  }));

  // заявка
  window.sendLead = e => {
    e.preventDefault();
    $('.lead__done', e.target).hidden = false;
    return false;
  };

  /* ─── портфолио: фильтр ─── */
  const chips = $$('.folio__filters .chip');
  chips.forEach(c => c.addEventListener('click', () => {
    chips.forEach(x => x.setAttribute('aria-pressed', x === c));
    const f = c.dataset.f;
    $$('.case').forEach(el => el.classList.toggle('is-off', f !== 'all' && !el.dataset.tags.split(' ').includes(f)));
  }));

  /* ─── видео ─── */
  const modal = $('#modal');
  if (modal) {
    let t;
    const bar = $('.modal__bar i', modal);
    const open = title => {
      $('#modal-title').textContent = title;
      modal.classList.add('open');
      bar.style.transition = 'none'; bar.style.width = '0';
      requestAnimationFrame(() => { bar.style.transition = 'width 12s linear'; bar.style.width = '100%'; });
      $('.modal__close', modal).focus();
    };
    const close = () => { modal.classList.remove('open'); clearTimeout(t); };
    $$('[data-video]').forEach(b => b.addEventListener('click', () => open(b.dataset.video)));
    $('.modal__close', modal).addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ─── статья: прогресс чтения лучом уровня ─── */
  const prog = $('.read-progress');
  if (prog) {
    const body = $('.article__body');
    const upd = () => {
      const r = body.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      prog.style.setProperty('--laser-p', p);
      const hs = $$('.article__body h2');
      let cur = hs[0];
      hs.forEach(h => { if (h.getBoundingClientRect().top < 200) cur = h; });
      $$('.toc a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + cur.id));
    };
    addEventListener('scroll', upd, { passive: true }); upd();
  }

  /* ─── объект: до / после ─── */
  $$('.ba').forEach(ba => {
    const input = $('input', ba);
    const set = () => ba.style.setProperty('--x', input.value + '%');
    input.addEventListener('input', set); set();
  });
})();
