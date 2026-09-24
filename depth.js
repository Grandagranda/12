// Эффект глубины для портретов: сдвиг по карте глубины + тёплый свет за курсором.
// Координаты — в единицах кадра Figma (холст .l-people: 1144×1176 от точки 373,−11).
(function () {
  if (matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches) return;

  const hero = document.querySelector('.hero-bg');
  const canvas = document.querySelector('.l-people canvas');
  const gl = canvas && canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) return;

  const CW = 1144, CH = 1176;
  // слои в порядке отрисовки (как в Figma: правый снизу, левый сверху)
  const LAYERS = [
    { src: 'img/p74.webp',  depth: 'img/p74-depth.png',  x: 370, y: 40, w: 774, h: 1136 },
    { src: 'img/p6cb.webp', depth: 'img/p6cb-depth.png', x: 0,   y: 0,  w: 647, h: 761 },
  ];
  const SHIFT = { x: 16, y: 10 };   // максимальный сдвиг самой ближней точки, px кадра
  const PAD = 24;                    // запас вокруг слоя, чтобы сдвинутый край не срезался
  const LIGHT = [1.0, 0.52, 0.22];   // тёплый, в тон #f3622a

  const VS = `
    attribute vec2 aPos;
    uniform vec4 uRect;      // x, y, w, h слоя в px холста (с запасом)
    uniform vec2 uCanvas;
    varying vec2 vPx;
    void main(){
      vec2 px = uRect.xy + aPos * uRect.zw;
      vPx = px;
      vec2 clip = px / uCanvas * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    }`;
  const FS = `
    precision highp float;
    varying vec2 vPx;
    uniform sampler2D uImg, uDep;
    uniform vec4 uBox;       // x, y, w, h самого снимка в px холста
    uniform vec2 uShift;     // текущий сдвиг, px
    uniform vec2 uLight;     // курсор, px холста
    uniform float uHover;    // 0..1 — присутствие курсора
    uniform vec2 uDepTexel;
    uniform vec3 uWarm;
    float dep(vec2 uv){ return texture2D(uDep, uv).r; }
    void main(){
      vec2 uv = (vPx - uBox.xy) / uBox.zw;
      vec2 off = uShift / uBox.zw;
      // параллакс с уточнением: ближние (светлые) точки уезжают дальше
      vec2 p = uv;
      for (int i = 0; i < 5; i++) { p = uv - off * (dep(p) - 0.3); }
      if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) { gl_FragColor = vec4(0.0); return; }
      vec4 c = texture2D(uImg, p);
      // нормаль из карты глубины и свет из точки курсора над кадром
      float dx = dep(p + vec2(uDepTexel.x, 0.0)) - dep(p - vec2(uDepTexel.x, 0.0));
      float dy = dep(p + vec2(0.0, uDepTexel.y)) - dep(p - vec2(0.0, uDepTexel.y));
      vec3 n = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
      vec2 d = uLight - vPx;
      vec3 L = normalize(vec3(d, 380.0));
      float lambert = max(dot(n, L), 0.0);
      float fall = exp(-dot(d, d) / (520.0 * 520.0));
      float k = lambert * fall * uHover * 0.6;
      // свет ложится на сам снимок (умножение), тени не засвечиваются
      c.rgb += c.rgb * uWarm * k;
      gl_FragColor = c;
    }`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('depth effect off:', e); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uRect','uCanvas','uImg','uDep','uBox','uShift','uLight','uHover','uDepTexel','uWarm']
    .forEach(n => U[n] = gl.getUniformLocation(prog, n));
  gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDep, 1);
  gl.uniform3fv(U.uWarm, LIGHT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  function tex(source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return t;
  }
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  let scale = 1;            // px экрана на px кадра (k × DPR)
  // WebGL1 без мип-карт: крупный снимок заранее уменьшаем до размера на экране,
  // иначе при сжатии в 2–3 раза лицо «сыплется» мелкой рябью
  function fitTexture(L) {
    const w = Math.min(L.img.naturalWidth, Math.round(L.w * scale));
    const h = Math.min(L.img.naturalHeight, Math.round(L.h * scale));
    if (L.tex && L.tw === w && L.th === h) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(L.img, 0, 0, w, h);
    if (L.tex) gl.deleteTexture(L.tex);
    L.tex = tex(c); L.tw = w; L.th = h;
  }

  function resize() {
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1;
    scale = k * Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * scale);
    canvas.height = Math.round(CH * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    LAYERS.forEach(fitTexture);
    need = true;
  }

  // состояние курсора: цель и сглаженное значение
  const cur = { x: 0, y: 0, lx: CW / 2, ly: 300, h: 0 };
  const tgt = { x: 0, y: 0, lx: CW / 2, ly: 300, h: 0 };
  let need = true, last = 0;

  const stage = document.querySelector('.stage');
  addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    if (e.clientY > r.bottom) { tgt.h = 0; tgt.x = tgt.y = 0; return kick(); }
    tgt.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    tgt.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    const c = canvas.getBoundingClientRect();
    tgt.lx = (e.clientX - c.left) / c.width * CW;
    tgt.ly = (e.clientY - c.top) / c.height * CH;
    tgt.h = 1; kick();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { tgt.h = 0; tgt.x = tgt.y = 0; kick(); });

  let raf = 0;
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const a = 1 - Math.exp(-dt * 5), b = 1 - Math.exp(-dt * 9);   // сдвиг мягче, свет живее
    let moving = false;
    for (const [key, f] of [['x', a], ['y', a], ['lx', b], ['ly', b], ['h', a]]) {
      const d = tgt[key] - cur[key];
      if (Math.abs(d) > (key[0] === 'l' ? 0.3 : 0.0005)) { cur[key] += d * f; moving = true; }
      else cur[key] = tgt[key];
    }
    draw();
    if (moving) raf = requestAnimationFrame(frame);
  }

  function draw() {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uCanvas, CW, CH);
    gl.uniform2f(U.uShift, cur.x * SHIFT.x, cur.y * SHIFT.y);
    gl.uniform2f(U.uLight, cur.lx, cur.ly);
    gl.uniform1f(U.uHover, cur.h);
    for (const L of LAYERS) {
      gl.uniform4f(U.uRect, L.x - PAD, L.y - PAD, L.w + PAD * 2, L.h + PAD * 2);
      gl.uniform4f(U.uBox, L.x, L.y, L.w, L.h);
      gl.uniform2f(U.uDepTexel, 2 / L.dimg.naturalWidth, 2 / L.dimg.naturalHeight);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, L.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L.dtex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  Promise.all(LAYERS.map(async L => {
    [L.img, L.dimg] = await Promise.all([load(L.src), load(L.depth)]);
    L.dtex = tex(L.dimg);
  })).then(() => {
    resize();
    draw();
    hero.classList.add('fx-on');      // подменяем <img> холстом только после первого кадра
    addEventListener('resize', () => { resize(); draw(); });
    window.__depthFx = { cur, tgt, draw, frame };   // для проверки
  }).catch(e => console.warn('depth effect off:', e));
})();
