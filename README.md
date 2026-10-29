# Kebel

Kebel es una versión **lite** de [Karajan Code](https://karajancode.com):
un orquestador multiagente para desarrollo con IA pensado para quien **no**
tiene suscripciones grandes (Claude Max, ChatGPT Pro...) y necesita ahorrar
tokens al máximo, sin renunciar a las garantías del método Karajan.

Kebel no es un fork de Karajan ni compite con él: es un proyecto nuevo,
inspirado en su filosofía y construido *con* Karajan (dogfooding), con un
subconjunto reducido de funcionalidad y foco explícito en eficiencia de
tokens.

## Lo que Kebel NO recorta

Aunque el alcance es reducido, el método no se recorta:

- **TDD-first estricto** — ningún código de producción sin un test que falle
  primero; la suite nunca se deja en rojo entre commits.
- **Revisión cruzada obligatoria en cada commit** — un modelo distinto al que
  escribió el código lo revisa antes de entrar (`kj review --staged` en este
  repo mientras se construye Kebel; el propio Kebel exigirá el equivalente).
  Si solo hay una IA logada, `kb review --staged` nunca la hace revisarse a
  sí misma: corre los tests del proyecto (rechaza directo si fallan) y pide
  la aprobación explícita del usuario, con un resumen del diff en lenguaje
  llano generado por esa misma IA — el veredicto queda marcado como
  `reviewer: "human"`, nunca disfrazado de revisión por IA.
- **Hallazgos de seguridad no overrideables**, ni siquiera en arbitraje.
- **Branch-first** — la rama base solo se mueve vía PR.
- **Gate de git real** — sin veredicto de revisión válido y con el hash del
  diff intacto, el commit se rechaza.

Ver `.karajan/adrs/` para las decisiones de arquitectura registradas.

## Lo que Kebel SÍ recorta (filosofía lite)

Karajan tiene piezas pensadas para equipos/proyectos grandes que Kebel
deliberadamente **no** replica, porque el público de Kebel no las necesita
y cada una cuesta tokens, infraestructura o fricción de setup:

- **Sin servidor ni dashboard** — las cards de Kebel viven en un `.kebel/cards.json`
  plano (`kb card add/list/move`), no en un board compartido con backend.
- **Sin RAG semántico ni base vectorial** — nada equivalente a `kj rag index/query`;
  Kebel no indexa el repo, confía en que el modelo lea el código directamente.
- **Sin Sonar/Semgrep/OSV-Scanner por defecto** — ni Docker como dependencia
  implícita del flujo de revisión; la revisión cruzada (`kb review --staged`)
  es la capa de calidad, no un análisis estático adicional.
- **Sin policy-as-code ni gobierno con firma móvil** — un solo archivo de
  config por proyecto (`.kebel/kebel.config.json`), sin excepciones temporales
  que haya que auditar.
- **Sin lanes/worktrees aislados** — se trabaja rama a rama en el checkout
  normal; no hay `kj worktree start/done` equivalente.
- **Sin roles adicionales** (planner, researcher, tester, security, triage...)
  — solo los tres imprescindibles para la revisión cruzada: coder, reviewer,
  solomon.

Si al construir una tarea de Kebel la implementación natural se parece a
alguna de estas piezas de Karajan, es una señal de que se está sobre-construyendo:
hay que decirlo y simplificar antes de escribir código.

## Uso

```sh
node bin/kb.js --version
node bin/kb.js --help
node bin/kb.js setup
```

(Aún no publicado en npm — en desarrollo activo.)

## Versionado

Semántico (`MAJOR.MINOR.PATCH`): MAJOR si algo rompe compatibilidad (formato
de `.kebel/kebel.config.json`, flags de `kb`...), MINOR cuando se completa
una tarea/feature nueva de `TASKS.md`, PATCH para fixes sin funcionalidad
nueva. Historial completo en [`CHANGELOG.md`](CHANGELOG.md).

## Squeezr, integrado por defecto

[Squeezr](https://www.squeezr.es/) es un proxy local que comprime el
contexto de las llamadas a los agentes (system prompt, diffs, salidas de
test...) para ahorrar tokens, sin cambiar el flujo de trabajo.

Kebel trata Squeezr como una **dependencia externa** — no reimplementa su
lógica de compresión — pero su instalación **no es opcional ni un add-on**:
`kb setup` lo detecta, lo instala (`npm i -g squeezr-ai`) y lo configura como
proxy por defecto automáticamente, sin pedir confirmación adicional más allá
de la que ya implica instalar Kebel. Si algún paso falla (permisos, red, SO
no soportado), `kb setup` avisa con el motivo exacto y las instrucciones
manuales de [squeezr.es/docs/installation](https://www.squeezr.es/docs/installation)
— dejando claro que sin Squeezr el consumo de tokens será mayor, pero sin
bloquear el resto del setup.

## Roles cross-AI de este repo (dogfooding)

Mientras se construye Kebel con Karajan, los roles están fijos y son tres
familias de modelo distintas:

- **brain/coder → Claude** — escribe el código, TDD first.
- **reviewer → Antigravity (Gemini)** — revisa cada diff, nunca el suyo propio.
- **solomon → Codex** — arbitra solo cuando el brain discrepa de un rechazo
  del reviewer (`kb solomon`); su veredicto se obedece salvo en hallazgos de
  seguridad, que nunca son overrideables.

Detalle completo en `.karajan/adrs/0001-*.md`.

## Estado (MVP v1)

Dentro: CLI (`kb`), setup con Squeezr por defecto, gate de git real,
TDD-first, revisión cruzada, ADRs ligeras en markdown.

Fuera de v1 (a evaluar más adelante): RAG semántico (kaRAGan), watch
cross-repo (kaWATCHan), dashboard de tareas tipo Linear/Jira, integración
SonarQube/Semgrep/OSV-Scanner por defecto.
