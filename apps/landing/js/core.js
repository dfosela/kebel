/* ============================================================
   KB — núcleo compartido: utilidades, texturas, postproceso
   (profundidad de campo + tono) y hormigas 3D articuladas.
   Este archivo se construye en varios commits por bloques; cada
   bloque añade propiedades a KB sin tocar lo ya construido.
   ============================================================ */
const KB = (function () {
  "use strict";
  const KB = {};

  // ---------- Matemáticas ----------
  KB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  KB.lerp = (a, b, t) => a + (b - a) * t;
  KB.smooth = (t) => { t = KB.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  KB.easeInOut = (t) => { t = KB.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  KB.easeOut = (t) => 1 - Math.pow(1 - KB.clamp(t, 0, 1), 3);
  KB.easeIn = (t) => { t = KB.clamp(t, 0, 1); return t * t * t; };
  KB.easeOutBack = (t) => { t = KB.clamp(t, 0, 1); const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  KB.range = (t, a, b) => KB.clamp((t - a) / (b - a), 0, 1);
  KB.rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

  // Ruido de Perlin 2D
  const perm = new Uint8Array(512);
  (function () {
    const r = KB.rng(1337); const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  KB.noise = (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y); const X = fx & 255, Y = fy & 255; x -= fx; y -= fy;
    const u = fade(x), v = fade(y); const a = perm[X] + Y, b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return (l1 + v * (l2 - l1)) * 0.7;
  };
  KB.fbm = (x, y, o) => { o = o || 4; let a = 0.5, f = 1, s = 0; for (let i = 0; i < o; i++) { s += a * KB.noise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };

  // ---------- Tema y calidad ----------
  KB.css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb || "#000000");
  KB.lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  KB.isDark = () => { const t = document.documentElement.getAttribute("data-theme"); if (t) return t === "dark"; return matchMedia("(prefers-color-scheme: dark)").matches; };
  KB.onTheme = (fn) => {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", fn);
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  };
  KB.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  KB.quality = () => {
    const mobile = matchMedia("(max-width: 760px)").matches || matchMedia("(pointer: coarse)").matches;
    const dpr = window.devicePixelRatio || 1;
    return { mobile, dpr: Math.min(dpr, mobile ? 1.5 : 2), shadow: mobile ? 1024 : 2048, taps: mobile ? 3 : 5, ss: (!mobile && dpr < 1.5) ? 1.4 : 1 };
  };

  // ---------- Texturas generadas ----------
  KB.radialTex = (hard) => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(hard ? 0.55 : 0.25, "rgba(255,255,255," + (hard ? 0.9 : 0.6) + ")"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  };
  KB.grainTex = (seed, lo, hi, size) => {
    size = size || 256; const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
    const img = g.createImageData(size, size); const r = KB.rng(seed);
    for (let i = 0; i < size * size; i++) {
      const x = i % size, y = (i / size) | 0;
      const n = 0.55 * r() + 0.45 * (0.5 + 0.5 * KB.noise(x * 0.09 + seed, y * 0.09));
      const v = Math.round(lo + (hi - lo) * n); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };

  // Roca irregular (mismo desplazamiento para vértices repetidos)
  KB.rockGeo = (seed, detail) => {
    const g = new THREE.IcosahedronGeometry(1, detail === undefined ? 1 : detail);
    const p = g.attributes.position; const r = KB.rng(seed); const o1 = r() * 50, o2 = r() * 50;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.3 * KB.noise(x * 1.6 + o1, y * 1.6 + z * 1.2 + o2) + 0.12 * KB.noise(x * 4 + o2, z * 4 - y * 2 + o1);
      p.setXYZ(i, x * k, y * k * 0.8, z * k);
    }
    g.computeVertexNormals(); return g;
  };

  // ---------- Postproceso: DOF por profundidad + tono + viñeta + grano ----------
  const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  function blurFS(horizontal, fromDepth) {
    return `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 texel; uniform float cNear, cFar, focus, range, maxR, fgMul;
uniform float exposure, vig, grain, time, aspect;
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * cNear * cFar / (cFar + cNear - z * (cFar - cNear)); }
float cocAt(vec2 uv){
  ${fromDepth ? "float d = lin(texture2D(tDepth, uv).x); float c = (d - focus) / (focus * range); c = c < 0.0 ? -c * fgMul : c; return clamp(c, 0.0, 1.0);" : "return texture2D(tColor, uv).a;"}
}
vec3 shoulder(vec3 c){ vec3 k = vec3(0.9); vec3 o = max(c - k, 0.0); return min(c, k) + 0.1 * (1.0 - exp(-o / 0.1)); }
vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float c0 = cocAt(vUv);
  vec3 acc = texture2D(tColor, vUv).rgb; float ws = 1.0;
  float rad = maxR * c0;
  vec2 dir = ${horizontal ? "vec2(texel.x, 0.0)" : "vec2(0.0, texel.y)"};
  for (int i = 1; i <= TAPS; i++) {
    float fi = float(i) / float(TAPS);
    float g = exp(-fi * fi * 2.2);
    vec2 o = dir * fi * rad;
    float ca = cocAt(vUv + o); float cb = cocAt(vUv - o);
    float wa = g * clamp(ca / max(c0, 0.03), 0.0, 1.0);
    float wb = g * clamp(cb / max(c0, 0.03), 0.0, 1.0);
    acc += texture2D(tColor, vUv + o).rgb * wa + texture2D(tColor, vUv - o).rgb * wb;
    ws += wa + wb;
  }
  vec3 col = acc / ws;
  ${horizontal ? "gl_FragColor = vec4(col, c0);" : `
  col = shoulder(col * exposure);
  col = toSRGB(col);
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  float v = smoothstep(1.05, 0.25, length(q));
  col *= mix(1.0 - vig, 1.0, v);
  col += (hash(gl_FragCoord.xy + fract(time) * 91.0) - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);`}
}`;
  }

  KB.Post = function (renderer, q) {
    this.r = renderer; this.q = q;
    this.ok = renderer.capabilities.isWebGL2;
    renderer.toneMapping = THREE.NoToneMapping;
    if (!this.ok) { renderer.outputEncoding = THREE.sRGBEncoding; return; }
    renderer.outputEncoding = THREE.LinearEncoding;
    const mk = (depth) => {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, stencilBuffer: false });
      if (depth) { rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.UnsignedIntType; }
      return rt;
    };
    this.rtA = mk(true); this.rtB = mk(false);
    const uni = () => ({
      tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
      cNear: { value: 1 }, cFar: { value: 100 }, focus: { value: 20 }, range: { value: 0.3 }, maxR: { value: 8 }, fgMul: { value: 1.3 },
      exposure: { value: 1 }, vig: { value: 0.14 }, grain: { value: 0.018 }, time: { value: 0 }, aspect: { value: 1 }
    });
    const defs = { TAPS: q.taps };
    this.mH = new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: VS, fragmentShader: blurFS(true, true), defines: defs, depthTest: false, depthWrite: false });
    this.mV = new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: VS, fragmentShader: blurFS(false, false), defines: defs, depthTest: false, depthWrite: false });
    const geo = new THREE.PlaneGeometry(2, 2);
    this.sH = new THREE.Scene(); this.sH.add(new THREE.Mesh(geo, this.mH));
    this.sV = new THREE.Scene(); this.sV.add(new THREE.Mesh(geo, this.mV));
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  };
  KB.Post.prototype.setSize = function (w, h) {
    const dpr = this.r.getPixelRatio();
    this.r.setSize(w, h, false);
    if (!this.ok) return;
    const W = Math.max(4, Math.round(w * dpr * this.q.ss)), H = Math.max(4, Math.round(h * dpr * this.q.ss));
    this.rtA.setSize(W, H); this.rtB.setSize(W, H);
    this.scale = dpr * this.q.ss;
    [this.mH, this.mV].forEach((m) => { m.uniforms.texel.value.set(1 / W, 1 / H); m.uniforms.aspect.value = w / h; });
  };
  KB.Post.prototype.render = function (scene, camera, p) {
    if (!this.ok) { this.r.setRenderTarget(null); this.r.render(scene, camera); return; }
    const r = this.r;
    r.setRenderTarget(this.rtA); r.render(scene, camera);
    const H = this.mH.uniforms, V = this.mV.uniforms;
    H.tColor.value = this.rtA.texture; H.tDepth.value = this.rtA.depthTexture;
    H.cNear.value = camera.near; H.cFar.value = camera.far;
    H.focus.value = p.focus; H.range.value = p.range; H.fgMul.value = p.fgMul || 1.3;
    const mr = (p.maxR || 8) * this.scale;
    H.maxR.value = mr; V.maxR.value = mr;
    r.setRenderTarget(this.rtB); r.render(this.sH, this.qc);
    V.tColor.value = this.rtB.texture;
    V.exposure.value = p.exposure || 1; V.vig.value = p.vig === undefined ? 0.14 : p.vig;
    V.grain.value = p.grain === undefined ? 0.016 : p.grain; V.time.value = p.time || 0;
    r.setRenderTarget(null); r.render(this.sV, this.qc);
  };

  // ---------- Polvo analítico (determinista en el tiempo) ----------
  KB.Dust = function (scene, pool, color) {
    this.tex = KB.radialTex(false); this.sprites = []; this.events = [];
    for (let i = 0; i < pool; i++) {
      const m = new THREE.SpriteMaterial({ map: this.tex, color: color, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 5; scene.add(s); this.sprites.push(s);
    }
  };
  KB.Dust.prototype.setColor = function (c) { this.sprites.forEach((s) => s.material.color.copy(c)); };
  KB.Dust.prototype.add = function (ev) { this.events.push(Object.assign({ n: 12, spread: 1, size: 0.5, life: 1.4, seed: 1, rx: 0.5, rz: 0.5, op: 0.5 }, ev)); };
  KB.Dust.prototype.update = function (time) {
    let k = 0; const sp = this.sprites;
    for (let e = this.events.length - 1; e >= 0; e--) {
      const ev = this.events[e]; const tau = time - ev.t0;
      if (tau > ev.life + 0.1 && ev.temp) { this.events.splice(e, 1); continue; }
      if (tau < 0 || tau > ev.life) continue;
      const r = KB.rng(ev.seed * 977 + 13);
      for (let j = 0; j < ev.n && k < sp.length; j++) {
        const a = r() * Math.PI * 2, v = (0.5 + r()) * ev.spread, up = 0.3 + 0.6 * r();
        const ox = Math.cos(a) * ev.rx * r(), oz = Math.sin(a) * ev.rz * r();
        const hor = v * (1 - Math.exp(-2.6 * tau)) / 2.6;
        const vert = up * (1 - Math.exp(-2.0 * tau)) / 2.0 * ev.spread - 0.12 * tau * tau;
        const s = sp[k++];
        s.visible = true;
        s.position.set(ev.x + ox + Math.cos(a) * hor, ev.y + Math.max(0, vert) + 0.05, ev.z + oz + Math.sin(a) * hor);
        const sz = ev.size * (0.35 + 1.15 * (1 - Math.exp(-1.8 * tau))) * (0.6 + 0.8 * r());
        s.scale.set(sz, sz, 1);
        s.material.opacity = ev.op * Math.pow(1 - tau / ev.life, 1.5) * Math.min(1, tau * 14);
      }
    }
    for (; k < sp.length; k++) sp[k].visible = false;
  };

  // ---------- Hormigas 3D ----------
  const SPH = 5, CYL = 30, STR = 0.11;
  const LEGS = [
    { hx: 0.12, hy: 0.24, hz: 0.055, rx: 0.42, rz: 0.30, a: 0.22, b: 0.25, g: 0 },
    { hx: 0.035, hy: 0.235, hz: 0.065, rx: 0.05, rz: 0.40, a: 0.24, b: 0.28, g: 1 },
    { hx: -0.04, hy: 0.235, hz: 0.065, rx: -0.36, rz: 0.36, a: 0.28, b: 0.33, g: 0 }
  ];
  const Y = new THREE.Vector3(0, 1, 0), NO = {};
  const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _sd = new THREE.Vector3(), _v = new THREE.Vector3(), _mid = new THREE.Vector3();
  const _H = new THREE.Vector3(), _Cx = new THREE.Vector3(), _Ft = new THREE.Vector3(), _An = new THREE.Vector3(), _K = new THREE.Vector3(), _T2 = new THREE.Vector3();
  const _pole = new THREE.Vector3(), _d = new THREE.Vector3(), _pp = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const _B = new THREE.Matrix4(), _L = new THREE.Matrix4(), _M = new THREE.Matrix4(), _Z = new THREE.Matrix4().makeScale(0, 0, 0);
  const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _sc = new THREE.Vector3();

  function ik(C, A, a, b, pole, out) {
    _d.subVectors(A, C); let d = _d.length() || 1e-4; _d.multiplyScalar(1 / d);
    d = KB.clamp(d, Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const x = (a * a - b * b + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, a * a - x * x));
    _pp.copy(pole).addScaledVector(_d, -pole.dot(_d)); if (_pp.lengthSq() < 1e-8) _pp.copy(Y); _pp.normalize();
    out.copy(C).addScaledVector(_d, x).addScaledVector(_pp, h);
    A.copy(C).addScaledVector(_d, d); // si la pata no llega, el tobillo se acerca
  }

  KB.Ants = function (scene, max, q) {
    const low = q && q.mobile;
    const sph = new THREE.SphereGeometry(1, low ? 12 : 18, low ? 9 : 13);
    const cyl = new THREE.CylinderGeometry(0.78, 1, 1, 6, 1, false);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.06 });
    this.sph = new THREE.InstancedMesh(sph, this.mat, max * SPH);
    this.cyl = new THREE.InstancedMesh(cyl, this.mat, max * CYL);
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    this.blobMat = new THREE.MeshBasicMaterial({ map: KB.radialTex(true), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.blob = new THREE.InstancedMesh(bg, this.blobMat, max);
    [this.sph, this.cyl, this.blob].forEach((m) => { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); });
    this.sph.castShadow = this.cyl.castShadow = true;
    this.blob.renderOrder = 1;
    for (let i = 0; i < max * SPH; i++) this.sph.setMatrixAt(i, _Z);
    for (let i = 0; i < max * CYL; i++) this.cyl.setMatrixAt(i, _Z);
    for (let i = 0; i < max; i++) this.blob.setMatrixAt(i, _Z);
    this.max = max; this.list = [];
  };
  KB.Ants.prototype.add = function (o) {
    o = o || {}; const r = KB.rng((o.seed || this.list.length + 1) * 7919);
    const a = {
      scale: o.scale || (0.92 + r() * 0.16), head: o.head || (0.95 + r() * 0.1), gaster: o.gaster || (0.92 + r() * 0.16),
      legLen: o.legLen || (0.97 + r() * 0.06), spread: 0.96 + r() * 0.08, mand: o.mand || 1, ant: 0.92 + r() * 0.16,
      ph0: r(), wob: r() * 20, light: (r() - 0.5) * 0.1, hue: (r() - 0.5) * 0.02, tint: o.tint || null, tintAmt: o.tintAmt || 0
    };
    this.list.push(a); return this.list.length - 1;
  };
  KB.Ants.prototype.setColors = function (hex) {
    const base = KB.lin(hex); const c = new THREE.Color();
    this.list.forEach((a, i) => {
      c.copy(base); if (a.tint) c.lerp(KB.lin(a.tint), a.tintAmt); c.offsetHSL(a.hue, 0, a.light * 0.25);
      for (let k = 0; k < SPH; k++) this.sph.setColorAt(i * SPH + k, c);
      for (let k = 0; k < CYL; k++) this.cyl.setColorAt(i * CYL + k, c);
    });
    if (this.sph.instanceColor) this.sph.instanceColor.needsUpdate = true;
    if (this.cyl.instanceColor) this.cyl.instanceColor.needsUpdate = true;
  };
  KB.Ants.prototype.hide = function (i) {
    for (let k = 0; k < SPH; k++) this.sph.setMatrixAt(i * SPH + k, _Z);
    for (let k = 0; k < CYL; k++) this.cyl.setMatrixAt(i * CYL + k, _Z);
    this.blob.setMatrixAt(i, _Z);
  };
  KB.Ants.prototype.seg = function (idx, A, Bp, r) {
    _v.subVectors(Bp, A); const len = _v.length();
    if (len < 1e-5) { this.cyl.setMatrixAt(idx, _Z); return; }
    _q.setFromUnitVectors(Y, _v.multiplyScalar(1 / len));
    _mid.addVectors(A, Bp).multiplyScalar(0.5); _s.set(r, len, r);
    _M.compose(_mid, _q, _s); this.cyl.setMatrixAt(idx, _M);
  };
  // P: punto del suelo bajo el cuerpo · F: hacia delante · U: normal del suelo
  // dist: distancia recorrida (mueve las patas) · o: { ground(x,z), lift, reach, headYaw, headPitch, chew, still, shuffle }
  KB.Ants.prototype.pose = function (i, P, F, U, dist, t, o) {
    o = o || NO; const A = this.list[i]; const sc = A.scale;
    _u.copy(U).normalize();
    _f.copy(F).addScaledVector(_u, -F.dot(_u)); if (_f.lengthSq() < 1e-8) _f.set(1, 0, 0); _f.normalize();
    _sd.crossVectors(_f, _u);
    _B.makeBasis(_f, _u, _sd).scale(_sc.set(sc, sc, sc)).setPosition(P);
    const toW = (x, y, z, out) => out.set(x, y, z).applyMatrix4(_B);
    const cyc = dist / (4 * STR);
    const bob = (o.still ? 0 : 0.012 * Math.sin((cyc + A.ph0) * Math.PI * 4)) + (o.lift || 0);
    let k = i * SPH;
    const part = (x, y, z, rx, ry, rz, pitch, yaw) => {
      _L.makeRotationFromEuler(_e.set(0, yaw || 0, pitch || 0, "YXZ")); _L.scale(_s.set(rx, ry, rz)); _L.setPosition(x, y + bob, z);
      _M.multiplyMatrices(_B, _L); this.sph.setMatrixAt(k++, _M);
    };
    const hs = A.head, gs = A.gaster;
    part(-0.36 - (gs - 1) * 0.1, 0.30, 0, 0.25 * gs, 0.175 * gs, 0.18 * gs, 0.28);
    part(-0.105, 0.255, 0, 0.055, 0.07, 0.05, 0);
    part(-0.01, 0.27, 0, 0.09, 0.075, 0.07, -0.1);
    part(0.115, 0.29, 0, 0.115, 0.085, 0.08, -0.18);
    const hx = 0.30 + (hs - 1) * 0.08, yaw = o.headYaw || 0;
    part(hx, 0.30, 0, 0.11 * hs, 0.095 * hs, 0.105 * hs, 0.22 + (o.headPitch || 0), yaw);

    let c = i * CYL;
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1;
      for (let l = 0; l < 3; l++) {
        const D = LEGS[l]; const grp = (D.g + side) % 2;
        let ph = (cyc + A.ph0 + grp * 0.5 + (o.shuffle || 0)) % 1; if (ph < 0) ph += 1;
        let off, lift = 0;
        if (o.still) off = 0;
        else if (ph < 0.5) off = STR - (ph / 0.5) * 2 * STR;
        else { const qq = (ph - 0.5) / 0.5; off = -STR + 2 * STR * KB.smooth(qq); lift = Math.sin(Math.PI * qq) * 0.065; }
        toW(D.hx, D.hy + bob, sgn * D.hz, _H);
        toW(D.hx + 0.015, D.hy - 0.055 + bob, sgn * (D.hz + 0.045), _Cx);
        toW(D.rx * A.spread + off, 0, sgn * D.rz * A.spread, _Ft);
        if (o.ground) _Ft.y = o.ground(_Ft.x, _Ft.z) + lift * sc; else _Ft.addScaledVector(_u, lift * sc);
        _An.copy(_Ft).addScaledVector(_u, 0.03 * sc);
        _pole.copy(_u).addScaledVector(_sd, sgn * 0.4);
        ik(_Cx, _An, D.a * sc * A.legLen, D.b * sc * A.legLen, _pole, _K);
        _T2.copy(_An).addScaledVector(_u, -0.03 * sc).addScaledVector(_sd, sgn * 0.06 * sc).addScaledVector(_f, (l === 0 ? 0.03 : l === 2 ? -0.03 : 0) * sc);
        this.seg(c++, _H, _Cx, 0.024 * sc);
        this.seg(c++, _Cx, _K, 0.019 * sc);
        this.seg(c++, _K, _An, 0.0135 * sc);
        this.seg(c++, _An, _T2, 0.009 * sc);
      }
    }
    const reach = o.reach || 0;
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1; const w = A.wob + sgn * 1.7;
      const e1 = 0.7 - reach * 0.5 + 0.13 * Math.sin(t * 2.3 + w);
      const a1 = sgn * (0.5 + 0.16 * Math.sin(t * 1.6 + w * 1.3)) * (1 - reach * 0.45) - yaw;
      const e2 = -0.3 - reach * 0.45 + 0.22 * Math.sin(t * 4.1 + w * 2.0);
      const a2 = sgn * (0.12 + 0.18 * Math.sin(t * 3.3 + w * 0.6)) - yaw * 0.9;
      const bx = hx + 0.07 * hs * Math.cos(yaw), bz = sgn * 0.045 * hs - 0.07 * hs * Math.sin(yaw);
      const L1 = 0.19 * A.ant, L2 = 0.27 * A.ant;
      const ex = bx + Math.cos(e1) * Math.cos(a1) * L1, ey = 0.345 + bob + Math.sin(e1) * L1, ez = bz + Math.cos(e1) * Math.sin(a1) * L1;
      toW(bx, 0.345 + bob, bz, _a); toW(ex, ey, ez, _b);
      this.seg(c++, _a, _b, 0.011 * sc);
      toW(ex + Math.cos(e2) * Math.cos(a2) * L2, ey + Math.sin(e2) * L2, ez + Math.cos(e2) * Math.sin(a2) * L2, _H);
      this.seg(c++, _b, _H, 0.0085 * sc);
    }
    const ch = o.chew || 0, md = A.mand;
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1;
      toW(hx + 0.09 * hs, 0.275 + bob, sgn * 0.035 * hs, _a);
      toW(hx + 0.09 * hs + 0.08 * md, 0.258 + bob, sgn * (0.008 + 0.03 * ch) * md, _b);
      this.seg(c++, _a, _b, 0.014 * sc * md);
    }
    _L.makeScale(1.05, 1, 0.62); _L.setPosition(-0.06, 0.012, 0);
    _M.multiplyMatrices(_B, _L); this.blob.setMatrixAt(i, _M);
  };
  KB.Ants.prototype.commit = function () {
    this.sph.instanceMatrix.needsUpdate = true; this.cyl.instanceMatrix.needsUpdate = true; this.blob.instanceMatrix.needsUpdate = true;
  };

  // ---------- Hoja (forma, piezas y textura) ----------
  KB.leafHalfW = (u) => { const t = (u + 1) / 2; return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.85))), 0.9) * 0.5; };
  KB.leafGeo = (len, wid, u0, u1) => {
    const sh = new THREE.Shape(); const N = 14;
    for (let i = 0; i <= N; i++) { const u = u0 + (u1 - u0) * i / N; const x = u * len / 2, y = KB.leafHalfW(u) * wid; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
    for (let i = N; i >= 0; i--) { const u = u0 + (u1 - u0) * i / N; sh.lineTo(u * len / 2, -KB.leafHalfW(u) * wid * 0.96); }
    const g = new THREE.ShapeGeometry(sh);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / len + 0.5, p.getY(i) / wid + 0.5);
    return g;
  };
  KB.leafTex = (base, vein) => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, 512, 256);
    const r = KB.rng(4);
    for (let i = 0; i < 900; i++) { g.fillStyle = "rgba(0,0,0," + (r() * 0.05) + ")"; g.fillRect(r() * 512, r() * 256, 2 + r() * 6, 2 + r() * 6); }
    g.strokeStyle = vein; g.lineCap = "round";
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
    g.lineWidth = 2;
    for (let i = 1; i < 9; i++) {
      const x = i * 56;
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + 24, 90, x + 60, 30); g.stroke();
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + 24, 166, x + 60, 226); g.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  };

  return KB;
})();
