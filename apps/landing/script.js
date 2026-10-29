(function () {
  "use strict";
  // Copiar comando
  (function () {
    const btn = document.getElementById("copyCmd");
    const code = document.getElementById("cmdText");
    if (!btn || !code) return;
    btn.addEventListener("click", () => {
      const text = code.textContent.replace(/^\s*\$\s*/, "");
      const done = () => { btn.textContent = "copiado"; setTimeout(() => { btn.textContent = "copiar"; }, 1600); };
      const fallback = () => { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
      try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
    });
  })();


  // ---------- Parámetros ajustables ----------
  const CONFIG = {
    viewHeight: 10,        // alto del mundo en unidades
    antSpacing: 0.46,      // separación entre hormigas (× escala)
    speedDivisor: 6,       // velocidad = ancho / speedDivisor (unidades/s)
    minSpeed: 1.4,
    trailBase: -1.45,      // altura de la fila respecto al centro
    letterY: 0.95,         // altura donde quedan las letras
    wordWidthRatio: 0.82,  // ancho de la palabra respecto a pantalla
    maxWordWidth: 8.6,
    jitterRot: 0.105,      // ±6° de desorden
    jitterX: 0.07,
    jitterY: 0.12,
    leafEvery: 5,
    calmSpeed: 0.5,        // velocidad tras montar el logo (× normal)
    calmKeep: [0, 2],      // de cada 5 hormigas de la fila, cuáles se quedan
    pushRadius: 0.55,      // radio de empuje del ratón (× escala)
    pushForce: 46,
    springK: 16,           // fuerza con la que vuelven a su camino
    springDamp: 4.2
  };
  const WORD = ["K", "E", "B", "E", "L"];

  const hero = document.getElementById("hero");
  const canvas = document.getElementById("scene");
  const skipBtn = document.getElementById("skip");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    document.body.classList.add("is-revealed");
  }
  setTimeout(reveal, 14000); // red de seguridad

  function fallback() { hero.classList.add("no-gl"); reveal(); }
  if (!window.THREE) { fallback(); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { fallback(); return; }
  if (!renderer || !renderer.getContext()) { fallback(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 50);
  camera.position.z = 20;

  // ---------- Utilidades ----------
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#000000";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeOutBack = (p) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // ---------- Recursos compartidos ----------
  const circleGeo = new THREE.CircleGeometry(1, 24);
  const planeGeo = new THREE.PlaneGeometry(1, 1);

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  (function () {
    const g = shadowCanvas.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  })();
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);

  const mats = {
    ant: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    antLine: new THREE.LineBasicMaterial({ color: 0x000000 }),
    leaf: new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }),
    vein: new THREE.LineBasicMaterial({ color: 0x000000 }),
    shadow: new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
    letter: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false }),
    letterDeep: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false }),
    letterShadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14, depthWrite: false })
  };
  const letterMats = []; // materiales con textura por letra

  function applyColors() {
    mats.ant.color.set(css("--ant"));
    mats.antLine.color.set(css("--ant"));
    mats.leaf.color.set(css("--leaf"));
    mats.vein.color.set(css("--leaf-vein"));
    letterMats.forEach((m) => {
      m.front.color.set(css("--accent"));
      m.deep.color.set(css("--accent-deep"));
    });
    if (reduceMotion) requestRender();
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyColors);
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });

  // Hoja
  const leafShape = new THREE.Shape();
  leafShape.moveTo(-1, 0);
  leafShape.quadraticCurveTo(-0.1, 0.78, 1, 0);
  leafShape.quadraticCurveTo(-0.1, -0.78, -1, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 10);
  const veinGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, 0, 0.01), new THREE.Vector3(0.95, 0, 0.01)]);

  // ---------- Layout dependiente del tamaño ----------
  const L = {};
  function computeLayout() {
    const w = hero.clientWidth, h = hero.clientHeight;
    const aspect = w / h;
    L.H = CONFIG.viewHeight;
    L.W = L.H * aspect;
    camera.left = -L.W / 2; camera.right = L.W / 2; camera.top = L.H / 2; camera.bottom = -L.H / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);

    L.s = clamp(L.W / 14, 0.8, 1.15);
    L.wordW = Math.min(L.W * CONFIG.wordWidthRatio, CONFIG.maxWordWidth);
    L.slotSp = L.wordW / 5;
    L.capH = Math.min(L.slotSp * 0.95, 1.8);
    L.capW = L.capH * 0.85;
    L.m = 0.6 + L.capW;
    L.sp = CONFIG.antSpacing * L.s;
    L.speed = Math.max(CONFIG.minSpeed, L.W / CONFIG.speedDivisor);
    L.slots = WORD.map((_, i) => -L.wordW / 2 + L.slotSp * (i + 0.5));

    // Posición del texto bajo la fila
    let lowest = Infinity;
    for (let x = -L.W * 0.35; x <= L.W * 0.35; x += 0.1) lowest = Math.min(lowest, trailY(x));
    const screenY = ((L.H / 2 - (lowest - 0.6 * L.s)) / L.H) * h;
    hero.style.setProperty("--copy-top", Math.round(screenY) + "px");
  }

  function trailY(x) {
    const s = L.s || 1;
    return CONFIG.trailBase + s * (0.3 * Math.sin(0.62 * x + 0.4) + 0.15 * Math.sin(1.37 * x + 1.9) + 0.06 * Math.sin(2.9 * x + 0.3));
  }

  // ---------- Hormiga ----------
  const legDefs = [
    // hipX, ángulo base, fémur, tibia, curvatura
    [0.06, 0.8, 0.075, 0.085, -0.35],
    [0.038, 1.6, 0.07, 0.085, 0.1],
    [0.016, 2.35, 0.075, 0.1, 0.4]
  ];
  const ants = [];

  function makeAnt(opts) {
    const g = new THREE.Group();
    const parts = [[-0.1, 0, 0.1, 0.066], [-0.008, 0, 0.02, 0.016], [0.04, 0, 0.056, 0.034], [0.118, 0, 0.042, 0.044]];
    parts.forEach(([x, y, rx, ry]) => {
      const m = new THREE.Mesh(circleGeo, mats.ant);
      m.position.set(x, y, 0); m.scale.set(rx, ry, 1); g.add(m);
    });
    const positions = new Float32Array(16 * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geo, mats.antLine);
    lines.frustumCulled = false;
    g.add(lines);

    let leaf = null;
    if (opts.leaf) {
      leaf = new THREE.Group();
      const lm = new THREE.Mesh(leafGeo, mats.leaf);
      const lv = new THREE.Line(veinGeo, mats.vein);
      leaf.add(lm, lv);
      const ls = 0.11 + rand() * 0.07;
      leaf.scale.set(ls * 1.25, ls, 1);
      leaf.position.set(0.17 + ls * 0.6, 0, 0.3);
      leaf.userData.baseRot = (rand() - 0.5) * 1.1;
      g.add(leaf);
    }

    const shadow = new THREE.Mesh(planeGeo, mats.shadow);
    scene.add(g, shadow);

    const a = Object.assign({}, opts, {
      ox: 0, oy: 0, vx: 0, vy: 0, hidden: false,
      group: g, geo, positions, shadow, leaf,
      phase: rand() * Math.PI * 2,
      latRest: (rand() - 0.5) * 0.14,
      wob: rand() * 10,
      x: 0, y: 0, angle: 0
    });
    a.lat = a.latStart !== undefined ? a.latStart : a.latRest;
    ants.push(a);
    return a;
  }

  function updateLegs(a, t) {
    const p = a.positions;
    let k = 0;
    const push = (x, y) => { p[k++] = x; p[k++] = y; p[k++] = 0; };
    for (const side of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        const [hx, base, f, tb, bend] = legDefs[i];
        const tripod = ((i % 2 === 0) === (side === 1)) ? 0 : Math.PI;
        const sw = Math.sin(a.phase + tripod) * 0.34;
        const ang = base - sw;
        const hy = side * 0.02;
        const kx = hx + Math.cos(ang) * f, ky = hy + side * Math.sin(ang) * f;
        const ang2 = ang + bend;
        const fx = kx + Math.cos(ang2) * tb, fy = ky + side * Math.sin(ang2) * tb;
        push(hx, hy); push(kx, ky);
        push(kx, ky); push(fx, fy);
      }
      // antena
      const wig = Math.sin(t * 7 + a.wob + side) * 0.012;
      push(0.152, side * 0.014); push(0.19, side * 0.046 + wig);
      push(0.19, side * 0.046 + wig); push(0.248, side * 0.052 + wig * 1.6);
    }
    a.geo.attributes.position.needsUpdate = true;
  }

  // ---------- Letras ----------
  function letterTexture(ch) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.font = '800 210px "Bricolage Grotesque", "Arial Black", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(ch, 128, 128 + 210 * 0.35);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  const groups = []; // cada grupo = 3 hormigas + 1 letra
  const texCache = {};

  function makeLetter(ch) {
    if (!texCache[ch]) texCache[ch] = letterTexture(ch);
    const tex = texCache[ch];
    const front = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, depthWrite: false });
    const deep = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, depthWrite: false });
    const sh = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false });
    letterMats.push({ front, deep });
    const grp = new THREE.Group();
    const d = new THREE.Mesh(planeGeo, deep);
    const f = new THREE.Mesh(planeGeo, front);
    d.position.z = 0; f.position.z = 0.01;
    grp.add(d, f);
    const shadow = new THREE.Mesh(planeGeo, sh);
    scene.add(grp, shadow);
    return { grp, front: f, deep: d, shadow };
  }

  // ---------- Construcción ----------
  let S = 0; // longitud del bucle

  function build() {
    computeLayout();
    const span = L.W + 2 * L.m;
    const N = Math.ceil(span / L.sp);
    S = N * L.sp;
    const gap = Math.max(3, Math.ceil((L.capW * 1.6) / L.sp));

    const groupIdx = WORD.map((_, k) => 1 + (WORD.length - 1 - k) * gap); // L primero en la fila
    const blocked = new Set();
    groupIdx.forEach((gi) => {
      for (let d = -6; d <= 6; d++) if (Math.abs(d) * L.sp < L.capW * 0.75) blocked.add(gi + d);
    });

    // hormigas de la fila
    let leafCount = 0;
    for (let i = 0; i < N; i++) {
      if (blocked.has(i)) continue;
      leafCount++;
      makeAnt({ kind: "line", lineIdx: i, pos: -i * L.sp, lap: 0, leaf: leafCount % CONFIG.leafEvery === 3 });
    }

    // grupos que cargan letras
    WORD.forEach((ch, k) => {
      const letter = makeLetter(ch);
      const g = {
        k, ch, letter,
        pos: -groupIdx[k] * L.sp, lap: 0,
        dropped: false, landed: false, skip: false,
        pauseUntil: 0, landStart: 0, factor: 1,
        jx: (rand() - 0.5) * 2, jy: (rand() - 0.5) * 2, jr: (rand() - 0.5) * 2,
        dropPose: null, members: []
      };
      [[0.45, 0], [-0.32, 0.36], [-0.32, -0.36]].forEach(([dxK, latK]) => {
        const m = makeAnt({ kind: "member", g, dxK, latK, leaf: false });
        g.members.push(m);
      });
      groups.push(g);
    });
  }

  function anchorX(g) { return -L.W / 2 - L.m + g.pos; }
  function slotTarget(g) {
    return {
      x: L.slots[g.k] + g.jx * CONFIG.jitterX * L.slotSp,
      y: CONFIG.letterY + g.jy * CONFIG.jitterY * L.capH,
      r: g.jr * CONFIG.jitterRot
    };
  }
  function bump(g, x) {
    if (!g || g.lap !== 0 || g.skip) return 0;
    const sx = L.slots[g.k];
    const A = slotTarget(g).y - trailY(sx);
    const w = 1.05 * Math.max(L.s, 0.85);
    return A * Math.exp(-Math.pow((x - sx) / w, 2));
  }

  function pathY(a, x) {
    if (a.kind === "member") {
      const g = a.g;
      const latWorld = a.latK * L.capH;
      const lat = (g.dropped ? a.latBlend : 1) * latWorld + (g.dropped ? (1 - a.latBlend) * a.latRest : 0);
      return trailY(x) + bump(g, x - a.dxK * L.capW) + lat;
    }
    return trailY(x) + a.lat;
  }

  // ---------- Simulación ----------
  let simT = 0;
  let revealQueued = false;
  let calm = false, speedMul = 1;
  const mouse = { x: 1e9, y: 1e9 };

  function hideAnt(a) {
    a.hidden = true;
    a.group.visible = false;
    a.shadow.visible = false;
  }
  function startCalm() {
    if (calm) return;
    calm = true;
    const edge = L.W / 2 + 0.4;
    ants.forEach((a) => {
      if (a.kind === "line") a.retire = !CONFIG.calmKeep.includes(a.lineIdx % 5);
      else a.retire = a !== a.g.members[0];
      if (a.retire && (Math.abs(a.x) > edge || reduceMotion)) hideAnt(a);
    });
  }

  function step(dt) {
    simT += dt;
    const t = simT;
    if (calm) speedMul += (CONFIG.calmSpeed - speedMul) * Math.min(1, dt * 0.7);

    // grupos
    for (const g of groups) {
      let f = 1;
      if (g.lap === 0 && !g.skip) {
        const d = Math.abs(anchorX(g) - L.slots[g.k]);
        f = 0.28 + 0.72 * smooth(d / 1.0);
        if (t < g.pauseUntil) f = 0;
      }
      g.factor = f;
      g.pos += L.speed * speedMul * f * dt;
      if (!g.dropped && g.lap === 0 && anchorX(g) >= L.slots[g.k]) {
        g.dropped = true;
        g.pauseUntil = t + 0.4;
        g.landStart = t;
        g.dropPose = { x: anchorX(g), y: trailY(anchorX(g)) + bump(g, anchorX(g)), r: g.letter.grp.rotation.z };
        g.members.forEach((m) => { m.latBlend = 1; });
      }
      if (g.pos > S) {
        g.pos -= S; g.lap++;
        if (calm) g.members.forEach((m) => { if (m.retire) hideAnt(m); });
      }
      if (g.dropped) g.members.forEach((m) => { m.latBlend = Math.max(0, (m.latBlend ?? 1) - dt * 0.8); });
    }

    // hormigas
    const R = CONFIG.pushRadius * L.s;
    for (const a of ants) {
      if (a.hidden) continue;
      let x, spd;
      if (a.kind === "line") {
        spd = L.speed * speedMul;
        a.pos += spd * dt;
        if (a.pos > S) {
          a.pos -= S; a.lap++;
          if (a.retire) { hideAnt(a); continue; }
        }
        x = -L.W / 2 - L.m + a.pos;
      } else {
        spd = L.speed * speedMul * a.g.factor;
        x = anchorX(a.g) + a.dxK * L.capW;
      }
      const y = pathY(a, x) + Math.sin(t * 2.1 + a.wob) * 0.012;
      const dy = pathY(a, x + 0.03) - pathY(a, x - 0.03);
      let angle = Math.atan2(dy, 0.06);

      // Empuje del ratón + muelle de vuelta al camino
      if (dt > 0) {
        const px = x + a.ox - mouse.x, py = y + a.oy - mouse.y;
        const d = Math.hypot(px, py);
        if (d < R && d > 1e-4) {
          const f = (1 - d / R) * CONFIG.pushForce;
          a.vx += (px / d) * f * dt;
          a.vy += (py / d) * f * dt;
        }
        a.vx += (-CONFIG.springK * a.ox - CONFIG.springDamp * a.vx) * dt;
        a.vy += (-CONFIG.springK * a.oy - CONFIG.springDamp * a.vy) * dt;
        a.ox += a.vx * dt; a.oy += a.vy * dt;
        const sp2 = Math.hypot(a.vx, a.vy);
        if (sp2 > 0.05) {
          // gira un poco hacia donde la empujan y mueve las patas más rápido
          const ca = Math.cos(angle), sa = Math.sin(angle);
          const side = ca * a.vy - sa * a.vx;
          angle += clamp(side * 0.35, -0.7, 0.7);
          a.phase += dt * sp2 * 14;
        }
      }
      a.phase += dt * (spd * 9 + (spd > 0 ? 0 : 0.6));
      placeAnt(a, x + a.ox, y + a.oy, angle, t);
    }

    // letras
    let landedCount = 0;
    for (const g of groups) {
      const lt = g.letter;
      const size = L.capH / 0.57;
      if (!g.dropped) {
        const x = anchorX(g);
        const y = trailY(x) + bump(g, x) + 0.04;
        const rot = Math.sin(t * 5 + g.k) * 0.05;
        const sc = 1 + Math.sin(t * 11 + g.k) * 0.012;
        setLetter(g, x, y, rot, size * sc, 0.16, 3);
      } else {
        const tg = slotTarget(g);
        const p = g.skip ? 1 : clamp((t - g.landStart) / 0.6, 0, 1);
        const e = easeOutCubic(p);
        const dp = g.dropPose || tg;
        const x = dp.x + (tg.x - dp.x) * e;
        const y = dp.y + (tg.y - dp.y) * e;
        const r = dp.r + (tg.r - dp.r) * e;
        const sc = 1.08 - 0.08 * easeOutBack(p);
        setLetter(g, x, y, r, size * sc, 0.16 - 0.1 * e, p >= 1 ? 0.4 : 3 - 2.6 * e);
        if (p >= 1) { landedCount++; g.landed = true; }
      }
    }
    if (landedCount === groups.length && !revealQueued) { revealQueued = true; setTimeout(reveal, 250); startCalm(); }
  }

  function setLetter(g, x, y, rot, size, lift, z) {
    const lt = g.letter;
    lt.grp.position.set(x, y, z);
    lt.grp.rotation.z = rot;
    lt.grp.scale.set(size, size, 1);
    const off = L.capH * 0.03;
    lt.deep.position.set(off * 0.5 / size, -off / size, 0);
    lt.front.position.set(0, 0, 0.01);
    lt.shadow.position.set(x + lift * L.capH * 0.6, y - lift * L.capH * 0.85, 0.05);
    lt.shadow.rotation.z = rot;
    lt.shadow.scale.set(size, size, 1);
  }

  function placeAnt(a, x, y, angle, t) {
    const s = L.s;
    a.x = x; a.y = y; a.angle = angle;
    a.group.position.set(x, y, 1);
    a.group.rotation.z = angle + Math.sin(a.phase * 0.5) * 0.04;
    a.group.scale.set(s, s, 1);
    if (a.leaf) a.leaf.rotation.z = a.leaf.userData.baseRot + Math.sin(a.phase * 0.5 + 1) * 0.08;
    a.shadow.position.set(x + 0.025 * s, y - 0.04 * s, 0);
    a.shadow.rotation.z = angle;
    a.shadow.scale.set(0.46 * s, 0.2 * s, 1);
    updateLegs(a, t);
  }

  // ---------- Bucle de render ----------
  let running = false, rafId = 0, last = 0, visible = true;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    renderer.render(scene, camera);
  }
  function start() {
    if (running || reduceMotion) return;
    running = true; last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function syncRunning() { (visible && !document.hidden) ? start() : stop(); }

  let pendingRender = false;
  function requestRender() {
    if (pendingRender) return;
    pendingRender = true;
    requestAnimationFrame(() => { pendingRender = false; renderer.render(scene, camera); });
  }

  // ---------- Resize ----------
  let resizeTimer = 0;
  function onResize() {
    const oldS = S;
    computeLayout();
    const N = Math.max(1, Math.round(oldS / (CONFIG.antSpacing * (L.s))));
    const newS = Math.ceil((L.W + 2 * L.m) / L.sp) * L.sp;
    const k = oldS ? newS / oldS : 1;
    S = newS;
    ants.forEach((a) => { if (a.kind === "line") a.pos *= k; });
    groups.forEach((g) => { g.pos *= k; });
    if (reduceMotion) { step(0); requestRender(); }
  }
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(onResize, 120); });

  // ---------- Saltar intro ----------
  function skipIntro() {
    groups.forEach((g) => {
      if (!g.dropped) {
        g.skip = true; g.dropped = true;
        g.members.forEach((m) => { m.latBlend = 0; });
      }
    });
    reveal();
  }
  skipBtn.addEventListener("click", skipIntro);
  window.addEventListener("keydown", (e) => { if (!revealed && (e.key === "Escape" || e.key === "Enter")) skipIntro(); });

  // ---------- Inicio ----------
  function init() {
    build();
    applyColors();

    if (reduceMotion) {
      // Estado final: logo montado y hormigas quietas a lo largo de la fila
      groups.forEach((g) => { g.skip = true; g.dropped = true; g.lap = 1; g.members.forEach((m) => { m.latBlend = 0; }); });
      ants.forEach((a, i) => { if (a.kind === "line") { a.pos = ((a.pos % S) + S) % S; } });
      groups.forEach((g) => { g.pos = ((g.pos % S) + S) % S; });
      step(0);
      startCalm();
      renderer.render(scene, camera);
      reveal();
      return;
    }

    const setMouse = (e) => {
      const r = hero.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width - 0.5) * L.W;
      mouse.y = (0.5 - (e.clientY - r.top) / r.height) * L.H;
    };
    hero.addEventListener("pointermove", setMouse);
    hero.addEventListener("pointerdown", setMouse);
    const clearMouse = () => { mouse.x = mouse.y = 1e9; };
    hero.addEventListener("pointerleave", clearMouse);
    hero.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") clearMouse(); });

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      syncRunning();
    }).observe(hero);
    document.addEventListener("visibilitychange", syncRunning);
    syncRunning();
  }

  const fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load('800 210px "Bricolage Grotesque"').catch(() => {})
    : Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(init);
})();
