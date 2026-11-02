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

  return KB;
})();
