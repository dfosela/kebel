# Kebel — landing

Landing page de Kebel: intro animada en three.js (hormigas que montan el
logo "KEBEL") + web informativa. Vive en `apps/landing/` dentro del repo
de Kebel como HTML/CSS/JS plano, sin build ni frameworks — ni Next.js, ni
React, ni TypeScript. No se publica junto al CLI (`"files"` en el
`package.json` raíz no la incluye).

## Desarrollo

Sirve los archivos estáticos con cualquier servidor local, por ejemplo:

```sh
cd apps/landing
python -m http.server 4000
```

y abre `http://localhost:4000`.

## Estructura

- `index.html` — estructura y contenido (navbar, hero, secciones, footer).
- `style.css` — estilos, variables CSS de color/tipografía y responsive.
- `script.js` — la escena three.js (hormigas, letras, física del ratón,
  reduced-motion, fallback sin WebGL) y la interacción de la página
  (copiar comando de instalación, etc.).

## Paleta

Exactamente la de [daniel.fosela.com](https://daniel.fosela.com) — valores
en `style.css` (`:root`), con soporte de modo oscuro vía
`prefers-color-scheme` / `[data-theme]`.

## Pendiente

- Confirmar la tipografía real del portfolio (actualmente Bricolage
  Grotesque + Instrument Sans + JetBrains Mono, a revisar).
- Rellenar los iconos placeholder de la sección "por qué" con SVGs reales.
