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

  return KB;
})();
