/* ============================================================
   Kebel · Cinemática "Cómo funciona"
   Corte transversal del hormiguero. Todo se calcula a partir
   del tiempo T, así que avanzar, retroceder y pausar es exacto.
   ============================================================ */
(function () {
  "use strict";

  const STEPS = [
    { t0: 0, name: "Entrada", text: "Se te cae una idea en la entrada del hormiguero." },
    { t0: 7, name: "Obreras", text: "Las obreras la bajan y la parten en trozos que puedan cargar." },
    { t0: 13, name: "Obreras", text: "Cada trozo se construye por separado, con su propia obrera." },
    { t0: 18, name: "Centinelas", text: "Las centinelas revisan cada pieza antes de dejarla pasar." },
    { t0: 25, name: "Árbitro", text: "Si una obrera y una centinela no se ponen de acuerdo, la árbitro decide." },
    { t0: 31, name: "Despensa", text: "El resultado queda ordenado en la despensa. Tú solo miras." }
  ];
  const TEND = 38.5;          // fin de la explicación
  const EXIT0 = 36.6, EXIT1 = 42.2; // subida por el túnel hasta la salida
  const INTRO_URL = "index.html";

  const root = document.getElementById("cine");
  const canvas = document.getElementById("scene");
  const $ = (id) => document.getElementById(id);
  const ui = {
    panel: $("panel"), progress: $("progress"), label: $("stepLabel"), text: $("stepText"),
    close: $("closeBtn"), fade: $("fade")
  };
  const Q = KB.quality();
  const reduce = KB.reduce;
  const fromIntro = location.hash === "#desde-intro";

  if (!window.THREE) { root.classList.add("no-gl"); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }); }
  catch (e) { root.classList.add("no-gl"); return; }
  renderer.setPixelRatio(Q.dpr);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const post = new KB.Post(renderer, Q);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(); scene.fog = new THREE.Fog(0xffffff, 70, 160);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 240);

  const COL = {};
  const NAMES = ["bg", "accent", "accent-deep", "soil-a", "soil-b", "soil-sand", "soil-hole", "humus", "soil-mid", "soil-light", "soil-clay", "soil-deep", "tunnel", "stone-a", "stone-b", "stone-c", "ant-body", "leaf", "leaf-vein", "grass", "egg", "root", "seed", "dust"];
  const readColors = () => NAMES.forEach((n) => { COL[n] = KB.css("--" + n); });
  readColors();
  const lin = (n) => KB.lin(COL[n]);

  // ---------- Luces ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 30, bottom: -30, near: 10, far: 140 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  sun.target.position.set(0, -8, 0); sun.position.set(-27, 30, 38);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(20, -5, 30);
  scene.add(hemi, sun, sun.target, fill);
  function applyLights() {
    const dark = KB.isDark();
    hemi.color.set(dark ? 0xCDBB9E : 0xFFF8EE).convertSRGBToLinear();
    hemi.groundColor.set(dark ? 0x1E1610 : 0x8E7556).convertSRGBToLinear();
    hemi.intensity = dark ? 0.55 : 0.6;
    sun.color.set(dark ? 0xFFD9AA : 0xFFEEDA).convertSRGBToLinear(); sun.intensity = dark ? 1.15 : 1.1;
    fill.color.set(0xFFE2B8).convertSRGBToLinear(); fill.intensity = dark ? 0.3 : 0.22;
    scene.background.copy(lin("bg")); scene.fog.color.copy(scene.background);
  }

  // ---------- Mundo ----------
  const EX = -17;           // entrada
  const A_ANT = 0.85;       // escala de las hormigas
  const LANE_F = -0.42, LANE_B = -0.9, BLOCK_Z = -0.86, LEAF_Z = -0.64;
  function surfH(x, z) {
    let h = 0.12 * KB.fbm(x * 0.15 + 2, z * 0.15 + 5, 3) + 0.03 * KB.noise(x * 1.2, z * 1.2);
    const dx = x - EX, r2 = dx * dx + z * z;
    return h + 0.85 * Math.exp(-r2 / 6) - 0.65 * Math.exp(-r2 / 0.7);
  }

  function Route(pts, o) {
    o = o || {};
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], 0)), false, "centripetal", 0.5);
    const len = curve.getLength(); const N = Math.max(40, Math.ceil(len / 0.05));
    const sp = curve.getSpacedPoints(N);
    this.N = N; this.len = len; this.ds = len / N; this.r = o.r || 0.8;
    const X = this.x = new Float32Array(N + 1), Yv = this.y = new Float32Array(N + 1);
    const TX = this.tx = new Float32Array(N + 1), TY = this.ty = new Float32Array(N + 1);
    const NX = this.nx = new Float32Array(N + 1), NY = this.ny = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { X[i] = sp[i].x; Yv[i] = sp[i].y; }
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
      let tx = X[b] - X[a], ty = Yv[b] - Yv[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      TX[i] = tx; TY[i] = ty;
      let nx = -ty, ny = tx; if (ny < -0.02) { nx = -nx; ny = -ny; }
      NX[i] = nx; NY[i] = ny;
    }
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 1; i < N; i++) {
        const nx = NX[i - 1] + 2 * NX[i] + NX[i + 1], ny = NY[i - 1] + 2 * NY[i] + NY[i + 1]; const l = Math.hypot(nx, ny) || 1;
        NX[i] = nx / l; NY[i] = ny / l;
      }
    }
  }
  Route.prototype.at = function (s, out) {
    s = KB.clamp(s, 0, this.len); const f = s / this.ds; const i = Math.min(this.N - 1, Math.floor(f)); const u = f - i;
    out.x = KB.lerp(this.x[i], this.x[i + 1], u); out.y = KB.lerp(this.y[i], this.y[i + 1], u);
    let tx = KB.lerp(this.tx[i], this.tx[i + 1], u), ty = KB.lerp(this.ty[i], this.ty[i + 1], u); let l = Math.hypot(tx, ty) || 1; out.tx = tx / l; out.ty = ty / l;
    let nx = KB.lerp(this.nx[i], this.nx[i + 1], u), ny = KB.lerp(this.ny[i], this.ny[i + 1], u); l = Math.hypot(nx, ny) || 1; out.nx = nx / l; out.ny = ny / l;
    return out;
  };
  Route.prototype.near = function (px, py) {
    let best = 1e18, bi = 0;
    for (let i = 0; i <= this.N; i++) { const dx = this.x[i] - px, dy = this.y[i] - py, d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; } }
    return bi * this.ds;
  };

  const surfPts = []; for (let x = -32; x <= EX - 1.3; x += 1) surfPts.push([x, surfH(x, LEAF_Z)]);
  const ROUTE = new Route(surfPts.concat([
    [EX - 0.95, surfH(EX - 0.95, LEAF_Z) - 0.05], [EX - 0.66, surfH(EX - 0.66, LEAF_Z) - 0.5], [EX - 0.6, -1.2], [EX - 0.6, -2.2], [EX - 0.6, -3.1],
    [EX - 0.4, -3.85], [EX + 0.2, -4.2], [EX + 1.3, -4.3], [-14, -4.3], [-12, -4.3], [-10, -4.3], [-8, -4.3], [-6, -4.3],
    [-4.9, -4.42], [-3.7, -5.2], [-2.4, -6.4], [-1.2, -7.5], [-0.1, -7.95], [1, -8.0], [3, -8.0], [5, -8.0], [6.4, -8.0],
    [7.1, -8.2], [7.7, -9.0], [8.0, -10.5], [8.5, -12.2], [9.3, -13.8], [10.3, -15.05], [11.3, -15.55], [13, -15.6], [15, -15.6], [18.2, -15.6]
  ]), { r: 0.82 });
  const ARB = new Route([[12.4, -8.0], [11, -8.0], [9.5, -8.0], [8, -8.0], [6.5, -8.0], [4.6, -8.0], [3.2, -8.0], [2.2, -8.0]], { r: 0.8 });
  const AMB1 = new Route([[-33, -10.8], [-26, -11.2], [-21, -11.9], [-17, -12.9], [-15, -13.5], [-13, -13.5], [-11, -13.5], [-9, -13.5], [-7.2, -13.4], [-5, -13.0], [-2, -12.4], [1.5, -12.1], [5, -12.5], [7.6, -12.7], [9.5, -12.6], [12, -12.0], [16, -11.3], [21, -10.7], [26, -10.3], [33, -10.0]], { r: 0.72 });
  const AMB2 = new Route([[-33, -22.6], [-24, -23.2], [-16, -22.3], [-8, -23.4], [0, -22.6], [6, -21.6], [12, -22.4], [18, -23.3], [24, -22.5], [33, -22.0]], { r: 0.7 });
  const STUBS = [
    [[-6.3, -4.35], [-6.0, -2.8], [-5.2, -1.6]], [[6.8, -8.0], [7.6, -6.6], [8.8, -5.9]], [[-1.0, -12.3], [-0.6, -14.5], [0.4, -15.6]],
    [[18.2, -15.6], [20.5, -14.6], [22.5, -14.2]], [[-21, -11.9], [-22.5, -14.8], [-23, -17]], [[3, -22.6], [3.6, -19.8], [4.8, -18.4]],
    [[-26, -11.2], [-27.5, -8.4], [-28.4, -6.8]], [[24, -22.5], [25.2, -26], [26, -28]]
  ].map((p) => new Route(p, { r: 0.55 }));
  const CH = [
    { cx: -9.5, rx: 4.6, floor: -4.3, h: 2.4 },
    { cx: 3.6, rx: 3.8, floor: -8.0, h: 2.2 },
    { cx: 11.0, rx: 2.0, floor: -8.0, h: 1.6 },
    { cx: 13.4, rx: 5.6, floor: -15.6, h: 2.3 },
    { cx: -11, rx: 3.6, floor: -13.5, h: 1.8 }
  ];

  // Rejilla de círculos que excavan los túneles
  const CELL = 2, circ = new Map();
  [ROUTE, ARB, AMB1, AMB2].concat(STUBS).forEach((R) => {
    for (let s = 0; s <= R.len; s += 0.22) {
      const p = R.at(s, {}); const cx = p.x + p.nx * R.r * 0.95, cy = p.y + p.ny * R.r * 0.95;
      const k = Math.floor(cx / CELL) + "," + Math.floor(cy / CELL);
      if (!circ.has(k)) circ.set(k, []); circ.get(k).push(cx, cy, R.r);
    }
  });
  function carve(x, y) {
    let c = 0;
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const L = circ.get((gx + i) + "," + (gy + j)); if (!L) continue;
      for (let k = 0; k < L.length; k += 3) {
        const dx = x - L[k], dy = y - L[k + 1]; const m = L[k + 2] - Math.sqrt(dx * dx + dy * dy);
        if (m > -0.05) { const v = KB.smooth((m + 0.04) / 0.2); if (v > c) c = v; }
      }
    }
    for (const ch of CH) {
      const dx = (x - ch.cx) / ch.rx; if (Math.abs(dx) >= 1) continue;
      const top = ch.floor + ch.h * Math.sqrt(1 - dx * dx);
      const m = Math.min(y - ch.floor + 0.06, top - y);
      const v = KB.smooth((m + 0.04) / 0.22); if (v > c) c = v;
    }
    return c;
  }

  const grainMap = KB.grainTex(11, 196, 255); grainMap.encoding = THREE.sRGBEncoding;
  const grainBump = KB.grainTex(23, 0, 255);
  grainMap.repeat.set(26, 16); grainBump.repeat.copy(grainMap.repeat);

  // ---------- Cara del corte ----------
  const FX0 = -34, FX1 = 34, FY0 = -40;
  const face = (function () {
    const sw = Q.mobile ? 210 : 330, sh = Q.mobile ? 160 : 250;
    const n = (sw + 1) * (sh + 1);
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    const D = { dpt: new Float32Array(n), n1: new Float32Array(n), n2: new Float32Array(n), n3: new Float32Array(n), c: new Float32Array(n) };
    let k = 0;
    for (let j = 0; j <= sh; j++) for (let i = 0; i <= sw; i++) {
      const x = FX0 + (FX1 - FX0) * i / sw; const top = surfH(x, 0);
      const y = FY0 + (top - FY0) * j / sh;
      const c = carve(x, y);
      const z = 0.12 * KB.fbm(x * 0.35, y * 0.35, 3) + 0.04 * KB.noise(x * 2.1, y * 2.1) - 1.35 * c + c * 0.1 * KB.noise(x * 1.3 + 5, y * 1.3);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = i / sw; uv[k * 2 + 1] = j / sh;
      D.dpt[k] = top - y; D.n1[k] = KB.fbm(x * 0.25 + 11, y * 0.5, 3); D.n2[k] = KB.noise(x * 3.1, y * 3.1); D.n3[k] = KB.noise(x * 0.6 + 3, y * 1.8); D.c[k] = c;
      k++;
    }
    const idx = [];
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const a = j * (sw + 1) + i, b = a + 1, c2 = a + sw + 1, d = c2 + 1;
      idx.push(a, b, d, a, d, c2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    g.userData = D;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, map: grainMap, bumpMap: grainBump, bumpScale: 0.028 }));
    m.receiveShadow = true; m.castShadow = true; scene.add(m); return m;
  })();
  function colorFace() {
    const D = face.geometry.userData, col = face.geometry.attributes.color;
    const hu = lin("humus"), li = lin("soil-light"), mi = lin("soil-mid"), cl = lin("soil-clay"), de = lin("soil-deep"), tu = lin("tunnel");
    const c = new THREE.Color(), b = new THREE.Color(), dk = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      const dpt = D.dpt[i], n1 = D.n1[i], n3 = D.n3[i];
      const th = 0.9 + 0.35 * n1;
      b.copy(li).lerp(mi, KB.smooth((dpt - 2) / 5 + n1 * 0.5));
      b.lerp(cl, KB.smooth((dpt - 8) / 5 + n3 * 0.6));
      b.lerp(de, KB.smooth((dpt - 18) / 10));
      c.copy(hu).lerp(b, KB.smooth((dpt - th) / 0.6));
      c.multiplyScalar(1 + 0.05 * Math.sin(dpt * 2.6 + n3 * 3));
      if (D.n2[i] > 0.4) c.multiplyScalar(0.82); else if (D.n2[i] < -0.45) c.lerp(li, 0.3);
      const cc = D.c[i];
      c.lerp(dk.copy(tu), cc * 0.82);
      c.lerp(li, 4 * cc * (1 - cc) * 0.12);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  // ---------- Superficie ----------
  const surface = (function () {
    const g = new THREE.PlaneGeometry(68, 32, Q.mobile ? 150 : 240, Q.mobile ? 70 : 110);
    g.rotateX(-Math.PI / 2); g.translate(0, 0, -16);
    const p = g.attributes.position, n = p.count;
    const D = { n1: new Float32Array(n), k: new Float32Array(n), k2: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), z = p.getZ(i); let h = surfH(x, z);
      const dx = x - EX, r = Math.sqrt(dx * dx + z * z);
      p.setY(i, h);
      D.n1[i] = KB.fbm(x * 0.32 + 7, z * 0.32 - 3, 3); D.k[i] = Math.exp(-(r * r) / 1.0); D.k2[i] = Math.exp(-(r * r) / 7);
    }
    g.computeVertexNormals(); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.userData = D;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: grainMap, bumpMap: grainBump, bumpScale: 0.03 });
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
  })();
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: KB.radialTex(true), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const holeGeo = new THREE.CircleGeometry(1.05, 32, 0, Math.PI); holeGeo.rotateX(-Math.PI / 2);
  const holeDecal = new THREE.Mesh(holeGeo, holeMat); holeDecal.position.set(EX + 0.15, surfH(EX + 0.15, -0.3) + 0.03, -0.02); holeDecal.renderOrder = 2; scene.add(holeDecal);
  function colorSurface() {
    const D = surface.geometry.userData, col = surface.geometry.attributes.color;
    const a = lin("soil-a"), b = lin("soil-b"), s = lin("soil-sand"), h = lin("soil-hole"); const c = new THREE.Color();
    for (let i = 0; i < col.count; i++) { c.copy(a).lerp(b, KB.smooth(0.5 + D.n1[i] * 1.2)).lerp(s, D.k2[i] * 0.5).lerp(h, D.k[i] * 0.9); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
  }
})();
