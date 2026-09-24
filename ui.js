// Ховеры шапки и якоря.
// Текст ссылок и кнопки при наведении «перекатывается» по буквам: каждая буква уезжает
// вверх, снизу приходит её копия (text-shadow), с небольшой задержкой по индексу.
// Кнопка заливается акцентом из той точки, где в неё вошёл курсор, и слегка тянется к нему.
(function () {
  const hover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ── буквы ──
  document.querySelectorAll('[data-roll]').forEach(el => {
    const text = el.textContent.trim();
    const roll = document.createElement('span');
    roll.className = 'roll';
    roll.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', i);
      roll.appendChild(s);
    });
    el.textContent = '';
    el.appendChild(roll);
    const link = el.closest('a, button');
    if (link && !link.hasAttribute('aria-label')) link.setAttribute('aria-label', link.textContent.trim() || text);
  });

  // ── кнопка: заливка из точки входа/выхода + магнит ──
  document.querySelectorAll('.btn, .pill').forEach(btn => {
    if (!hover) return;
    // координаты в долях — кнопка лежит в масштабированном кадре
    const at = e => {
      const r = btn.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    const origin = e => {
      const p = at(e);
      btn.style.setProperty('--x', (p.x * 100).toFixed(1) + '%');
      btn.style.setProperty('--y', (p.y * 100).toFixed(1) + '%');
    };
    btn.addEventListener('pointerenter', origin);
    btn.addEventListener('pointerleave', e => { origin(e); btn.style.translate = ''; });
    btn.addEventListener('pointermove', e => {
      const p = at(e);
      btn.style.translate = `${((p.x - .5) * 10).toFixed(2)}px ${((p.y - .5) * 6).toFixed(2)}px`;
    });
  });

  // ── «Практика в живую» пишется от руки ──
  // каждый штрих — отдельное движение пера; скорость постоянная, внутри штриха лёгкий разгон
  // и торможение; перед новым словом и при отрыве пера — короткая пауза
  const script = document.querySelector('.script');
  if (script && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const SPEED = 900;          // единиц viewBox в секунду
    const LIFT = 25, WORD = 160; // мс: отрыв пера, пробел между словами
    let t = 450, prev = null, last = null;
    script.querySelectorAll('.script-pen path').forEach(p => {
      const L = p.getTotalLength();
      const start = p.getPointAtLength(0);
      if (last) {
        if (p.dataset.w !== prev) t += WORD;
        else if (Math.hypot(start.x - last.x, start.y - last.y) > 4) t += LIFT;
      }
      const dur = Math.max(40, L / SPEED * 1000);
      p.style.strokeDasharray = `${L} ${L + 20}`;
      p.style.strokeDashoffset = L;
      p.animate([{ opacity: 1, strokeDashoffset: L }, { opacity: 1, strokeDashoffset: 0 }],
        { duration: dur, delay: t, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      t += dur; prev = p.dataset.w; last = p.getPointAtLength(L);
    });
    setTimeout(() => script.classList.add('is-done'), t + 120);
  } else if (script) script.classList.add('is-done');

  // ── якоря — тем же плавным движением, что и колесо ──
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + scrollY;
    if (window.kmkScroll) window.kmkScroll.to(y); else scrollTo({ top: y, behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
})();
