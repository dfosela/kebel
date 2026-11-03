/* ============================================================
   Kebel · Intro 3D
   Hormigas articuladas cargan K-E-B-E-L por un suelo macro,
   las dejan en el centro y siguen caminando para siempre.
   ============================================================ */
window.KebelIntro3D = function (host, opts) {
  "use strict";
  opts = opts || {};

  // ---------- Parámetros ajustables ----------
  const CONFIG = {
    letterH: 3.2,        // alto de cada letra (unidades del mundo, 1 ≈ largo de una hormiga)
    letterDepth: 0.12,   // grosor relativo de las letras
    fov: 30, pitch: 0.93, // lente y ángulo de cámara (rad)
    antSpacing: 1.3,     // separación en la fila
    speed: 2.2,          // velocidad de la fila
    calmSpeed: 0.55,     // velocidad tras montar el logo (× normal)
    calmKeep: [0, 2],    // de cada 5 hormigas de la fila, cuáles se quedan
    pushRadius: 1.25, pushForce: 40, springK: 14, springDamp: 4.6, // empuje del ratón
    jitterYaw: 0.105, jitterX: 0.07, jitterZ: 0.1, // desorden al dejar las letras
    leafEvery: 5,        // cada cuántas hormigas lleva un trozo de hoja
    dofRange: 0.28, dofMax: 9,   // profundidad de campo
    parallax: 0.9
  };
  const WORD = ["K", "E", "B", "E", "L"];

  const hero = document.getElementById("hero");
  const canvas = document.getElementById("scene");
  const fadeEl = document.getElementById("fade");
  const Q = KB.quality();
  const reduce = KB.reduce;
  const fromCine = !!opts.fromCine;

  let revealed = false, active = false;
  function reveal() { if (revealed) return; revealed = true; host.reveal("3d"); }
  const safety = setTimeout(reveal, 16000);
  if (!window.THREE) return null;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }); }
  catch (e) { clearTimeout(safety); return null; }
  if (!renderer || !renderer.getContext()) { clearTimeout(safety); return null; }
  renderer.setPixelRatio(Q.dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const post = new KB.Post(renderer, Q);
  if (!post.ok) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, 30, 70);
  const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 1, 160);

  // ---------- Colores desde CSS ----------
  const COL = {};
  const NAMES = ["bg", "accent", "accent-deep", "soil-a", "soil-b", "soil-sand", "soil-hole", "stone-a", "stone-b", "stone-c", "ant-body", "leaf", "leaf-vein", "leaf-dry", "dust"];
  function readColors() { NAMES.forEach((n) => { COL[n] = KB.css("--" + n); }); }
  readColors();

  // ---------- Luces ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 5, far: 90 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.position.set(-14, 26, 9); sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target);
  function applyLights() {
    const dark = KB.isDark();
    hemi.color.set(dark ? 0xCDBB9E : 0xFFF8EE).convertSRGBToLinear();
    hemi.groundColor.set(dark ? 0x2A2018 : 0xA78F6C).convertSRGBToLinear();
    hemi.intensity = dark ? 0.5 : 0.62;
    sun.color.set(dark ? 0xFFD9AA : 0xFFEEDA).convertSRGBToLinear();
    sun.intensity = dark ? 1.1 : 1.15;
    scene.background.copy(KB.lin(COL.bg)); scene.fog.color.copy(scene.background);
  }

  // ---------- Layout ----------
  const L = {};
  const camBase = new THREE.Vector3();
  const MOUND = new THREE.Vector2();
  function computeLayout() {
    const w = hero.clientWidth, h = hero.clientHeight;
    L.w = w; L.h = h; L.aspect = w / h;
    L.ls = L.aspect < 0.8 ? 0.62 : L.aspect < 1.2 ? 0.8 : 1;
    L.antS = 0.82 + 0.33 * L.ls;
    L.H = CONFIG.letterH * L.ls;
    L.wordW = L.H * 4.3;
    L.slotSp = L.wordW / 5;
    L.letterZ = -1.25 * L.ls;
    L.trailZ0 = 2.55 * L.ls;
    L.target = new THREE.Vector3(0, 0, 0.4 * L.ls);
    const tanV = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov / 2));
    const tanH = tanV * L.aspect;
    let D = 26;
    D = Math.max(D, (L.wordW * 1.3 / 2) / tanH);
    D = Math.max(D, (L.ls * 13.5 / 2) / tanV);
    L.D = D;
    L.visHalfW = D * tanH;
    L.halfW = L.visHalfW * 1.3 + 2.5;
    L.m = 1.5 + L.H * 0.45;
    L.sp = CONFIG.antSpacing * L.antS;
    L.speed = CONFIG.speed * KB.clamp(L.visHalfW / 12, 0.75, 1.35);
    L.slots = WORD.map((_, i) => -L.wordW / 2 + L.slotSp * (i + 0.5));
    camBase.set(0, Math.sin(CONFIG.pitch) * D, Math.cos(CONFIG.pitch) * D).add(L.target);
    camera.aspect = L.aspect; camera.updateProjectionMatrix();
    scene.fog.near = D * 1.1; scene.fog.far = D * 2.3;
    post.setSize(w, h);
  }
  computeLayout();
  MOUND.set(0.6 * L.visHalfW, L.letterZ - 4.6 * L.ls);

  // ---------- Suelo ----------
  function groundH(x, z) {
    let h = 0.16 * KB.fbm(x * 0.12 + 3.1, z * 0.12 - 1.7, 3) + 0.035 * KB.noise(x * 1.1, z * 1.1);
    const dx = x - MOUND.x, dz = z - MOUND.y, r2 = dx * dx + dz * dz;
    h += 1.35 * Math.exp(-r2 / 7.5) - 0.95 * Math.exp(-r2 / 0.5);
    return h;
  }
  const _gn = new THREE.Vector3();
  function groundNormal(x, z, out) {
    const e = 0.18;
    out.set(groundH(x - e, z) - groundH(x + e, z), 2 * e, groundH(x, z - e) - groundH(x, z + e)).normalize();
    return out.lerp(_up, 0.45).normalize();
  }
  const _up = new THREE.Vector3(0, 1, 0);

  const grainMap = KB.grainTex(11, 200, 255); grainMap.encoding = THREE.sRGBEncoding;
  const grainBump = KB.grainTex(23, 0, 255);
  const GW = 78, GD = 52, GZ = -7;
  grainMap.repeat.set(GW / 2.4, GD / 2.4); grainBump.repeat.copy(grainMap.repeat);

  const groundGeo = (function () {
    const step = Q.mobile ? 0.36 : 0.26;
    const g = new THREE.PlaneGeometry(GW, GD, Math.round(GW / step), Math.round(GD / step));
    g.rotateX(-Math.PI / 2); g.translate(0, 0, GZ);
    const p = g.attributes.position, n = p.count;
    g.userData = { n1: new Float32Array(n), n2: new Float32Array(n), k1: new Float32Array(n), k2: new Float32Array(n) };
    const U = g.userData;
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, groundH(x, z));
      U.n1[i] = KB.fbm(x * 0.32 + 7, z * 0.32 - 3, 3);
      U.n2[i] = KB.noise(x * 5.3, z * 5.3);
      const dx = x - MOUND.x, dz = z - MOUND.y, r2 = dx * dx + dz * dz;
      U.k1[i] = Math.exp(-r2 / 1.0); U.k2[i] = Math.exp(-r2 / 7);
    }
    g.computeVertexNormals();
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  })();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: grainMap, bumpMap: grainBump, bumpScale: 0.03 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true; scene.add(ground);
  function colorGround() {
    const a = KB.lin(COL["soil-a"]), b = KB.lin(COL["soil-b"]), s = KB.lin(COL["soil-sand"]), h = KB.lin(COL["soil-hole"]);
    const U = groundGeo.userData, col = groundGeo.attributes.color, c = new THREE.Color(), dk = b.clone().multiplyScalar(0.85);
    for (let i = 0; i < col.count; i++) {
      c.copy(a).lerp(b, KB.smooth(0.5 + U.n1[i] * 1.2));
      if (U.n2[i] > 0.42) c.lerp(dk, 0.35);
      c.lerp(s, U.k2[i] * 0.55).lerp(h, U.k1[i] * 0.8);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  // Entrada del hormiguero
  const holeY = groundH(MOUND.x, MOUND.y);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: KB.radialTex(true), transparent: true, depthWrite: false });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), holeMat);
  hole.rotation.x = -Math.PI / 2; hole.position.set(MOUND.x, holeY + 0.03, MOUND.y); hole.renderOrder = 2;
  const holeCore = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  holeCore.rotation.x = -Math.PI / 2; holeCore.position.set(MOUND.x, holeY + 0.035, MOUND.y);
  scene.add(hole, holeCore);

  // ---------- Piedras, granos, ramitas y hojas secas ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0, bumpMap: grainBump, bumpScale: 0.015 });
  const rockGeos = [KB.rockGeo(3, 2), KB.rockGeo(9, 2), KB.rockGeo(17, 1)];
  const grainGeo = KB.rockGeo(5, 0);
  const rocks = [];
  function inFreeZone(x, z) {
    if (Math.abs(x) < L.wordW * 0.62 && z > L.letterZ - L.H * 0.7 && z < L.trailZ0 + 1.2 * L.ls) return false;
    const tz = L.trailZ0 + L.ls * (0.55 * Math.sin(0.33 * x / L.ls + 0.4) + 0.28 * Math.sin(0.71 * x / L.ls + 1.9));
    if (Math.abs(z - tz) < 1.3 * L.ls) return false;
    const dx = x - MOUND.x, dz = z - MOUND.y; if (dx * dx + dz * dz < 2.2) return false;
    return true;
  }
  const rockList = [];
  (function placeRocks() {
    const r = KB.rng(77);
    const zNear = L.target.z + (camBase.z - L.target.z) * 0.38, zFar = L.target.z - 16;
    const total = Q.mobile ? 70 : 130;
    for (let i = 0; i < total * 4 && rockList.length < total; i++) {
      const x = (r() - 0.5) * L.visHalfW * 3.2, z = zFar + r() * (zNear - zFar);
      if (!inFreeZone(x, z)) continue;
      const big = r() < 0.12;
      const s = big ? 0.3 + r() * 0.35 : 0.06 + Math.pow(r(), 3) * 0.3;
      rockList.push({ x, z, s, v: (r() * 3) | 0, c: r(), rot: [r() * 6, r() * 6, r() * 6], sy: 0.5 + r() * 0.4, sz: 0.8 + r() * 0.4 });
    }
    // primer plano (desenfocado) y fondo
    const fg = Q.mobile ? 4 : 7;
    for (let i = 0; i < fg; i++) rockList.push({ x: (r() - 0.5) * L.visHalfW * 1.9, z: L.target.z + (camBase.z - L.target.z) * (0.3 + r() * 0.12), s: 0.5 + r() * 0.6, v: (r() * 3) | 0, c: r(), rot: [r() * 6, r() * 6, r() * 6], sy: 0.55 + r() * 0.3, sz: 0.9 + r() * 0.3 });
    for (let i = 0; i < 10; i++) { const x = (r() - 0.5) * L.visHalfW * 2.6, z = zFar + r() * 4; if (inFreeZone(x, z)) rockList.push({ x, z, s: 0.45 + r() * 0.7, v: (r() * 3) | 0, c: r(), rot: [r() * 6, r() * 6, r() * 6], sy: 0.5 + r() * 0.3, sz: 0.9 + r() * 0.3 }); }
    const per = [0, 0, 0]; rockList.forEach((k) => per[k.v]++);
    for (let v = 0; v < 3; v++) {
      const m = new THREE.InstancedMesh(rockGeos[v], rockMat, Math.max(1, per[v]));
      m.castShadow = true; m.receiveShadow = true; m.userData.items = []; rocks.push(m); scene.add(m);
    }
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const idx = [0, 0, 0];
    rockList.forEach((k) => {
      const m = rocks[k.v]; const y = groundH(k.x, k.z) - k.s * k.sy * 0.35;
      M.compose(p.set(k.x, y, k.z), q.setFromEuler(e.set(k.rot[0] * 0.3, k.rot[1], k.rot[2] * 0.3)), sc.set(k.s, k.s * k.sy, k.s * k.sz));
      m.setMatrixAt(idx[k.v]++, M); m.userData.items.push(k);
    });
  })();
  const grains = (function () {
    const n = Q.mobile ? 700 : 2200; const r = KB.rng(91);
    const m = new THREE.InstancedMesh(grainGeo, rockMat, n); m.receiveShadow = true; m.userData.items = [];
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const zNear = L.target.z + (camBase.z - L.target.z) * 0.42, zFar = L.target.z - 18;
    for (let i = 0; i < n; i++) {
      let x, z; let tries = 0;
      do { x = (r() - 0.5) * L.visHalfW * 3.2; z = zFar + r() * (zNear - zFar); tries++; }
      while (tries < 6 && Math.abs(x) < L.wordW * 0.55 && z > L.letterZ - L.H * 0.55 && z < L.letterZ + L.H * 0.55);
      const s = 0.016 + Math.pow(r(), 2) * 0.05;
      M.compose(p.set(x, groundH(x, z) + s * 0.2, z), q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)), sc.set(s, s * (0.6 + r() * 0.4), s));
      m.setMatrixAt(i, M); m.userData.items.push({ c: r() });
    }
    scene.add(m); return m;
  })();
  function colorRocks() {
    const pal = [KB.lin(COL["stone-a"]), KB.lin(COL["stone-b"]), KB.lin(COL["stone-c"]), KB.lin(COL["soil-b"])];
    const c = new THREE.Color();
    const tint = (m) => { m.userData.items.forEach((k, i) => { const a = pal[Math.floor(k.c * 4) % 4], b = pal[Math.floor(k.c * 13) % 4]; c.copy(a).lerp(b, (k.c * 7) % 1); m.setColorAt(i, c); }); if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    rocks.forEach(tint); tint(grains);
  }

  const leafMats = [];
  function makeLeafMat(colName, veinName) {
    const m = new THREE.MeshStandardMaterial({ map: KB.leafTex(COL[colName], COL[veinName]), side: THREE.DoubleSide, roughness: 0.72, metalness: 0 });
    m.userData = { colName, veinName }; leafMats.push(m); return m;
  }
  const dryMat = makeLeafMat("leaf-dry", "accent-deep");
  const leafMat = makeLeafMat("leaf", "leaf-vein");
  (function scatterDebris() {
    const r = KB.rng(5);
    const spots = [[-0.78, -0.55, 1.0], [0.9, 0.25, 0.8], [-0.35, 0.42, 0.65]];
    spots.forEach(([fx, fz, s], i) => {
      const x = fx * L.visHalfW * 1.05, z = L.target.z + fz * 9 * L.ls;
      if (!inFreeZone(x, z)) return;
      const g = KB.leafGeo(1.9 * s, 0.95 * s, -1, 1);
      const m = new THREE.Mesh(g, dryMat);
      m.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.12, 0, r() * 6); m.position.set(x, groundH(x, z) + 0.05, z);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
    });
    const twigMat = new THREE.MeshStandardMaterial({ color: KB.lin(COL["leaf-dry"]).multiplyScalar(0.6), roughness: 0.9 });
    twigMat.userData.twig = true;
    [[-0.95, -0.15, 0.4], [0.82, 0.75, -0.5]].forEach(([fx, fz, ang]) => {
      const x = fx * L.visHalfW, z = L.target.z + fz * 8 * L.ls;
      const pts = []; for (let i = 0; i < 4; i++) { const u = i / 3 - 0.5; pts.push(new THREE.Vector3(x + Math.cos(ang) * u * 3.2, 0, z + Math.sin(ang) * u * 3.2 + Math.sin(i * 1.7) * 0.15)); }
      pts.forEach((p) => { p.y = groundH(p.x, p.z) + 0.07; });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 6, false), twigMat);
      tube.castShadow = true; tube.receiveShadow = true; scene.add(tube); leafMats.push(twigMat);
    });
  })();

  // ---------- Letras extruidas ----------
  function letterShape(ch) {
    const s = new THREE.Shape(); let w;
    const poly = (pts) => { s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); };
    if (ch === "E") { w = 0.62; poly([[0, 0], [0.62, 0], [0.62, 0.2], [0.22, 0.2], [0.22, 0.41], [0.55, 0.41], [0.55, 0.59], [0.22, 0.59], [0.22, 0.8], [0.62, 0.8], [0.62, 1], [0, 1]]); }
    else if (ch === "L") { w = 0.6; poly([[0, 0], [0.6, 0], [0.6, 0.2], [0.22, 0.2], [0.22, 1], [0, 1]]); }
    else if (ch === "K") { w = 0.76; poly([[0, 0], [0.22, 0], [0.22, 0.33], [0.31, 0.43], [0.51, 0], [0.76, 0], [0.46, 0.6], [0.73, 1], [0.47, 1], [0.22, 0.63], [0.22, 1], [0, 1]]); }
    else {
      w = 0.645;
      s.moveTo(0, 0); s.lineTo(0.38, 0); s.absarc(0.38, 0.265, 0.265, -Math.PI / 2, Math.PI / 2, false);
      s.lineTo(0.35, 0.53); s.absarc(0.35, 0.765, 0.235, -Math.PI / 2, Math.PI / 2, false); s.lineTo(0, 1); s.closePath();
      const h1 = new THREE.Path(); h1.moveTo(0.22, 0.2); h1.lineTo(0.38, 0.2); h1.absarc(0.38, 0.295, 0.095, -Math.PI / 2, Math.PI / 2, false); h1.lineTo(0.22, 0.39); h1.closePath();
      const h2 = new THREE.Path(); h2.moveTo(0.22, 0.635); h2.lineTo(0.35, 0.635); h2.absarc(0.35, 0.7175, 0.0825, -Math.PI / 2, Math.PI / 2, false); h2.lineTo(0.22, 0.8); h2.closePath();
      s.holes.push(h1, h2);
    }
    return { s, w };
  }
  const LG = {};
  function letterGeo(ch) {
    if (LG[ch]) return LG[ch];
    const { s, w } = letterShape(ch); const d = CONFIG.letterDepth;
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.016, bevelSegments: 3, curveSegments: 18 });
    g.translate(-w / 2, -0.5, -d / 2); g.rotateX(-Math.PI / 2);
    LG[ch] = { g, w }; return LG[ch];
  }
  const letterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0, bumpMap: grainBump, bumpScale: 0.01 });
  const halfThick = () => L.H * (CONFIG.letterDepth / 2 + 0.022);
  const blobTex = KB.radialTex(true);

  // ---------- Hormigas ----------
  const span0 = L.halfW * 2 + 2 * L.m;
  const lineCount = Math.ceil(span0 / L.sp);
  const ants = new KB.Ants(scene, Math.ceil(lineCount * 1.7) + 20, Q);
  const sim = [];   // todas las hormigas simuladas
  const groups = [];
  const leafBitGeo = KB.leafGeo(0.62, 0.46, -1, 1);
  let S = 0;

  function build() {
    const N = Math.ceil((L.halfW * 2 + 2 * L.m) / L.sp);
    S = N * L.sp;
    const gap = Math.max(3, Math.ceil((L.H * 0.95) / L.sp));
    const groupIdx = WORD.map((_, k) => 3 + (WORD.length - 1 - k) * gap);
    const shift = Math.max(0, (L.halfW + L.m) - (L.visHalfW + 2));
    const blocked = new Set();
    groupIdx.forEach((gi) => { for (let d = -6; d <= 6; d++) if (Math.abs(d) * L.sp < L.H * 0.42) blocked.add(gi + d); });
    const r = KB.rng(42);
    let count = 0;
    for (let i = 0; i < N; i++) {
      if (blocked.has(i)) continue;
      count++;
      const idx = ants.add({ scale: L.antS * (0.9 + r() * 0.2) });
      let leaf = null;
      if (count % CONFIG.leafEvery === 3) {
        leaf = new THREE.Mesh(leafBitGeo, leafMat); leaf.castShadow = true;
        leaf.userData.rot = (r() - 0.5) * 0.5; leaf.userData.s = 0.8 + r() * 0.5; scene.add(leaf);
      }
      sim.push({ kind: "line", idx, lineIdx: i, pos: shift - i * L.sp, lap: 0, leaf, lat: (r() - 0.5) * 0.36 * L.ls, ox: 0, oz: 0, vx: 0, vz: 0, dist: r() * 3, hidden: false });
    }
    WORD.forEach((ch, k) => {
      const lg = letterGeo(ch);
      const mesh = new THREE.Mesh(lg.g, letterMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.rotation.order = "YXZ";
      const bm = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), bm); blob.renderOrder = 1;
      scene.add(mesh, blob);
      const g = {
        k, ch, mesh, blob, w: lg.w, pos: shift - groupIdx[k] * L.sp, lap: 0, v: 0, acc: 0,
        dropped: false, landed: false, skip: false, pauseUntil: 0, dropT0: 0, dustDone: false,
        jx: (r() - 0.5) * 2, jz: (r() - 0.5) * 2, jr: (r() - 0.5) * 2, t1: (r() - 0.5) * 2, t2: (r() - 0.5) * 2,
        hy: 0, hyV: 0, roll: 0, rollV: 0, pitch: 0, pitchV: 0, yaw: 0, members: [], dropPose: null, init: false
      };
      [[0.3, 0], [-0.27, 0.27], [-0.27, -0.27]].forEach(([dxK, latK]) => {
        const idx = ants.add({ scale: L.antS * (0.98 + r() * 0.12) });
        const m = { kind: "member", idx, g, dxK, latK, latBlend: 1, latRest: (r() - 0.5) * 0.36 * L.ls, ox: 0, oz: 0, vx: 0, vz: 0, dist: r() * 3, hidden: false };
        g.members.push(m); sim.push(m);
      });
      groups.push(g);
    });
  }

  function trailZ(x) { const s = L.ls; return L.trailZ0 + s * (0.55 * Math.sin(0.33 * x / s + 0.4) + 0.28 * Math.sin(0.71 * x / s + 1.9) + 0.1 * Math.sin(1.5 * x / s + 0.3)); }
  function anchorX(g) { return -L.halfW - L.m + g.pos; }
  function slotTarget(g) { return { x: L.slots[g.k] + g.jx * CONFIG.jitterX * L.slotSp, z: L.letterZ + g.jz * CONFIG.jitterZ * L.H, yaw: g.jr * CONFIG.jitterYaw }; }
  function bump(g, x) {
    if (!g || g.lap !== 0 || g.skip) return 0;
    const sx = L.slots[g.k]; const A = slotTarget(g).z - trailZ(sx); const w = 3.1 * L.ls;
    return A * Math.exp(-Math.pow((x - sx) / w, 2));
  }
  function pathZ(a, x) {
    if (a.kind === "member") {
      const g = a.g, latW = a.latK * L.H;
      const lat = g.dropped ? a.latBlend * latW + (1 - a.latBlend) * a.latRest : latW;
      return trailZ(x) + bump(g, x - a.dxK * L.H) + lat;
    }
    return trailZ(x) + a.lat;
  }

  // ---------- Simulación ----------
  let simT = 0, calm = false, speedMul = 1.7, revealQueued = false, shake = 0;
  const mouse = { x: 1e9, z: 1e9, nx: 0, ny: 0, active: false };
  const dust = new KB.Dust(scene, Q.mobile ? 40 : 80, KB.lin(COL.dust));
  const _P = new THREE.Vector3(), _F = new THREE.Vector3(), _U = new THREE.Vector3(), _S = new THREE.Vector3(), _M4 = new THREE.Matrix4();
  const ZERO = new THREE.Vector3(0, -50, 0);

  function hideAnt(a) {
    a.hidden = true; ants.hide(a.idx);
    if (a.leaf) a.leaf.visible = false;
  }
  function startCalm() {
    if (calm) return;
    calm = true;
    sim.forEach((a) => {
      a.retire = a.kind === "line" ? !CONFIG.calmKeep.includes(a.lineIdx % 5) : a !== a.g.members[0];
      if (a.retire && (reduce || Math.abs(a.px || 0) > L.visHalfW * 1.25)) hideAnt(a);
    });
  }
  function startDrop(g, t) {
    g.dropped = true; g.pauseUntil = t + 0.5; g.dropT0 = t + 0.32; g.dustDone = false;
    g.members.forEach((m) => { m.latBlend = 1; });
  }

  function step(dt) {
    simT += dt; const t = simT;
    if (calm) speedMul += (CONFIG.calmSpeed - speedMul) * Math.min(1, dt * 0.7);

    for (const g of groups) {
      let f = 1;
      if (g.lap === 0 && !g.skip && !g.dropped) { const d = Math.abs(anchorX(g) - L.slots[g.k]); f = 0.25 + 0.75 * KB.smooth(d / (1.8 * L.ls)); }
      if (t < g.pauseUntil) f = 0;
      const v = L.speed * speedMul * f;
      g.acc = dt > 0 ? (v - g.v) / dt : 0; g.v = v;
      g.pos += v * dt;
      if (!g.dropped && g.lap === 0 && anchorX(g) >= L.slots[g.k]) startDrop(g, t);
      if (g.pos > S) { g.pos -= S; g.lap++; if (calm) g.members.forEach((m) => { if (m.retire) hideAnt(m); }); }
      if (g.dropped && t > g.pauseUntil) g.members.forEach((m) => { m.latBlend = Math.max(0, m.latBlend - dt * 0.75); });
    }

    const R = CONFIG.pushRadius * L.antS;
    for (const a of sim) {
      if (a.hidden) continue;
      let x, spd;
      if (a.kind === "line") {
        spd = L.speed * speedMul; a.pos += spd * dt;
        if (a.pos > S) { a.pos -= S; a.lap++; if (a.retire) { hideAnt(a); continue; } }
        x = -L.halfW - L.m + a.pos;
      } else { spd = a.g.v; x = anchorX(a.g) + a.dxK * L.H; }
      a.dist += spd * dt;
      const z = pathZ(a, x);
      const dz = (pathZ(a, x + 0.06) - pathZ(a, x - 0.06)) / 0.12;
      let heading = Math.atan2(dz, 1);
      if (dt > 0) {
        const px = x + a.ox - mouse.x, pz = z + a.oz - mouse.z; const d = Math.hypot(px, pz);
        if (d < R && d > 1e-4) { const f = (1 - d / R) * CONFIG.pushForce; a.vx += (px / d) * f * dt; a.vz += (pz / d) * f * dt; }
        a.vx += (-CONFIG.springK * a.ox - CONFIG.springDamp * a.vx) * dt;
        a.vz += (-CONFIG.springK * a.oz - CONFIG.springDamp * a.vz) * dt;
        a.ox += a.vx * dt; a.oz += a.vz * dt;
        const sv = Math.hypot(a.vx, a.vz);
        if (sv > 0.05) {
          const cross = Math.cos(heading) * a.vz - Math.sin(heading) * a.vx;
          heading += KB.clamp(cross * 0.3, -0.75, 0.75);
          a.dist += sv * dt * 0.9;
        }
      }
      const px = x + a.ox, pz = z + a.oz;
      _P.set(px, groundH(px, pz), pz);
      groundNormal(px, pz, _U);
      _F.set(Math.cos(heading), 0, Math.sin(heading));
      ants.pose(a.idx, _P, _F, _U, a.dist, t, { ground: groundH });
      a.px = px; a.py = _P.y; a.pz = pz;
      if (a.leaf) {
        const sc = ants.list[a.idx].scale;
        _F.addScaledVector(_U, -_F.dot(_U)).normalize(); _S.crossVectors(_F, _U);
        _M4.makeBasis(_F, _U, _S);
        a.leaf.quaternion.setFromRotationMatrix(_M4);
        a.leaf.rotateY(a.leaf.userData.rot + Math.sin(t * 3 + a.idx) * 0.06);
        a.leaf.position.copy(_P).addScaledVector(_U, (0.5 + 0.2 * a.leaf.userData.s) * sc).addScaledVector(_F, 0.02 * sc);
        a.leaf.scale.setScalar(sc * a.leaf.userData.s);
      }
    }

    // Letras
    const tH = halfThick();
    let landedCount = 0;
    for (const g of groups) {
      const m = g.mesh;
      const carried = !g.dropped || t < g.dropT0;
      if (carried) {
        const [c0, c1, c2] = g.members;
        const cx = (c0.px + (c1.px + c2.px) / 2) / 2;
        const cz = (c0.pz + c1.pz + c2.pz) / 3;
        const top = Math.max(c0.py, c1.py, c2.py) + 0.5 * L.antS + tH;
        let rollT = Math.atan2(c0.py - (c1.py + c2.py) / 2, Math.max(0.1, c0.px - (c1.px + c2.px) / 2));
        let pitchT = -Math.atan2(c1.py - c2.py, Math.max(0.1, c1.pz - c2.pz));
        rollT += KB.clamp(g.acc * 0.018, -0.25, 0.25) + 0.035 * Math.sin(t * 5.1 + g.k);
        pitchT += 0.028 * Math.sin(t * 4.3 + g.k * 2.1);
        const hyT = top + 0.025 * Math.sin(t * 9 + g.k);
        if (!g.init) { g.hy = hyT; g.roll = rollT; g.pitch = pitchT; g.init = true; g.hyV = 2.2; }
        if (dt > 0) {
          g.rollV += ((rollT - g.roll) * 55 - g.rollV * 8) * dt; g.roll += g.rollV * dt;
          g.pitchV += ((pitchT - g.pitch) * 55 - g.pitchV * 8) * dt; g.pitch += g.pitchV * dt;
          g.hyV += ((hyT - g.hy) * 90 - g.hyV * 11) * dt; g.hy += g.hyV * dt;
        }
        g.yaw = 0.05 * Math.sin(t * 0.9 + g.k * 1.7);
        m.position.set(cx, g.hy, cz); m.rotation.set(g.pitch, g.yaw, g.roll);
        g.dropPose = { x: cx, y: g.hy, z: cz, roll: g.roll, pitch: g.pitch, yaw: g.yaw };
        g.blob.position.set(cx, groundH(cx, cz) + 0.03, cz);
        g.blob.material.opacity = 0.12;
      } else {
        const tg = slotTarget(g);
        const rest = { x: tg.x, z: tg.z, y: groundH(tg.x, tg.z) + tH, roll: g.t1 * 0.035, pitch: g.t2 * 0.03, yaw: tg.yaw };
        const dp = g.dropPose || rest;
        const tau = g.skip ? 99 : t - g.dropT0;
        let x, y, z, roll, pitch, yaw;
        if (tau < 0.5) {
          const p = tau / 0.5, e = KB.easeIn(p), eo = KB.easeOut(p);
          x = KB.lerp(dp.x, rest.x, eo); z = KB.lerp(dp.z, rest.z, eo);
          y = KB.lerp(dp.y, rest.y, e) + Math.sin(Math.PI * p) * 0.25 * L.ls;
          roll = KB.lerp(dp.roll, rest.roll - 0.16, e); pitch = KB.lerp(dp.pitch, rest.pitch + 0.05, e); yaw = KB.lerp(dp.yaw, rest.yaw, eo);
        } else {
          const u = tau - 0.5;
          if (!g.dustDone && !g.skip) {
            g.dustDone = true; shake = Math.max(shake, 0.05);
            dust.add({ t0: t, x: rest.x, y: rest.y - tH, z: rest.z, n: Q.mobile ? 8 : 16, spread: 1.3 * L.ls, size: 0.55 * L.ls, rx: g.w * L.H * 0.5, rz: L.H * 0.45, life: 1.5, seed: g.k + 3 + Math.floor(t), op: 0.55, temp: true });
          }
          const k = Math.exp(-5.5 * u);
          x = rest.x; z = rest.z; yaw = rest.yaw;
          y = rest.y + 0.16 * L.ls * Math.exp(-6 * u) * Math.abs(Math.sin(u * 13));
          roll = rest.roll - 0.16 * k * Math.cos(u * 15);
          pitch = rest.pitch + 0.05 * k * Math.cos(u * 12);
          if (u > 0.9) { landedCount++; g.landed = true; }
        }
        m.position.set(x, y, z); m.rotation.set(pitch, yaw, roll);
        g.blob.position.set(x, groundH(x, z) + 0.03, z);
        g.blob.material.opacity = 0.14 + 0.24 * (1 - KB.clamp((y - rest.y) / 1.2, 0, 1));
      }
      g.blob.rotation.y = g.yaw; g.blob.scale.set(g.w * L.H * 1.35, 1, L.H * 1.25);
      m.scale.setScalar(L.H);
    }
    if (landedCount === groups.length && !revealQueued) {
      revealQueued = true; clearTimeout(safety);
      setTimeout(() => { reveal(); startCalm(); }, 200);
    }
    dust.update(t);
    shake = Math.max(0, shake - dt * 0.12);
  }

  function skipIntro() {
    groups.forEach((g) => { if (!g.dropped || !g.landed) { g.skip = true; g.dropped = true; g.members.forEach((m) => { m.latBlend = 0; }); } });
  }

  // ---------- Cámara ----------
  const look = new THREE.Vector3(), camPos = new THREE.Vector3();
  let smx = 0, smy = 0, focus = 26, flight = null, clock = 0;
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2), hit = new THREE.Vector3();
  function moundTop() { return new THREE.Vector3(MOUND.x, holeY, MOUND.y); }
  function flightPose(p, dir, out, outLook) {
    const M = moundTop();
    const W1 = M.clone().add(new THREE.Vector3(-1.2 * L.ls, 6.5 * L.ls, 6.5 * L.ls));
    const W2 = M.clone().add(new THREE.Vector3(0, 0.9, 0.45));
    const e = KB.easeInOut(p);
    const A = camBase, B = W1, C = W2;
    out.set(0, 0, 0).addScaledVector(A, (1 - e) * (1 - e)).addScaledVector(B, 2 * e * (1 - e)).addScaledVector(C, e * e);
    if (dir > 0) outLook.copy(L.target).lerp(M, KB.easeOut(Math.min(1, p * 1.5)));
    else outLook.copy(L.target).lerp(M, 0.25 * KB.smooth(p));
  }
  function updateCamera(dt) {
    if (!reduce && !flight) {
      smx += (mouse.nx - smx) * Math.min(1, dt * 2.2);
      smy += (mouse.ny - smy) * Math.min(1, dt * 2.2);
    }
    if (flight) {
      flight.p = KB.clamp((clock - flight.t0) / flight.dur, 0, 1);
      const p = flight.dir > 0 ? flight.p : 1 - flight.p;
      flightPose(p, flight.dir, camPos, look);
      camPos.x += smx * CONFIG.parallax * L.ls * (1 - p); camPos.y += smy * 0.5 * L.ls * (1 - p);
      focus = camPos.distanceTo(look);
      if (flight.dir > 0 && flight.p > 0.7 && !flight.faded) { flight.faded = true; fadeEl.classList.add("on"); }
      if (flight.dir > 0 && flight.p >= 1 && !flight.gone) { flight.gone = true; setTimeout(() => { location.href = flight.url; }, 380); }
      if (flight.dir < 0 && flight.p >= 1) { flight = null; }
    } else {
      camPos.copy(camBase);
      camPos.x += smx * CONFIG.parallax * L.ls + Math.sin(clock * 0.13) * 0.12;
      camPos.y += smy * 0.5 * L.ls + Math.sin(clock * 0.17) * 0.06;
      look.copy(L.target);
      focus = camPos.distanceTo(L.target);
    }
    if (shake > 0) { camPos.x += (Math.random() - 0.5) * shake; camPos.y += (Math.random() - 0.5) * shake; }
    camera.position.copy(camPos); camera.lookAt(look);
  }

  function placeCopy() {
    camera.position.copy(camBase); camera.lookAt(L.target); camera.updateMatrixWorld();
    let maxY = 0; const v = new THREE.Vector3();
    for (let x = -L.wordW * 0.6; x <= L.wordW * 0.6; x += 0.4) {
      const z = trailZ(x) + 0.6 * L.antS;
      v.set(x, groundH(x, z) + 0.2, z).project(camera);
      maxY = Math.max(maxY, (1 - (v.y * 0.5 + 0.5)) * L.h);
    }
    L.copyTop = Math.round(Math.min(maxY + 20, L.h - 170));
    if (active) hero.style.setProperty("--copy-top", L.copyTop + "px");
  }

  function render() {
    ants.commit();
    post.render(scene, camera, { focus, range: CONFIG.dofRange, maxR: Q.mobile ? 5 : CONFIG.dofMax, time: clock, vig: 0.12, grain: 0.014 });
  }

  // ---------- Bucle ----------
  let running = false, rafId = 0, last = 0, visible = true;
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; clock += dt;
    try { step(dt); updateCamera(dt); render(); }
    catch (err) { stop(); console.error("[Kebel 3D] La animación se ha detenido:", err); if (host.crash) host.crash("3d", err); }
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function sync() { (active && visible && !document.hidden) ? start() : stop(); }
  function renderStill() {
    try { step(0); updateCamera(0); render(); }
    catch (err) { console.error("[Kebel 3D] No se pudo dibujar la escena:", err); if (host.crash) host.crash("3d", err); }
  }

  // ---------- Entrada del usuario ----------
  function onPointer(e) {
    const r = hero.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouse.nx = ndc.x; mouse.ny = ndc.y;
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) { mouse.x = hit.x; mouse.z = hit.z; }
  }
  hero.addEventListener("pointermove", onPointer);
  hero.addEventListener("pointerdown", onPointer);
  const clearMouse = () => { mouse.x = mouse.z = 1e9; };
  hero.addEventListener("pointerleave", () => { clearMouse(); mouse.nx = mouse.ny = 0; });
  hero.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") clearMouse(); });


  let resizeT = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const oldS = S; computeLayout();
      const newS = Math.ceil((L.halfW * 2 + 2 * L.m) / L.sp) * L.sp; const k = oldS ? newS / oldS : 1; S = newS;
      sim.forEach((a) => { if (a.kind === "line") a.pos *= k; }); groups.forEach((g) => { g.pos *= k; });
      placeCopy(); if (!running && active) renderStill();
    }, 140);
  });

  function applyTheme() {
    readColors(); applyLights(); colorGround(); colorRocks();
    letterMat.color.copy(KB.lin(COL.accent)).multiplyScalar(0.7);
    holeMat.color.copy(KB.lin(COL["soil-hole"])); holeCore.material.color.copy(KB.lin(COL["soil-hole"]));
    ants.setColors(COL["ant-body"]);
    leafMats.forEach((m) => {
      if (m.userData.twig) { m.color.copy(KB.lin(COL["leaf-dry"]).multiplyScalar(0.6)); return; }
      if (m.map) m.map.dispose(); m.map = KB.leafTex(COL[m.userData.colName], COL[m.userData.veinName]); m.needsUpdate = true;
    });
    dust.setColor(KB.lin(COL.dust));
    if (!running && active) renderStill();
  }
  KB.onTheme(applyTheme);

  // ---------- Inicio ----------
  build();
  applyTheme();
  placeCopy();

  if (reduce || fromCine) {
    skipIntro();
    // reparte la fila por toda la pantalla, como si llevara rato caminando
    sim.forEach((a) => { if (a.kind === "line") { a.pos = ((a.pos % S) + S) % S; a.lap = 1; } });
    groups.forEach((g) => { g.pos = ((g.pos % S) + S) % S; g.lap = 1; });
    for (let i = 0; i < 8; i++) step(0.25);
    reveal(); startCalm(); speedMul = CONFIG.calmSpeed; step(0);
  }
  if (fromCine && !reduce) flight = { t0: 0, dur: 2.4, dir: -1 };

  let wired = false;
  function wire() {
    if (wired || reduce) return; wired = true;
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; sync(); }).observe(hero);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", (e) => { if (e.persisted) { flight = null; fadeEl.classList.remove("on"); } });
  }

  return {
    activate() {
      active = true; canvas.hidden = false;
      if (L.copyTop) hero.style.setProperty("--copy-top", L.copyTop + "px");
      wire(); renderStill(); sync();
    },
    deactivate() { active = false; stop(); canvas.hidden = true; },
    skip: skipIntro,
    isRevealed: () => revealed,
    fly(url) { if (reduce) { location.href = url; return; } flight = { t0: clock, dur: 2.1, dir: 1, url }; start(); },
    pause: stop,
    advance(sec) { const n = Math.ceil(sec * 30); for (let i = 0; i < n; i++) { clock += 1 / 30; step(1 / 30); } updateCamera(1 / 30); render(); }
  };
};
