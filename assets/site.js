/* Spicy Bite: scroll-scrubbed story + page interactions. No dependencies. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const win = (p, a, b, f = 0.025) => Math.min(smooth(a, a + f, p), 1 - smooth(b - f, b, p)); // fade in at a, out at b
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionPreference.matches;
  const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const fine = matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
  document.documentElement.classList.toggle('motion', !reduce);

  const story = $('#story'), stage = $('#stage'), media = $('#media'), mtype = $('#mtype'), cut = $('#cut');
  const heroMeta = $('#heroMeta'), bar = $('#bar'), nav = $('#nav'), poster = $('#poster');
  const anatomyFrame = $('#anatomyFrame');
  const beats = [$('#b1'), $('#b2'), $('#b3')];
  const letters = [...mtype.querySelectorAll('span')];
  letters.forEach((s, i) => s.style.setProperty('--i', i));
  const drips = [...mtype.querySelectorAll('.drip')];

  /* ---------------- timeline (story progress 0..1) ---------------- */
  const T = {
    heroOut: [0.0, 0.05],
    leg1: [0.045, 0.36],
    labels: [0.355, 0.50],
    leg2: [0.50, 0.70],
    leg3: [0.715, 0.93],
    beats: [[0.10, 0.33], [0.52, 0.69], [0.86, 1.01]],
  };

  /* ---------------- media layout ---------------- */
  let W = 0, H = 0, portrait = false;
  function layout() {
    W = innerWidth; H = stage.clientHeight || innerHeight;
    portrait = W / H < 0.95;
    document.documentElement.classList.toggle('portrait', portrait);
    let mw, mh, left, top;
    if (!portrait) {
      const s = Math.max(W / 1920, H / 1080);
      mw = 1920 * s; mh = 1080 * s; left = (W - mw) / 2; top = (H - mh) / 2;
    } else {
      mw = W / 0.5; mh = mw * 9 / 16; left = (W - mw) / 2; top = (H - mh) / 2 - H * 0.04;
    }
    Object.assign(media.style, { width: mw + 'px', height: mh + 'px', left: left + 'px', top: top + 'px' });
    media.style.setProperty('--u', (mw / 1920) + 'px');
    // type unit: in landscape the type lives in video space; in portrait shrink it to fit the screen width
    const tu = portrait ? Math.min(mw / 1920, (W * 0.94) / 1300) : mw / 1920;
    mtype.style.setProperty('--tu', tu + 'px');
    mtype.querySelectorAll('.word').forEach(w => (w.style.fontSize = `calc(var(--tu) * 300)`));
  }

  /* ---------------- scroll-scrubbed video ---------------- */
  const mobileClips = coarse || innerWidth <= 860;
  const legs = [1, 2, 3].map(n => ({
    el: $('#v' + n), src: `assets/vid/l${n}${mobileClips ? '-m' : ''}.mp4`, requested: false, ready: false, dur: 0, want: 0,
  }));
  async function loadLeg(leg) {
    if (leg.requested || reduce) return;
    leg.requested = true;
    try {
      // A complete local buffer keeps scrubbing reliable on static hosts without byte-range support.
      const response = await fetch(leg.src);
      if (!response.ok) throw new Error(`Video request failed (${response.status})`);
      const video = await response.blob();
      leg.el.addEventListener('loadedmetadata', () => { leg.dur = leg.el.duration; });
      leg.el.addEventListener('loadeddata', () => { leg.ready = true; }, { once: true });
      leg.el.addEventListener('error', () => { leg.ready = false; });
      leg.el.src = URL.createObjectURL(video);
    } catch (error) {
      console.warn('Could not load story video', leg.src, error);
    }
  }
  function scrub(leg, t) {
    if (!leg.dur || !Number.isFinite(leg.dur)) return;
    leg.want = clamp(t, 0, leg.dur - 0.04);
    const error = Math.abs(leg.el.currentTime - leg.want);
    if (!leg.el.seeking && error > 1 / 36) leg.el.currentTime = leg.want;
  }
  let activeLeg = -1;
  function showLeg(i) {
    if (i === activeLeg) return;
    if (i >= 0 && (!legs[i].ready || legs[i].el.seeking)) return;
    legs.forEach((l, k) => l.el.classList.toggle('on', k === i));
    activeLeg = i;
  }

  /* ---------------- ingredient labels (anchors in 1920x1080 video space) ---------------- */
  const LABELS = [
    { x: 1022, y: 140, side: 'r', name: 'Red onion', note: 'Sliced thin, kept snappy' },
    { x: 905, y: 232, side: 'l', name: 'Potato wedges', note: 'Double-fried, twice crisp' },
    { x: 1150, y: 395, side: 'r', name: 'Toasted sesame', note: 'Nutty, a little smoky' },
    { x: 952, y: 448, side: 'l', name: 'Chilli-garlic glaze', note: 'Sticky, sweet, slow burn' },
    { x: 1018, y: 520, side: 'r', name: 'Green capsicum', note: 'Charred at the edges' },
    { x: 1153, y: 852, side: 'r', name: 'Spring onion', note: 'Fresh bite at the end' },
  ];
  const svg = $('#labels'), NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
  const labelEls = LABELS.map(L => {
    const g = mk('g', { opacity: 0 }, svg);
    const tx = L.side === 'l' ? 560 : 1360;
    const elbowX = L.side === 'l' ? L.x - 70 : L.x + 70;
    const d = `M${L.x},${L.y} L${elbowX},${L.y - 34} L${tx},${L.y - 34}`;
    const ring = mk('circle', { cx: L.x, cy: L.y, r: 16, class: 'lbl-ring' }, g);
    mk('circle', { cx: L.x, cy: L.y, r: 5, class: 'lbl-dot' }, g);
    const line = mk('path', { d, class: 'lbl-line' }, g);
    const anchor = L.side === 'l' ? 'end' : 'start';
    const tX = L.side === 'l' ? tx - 14 : tx + 14;
    const name = mk('text', { x: tX, y: L.y - 26, 'text-anchor': anchor, class: 'lbl-name' }, g); name.textContent = L.name;
    const note = mk('text', { x: tX, y: L.y + 2, 'text-anchor': anchor, class: 'lbl-note' }, g); note.textContent = L.note;
    return { g, line, ring, name, note, len: 0 };
  });
  requestAnimationFrame(() => labelEls.forEach(l => { l.len = l.line.getTotalLength(); l.line.style.strokeDasharray = l.len; }));
  const mob = $('#mobLabels');
  const mobEls = LABELS.map(L => { const li = document.createElement('li'); li.textContent = L.name; mob.appendChild(li); return li; });

  /* ---------------- pointer parallax ---------------- */
  let mx = 0, my = 0, cmx = 0, cmy = 0, glow = 0;
  let px = -999, py = -999, pointerOver = false;
  if (fine) {
    stage.addEventListener('pointermove', event => {
      if (reduce || event.pointerType !== 'mouse') return;
      px = event.clientX;
      py = event.clientY - stage.getBoundingClientRect().top;
      mx = px / W - .5;
      my = py / H - .5;
      pointerOver = true;
    }, { passive: true });
    const relaxPointer = () => {
      mx = my = 0;
      px = py = -999;
      pointerOver = false;
    };
    stage.addEventListener('pointerleave', relaxPointer);
    stage.addEventListener('pointercancel', relaxPointer);
  }

  /* ---------------- main loop ---------------- */
  let target = 0, sp = 0, storyTop = 0, storyLen = 1;
  function measure() { layout(); storyTop = story.offsetTop; storyLen = Math.max(1, story.offsetHeight - H); }
  function readScroll() {
    target = clamp((scrollY - storyTop) / storyLen);
    nav.classList.toggle('solid', scrollY > storyTop + storyLen + H * .6);
  }
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => { measure(); readScroll(); });

  function frame() {
    requestAnimationFrame(frame);
    if (reduce || scrollY > storyTop + storyLen + H) return;
    sp += (target - sp) * .16;
    if (Math.abs(target - sp) < 0.00005) sp = target;
    const p = sp;
    cmx += (mx - cmx) * 0.06; cmy += (my - cmy) * 0.06;

    // hero exit
    const e = smooth(T.heroOut[0], T.heroOut[1], p);
    letters.forEach((s, i) => {
      if (!document.body.classList.contains('settled')) return;
      const spread = (i - (i < 5 ? 2 : 6.5)) * e * 60;
      s.style.transform = `translate(${spread}px, ${-e * 160 - i * e * 6}px) rotate(${(i % 2 ? 1 : -1) * e * 6}deg)`;
      s.style.opacity = 1 - smooth(0.005 + i * 0.002, 0.04 + i * 0.002, p);
    });
    drips.forEach(d => (d.style.opacity = 1 - smooth(0.0, 0.025, p)));
    cut.style.opacity = 1 - smooth(0.012, 0.04, p);
    heroMeta.style.opacity = 1 - smooth(0.0, 0.03, p);
    const par = 1 - e;
    const mxPar = cmx * par, myPar = cmy * par;
    media.style.transform = `translate(${mxPar * -18}px, ${myPar * -12}px) scale(${1 + e * .02})`;
    mtype.style.transform = `translate(${mxPar * 30}px, ${myPar * 20}px)`;
    cut.style.transform = `translate(${mxPar * -9}px, ${myPar * -7}px)`;
    glow += ((pointerOver ? .95 * par : 0) - glow) * .13;
    stage.style.setProperty('--glint', glow.toFixed(3));
    stage.style.setProperty('--glint-x', `${cmx * W}px`);
    stage.style.setProperty('--glint-y', `${cmy * H}px`);

    // video legs
    loadLeg(legs[0]);
    if (p > .21) loadLeg(legs[1]);
    if (p > .47) loadLeg(legs[2]);
    const onAnatomy = p >= T.leg1[1] && p < T.leg2[0];
    if (p < .006 || onAnatomy) {
      showLeg(-1);
    } else if (p < T.leg2[0]) {
      scrub(legs[0], smooth(...T.leg1, p) * legs[0].dur);
      showLeg(0);
    } else if (p < T.leg3[0] - .008) {
      scrub(legs[1], clamp((p - T.leg2[0]) / (T.leg2[1] - T.leg2[0])) * legs[1].dur);
      showLeg(1);
    } else {
      scrub(legs[2], smooth(...T.leg3, p) * legs[2].dur);
      showLeg(2);
    }
    anatomyFrame.classList.toggle('on', onAnatomy || (p >= T.leg1[1] && activeLeg < 0));
    poster.style.opacity = activeLeg >= 0 ? 0 : 1;

    // copy beats
    T.beats.forEach(([a, b], i) => {
      const o = win(p, a, b, 0.03), el = beats[i];
      el.style.opacity = o; el.classList.toggle('on', o > 0.01);
      const y = (1 - o) * 26;
      if (!portrait) el.style.transform = (i < 2 ? 'translateY(-50%) ' : '') + `translateY(${y}px)`;
      else el.style.transform = `translateY(${y}px)`;
    });

    // labels
    const [la, lb] = T.labels;
    const out = 1 - smooth(lb - 0.02, lb + 0.01, p);
    labelEls.forEach((l, k) => {
      const t = smooth(la + k * 0.011, la + k * 0.011 + 0.03, p) * out;
      l.g.setAttribute('opacity', t > 0.001 ? 1 : 0);
      l.line.style.strokeDashoffset = l.len * (1 - smooth(0, 0.6, t));
      l.ring.setAttribute('r', 6 + 12 * t);
      const tt = smooth(0.45, 1, t);
      l.name.style.opacity = tt; l.note.style.opacity = tt * 0.7;
      mobEls[k].classList.toggle('in', t > 0.5);
    });

    bar.style.transform = `scaleY(${p})`;
    stage.style.setProperty('--endfade', smooth(0.95, 1, p).toFixed(3));
    flakesAlpha = p < 0.05 ? 1 : lerp(1, 0.35, smooth(0.05, 0.12, p));
  }

  /* ---------------- floating chilli flakes + sesame ---------------- */
  const fc = $('#flakes'), fx = fc.getContext('2d');
  let flakes = [], flakesAlpha = 1, dpr = 1;
  function sizeFlakes() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    fc.width = W * dpr; fc.height = H * dpr;
    const count = reduce ? 0 : Math.round((coarse ? 26 : 60) * Math.min(1.4, (W * H) / (1440 * 900)));
    flakes = Array.from({ length: count }, () => newFlake(true));
  }
  function newFlake(anywhere) {
    const seed = Math.random() < 0.35;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : -20,
      vy: 0.12 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.15,
      r: seed ? 2.2 + Math.random() * 1.6 : 1.6 + Math.random() * 3.4,
      a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.02,
      seed, hue: Math.random(), z: 0.4 + Math.random() * 0.8, sway: Math.random() * 6.28,
      pts: Array.from({ length: 5 }, (_, i) => [Math.cos(i / 5 * 6.28) * (0.6 + Math.random() * 0.6), Math.sin(i / 5 * 6.28) * (0.5 + Math.random() * 0.7)]),
    };
  }
  function drawFlakes() {
    requestAnimationFrame(drawFlakes);
    if (reduce || scrollY > storyTop + storyLen + 10) return;
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, W, H);
    if (flakesAlpha > 0.01 && scrollY < storyTop + storyLen + 10) {
      fx.globalAlpha = flakesAlpha;
      for (const f of flakes) {
        f.sway += 0.01; f.y += f.vy * f.z; f.x += f.vx + Math.sin(f.sway) * 0.15; f.a += f.va;
        const dx = f.x - px, dy = f.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) { const k = (1 - Math.sqrt(d2) / 120) * 2.2; f.x += dx / Math.sqrt(d2 + 1) * k; f.y += dy / Math.sqrt(d2 + 1) * k; f.va = clamp(f.va + .002, -.06, .06); }
        if (f.y > H + 20) Object.assign(f, newFlake(false));
        fx.save(); fx.translate(f.x, f.y); fx.rotate(f.a); fx.scale(f.z, f.z);
        if (f.seed) {
          fx.fillStyle = 'rgba(246,234,212,0.9)';
          fx.beginPath(); fx.ellipse(0, 0, f.r * 1.5, f.r * 0.8, 0, 0, 6.283); fx.fill();
        } else {
          fx.fillStyle = f.hue < 0.55 ? '#d8261a' : f.hue < 0.85 ? '#ef6b1f' : '#f2a531';
          fx.beginPath(); f.pts.forEach(([a, b], i) => (i ? fx.lineTo(a * f.r * 1.4, b * f.r * 1.4) : fx.moveTo(a * f.r * 1.4, b * f.r * 1.4))); fx.closePath(); fx.fill();
        }
        fx.restore();
      }
    }
  }

  /* ---------------- drip wipe into cream ---------------- */
  const dripSvg = $('#dripSvg');
  const dripPaths = [];
  (function buildDrips() {
    mk('rect', { x: 0, y: 0, width: 1440, height: 26, fill: '#2c0306' }, dripSvg);
    let x = 10;
    const rnd = (a, b) => a + Math.random() * (b - a);
    while (x < 1440) {
      const w = rnd(22, 70), len = rnd(30, 230);
      const g = mk('g', {}, dripSvg);
      // a drip: neck from the band down to a round bead
      const r = w * 0.42, cx = x + w / 2, neck = w * 0.32;
      const d = `M${x},20 C${x + w * 0.2},26 ${cx - neck},34 ${cx - neck},${20 + len - r}
        A${r},${r} 0 1 0 ${cx + neck},${20 + len - r} C${cx + neck},34 ${x + w * 0.8},26 ${x + w},20 Z`;
      mk('path', { d }, g);
      g.style.transformOrigin = `${cx}px 20px`; g.style.transformBox = 'view-box';
      dripPaths.push({ g, k: rnd(0.4, 1) });
      x += w + rnd(8, 80);
    }
  })();
  function dripLoop() {
    requestAnimationFrame(dripLoop);
    const r = dripSvg.getBoundingClientRect();
    if (reduce || r.top > innerHeight || r.bottom < 0) return;
    const t = clamp((innerHeight - r.top) / (innerHeight * 0.9));
    dripPaths.forEach(d => (d.g.style.transform = `scaleY(${0.15 + smooth(0, 1, t) * 0.85 * (0.6 + d.k * 0.4)})`));
  }

  /* ---------------- menu ---------------- */
  const chilli = lit => `<svg viewBox="0 0 32 32" class="${lit ? 'lit' : ''}" aria-hidden="true">
    <path d="M22 6c2 0 3.6 1.4 3.6 3.4 0 1.2-.4 2-1 2.6" fill="none" stroke="${lit ? '#3f8a28' : 'currentColor'}" stroke-width="2.2" stroke-linecap="round" opacity="${lit ? 1 : .35}"/>
    <path d="M24.6 12.4c1.4 3.4-.2 8.6-5.4 12.6-4.4 3.4-10.4 4.6-13.6 3.2-1-.4-.6-1.4.4-1.6 4.6-1 8.2-4 10.4-8.6 1.4-3 2.6-5.4 4.4-6.2 1.6-.6 3.2-.2 3.8.6z" fill="${lit ? '#d9231b' : 'currentColor'}" opacity="${lit ? 1 : .2}"/>
    <path d="M19.4 14.2c-.6 1.6-1.4 3.2-2.4 4.4" stroke="#fff" stroke-opacity="${lit ? .55 : 0}" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>`;
  const dishRows = [...document.querySelectorAll('.dish')];
  const dishes = dishRows.map(row => {
    const meter = $('.meter', row);
    const heat = Number(row.dataset.heat);
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', `Heat ${heat} of 5`);
    meter.innerHTML = [1, 2, 3, 4, 5].map(level => chilli(level <= heat)).join('');
    return { name: $('h3', row).textContent, price: Number(row.dataset.price) };
  });

  /* ---------------- fictional order flow ---------------- */
  const order = $('#order');
  if (typeof order.showModal === 'function') {
    const title = $('#orderTitle');
    const message = $('#orderMessage');
    const orderItems = $('#orderItems');
    const orderTotal = $('#orderTotal');
    const complete = $('#completeOrder');
    const browse = $('#browseMenu');
    const status = $('#orderStatus');
    const count = $('.order-count');
    const quantities = Array(dishes.length).fill(0);
    const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    let completed = false;

    function renderOrder() {
      const quantity = quantities.reduce((total, amount) => total + amount, 0);
      count.hidden = quantity === 0;
      count.textContent = quantity;
      title.textContent = completed ? 'Demo order complete' : 'Your bag';
      message.textContent = completed
        ? 'Thanks for trying Spicy Bite. This was a fictional order.'
        : quantity ? 'Review your dishes and quantities.' : 'Add dishes from the menu to build your bag.';
      orderItems.innerHTML = dishes.map((dish, index) => {
        const amount = quantities[index];
        if (!amount) return '';
        return `<li><div><strong>${dish.name}</strong><small>${rupees.format(dish.price * amount)}</small></div>
          <div class="quantity">
            <button type="button" data-index="${index}" data-change="-1" aria-label="Remove one ${dish.name}">−</button>
            <span aria-label="Quantity ${amount}">${amount}</span>
            <button type="button" data-index="${index}" data-change="1" aria-label="Add one ${dish.name}">+</button>
          </div></li>`;
      }).join('');
      const subtotal = dishes.reduce((total, dish, index) => total + dish.price * quantities[index], 0);
      $('strong', orderTotal).textContent = rupees.format(subtotal);
      orderTotal.hidden = complete.hidden = quantity === 0;
    }

    function changeQuantity(index, delta) {
      quantities[index] = Math.max(0, quantities[index] + delta);
      completed = false;
      renderOrder();
    }

    dishRows.forEach((row, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dish-add';
      button.textContent = 'Add +';
      button.setAttribute('aria-label', `Add ${dishes[index].name} to order`);
      button.addEventListener('click', () => {
        changeQuantity(index, 1);
        status.textContent = `${dishes[index].name} added. ${quantities[index]} in your bag.`;
        button.textContent = 'Added ✓';
        clearTimeout(button.feedbackTimer);
        button.feedbackTimer = setTimeout(() => { button.textContent = 'Add +'; }, 900);
      });
      row.classList.add('can-order');
      row.append(button);
    });

    document.querySelectorAll('[data-order]').forEach(link => {
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', event => {
        event.preventDefault();
        completed = false;
        renderOrder();
        order.showModal();
        title.focus();
      });
    });
    orderItems.addEventListener('click', event => {
      const button = event.target.closest('button[data-index]');
      if (!button) return;
      const { index, change } = button.dataset;
      changeQuantity(Number(index), Number(change));
      const next = $(`[data-index="${index}"][data-change="${change}"]`, orderItems);
      (next || $('button', orderItems) || browse).focus();
    });
    browse.addEventListener('click', () => order.close());
    complete.addEventListener('click', () => {
      quantities.fill(0);
      completed = true;
      renderOrder();
      title.focus();
    });
  }

  /* ---------------- heat dial ---------------- */
  const LEVELS = [
    ['Mild hum', 'A little chilli warmth with plenty of room for garlic and smoke.', '#a3471b'],
    ['Warm', 'A gentle glow that builds by the last bite.', '#a43a17'],
    ['Proper kick', 'The house standard. You will feel it, then you will want more.', '#8f1d13'],
    ['Fire drill', 'Eyes water, nose runs, you keep eating anyway.', '#7a0d10'],
    ['Volcano', 'Bird\'s eye, Kashmiri and ghost pepper. Keep the milk close.', '#4a0307'],
  ];
  const range = $('#heatRange'), chillis = $('#chillis'), heatSec = $('#heat');
  chillis.innerHTML = [1, 2, 3, 4, 5].map(() => chilli(true)).join('');
  let heatLevel = 3;
  function setHeat(v) {
    heatLevel = v;
    const [n, d, bg] = LEVELS[v - 1];
    $('#heatName').textContent = n; $('#heatDesc').textContent = d;
    heatSec.style.setProperty('--hbg', bg);
    [...chillis.children].forEach((s, i) => { s.classList.toggle('off', i >= v); s.classList.toggle('lit', i < v); });
    range.setAttribute('aria-valuetext', n);
  }
  range.addEventListener('input', () => setHeat(+range.value));
  setHeat(3);

  const ec = $('#embers'), ex = ec.getContext('2d');
  let embers = [];
  function sizeEmbers() { const r = heatSec.getBoundingClientRect(); ec.width = r.width * dpr; ec.height = r.height * dpr; }
  function emberLoop() {
    const r = heatSec.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight && !reduce) {
      const w = r.width, h = r.height;
      ex.setTransform(dpr, 0, 0, dpr, 0, 0); ex.clearRect(0, 0, w, h);
      const want = heatLevel * heatLevel * 9;
      while (embers.length < want) embers.push({ x: Math.random() * w, y: h + Math.random() * 40, v: 0.4 + Math.random() * (0.6 + heatLevel * 0.35), s: 1 + Math.random() * 2.4, l: 1, f: Math.random() * 6 });
      if (embers.length > want) embers.length = want;
      ex.globalCompositeOperation = 'lighter';
      for (const m of embers) {
        m.y -= m.v; m.f += 0.05; m.x += Math.sin(m.f) * 0.5; m.l = clamp(m.y / h);
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        ex.fillStyle = `rgba(255,${120 + 100 * m.l | 0},40,${0.15 + 0.6 * m.l})`;
        ex.beginPath(); ex.arc(m.x, m.y, m.s, 0, 6.283); ex.fill();
      }
      ex.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(emberLoop);
  }

  /* ---------------- reveals ---------------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2 });
  document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 7) * 60 + 'ms'; io.observe(el); });

  /* ---------------- boot ---------------- */
  measure(); readScroll(); sizeFlakes(); sizeEmbers();
  addEventListener('resize', () => { sizeFlakes(); sizeEmbers(); });
  // WebKit can resolve the 680svh story height after this script runs; re-measure whenever it settles.
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); readScroll(); }).observe(story);
  addEventListener('load', () => { measure(); readScroll(); });
  motionPreference.addEventListener('change', event => {
    reduce = event.matches;
    document.documentElement.classList.toggle('motion', !reduce);
    measure(); readScroll(); sizeFlakes(); sizeEmbers();
    if (reduce) {
      showLeg(-1);
      poster.style.opacity = 1;
      anatomyFrame.classList.remove('on');
      media.style.transform = mtype.style.transform = cut.style.transform = '';
      cut.style.opacity = heroMeta.style.opacity = 1;
      beats.forEach(beat => beat.classList.remove('on'));
      mobEls.forEach(label => label.classList.remove('in'));
    }
  });
  const go = () => {
    if (document.body.classList.contains('loaded')) return;
    document.body.classList.add('loaded');
    // after the intro animation, hand the letters to the scroll loop
    setTimeout(() => { letters.forEach(s => { s.style.animation = 'none'; s.style.opacity = 1; s.style.transform = 'none'; }); document.body.classList.add('settled'); }, 1900);
  };
  setTimeout(go, 850);
  Promise.all([document.fonts.ready, poster.decode().catch(() => {})]).then(go);
  requestAnimationFrame(frame); requestAnimationFrame(drawFlakes); requestAnimationFrame(dripLoop); requestAnimationFrame(emberLoop);
})();
