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

## Pendiente — P1 (soporte al método)

- [ ] `kb-onboarding-msg` — `kb init` imprime una explicación corta de los 3
  roles de IA y de cómo funciona `TASKS.md` para quien se instala Kebel

## Pendiente — P2 (pulido)

- [ ] `kb-npm-publish` — Publicar `kebel` en npm + guía de instalación real
- [ ] `hu_plan-20260818103052-bwhw_019` — Landing page de Kebel: qué es y cómo
  instalarlo (colores de daniel.fosela.com y el diseño visual se deciden al llegar a la tarea; depende
  de `kb-npm-publish` para tener una instalación real que documentar)
- [ ] `kb-own-ci` — CI propio de Kebel, separado del meta-tooling de `kj`
- [ ] `kb-project-context` — Un `PROJECT.md` (o similar) con la importancia y
  el contexto del proyecto en el que se usa Kebel, auto-mantenido a medida
  que se trabaja (formato y momento de actualización a decidir vía ADR)

## Cola del usuario

_(vacía — añade aquí lo que quieras encolar)_
