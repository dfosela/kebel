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

- `index.html` — página principal (navbar con selector 2D/3D, hero con la
  intro animada, secciones, footer).
- `como-funciona.html` — animación explicativa aparte ("cómo funciona"):
  corte transversal del hormiguero, se reproduce sola y vuelve a la intro.
- `style.css` — estilos y variables CSS compartidas (color/tipografía,
  responsive, paleta de tierra/piedra para las escenas 3D).
- `css/cinematica.css` — layout propio de `como-funciona.html` (los
  colores salen de `style.css`).
- `js/core.js` — utilidades 3D compartidas por la intro y la cinemática
  (ruido, texturas generadas, postproceso de profundidad de campo,
  hormigas articuladas, geometría de la hoja).
- `js/intro2d.js` / `js/intro3d.js` — las dos versiones de la intro
  (cenital plana / macro con profundidad real), cada una una fábrica
  independiente que `js/host.js` activa según el modo elegido.
- `js/host.js` — decide qué versión de la intro mostrar, el selector
  2D/3D, "saltar intro" y la navegación hacia/desde `como-funciona.html`.
- `js/cine.js` — la coreografía de `como-funciona.html`.
- `js/copy-command.js` — copiar el comando de instalación al portapapeles
  (independiente de las escenas 3D).

## Paleta

Exactamente la de [daniel.fosela.com](https://daniel.fosela.com) — valores
en `style.css` (`:root`), con soporte de modo oscuro vía
`prefers-color-scheme` / `[data-theme]`.

## Pendiente

- Confirmar la tipografía real del portfolio (actualmente Bricolage
  Grotesque + Instrument Sans + JetBrains Mono, a revisar).
- Rellenar los iconos placeholder de la sección "por qué" con SVGs reales.
