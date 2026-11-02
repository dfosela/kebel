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
})();
