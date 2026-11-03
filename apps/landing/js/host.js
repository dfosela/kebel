/* ============================================================
   Kebel · Intro: elige entre la versión 2D y la 3D
   ============================================================ */
(function () {
  "use strict";
  const hero = document.getElementById("hero");
  const fade = document.getElementById("fade");
  const how = document.getElementById("howBtn");
  const skip = document.getElementById("skip");
  const btns = Array.from(document.querySelectorAll("[data-mode]"));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fromCine = location.hash === "#desde-cinematica";
  if (fromCine) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* vista previa sin historial */ } }

  const factories = { "2d": window.KebelIntro2D, "3d": window.KebelIntro3D };
  const mods = {}, failed = {};
  let mode = "3d", leaving = false, first = true;
  try { const saved = localStorage.getItem("kebel-modo"); if (saved === "2d" || saved === "3d") mode = saved; } catch (e) { /* sin almacenamiento */ }

  const host = {
    reveal(m) { if (m === mode) hero.classList.add("is-revealed"); },
    // si una versión falla en este equipo, se pasa a la otra sin romper la página
    crash(m) {
      failed[m] = true;
      if (mods[m]) { try { mods[m].deactivate(); } catch (e) { /* ya estaba parada */ } delete mods[m]; }
      btns.forEach((b) => { if (b.dataset.mode === m) b.disabled = true; });
      if (m === mode && !failed[m === "3d" ? "2d" : "3d"]) setTimeout(() => setMode(m === "3d" ? "2d" : "3d"), 0);
    }
  };

  function get(m) {
    if (mods[m] || failed[m]) return mods[m] || null;
    let mod = null;
    try { mod = factories[m] ? factories[m](host, { fromCine: fromCine && first }) : null; }
    catch (err) { console.error("[Kebel " + m.toUpperCase() + "] No se pudo iniciar:", err); mod = null; }
    first = false;
    if (mod) mods[m] = mod; else failed[m] = true;
    return mod;
  }
  function setMode(m, save) {
    if (leaving) return;
    if (mods[mode] && mode !== m) mods[mode].deactivate();
    mode = m;
    btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    hero.dataset.mode = m;
    const mod = get(m);
    if (!mod) {
      if (m === "3d" && !failed["2d"]) { btns.forEach((b) => { if (b.dataset.mode === "3d") b.disabled = true; }); setMode("2d"); return; }
      hero.classList.add("no-gl", "is-revealed"); return;
    }
    hero.classList.toggle("is-revealed", mod.isRevealed());
    try { mod.activate(); } catch (err) { console.error("[Kebel " + m.toUpperCase() + "] Error al arrancar:", err); host.crash(m); return; }
    if (save) { try { localStorage.setItem("kebel-modo", m); } catch (e) { /* sin almacenamiento */ } }
  }

  btns.forEach((b) => b.addEventListener("click", () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode, true); }));
  skip.addEventListener("click", () => { if (mods[mode]) mods[mode].skip(); });
  window.addEventListener("keydown", (e) => {
    if (!hero.classList.contains("is-revealed") && (e.key === "Escape" || e.key === "Enter") && mods[mode]) mods[mode].skip();
  });
  how.addEventListener("click", (e) => {
    e.preventDefault(); if (leaving) return; leaving = true;
    const url = how.getAttribute("href");
    hero.classList.add("is-leaving");
    fade.classList.remove("light");
    if (mode === "3d" && mods["3d"] && !reduce) { mods["3d"].fly(url); return; }
    if (reduce) { location.href = url; return; }
    fade.classList.add("on"); setTimeout(() => { location.href = url; }, 520);
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) { leaving = false; hero.classList.remove("is-leaving"); fade.classList.remove("on"); }
  });

  // Vuelta desde la cinemática: entras desde la luz de fuera
  if (fromCine) {
    fade.classList.add("light", "on", "instant");
    requestAnimationFrame(() => { fade.classList.remove("instant"); requestAnimationFrame(() => fade.classList.remove("on")); });
  }
  setMode(mode);

  window.KebelIntro = { setMode: (m) => setMode(m, true), mode: () => mode, current: () => mods[mode], skip: () => mods[mode] && mods[mode].skip() };
})();
