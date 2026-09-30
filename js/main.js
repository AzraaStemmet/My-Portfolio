// Page behaviour: the pellet name in the intro, scroll reveals, the
// project index preview and the Pac-Man scroll guide.
// index.html adds the `js` class to <html> before paint, so the CSS
// only hides reveal content and shows the rail when this script runs.

// Draw the name in the intro as a grid of pellets. The text is rendered
// off screen, sampled on a grid, and each filled cell becomes a pellet.
// Pellets fly in to form the name on load, and swell and turn pink near
// the cursor. The h1 keeps the real text for screen readers.
function initPoster() {
  const poster = document.querySelector('.poster');
  const canvas = poster && poster.querySelector('.poster-canvas');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LINES = ['AZRAA', 'STEMMET'];
  const FONT = '800 100px Unbounded, system-ui, sans-serif';
  const COLORS = ['#f4f1f6', '#9b7bff']; // one per line
  const HOVER_COLOR = '#ff5ca8';
  const LENS = 90;          // cursor influence radius in px
  const ASSEMBLE_MS = 1400;

  let pellets = [];
  let width = 0, height = 0, radius = 2;
  let pointer = null;
  let start = 0, frame = 0;

  // Lay the name out to fill the width, then sample it into pellets.
  function build() {
    width = poster.clientWidth;
    if (!width) return;

    const probe = document.createElement('canvas').getContext('2d');
    probe.font = FONT;
    const widest = Math.max(...LINES.map(line => probe.measureText(line).width));
    const size = 100 * width / widest;
    const lineHeight = size * 0.9;
    height = Math.ceil(lineHeight * LINES.length + size * 0.08);

    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const octx = off.getContext('2d');
    octx.font = FONT.replace('100px', size + 'px');
    octx.textBaseline = 'alphabetic';
    octx.fillStyle = '#000';
    const baselines = LINES.map((_, i) => lineHeight * (i + 1) - size * 0.14);
    LINES.forEach((line, i) => octx.fillText(line, -size * 0.04, baselines[i]));
    // A pellet belongs to the first line whose baseline it sits on or above.
    const lineOf = y => {
      const i = baselines.findIndex(b => y <= b + size * 0.04);
      return i === -1 ? LINES.length - 1 : i;
    };

    const step = Math.max(3.5, Math.min(11, width / 125));
    radius = step * 0.34;
    const data = octx.getImageData(0, 0, width, height).data;
    pellets = [];
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const i = (Math.floor(y) * width + Math.floor(x)) * 4;
        if (data[i + 3] < 140) continue;
        pellets.push({
          hx: x, hy: y,
          line: lineOf(y),
          sx: Math.random() * width,
          sy: Math.random() * height,
          delay: (x / width) * 0.45 + Math.random() * 0.15,
        });
      }
    }

    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ease = t => 1 - Math.pow(1 - t, 3);

  function draw(now) {
    const t = reduceMotion ? 1 : Math.min(1, (now - start) / ASSEMBLE_MS);
    ctx.clearRect(0, 0, width, height);

    // Two passes per line keep fill style changes to a minimum.
    for (let line = 0; line < LINES.length; line++) {
      const lensed = [];
      ctx.fillStyle = COLORS[line];
      ctx.beginPath();
      for (const p of pellets) {
        if (p.line !== line) continue;
        const k = ease(Math.min(1, Math.max(0, (t - p.delay) / (1 - p.delay))));
        const x = p.sx + (p.hx - p.sx) * k;
        const y = p.sy + (p.hy - p.sy) * k;
        let r = radius * (0.35 + 0.65 * k);
        if (pointer) {
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          if (d < LENS) { lensed.push([x, y, r * (1 + 1.1 * (1 - d / LENS))]); continue; }
        }
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();

      if (lensed.length) {
        ctx.fillStyle = HOVER_COLOR;
        ctx.beginPath();
        for (const [x, y, r] of lensed) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
        ctx.fill();
      }
    }

    frame = t < 1 ? requestAnimationFrame(draw) : 0;
  }

  const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };

  canvas.addEventListener('pointermove', e => {
    const box = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
    redraw();
  });
  canvas.addEventListener('pointerleave', () => { pointer = null; redraw(); });

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (poster.clientWidth === width) return;
      build();
      redraw();
    }, 120);
  }).observe(poster);

  // Wait for the display font so the pellets trace the right letter shapes.
  const ready = document.fonts ? document.fonts.load(FONT) : Promise.resolve();
  ready.catch(() => {}).then(() => {
    build();
    start = performance.now();
    redraw();
  });
}

// Fade elements with `.reveal` in as they scroll into view.
function initReveal() {
  const items = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  items.forEach(el => observer.observe(el));
}

