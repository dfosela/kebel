# Tareas de Kebel

Lista de trabajo del proyecto, sincronizada con el board de Karajan (`kj hu list`)
mientras se hace dogfooding de Kebel con `kj`. Cada `id` entre backticks es el id
de la card en el board (`kj hu list` / `kj board`).

**Cómo la mantengo:** cada vez que empiezo, termino o creo una tarea nueva,
actualizo este archivo en el mismo commit/PR que el trabajo correspondiente
(pasa de "Pendiente" a "Hecho", o se añade una línea nueva en la sección que
toque). Además, cada vez que termino una tarea reviso la sección "Cola del
usuario": si hay algo nuevo, lo convierto en card(s) real(es) y lo coloco en
la sección de prioridad que corresponda, para que quede listo para hacerse.

**Cómo añades tú tareas a la cola:** escribe una línea nueva bajo
"Cola del usuario" (formato libre, no hace falta id). Cuando la recoja, creo
la card real en el board (`kj hu add`) y la muevo a la sección de prioridad
que corresponda.

## Hecho

- [x] `activate-karajan` — Activar el método Karajan (v4) en este proyecto
- [x] `kebel-setup` — Setup inicial: estructura, roles de agentes, detección de Squeezr
- [x] `kb-cli-skeleton` — `kb --version` / `kb --help`
- [x] `kb-squeezr-setup` — `kb setup`: detección y auto-instalación de Squeezr por defecto
- [x] `kb-provider-strategy` — ADR: CLIs instaladas vs API directa
- [x] `kb-init` — `kb init`: detección de proveedores + asignación de roles + Squeezr
- [x] `kb-review-engine` — `kb review --staged`: motor de revisión cruzada real
- [x] `kb-git-gate` — Gate de git real: bloquear commit sin veredicto válido y con hash del diff intacto
- [x] `kb-branch-first` — Bloquear commits directos en la rama base
- [x] `kb-tdd-check` — Chequeo TDD-first mínimo viable (tests junto al código)
- [x] `kb-security-nonoverridable` — Hallazgos de seguridad no overrideables por Solomon
- [x] `kb-solomon` — `kb solomon`: arbitraje de terceros
- [x] `kb-adr-cmd` — `kb adr add/list`
- [x] `kb-card-cmd` — `kb card add/list/move` (tracking plano en CLI, sin
  servidor; cubre también tener visible qué tarea está en curso y en qué
  orden van las demás, y poder encolar/quitar tareas)
- [x] `kb-doctor` — `kb doctor`: diagnóstico del setup (incluye comprobar que
  el user está logado en los 3 proveedores de IA asignados, no solo que el
  CLI esté instalado)
- [x] `kb-init-scaffold` — `kb init` crea `AGENTS.md`/`CLAUDE.md` (si no
  existen ya) con los roles y convenciones del proyecto, y detecta cada
  proveedor por login real, no solo por binario instalado (se descartó el
  fallback automático a Claude: siempre colisiona con `coder`, que ya es
  Claude cuando está disponible — ver `kb-human-review-fallback` para el
  caso de tener solo un proveedor)
- [x] `kb-human-review-fallback` — `kb review --staged`: si no hay un segundo
  proveedor de IA logado, corre los tests del proyecto (rechaza directo si
  fallan, sin preguntar), pide un resumen en lenguaje llano al coder y
  pregunta al usuario si aprueba (veredicto `reviewer: "human"`) en vez de
  bloquear sin alternativa
- [x] `kb-onboarding-msg` — `kb init` imprime una explicación corta de los 3
  roles de IA y de los comandos básicos (`kb review`, `kb card`, `kb adr`,
  `kb doctor`) para quien se instala Kebel
- [x] `kb-versioning` — Versionado semántico (`package.json`) + `CHANGELOG.md`,
  para ver el progreso en cambios grandes y pequeños

## Pendiente — P1 (soporte al método)

_(vacía — todo el bloque de soporte al método está completo)_

## Pendiente — P2 (pulido)

- [ ] `hu_plan-20260818103052-bwhw_019` — Landing page de Kebel (va antes de
  `kb-npm-publish` — no queremos que nadie pueda instalarlo hasta que todo
  esté listo, y publicar en npm lo hace instalable al instante, con web o
  sin ella). Spec completa: intro animada en three.js (hormigas que montan
  el logo "KEBEL") + web informativa con el estilo de daniel.fosela.com.
  Decisiones ya tomadas:
  - Repo: dentro de este mismo (`apps/landing/`), como hace Karajan en su
    propio repo — proyecto Next.js (App Router) + TypeScript aislado, con
    su propio `package.json`, excluido del `"files"` que se publica a npm.
  - Paleta: exactamente la de daniel.fosela.com (valores reales ya en
    `apps/landing/app/globals.css`). Tipografía real todavía pendiente de
    confirmar (marcador de posición `system-ui` mientras tanto).
  - Rigor: tests reales para la lógica pura y testeable (generación de la
    curva/ruido del camino de las hormigas, jitter aleatorio de las letras,
    detección de `reduced-motion`, escalado responsive); QA visual manual
    para lo estético (geometría/aspecto de las hormigas, sensación del
    rebote, etc.) — eso no es testeable de forma significativa con TDD.
  - Orden de construcción por fases, cada una su propio PR:
    1. [x] Scaffold del proyecto Next.js + paleta extraída.
    2. Geometría y movimiento de las hormigas (curva + ruido, con tests) —
       en curso: camino ondulado (`lib/ants/path.ts`) ya hecho y testeado;
       falta la geometría de la hormiga y la animación de las patas.
    3. Coreografía de las letras K-E-B-E-L (recogida/transporte/depósito).
    4. Loop infinito + `prefers-reduced-motion` + presupuesto de rendimiento
       (DPR, pausa fuera de viewport, menos hormigas en móvil, botón
       "saltar intro").
    5. Parte 2 (web informativa): navbar, qué es, cómo funciona,
       características, stack, CTA final, footer — una sección por commit.
    6. Pulido final + README de la carpeta `apps/landing/`.
- [ ] `kb-npm-publish` — Publicar `kebel` en npm + guía de instalación real
  (último paso, cuando la landing ya esté lista)
- [ ] `kb-own-ci` — CI propio de Kebel, separado del meta-tooling de `kj`
- [ ] `kb-project-context` — Un `PROJECT.md` (o similar) con la importancia y
  el contexto del proyecto en el que se usa Kebel, auto-mantenido a medida
  que se trabaja (formato y momento de actualización a decidir vía ADR)
- [ ] `kb-public-release` — Última tarea: dejar el repo listo para hacerlo
  público en GitHub y enlazarlo en el portfolio — ocultar/excluir (vía
  `.gitignore` o equivalente) cualquier artefacto que delate que se construyó
  con Karajan (`.karajan/`, referencias internas, etc.)

## Cola del usuario

_(vacía — añade aquí lo que quieras encolar)_
