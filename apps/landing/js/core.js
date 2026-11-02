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

  return KB;
})();