// Project index: hovering a row floats its screenshot next to the cursor,
// and focusing a row with the keyboard shows it beside the row.
// Only on devices with a precise pointer; touch users get the full
// project blocks below the index instead.
function initIndexPreview() {
  const rows = [...document.querySelectorAll('.index-row[data-preview]')];
  if (!rows.length || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOLLOW = reduceMotion ? 1 : 0.18; // share of the remaining distance moved per frame
  const OFFSET = 28;
  const EDGE = 16;

  const preview = document.createElement('img');
  preview.className = 'index-preview';
  preview.alt = '';
  preview.setAttribute('aria-hidden', 'true');
  preview.decoding = 'async';
  document.body.append(preview);

  // Warm the cache so the first hover shows the image straight away.
  rows.forEach(row => { new Image().src = row.dataset.preview; });

  let x = 0, y = 0, targetX = 0, targetY = 0, frame = 0, visible = false;

  function step() {
    x += (targetX - x) * FOLLOW;
    y += (targetY - y) * FOLLOW;
    preview.style.translate = `${x}px ${y}px`;
    frame = Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5 ? requestAnimationFrame(step) : 0;
  }

  // Keep the preview fully on screen, and jump rather than glide when it first appears.
  function moveTo(left, top) {
    const w = preview.offsetWidth, h = preview.offsetHeight;
    targetX = Math.min(Math.max(left, EDGE), innerWidth - w - EDGE);
    targetY = Math.min(Math.max(top, EDGE), innerHeight - h - EDGE);
    if (!visible) { x = targetX; y = targetY; }
    if (!frame) frame = requestAnimationFrame(step);
  }

  function show(row) {
    preview.src = row.dataset.preview;
    preview.classList.toggle('is-tall', row.dataset.shape === 'tall');
  }

  function reveal() {
    visible = true;
    preview.classList.add('is-visible');
  }

  function hide() {
    visible = false;
    preview.classList.remove('is-visible');
  }

  rows.forEach(row => {
    row.addEventListener('pointerenter', e => {
      show(row);
      moveTo(e.clientX + OFFSET, e.clientY - preview.offsetHeight / 2);
      reveal();
    });
    row.addEventListener('pointermove', e => moveTo(e.clientX + OFFSET, e.clientY - preview.offsetHeight / 2));
    row.addEventListener('pointerleave', hide);
    row.addEventListener('focus', () => {
      show(row);
      const box = row.getBoundingClientRect();
      moveTo(box.right - preview.offsetWidth - 64, box.top + box.height / 2 - preview.offsetHeight / 2);
      reveal();
    });
    row.addEventListener('blur', hide);
  });

  // The preview is tied to a spot on screen, so drop it once the page moves.
  addEventListener('scroll', () => { if (visible) hide(); }, { passive: true });
}

// Pac-Man follows scroll progress along a rail, eating dots as it goes.
// Pellets mark each section and link to it. The rail is vertical on wide
// screens and horizontal on smaller ones (see the rail styles in styles.css).
function initPacGuide() {
  const rail = document.querySelector('.pac-rail');
  if (!rail) return;

  const root = document.documentElement;
  const track = rail.querySelector('.pac-track');
  const dotsEl = rail.querySelector('.pac-dots');
  const pac = rail.querySelector('.pac');
  const pellets = [...rail.querySelectorAll('.pellet')];
  const wide = matchMedia('(min-width: 1100px)');

  const PAC_SIZE = 18;
  const CHOMP_MS = 180;

  let length = 0;
  let dots = [];
  let dotAt = [];
  let pelletAt = [];
  let lastY = scrollY;
  let ticking = false;
  let chompTimer;

  const maxScroll = () => Math.max(1, root.scrollHeight - innerHeight);
  const clamp01 = n => Math.min(1, Math.max(0, n));
  // Convert a 0 to 1 scroll progress into a pixel position on the track.
  const toTrack = progress => PAC_SIZE / 2 + clamp01(progress) * (length - PAC_SIZE);

  function placePellets() {
    pelletAt = pellets.map(link => {
      const section = document.querySelector(link.hash);
      const sectionTop = section.getBoundingClientRect().top + scrollY;
      const at = toTrack(sectionTop / maxScroll());
      link.style.setProperty('--at', at + 'px');
      return at;
    });
  }

  function placeDots() {
    const gap = wide.matches ? 22 : 16;
    dotsEl.textContent = '';
    dots = [];
    dotAt = [];
    for (let at = PAC_SIZE / 2 + gap; at < length - PAC_SIZE / 2; at += gap) {
      if (pelletAt.some(p => Math.abs(p - at) < gap * 0.7)) continue;
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.setProperty('--at', at + 'px');
      dotsEl.append(dot);
      dots.push(dot);
      dotAt.push(at);
    }
  }

  function layout() {
    const box = track.getBoundingClientRect();
    length = wide.matches ? box.height : box.width;
    placePellets();
    placeDots();
    update(false);
  }

  function update(moving) {
    const progress = scrollY / maxScroll();
    const head = toTrack(progress);

    pac.style.setProperty('--at', head + 'px');
    dots.forEach((dot, i) => dot.classList.toggle('eaten', dotAt[i] < head));
    pellets.forEach((link, i) => link.classList.toggle('eaten', pelletAt[i] <= head + 1));
    rail.classList.toggle('done', progress > 0.985);

    if (moving && scrollY !== lastY) {
      pac.dataset.face = scrollY < lastY ? 'back' : 'fwd';
      rail.classList.add('chomping');
      clearTimeout(chompTimer);
      chompTimer = setTimeout(() => rail.classList.remove('chomping'), CHOMP_MS);
    }
    lastY = scrollY;
  }

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update(true);
      ticking = false;
    });
  }, { passive: true });

  wide.addEventListener('change', layout);
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(document.body);
  else addEventListener('resize', layout);
  addEventListener('load', layout);
  layout();
}

initPoster();
initReveal();
initIndexPreview();
initPacGuide();
